"""Loads the sample cycle (exported from the frontend by backend/scripts/export_seed.mjs) into an empty database."""
import json
import random
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit
from ..models import (
    Campus,
    Application, ApplicationType, CalendarEvent, Expert, Faculty, GlossaryTerm, HistoryEvent, Institution,
    KeyValue, Notice, Notification, Obligation, Region, RuleVersion, StatusCheck, UnapprovedInstitution, User,
)
from ..rules import DEFAULT_TARGETS
from ..security import DEV_USERS
from .records import seed_records

SEED = json.loads((Path(__file__).parent / "seed.json").read_text(encoding="utf-8"))
SERVICES = ["Public portal", "Institution portal", "AICTE officials portal", "Document upload and storage", "Digital signature check", "DigiLocker source check", "Alerts: email, SMS, WhatsApp", "Evidence log", "Fee payment gateway"]

d = date.fromisoformat


async def backfill_if_needed(session: AsyncSession) -> bool:
    """A database seeded before version 1.3 has no institutional record yet: build it from the data already there.
    Runs once (it does nothing when any campus exists) and never removes what people entered."""
    if not (await session.execute(select(func.count()).select_from(Region))).scalar_one():
        return False
    if (await session.execute(select(func.count()).select_from(Campus))).scalar_one():
        return False
    for p in {p.id: p for p in DEV_USERS.values()}.values():
        if not await session.get(User, p.id):
            session.add(User(id=p.id, name=p.name, portal=p.portal, role=p.role, region=p.region, institution_id=p.institution_id, email=f"{p.id}@example.gov.in"))
    await session.flush()
    await seed_records(session, SEED["applications"], backfill=True)
    await session.commit()
    return True


