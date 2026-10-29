"""Read-side intelligence: risk with reasons, expected decision dates, case briefs, performance,
dashboard, process map, simulator, forecast, service status, lookalike names, inspection weights and
duplicate faculty. Where the browser already shows a number, these use the same formula so they agree.
"""
import math

import time
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit, rules
from ..config import settings, today
from ..models import Application, ApplicationType, Document, EvcPanel, Faculty, Institution, KeyValue, Obligation, Region, StatusCheck, UnapprovedInstitution

STEP_DAYS = {"Self-disclosure": 10, "Scrutiny": 15, "Re-scrutiny": 10, "EVC": 30, "SHC": 15, "Executive Committee": 10, "SAC appeal": 7}
STAGE_TO_STEP = {"submitted": "Submitted", "scrutiny": "Scrutiny", "rescrutiny": "Re-scrutiny", "evc": "EVC", "shc": "SHC", "ec": "Executive Committee", "decision": "Decision", "appeal": "SAC appeal"}


# ---------------------------------------------------------------- risk with reasons
def risk_model(app: Application, queue_len: int, target_days: int, panel_drawn: bool) -> tuple[float, list[dict]]:
    """A transparent additive (logistic) model. Each contribution is exactly the factor's share of the
    score, which is what SHAP reports for a linear model, so the reasons are faithful, not decorative.
    Swap in a Random Survival Forest with TreeSHAP once a few cycles of real history exist."""
    if app.stage == "decision":
        return 0.0, []
    in_stage = max(0, (today() - app.stage_entered_on).days)
    factors = [
        ("Days already spent in this stage", 1.1 * min(2.0, in_stage / max(1, target_days)) - 0.4),
        ("Expert visit still to schedule", 0.45 if app.stage == "evc" and not panel_drawn else 0.0),
        ("Regional queue length", 0.4 * min(2.0, queue_len / 10) - 0.2),
        ("Deficiencies raised so far", 0.5 * app.deficiencies),
        ("Deadline already missed", 0.9 if app.clock == "breached" else 0.0),
        ("Clock paused while the institution replies", -0.6 if app.clock == "paused" else 0.0),
    ]
    score = -0.9 + sum(v for _, v in factors)
    risk = 1 / (1 + math.exp(-score))
    reasons = [{"factor": f, "impact": round(v, 2)} for f, v in sorted(factors, key=lambda x: -abs(x[1])) if abs(v) >= 0.05][:4]
    return risk, reasons


async def refresh_risk(session: AsyncSession, app: Application) -> None:
    queue = (await session.execute(select(func.count()).select_from(Application).where(Application.region == app.region, Application.stage == app.stage))).scalar_one()
    panel = (await session.execute(select(func.count()).select_from(EvcPanel).where(EvcPanel.application_id == app.id, EvcPanel.randomness.is_not(None)))).scalar_one()
    target = rules.DEFAULT_TARGETS.get(app.stage, 15)
    app.risk, app.risk_reasons = risk_model(app, queue, target, panel > 0)


# ---------------------------------------------------------------- paths and expected decision
def path_for(app: Application, table: dict) -> list[str]:
    return ["Submitted", *rules.evaluate_path(table, **rules.facts_of(app)), "Decision"]


def current_index(app: Application, path: list[str]) -> int:
    if app.stage == "decision":
        return len(path) - 1
    step = STAGE_TO_STEP[app.stage]
    return path.index(step) if step in path else (0 if app.stage == "submitted" else 1)


def eta(app: Application, table: dict) -> dict | None:
    """Like a parcel's delivery window: the current stage's end plus the target of every stage ahead,
    widened by the file's delay risk. Same formula as the tracker in the browser."""
    if app.stage == "decision":
        return None
    path = path_for(app, table)
    ahead = sum(STEP_DAYS.get(p, 10) for p in path[current_index(app, path) + 1 : -1])
    t = today()
    stage_end = t + timedelta(days=7) if app.clock == "paused" else (t + timedelta(days=5) if app.due_on < t else app.due_on)
    likely = stage_end + timedelta(days=ahead)
    return {"likely": likely, "early": likely - timedelta(days=4), "late": likely + timedelta(days=5 + round(app.risk * 20)), "start": app.submitted_on}


