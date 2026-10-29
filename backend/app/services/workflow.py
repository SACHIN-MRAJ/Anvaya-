"""The life of an application: submit, forward, send back (clock pauses), respond (clock resumes),
decide and appeal, plus the background tick that reminds and escalates.

Clocks are durable because they are data: due dates and pause dates live in the database, so a restart
loses nothing. In a national deployment the same steps run as Temporal workflows (signals for each
action, timers for each stage); this module is the single place to swap.
"""
import json
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit, observability, rules
from ..config import today
from ..models import Application, ApplicationType, Certificate, Deficiency, Document, HistoryEvent, Institution, KeyValue, Obligation
from ..schemas import ActionIn, Principal, ResponseIn, SubmitIn
from ..security import CASE_ROLES, DECIDERS
from . import insight
from .notify import notify

HOLDER = {"scrutiny": "Scrutiny committee", "rescrutiny": "Scrutiny committee", "evc": "EVC panel", "shc": "Standing Hearing Committee", "ec": "Executive Committee", "appeal": "Standing Appellate Committee"}
STAGE_LABEL = {"submitted": "Submitted", "scrutiny": "Scrutiny", "rescrutiny": "Re-scrutiny", "evc": "EVC", "shc": "SHC", "ec": "Executive Committee", "decision": "Decision", "appeal": "SAC appeal"}
OUTCOME_TEXT = {"EoA": "Extension of Approval granted", "LoA": "Letter of Approval granted", "LoD": "Letter of Deficiency issued", "LoR": "Letter of Rejection issued"}
IST = timezone(timedelta(hours=5, minutes=30))


def stage_keys(path: list[str]) -> list[str]:
    keys: list[str] = []
    for step in path:
        k = rules.STAGE_FOR_STEP[step]
        if not keys or keys[-1] != k:
            keys.append(k)
    return keys


async def record(session: AsyncSession, app: Application, action: str, actor: str, role: str, rule: str | None = None, note: str | None = None) -> None:
    at = audit.now_iso()
    app.history.append(HistoryEvent(at=at, actor=actor, role=role, action=action, note=note, rule_ref=rule))
    await audit.append(session, app.id, action, actor, role, rule, note, at=at)


async def _version(session: AsyncSession):
    v = await rules.published(session)
    return v, v.table, {**rules.DEFAULT_TARGETS, **(v.targets or {})}


async def next_ref(session: AsyncSession) -> str:
    ids = (await session.execute(select(Application.id).where(Application.id.like("ANU-2026-%")))).scalars().all()
    n = max((int(i.rsplit("-", 1)[1]) for i in ids), default=400) + 1
    return f"ANU-2026-{n:04d}"