async def seed_if_empty(session: AsyncSession) -> bool:
    if (await session.execute(select(func.count()).select_from(Region))).scalar_one():
        return False
    s = SEED
    session.add_all(Region(**r) for r in s["regions"])
    await session.flush()
    for i in s["institutions"]:
        session.add(Institution(
            id=i["id"], aicte_id=i["aicteId"], name=i["name"], city=i["city"], state=i["state"], region=i["region"], category=i["category"],
            established=i["established"], land=i["land"], lease_end=d(i["leaseEnd"]) if i.get("leaseEnd") else None,
            longest_course_years=i["longestCourseYears"], intake=i["intake"], programmes=i["programmes"], status=i["status"], trust=i["trust"], lat=i["lat"], lng=i["lng"],
        ))
    for t in s["applicationTypes"]:
        session.add(ApplicationType(id=t["id"], name=t["name"], chapter=t["chapter"], clause=t["clause"], summary=t["summary"], steps=t["steps"], documents=t["documents"], target_days=t["targetDays"]))
    table = {t["id"]: t["steps"] for t in s["applicationTypes"]}
    history = [
        ("2026.1", "2025-11-28", "Approval process 2026-27 baseline from APH 2024-27 Table 2.3"),
        ("2026.2", "2026-02-10", "Re-scrutiny target reduced from 15 to 10 working days"),
        ("2026.3", "2026-08-25", "EVC and SAC constituted by the Council; EVC mode physical/online/hybrid (Dec 2025 corrigendum)"),
    ]
    for v, when, why in history:
        session.add(RuleVersion(version=v, table=table, targets=dict(DEFAULT_TARGETS), status="published", author="Rules administrator", approver="Bureau head", reason=why, effective_from=d(when), tests_passed=len(s["goldenCases"]), tests_total=len(s["goldenCases"]), published_at=datetime.fromisoformat(when + "T10:00:00")))
    await session.flush()

    for a in s["applications"]:
        app = Application(
            id=a["id"], institution_id=a["institutionId"], type_id=a["typeId"], cycle=a["cycle"], submitted_on=d(a["submittedOn"]), stage=a["stage"],
            stage_entered_on=d(a["stageEnteredOn"]), due_on=d(a["dueOn"]), clock=a["clock"], holder=a["holder"], region=a["region"], deficiencies=a["deficiencies"],
            risk=a["risk"], risk_reasons=a["riskReasons"], outcome=a["outcome"], public_status=a["publicStatus"], paused_on=d(a["stageEnteredOn"]) if a["clock"] == "paused" else None,
        )
        for h in a["history"]:
            app.history.append(HistoryEvent(at=h["at"], actor=h["actor"], role=h["role"], action=h["action"], note=h.get("note"), rule_ref=h.get("ruleRef")))
        session.add(app)
    await session.flush()
    # Evidence chains rebuilt from each file's history, exactly as the browser builds them.
    for a in s["applications"]:
        for h in a["history"]:
            await audit.append(session, a["id"], h["action"], h["actor"], h["role"], h.get("ruleRef"), h.get("note"), at=h["at"])

    for o in s["obligations"]:
        session.add(Obligation(id=o["id"], institution_id=o["institutionId"], kind=o["kind"], title=o["title"], clause=o["clause"], due_on=d(o["dueOn"]), status=o["status"], escalation_level=o["escalationLevel"], source=o["source"], evidence=o.get("evidence")))
    for e in s["experts"]:
        session.add(Expert(id=e["id"], name=e["name"], city=e["city"], region=e["region"], specialisation=e["specialisation"], load=e["load"], max_load=e["maxLoad"], linked_institutions=e["linkedInstitutions"], available=e["available"]))
    for n in s["notices"]:
        session.add(Notice(id=n["id"], title=n["title"], date=d(n["date"]), audience=n["audience"], category=n["category"], summary=n["summary"]))
    for c in s["calendar"]:
        session.add(CalendarEvent(id=c["id"], label=c["label"], date=d(c["date"]), end_date=d(c["endDate"]) if c.get("endDate") else None, kind=c["kind"], clause=c.get("clause"), revised_from=d(c["revisedFrom"]) if c.get("revisedFrom") else None, revision_reason=c.get("revisionReason")))
    for g in s["glossary"]:
        session.add(GlossaryTerm(key=g["key"], full=g["full"], meaning=g["meaning"], clause=g.get("clause"), aliases=g.get("aliases", [])))
    for f in s["faculty"]:
        session.add(Faculty(id=f["id"], name=f["name"], pan_hash=f["panHash"], institution_id=f["institutionId"], designation=f["designation"], joined=d(f["joined"])))
    for u in s["unapproved"]:
        session.add(UnapprovedInstitution(name=u["name"], city=u["city"], notice=u["notice"]))
    for p in {p.id: p for p in DEV_USERS.values()}.values():
        session.add(User(id=p.id, name=p.name, portal=p.portal, role=p.role, region=p.region, institution_id=p.institution_id, email=f"{p.id}@example.gov.in"))
    await session.flush()
    await seed_records(session, s["applications"])

    session.add(KeyValue(key="mining", value=s["mining"]))
    session.add(KeyValue(key="golden", value={"cases": s["goldenCases"]}))
    session.add(KeyValue(key="alerts", value={"ladder": s["escalationLadder"], "channels": {"email": True, "sms": True, "whatsapp": True}, "remindDaysBefore": [30, 7, 1], "quietHours": "21:00-08:00"}))

    session.add_all([
        Notification(audience="aicte", title="Escalation level 3: security deposit proof overdue (Krishna Delta)", tone="red", ref="OB-110"),
        Notification(audience="aicte", title="6 new applications submitted in Central region", tone="brand"),
        Notification(audience="aicte", title="EVC panel drawn for ANU-2026-0412 (drand round committed)", tone="green", ref="ANU-2026-0412"),
        Notification(audience="institution", institution_id="INS-001", title="Fire safety certificate expires in 17 days", tone="amber"),
        Notification(audience="institution", institution_id="INS-001", title="Action needed on ANU-2026-0398: corrected NOC", tone="red", ref="ANU-2026-0398"),
        Notification(audience="institution", institution_id="INS-001", title="Expert visit panel assigned for ANU-2026-0412", tone="green", ref="ANU-2026-0412"),
    ])

    # 90 days of uptime history so the status page has a record from day one.
    start = datetime.combine(d("2026-10-22") - timedelta(days=89), datetime.min.time()) + timedelta(hours=12)
    for k, name in enumerate(SERVICES):
        rnd = random.Random(100 + k * 17)  # noqa: S311  # nosec B311  (repeatable sample history, not security)
        for day in range(90):
            x = rnd.random()
            session.add(StatusCheck(service=name, at=start + timedelta(days=day), ok=x <= 0.996, latency_ms=900 if x > 0.982 else rnd.randint(40, 160)))
    await session.commit()
    return True