# ---------------------------------------------------------------- case brief
def brief(app: Application, inst: Institution, t: ApplicationType) -> dict:
    days = (app.due_on - today()).days
    lines = [{"text": f"{inst.name.split(',')[0]} asks for: {t.name.lower()} ({t.clause}).", "source": "Application"}]
    if app.stage == "decision":
        lines.append({"text": f"Decided on {app.stage_entered_on:%d %b %Y}: {app.outcome}.", "source": "Fair clock"})
    else:
        clock = "The clock is paused while the institution replies." if app.clock == "paused" else (f"Due in {days} days ({app.due_on:%d %b %Y})." if days >= 0 else f"{-days} days past the deadline; already escalated.")
        lines.append({"text": f"Now at {STAGE_TO_STEP[app.stage]}. {clock}", "source": "Fair clock", "tone": "warn" if app.clock == "breached" else None})
    lines.append({"text": f"{app.deficiencies} deficiency raised; re-scrutiny may look only at it (APH 1.8(g)).", "source": "Scrutiny record", "tone": "warn"} if app.deficiencies else {"text": "No deficiency raised so far.", "source": "Scrutiny record", "tone": "ok"})
    if app.risk_reasons:
        top = max(app.risk_reasons, key=lambda r: r["impact"])
        lines.append({"text": f"Delay risk {round(app.risk * 100)}%, mainly: {top['factor'].lower()}.", "source": "Risk model", "tone": "warn" if app.risk >= 0.5 else None})
    if inst.lease_end:
        runway = (inst.lease_end - today()).days / 365.25 - inst.longest_course_years
        lines.append({"text": f"Leased land with {runway:.1f} years of lease runway (APH 2.1(e)).", "source": "Lease record", "tone": "warn" if runway < 3 else "ok"})
    nxt = (
        "Nothing pending. Watch the 7-day appeal window." if app.stage == "decision"
        else "Act today: forward with your notes, or send back with a reason." if app.clock == "breached"
        else "Nothing to do until the institution replies; a reminder goes automatically." if app.clock == "paused"
        else "Commit and draw the expert panel on the EVC page." if app.stage == "evc"
        else "Check the AI findings in Documents, then forward or send back."
    )
    return {"lines": lines, "next": nxt}


# ---------------------------------------------------------------- what changed since the last submission
async def diff(session: AsyncSession, app: Application, t: ApplicationType) -> dict:
    docs = list((await session.execute(select(Document).where(Document.application_id == app.id).order_by(Document.uploaded_at))).scalars())
    by_kind: dict[str, list[Document]] = defaultdict(list)
    for d in docs:
        by_kind[d.doc_kind].append(d)
    changed = [
        {"docKind": k, "name": next((x["name"] for x in t.documents if x["id"] == k), k), "before": {"sha256": v[-2].sha256, "filename": v[-2].filename}, "after": {"sha256": v[-1].sha256, "filename": v[-1].filename, "signed": v[-1].signed}}
        for k, v in by_kind.items() if len(v) > 1
    ]
    return {"changed": changed, "unchanged": max(0, len(t.documents) - len(changed)), "scope": "APH 1.8(g): re-scrutiny looks only at the raised deficiencies."}


# ---------------------------------------------------------------- performance and dashboard
def median(xs: list[int]) -> int:
    if not xs:
        return 0
    s = sorted(xs)
    m = len(s) // 2
    return s[m] if len(s) % 2 else math.floor((s[m - 1] + s[m]) / 2 + 0.5)  # half up, like JavaScript Math.round


def summarise(apps: list[Application], targets: dict[str, int]) -> dict:
    decided = [a for a in apps if a.stage == "decision"]
    open_ = [a for a in apps if a.stage != "decision"]
    days = [(a.stage_entered_on - a.submitted_on).days for a in decided]
    on_time = sum(1 for a in decided if (a.stage_entered_on - a.submitted_on).days <= targets.get(a.type_id, 60))
    return {
        "total": len(apps), "decided": len(decided), "open": len(open_), "missed": sum(1 for a in open_ if a.clock == "breached"),
        "medianDays": median(days), "onTimePct": round(on_time / len(decided) * 100) if decided else 0,
    }