async def submit(session: AsyncSession, user: Principal, body: SubmitIn) -> tuple[Application, dict]:
    if not (body.declarations.get("truth") and body.declarations.get("lock")):
        raise HTTPException(422, "Both declarations must be accepted before final submission (APH 2.3.4(b), 2.3.3(c)).")
    t = await session.get(ApplicationType, body.type_id)
    if not t:
        raise HTTPException(404, "Unknown request type")
    inst = await session.get(Institution, user.institution_id)
    docs = list((await session.execute(select(Document).where(Document.id.in_(body.document_ids), Document.institution_id == inst.id))).scalars()) if body.document_ids else []
    blocked = [d.filename for d in docs if d.preflight.get("errors")]
    if blocked:
        raise HTTPException(422, f"Fix these files first: {', '.join(blocked)}")

    version, table, targets = await _version(session)
    path = rules.evaluate_path(table, t.id)
    first = stage_keys(path)[0]
    now = datetime.now(IST).replace(microsecond=0)
    canonical = json.dumps({"typeId": t.id, "details": body.details, "documents": sorted(d.sha256 for d in docs), "signer": body.signer}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    fingerprint = audit.sha256_hex(canonical)
    app = Application(
        id=await next_ref(session), institution_id=inst.id, type_id=t.id, cycle="2027-28", submitted_on=today(), stage=first, stage_entered_on=today(),
        due_on=today() + timedelta(days=targets[first]), clock="running", holder=HOLDER[first], region=inst.region, deficiencies=0, risk=0.15,
        risk_reasons=[], outcome=None, public_status="Ongoing", rules_version=version.version, submission_sha256=fingerprint, details=body.details, history=[],
    )
    session.add(app)
    await session.flush()
    for d in docs:
        d.application_id, d.review_status = app.id, "awaiting verification"
    await record(session, app, "Application submitted and digitally signed", "Institution", body.signer, "APH 1.4.6", f"Submission fingerprint {fingerprint[:16]}…")
    await record(session, app, f"Path set by rules v{version.version}: " + " → ".join(path), "ANUMATI", "Rules engine", "APH Table 2.3")
    await insight.refresh_risk(session, app)
    await notify(session, "aicte", f"New application {app.id} from {inst.name.split(',')[0]} ({t.name})", "brand", app.id, region=inst.region)
    await notify(session, "institution", f"{app.id} received. Your deadline is met as of {now.strftime('%d %b %Y, %H:%M')} IST.", "green", app.id, institution_id=inst.id)
    await session.commit()
    receipt = {
        "ref": app.id, "receivedAt": now.isoformat(), "fingerprint": fingerprint, "path": ["Submitted", *path],
        "documents": [{"name": d.filename, "sha256": d.sha256} for d in docs],
    }
    return app, receipt


def _path_keys(app: Application, table: dict) -> list[str]:
    f = rules.facts_of(app)
    return stage_keys(rules.evaluate_path(table, **f))


async def act(session: AsyncSession, user: Principal, app: Application, body: ActionIn) -> Application:
    if user.role not in CASE_ROLES:
        raise HTTPException(403, f"The {user.role} role does not act on files.")
    if app.stage == "decision" and body.action != "note":
        raise HTTPException(409, "This file already has a decision.")
    _, table, targets = await _version(session)
    who = f"{user.name}"
    if body.action in ("sendback", "note") and len(body.reason.strip()) < 5:
        raise HTTPException(422, "Please write a reason of at least 5 characters; it is shown to the institution.")

    if body.action == "forward":
        keys = _path_keys(app, table)
        nxt = keys[keys.index(app.stage) + 1] if app.stage in keys and keys.index(app.stage) + 1 < len(keys) else "ec"
        if app.stage == "ec":
            raise HTTPException(409, "The Executive Committee records a decision instead of forwarding.")
        app.stage, app.stage_entered_on = nxt, today()
        app.due_on, app.clock, app.holder, app.escalation_level = today() + timedelta(days=targets[nxt]), "running", HOLDER[nxt], 0
        await record(session, app, f"Forwarded to {STAGE_LABEL[nxt]}", who, user.role, "APH Table 2.3", body.reason or None)
    elif body.action == "sendback":
        app.deficiencies += 1
        session.add(Deficiency(application_id=app.id, text=body.reason.strip(), stage=app.stage))
        app.clock, app.paused_on, app.public_status, app.holder = "paused", today(), "Action needed", "Awaiting institution"
        await record(session, app, f"Sent back to institution: {body.reason.strip()}", who, user.role, "APH 1.8(f)", "Clock paused until the institution responds.")
        await notify(session, "institution", f"Action needed on {app.id}: {body.reason.strip()}", "red", app.id, institution_id=app.institution_id)
    elif body.action == "recommend":
        await record(session, app, "Recommended to the committee with officer notes", who, user.role, None, body.reason or None)
    elif body.action == "note":
        await record(session, app, f"Note added: {body.reason.strip()}", who, user.role)
    elif body.action == "decide":
        if user.role not in DECIDERS:
            raise HTTPException(403, "Only the Executive Committee (committee member or bureau head) records decisions.")
        if app.stage != "ec" or not body.outcome:
            raise HTTPException(409, "A decision needs the file at the Executive Committee and an outcome.")
        if body.conditions and body.outcome not in ("EoA", "LoA"):
            raise HTTPException(422, "Conditions go with an approval (EoA or LoA), not with a deficiency or rejection letter.")
        if any(c.due_on <= today() for c in body.conditions):
            raise HTTPException(422, "Each condition needs a due date after today.")
        late = today() > app.due_on
        app.stage, app.stage_entered_on, app.outcome, app.public_status = "decision", today(), body.outcome, "Decision issued"
        app.clock, app.holder, app.risk, app.risk_reasons = ("breached" if late else "met"), "Executive Committee", 0.0, []
        await record(session, app, f"Decision: {OUTCOME_TEXT[body.outcome]}" + (f" with {len(body.conditions)} condition{'s' if len(body.conditions) != 1 else ''}" if body.conditions else ""), who, user.role, "APH 2.25", body.reason or None)
        for c in body.conditions:
            o = Obligation(
                id=f"OBL-{audit.sha256_hex(app.id + c.title)[:6].upper()}", institution_id=app.institution_id, kind="Condition", title=c.title.strip(),
                clause=c.clause, due_on=c.due_on, status="Due soon" if (c.due_on - today()).days <= 30 else "On track", source=f"Condition on {app.id}, Executive Committee",
            )
            session.add(o)
            await audit.append(session, o.id, f"Condition of approval set on {app.id}: {o.title}", who, user.role, c.clause, f"due {c.due_on}")
        await notify(session, "institution", f"Decision on {app.id}: {OUTCOME_TEXT[body.outcome]}. Verify it any time with its QR code.", "green" if body.outcome in ("EoA", "LoA") else "amber", app.id, institution_id=app.institution_id)
    if body.action != "decide":
        await insight.refresh_risk(session, app)
    await session.commit()
    return app


async def respond(session: AsyncSession, user: Principal, app: Application, body: ResponseIn) -> Application:
    if app.clock != "paused":
        raise HTTPException(409, "Nothing is waiting on your institution for this file.")
    docs = list((await session.execute(select(Document).where(Document.id.in_(body.document_ids), Document.institution_id == app.institution_id))).scalars()) if body.document_ids else []
    for d in docs:
        d.application_id, d.review_status = app.id, "awaiting verification"
    for df in (await session.execute(select(Deficiency).where(Deficiency.application_id == app.id, Deficiency.status == "open"))).scalars():
        df.status, df.resolved_at = "resolved", datetime.now()
    paused_days = (today() - app.paused_on).days if app.paused_on else 0
    _, _, targets = await _version(session)
    app.due_on = app.due_on + timedelta(days=paused_days)
    if app.stage == "scrutiny":
        app.stage, app.stage_entered_on, app.due_on = "rescrutiny", today(), today() + timedelta(days=targets["rescrutiny"])
    app.clock = "breached" if today() > app.due_on else "running"
    app.paused_on, app.public_status, app.holder = None, "Ongoing", HOLDER.get(app.stage, "Dealing officer")
    await record(session, app, f"Response uploaded ({len(docs)} document{'s' if len(docs) != 1 else ''}); clock restarted", "Institution", user.role, "APH 1.8(g)", body.note or None)
    await notify(session, "aicte", f"{app.id}: institution responded; re-scrutiny of the raised deficiency only", "brand", app.id, region=app.region)
    await insight.refresh_risk(session, app)
    await session.commit()
    return app


async def appeal(session: AsyncSession, user: Principal, app: Application, reason: str) -> Application:
    if app.stage != "decision" or app.outcome not in ("LoD", "LoR"):
        raise HTTPException(409, "Only a Letter of Deficiency or Rejection can be appealed.")
    if (today() - app.stage_entered_on).days > 7:
        raise HTTPException(409, "The 7-day appeal window has closed (APH 2.24).")
    app.stage, app.stage_entered_on, app.due_on, app.clock, app.public_status, app.holder = "appeal", today(), today() + timedelta(days=7), "running", "Ongoing", HOLDER["appeal"]
    await record(session, app, "Appeal filed with the Standing Appellate Committee", "Institution", user.role, "APH 2.24", reason or None)
    await notify(session, "aicte", f"Appeal filed on {app.id}", "amber", app.id, region=app.region)
    await session.commit()
    return app


CERT_WINDOWS = (1, 7, 15, 30, 60)  # days before expiry, nearest first
SCHEDULER_LOCK = 26_262_001  # PostgreSQL advisory-lock key: one deadline check at a time across all API servers


async def tick(session: AsyncSession) -> dict:
    """Runs every minute: reminders before due dates, escalation after them, obligations, lease runway."""
    if session.bind.dialect.name == "postgresql":
        got = (await session.execute(text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": SCHEDULER_LOCK})).scalar()
        if not got:
            return {"skipped": "another server is running the deadline check"}
    t = today()
    ladder = ((await session.get(KeyValue, "alerts")).value or {}).get("ladder", [])
    who = {s["level"]: s["who"] for s in ladder}
    escalated = reminded = 0
    for app in (await session.execute(select(Application).where(Application.clock.in_(("running", "breached"))))).scalars():
        late = (t - app.due_on).days
        level = 0 if late <= 0 else 1 if late < 3 else 2 if late < 7 else 3  # due today is not yet missed
        if late > 0 and app.clock != "breached":
            app.clock = "breached"
        if level > app.escalation_level:
            app.escalation_level = level
            escalated += 1
            await audit.append(session, app.id, f"Escalated to level {level}: {who.get(level, 'senior officer')}", "ANUMATI", "Escalation ladder", "Escalation ladder v3")
            await notify(session, "aicte", f"Escalation level {level}: {app.id} is {late} day{'s' if late != 1 else ''} past its deadline", "red", app.id, region=app.region)
        elif -7 <= late <= 0 and not app.details.get("reminded"):
            app.details = {**app.details, "reminded": True}
            reminded += 1
            when = "today" if late == 0 else f"in {-late} day{'s' if late != -1 else ''}"
            await notify(session, "aicte", f"{app.id} is due {when} ({app.due_on:%d %b})", "amber", app.id, region=app.region)
    for o in (await session.execute(select(Obligation).where(Obligation.status != "Met"))).scalars():
        days = (o.due_on - t).days
        status = "Overdue" if days < 0 else "Due soon" if days <= 30 else "On track"
        if o.status == "Escalated":
            continue
        if status != o.status:
            o.status = status
            if status == "Overdue":
                o.escalation_level = min(3, o.escalation_level + 1)
                await notify(session, "institution", f"Overdue: {o.title}", "red", o.id, institution_id=o.institution_id)
    certificates = 0
    for c in (await session.execute(select(Certificate).where(Certificate.valid_until.is_not(None)))).scalars():
        days = (c.valid_until - t).days
        window = next((w for w in CERT_WINDOWS if days <= w), None)
        if window is None or window in (c.reminded or []):
            continue
        c.reminded = sorted({*(c.reminded or []), *(w for w in CERT_WINDOWS if w >= window)})
        certificates += 1
        text_ = f"{c.kind} expired on {c.valid_until:%d %b %Y}. Upload the renewed certificate." if days < 0 else f"{c.kind} expires in {days} day{'s' if days != 1 else ''} ({c.valid_until:%d %b %Y}). Start the renewal now."
        await notify(session, "institution", text_, "red" if days <= 7 else "amber", c.id, institution_id=c.institution_id)
    open_files = (await session.execute(select(Application.clock, Application.escalation_level).where(Application.stage != "decision"))).all()
    observability.record_scheduler(dict(Counter(c for c, _ in open_files)), dict(Counter(lvl for _, lvl in open_files)))
    beat = {"lastRun": datetime.now().isoformat(timespec="seconds"), "escalated": escalated, "reminded": reminded, "certificates": certificates}
    hb = await session.get(KeyValue, "scheduler")
    if hb:
        hb.value = beat
    else:
        session.add(KeyValue(key="scheduler", value=beat))
    await session.commit()
    return beat


async def counts_by_stage(session: AsyncSession) -> dict[str, int]:
    rows = (await session.execute(select(Application.stage, func.count()).group_by(Application.stage))).all()
    return dict(rows)