async def performance(session: AsyncSession) -> dict:
    apps = list((await session.execute(select(Application))).scalars())
    targets = dict((await session.execute(select(ApplicationType.id, ApplicationType.target_days))).all())
    regions = list((await session.execute(select(Region))).scalars())
    by_region = []
    for r in regions:
        s = summarise([a for a in apps if a.region == r.id], targets)
        if s["total"]:
            by_region.append({"id": r.id, "name": r.name, "office": r.office, **s})
    by_region.sort(key=lambda x: -x["onTimePct"])
    stages = []
    for s in ("scrutiny", "rescrutiny", "evc", "shc", "ec", "appeal"):
        files = [a for a in apps if a.stage == s]
        late = sum(1 for a in files if a.clock == "breached")
        stages.append({"stage": STAGE_TO_STEP[s], "onTime": len(files) - late, "late": late})
    outcomes = [{"o": o, "n": sum(1 for a in apps if a.outcome == o)} for o in ("EoA", "LoA", "LoD", "LoR")]
    return {"generatedAt": datetime.now().isoformat(timespec="seconds"), "cycle": "2027-28", "licence": "Government Open Data License - India", "national": summarise(apps, targets), "regions": by_region, "stages": stages, "outcomes": outcomes}


async def dashboard(session: AsyncSession, region: str | None) -> dict:
    q = select(Application)
    if region:
        q = q.where(Application.region == region)
    apps = list((await session.execute(q)).scalars())
    open_ = [a for a in apps if a.stage != "decision"]
    regions = [r for r in (await session.execute(select(Region))).scalars() if not region or r.id == region]
    targets = dict((await session.execute(select(ApplicationType.id, ApplicationType.target_days))).all())
    buckets = [("0–7 days", 0, 7), ("8–15 days", 8, 15), ("16–30 days", 16, 30), ("31–45 days", 31, 45), ("Over 45 days", 46, 9999)]
    t = today()
    return {
        "pending": len(open_), "atRisk": sum(1 for a in open_ if a.risk >= 0.5), "breached": sum(1 for a in open_ if a.clock == "breached"),
        "paused": sum(1 for a in open_ if a.clock == "paused"), "decided": len(apps) - len(open_),
        "onTimeRate": summarise(apps, targets)["onTimePct"] / 100,
        "byRegionStage": [{"region": r.id, **{s: sum(1 for a in open_ if a.region == r.id and a.stage == s) for s in ("scrutiny", "rescrutiny", "evc", "shc", "ec")}} for r in regions],
        "ageing": [{"bucket": b, "count": sum(1 for a in open_ if lo <= (t - a.submitted_on).days <= hi)} for b, lo, hi in buckets],
    }


# ---------------------------------------------------------------- process map
async def mining(session: AsyncSession) -> dict:
    """Historical process map (where files waited last cycle) with today's live occupancy laid over it."""
    base = (await session.get(KeyValue, "mining")).value
    waits: dict[str, list[int]] = defaultdict(list)
    for stage, entered in (await session.execute(select(Application.stage, Application.stage_entered_on).where(Application.stage != "decision"))).all():
        waits[stage].append((today() - entered).days)
    live = {stage: {"files": len(v), "avgDaysInStage": round(sum(v) / len(v), 1)} for stage, v in waits.items()}
    return {**base, "live": live}


# ---------------------------------------------------------------- simulator (digital twin)
def simulate(extra_officers_bottleneck: int = 0, extra_experts: int = 0, volume_change: float = 0, calendar_shift_days: int = 0) -> dict:
    """Fluid queue model, identical to the browser's. Replace with a SimPy discrete-event model
    calibrated from the mined event log when real history is available."""
    start = date(2026, 10, 22)
    weeks_n, window_weeks = 30, 6
    arrivals = 110 * (1 + volume_change)
    cap_b = 22 + extra_officers_bottleneck * 3.2 + extra_experts * 0.5
    cap_o = 70 + extra_experts * 0.9
    b, o, sum_b, sum_o, weeks = 150.0, 260.0, 0.0, 0.0, []
    for w in range(weeks_n):
        a = arrivals if w < window_weeks else 0
        b = max(0.0, b + a * 0.3 - cap_b)
        o = max(0.0, o + a * 0.7 - cap_o)
        sum_b, sum_o = sum_b + b, sum_o + o
        d = start + timedelta(days=(w + 1) * 7)
        weeks.append({"week": f"{d.day} {d:%b}", "bottleneck": round(b), "others": round(o), "total": round(b + o)})
    w_b = max(1, (sum_b / weeks_n) / cap_b * 7 + 9)
    w_o = max(1, (sum_o / weeks_n) / cap_o * 7 + 9)
    limit = 60 + calendar_shift_days
    p_b, p_o = 1 - math.exp(-limit / w_b), 1 - math.exp(-limit / w_o)
    deadline_week = round(((date(2027, 4, 30) - start).days) / 7 + calendar_shift_days / 7)
    return {"weeks": weeks, "onTime": 0.3 * p_b + 0.7 * p_o, "avgDays": 0.3 * w_b + 0.7 * w_o + 12, "peak": max(x["total"] for x in weeks), "deadlineWeek": deadline_week}


# ---------------------------------------------------------------- deadline-rush forecast
async def forecast(session: AsyncSession) -> dict:
    start, end = date(2026, 10, 1), date(2026, 11, 30)
    days = (end - start).days + 1
    actual = Counter(d for (d,) in (await session.execute(select(Application.submitted_on).where(Application.submitted_on >= start))).all())
    rows = []
    for i in range(days):
        d = start + timedelta(days=i)
        left = days - 1 - i
        expected = round(14 + i * 0.35 + 300 * math.exp(-left / 3.2))
        rows.append({"date": d, "expected": expected, "submitted": actual.get(d, 0) if d <= today() else None})
    total = sum(r["expected"] for r in rows)
    last_week = sum(r["expected"] for r in rows[-7:])
    now = next((r["expected"] for r in rows if r["date"] == today()), 1)
    rush = next((r["date"] for r in rows if r["date"] > today() and r["expected"] > now * 2.5), end)
    return {"windowStart": start, "windowEnd": end, "days": rows, "lastWeekShare": round(last_week / total, 3), "rushFrom": rush}


# ---------------------------------------------------------------- service status
SERVICES = ["Public portal", "Institution portal", "AICTE officials portal", "Document upload and storage", "Digital signature check", "DigiLocker source check", "Alerts: email, SMS, WhatsApp", "Evidence log", "Fee payment gateway"]


async def status(session: AsyncSession) -> dict:
    checks = {}
    t0 = time.perf_counter()
    await session.execute(text("SELECT 1"))
    checks["Database"] = {"ok": True, "ms": round((time.perf_counter() - t0) * 1000, 1)}
    t0 = time.perf_counter()
    from .documents import storage  # local folder or S3, whichever is configured

    ok = await storage.healthy()
    checks["File storage"] = {"ok": ok, "ms": round((time.perf_counter() - t0) * 1000, 1) if ok else None}
    hb = await session.get(KeyValue, "scheduler")
    age = (datetime.now() - datetime.fromisoformat(hb.value["lastRun"])).total_seconds() if hb else None
    checks["Deadline scheduler"] = {"ok": age is not None and age < settings.scheduler_interval_seconds * 3, "lastRun": hb.value["lastRun"] if hb else None}
    entries = await audit.chain(session, "ANU-2026-0412")
    checks["Evidence log"] = {"ok": audit.verify_entries(entries)["ok"] if entries else True}
    since = datetime.now() - timedelta(days=90)
    history = []
    for name in SERVICES:
        rows = list((await session.execute(select(StatusCheck).where(StatusCheck.service == name, StatusCheck.at >= since - timedelta(days=400)).order_by(StatusCheck.at))).scalars())[-90:]
        lost = sum(20 for r in rows if not r.ok)
        history.append({"service": name, "days": ["ok" if r.ok and r.latency_ms < 800 else "slow" if r.ok else "down" for r in rows], "uptime": round(100 - lost / max(1, len(rows) * 1440) * 100, 3)})
    all_ok = all(c["ok"] for c in checks.values())
    return {"overall": "All services are running normally" if all_ok else "Some services are degraded", "ok": all_ok, "checks": checks, "services": history, "checkedAt": datetime.now().isoformat(timespec="seconds")}


# ---------------------------------------------------------------- lookalike names (fake-college shield)
def _bigrams(s: str) -> Counter:
    import re

    t = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", s.lower())).strip()
    return Counter(t[i : i + 2] for i in range(len(t) - 1))


def similarity(a: str, b: str) -> float:
    A, B = _bigrams(a), _bigrams(b)
    size = sum(A.values()) + sum(B.values())
    return 2 * sum((A & B).values()) / size if size else 0.0


async def safety_check(session: AsyncSession, q: str) -> dict:
    insts = list((await session.execute(select(Institution))).scalars())
    flagged = list((await session.execute(select(UnapprovedInstitution))).scalars())
    matches = [i for i in insts if q.lower() in f"{i.name} {i.city} {i.aicte_id}".lower()]
    best_bad = max(((similarity(q, u.name), u) for u in flagged), default=(0, None), key=lambda x: x[0])
    best_good = max((similarity(q, i.name) for i in insts), default=0)
    out: dict = {"query": q, "matches": len(matches), "flagged": None, "lookalikes": []}
    if best_bad[1] and best_bad[0] >= 0.75 and best_bad[0] > best_good + 0.03:
        u = best_bad[1]
        real = max(((similarity(u.name, i.name), i) for i in insts), key=lambda x: x[0])
        out["flagged"] = {"name": u.name, "notice": u.notice, "realName": real[1].name if real[0] > 0.5 else None, "realAicteId": real[1].aicte_id if real[0] > 0.5 else None}
    elif not matches:
        out["lookalikes"] = [{"name": i.name, "aicteId": i.aicte_id, "score": round(s, 2)} for s, i in sorted(((similarity(q, i.name), i) for i in insts), key=lambda x: -x[0]) if s >= 0.4][:2]
    return out


# ---------------------------------------------------------------- surprise-inspection weights
async def inspection_weights(session: AsyncSession) -> list[dict]:
    t = today()
    obls = list((await session.execute(select(Obligation))).scalars())
    out = []
    for i in (await session.execute(select(Institution))).scalars():
        mine = [o for o in obls if o.institution_id == i.id]
        overdue = sum(1 for o in mine if o.status in ("Overdue", "Escalated"))
        soon = sum(1 for o in mine if o.status == "Due soon")
        runway = (i.lease_end - t).days / 365.25 - i.longest_course_years if i.lease_end else 99
        signals = [(overdue > 0, 3 * overdue, f"{overdue} overdue"), (soon > 0, 1.5 * soon, f"{soon} due soon"), (runway < 3, 2, "short lease"), (i.status != "Approved", 1, i.status.lower())]
        hits = [s for s in signals if s[0]]
        out.append({"id": i.id, "name": i.name.split(",")[0], "weight": 1 + sum(s[1] for s in hits), "reasons": [s[2] for s in hits]})
    return sorted(out, key=lambda x: -x["weight"])


# ---------------------------------------------------------------- duplicate faculty
async def duplicates(session: AsyncSession) -> dict:
    rows = list((await session.execute(select(Faculty))).scalars())
    by_person: dict[str, list[Faculty]] = defaultdict(list)
    for r in rows:
        by_person[r.pan_hash].append(r)
    clusters = [
        {"panHash": h, "name": rs[0].name, "records": [{"id": r.id, "institutionId": r.institution_id, "designation": r.designation, "joined": r.joined} for r in rs]}
        for h, rs in by_person.items() if len({r.institution_id for r in rs}) > 1
    ]
    return {"checked": len(rows), "clusters": sorted(clusters, key=lambda c: -len(c["records"])), "institutionsInvolved": len({r["institutionId"] for c in clusters for r in c["records"]})}


