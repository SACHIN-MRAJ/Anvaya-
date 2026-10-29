"""Oversight tools for AICTE staff: routing and handoffs, field inspections, institutional verification, document review,
decision readiness, regulatory actions, why files are sent back, and user access. Plus the live counts behind the
navigation badges of both portals.

AI assists, people decide: the readiness check suggests an outcome and conditions with its reasons, but only the
Executive Committee records a decision (workflow.act), and a penal action needs a show-cause notice and a hearing first.
"""
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit, rules
from ..config import today
from ..db import get_session
from ..models import (
    Application, ApplicationType, Campus, Certificate, Deficiency, Document, Draft, EvcPanel, Expert, Faculty, FieldInspection, Institution, Leader,
    Notification, Obligation, Programme, RegulatoryAction, Space, User, Verification,
)
from ..schemas import AdminUserIn, DocumentOut, DocumentReviewIn, FieldAssignIn, FieldItemIn, FieldSubmitIn, InstitutionOut, Principal, ReassignIn, RegulatoryActionIn, VerificationIn
from ..security import CASE_ROLES, DECIDERS, INSTITUTION_ROLES, OFFICER_ROLES, current_user, forget_deactivated, may, region_scope, require_portal, require_roles
from ..services import documents, geo, inspection, norms, workflow
from ..services.notify import notify
from .common import visible_app
from .records import courses_of, faculty_out, faculty_rows, infrastructure_of, leader_out, programme_out

router = APIRouter(tags=["Oversight"])
officer = require_portal("aicte")
case_officer = require_roles(*sorted(CASE_ROLES))
decider = require_roles(*sorted(DECIDERS))
PENAL = {"Reduction in intake", "No admission for one year", "Withdrawal of approval"}


async def _institution_in_scope(session: AsyncSession, user: Principal, inst_id: str) -> Institution:
    inst = await session.get(Institution, inst_id)
    if not inst or (region_scope(user) and inst.region != region_scope(user)):
        raise HTTPException(404, "Not found")
    return inst


# ---------------------------------------------------------------- routing and handoffs
HANDOFF = re.compile(r"^(Forwarded to|Assigned to|Reassigned to|Sent back)")


def _route_row(a: Application, names: dict[str, str], targets: dict) -> dict:
    events = list(a.history)
    last = events[-1] if events else None
    last_at = datetime.fromisoformat(last.at[:19]).date() if last else a.stage_entered_on
    handoffs = [e for e in events if HANDOFF.match(e.action)]
    sendbacks = sum(1 for e in events if e.action.startswith("Sent back"))
    days_at = (today() - a.stage_entered_on).days
    idle = (today() - last_at).days
    flags = []
    if a.clock == "paused":
        flags.append("Waiting on institution")
    if today() > a.due_on and a.clock != "paused":
        flags.append("Past target")
    if idle >= 7 and a.clock != "paused":
        flags.append(f"No action for {idle} days")
    if sendbacks >= 2:
        flags.append(f"Sent back {sendbacks} times")
    return {
        "id": a.id, "institution": names.get(a.institution_id, a.institution_id), "typeId": a.type_id, "stage": a.stage, "holder": a.holder, "region": a.region, "clock": a.clock,
        "daysAtStage": days_at, "targetDays": targets.get(a.stage), "dueOn": a.due_on, "idleDays": idle, "handoffs": len(handoffs), "sendbacks": sendbacks,
        "lastHandoff": {"at": handoffs[-1].at, "action": handoffs[-1].action, "actor": handoffs[-1].actor} if handoffs else None, "flags": flags,
    }


@router.get("/aicte/routing", summary="Who holds each open file, how long it has waited and where handoffs stall")
async def routing(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    stmt = select(Application).where(Application.stage != "decision")
    if scope := region_scope(user):
        stmt = stmt.where(Application.region == scope)
    apps = list((await session.execute(stmt)).scalars())
    names = {i.id: i.name.split(",")[0] for i in (await session.execute(select(Institution))).scalars()}
    version = await rules.published(session)
    targets = {**rules.DEFAULT_TARGETS, **(version.targets or {})}
    rows = sorted((_route_row(a, names, targets) for a in apps), key=lambda r: (-len(r["flags"]), -r["idleDays"]))
    holders: dict[str, dict] = {}
    for r in rows:
        h = holders.setdefault(r["holder"], {"holder": r["holder"], "files": 0, "pastTarget": 0, "idle": 0, "oldestDays": 0})
        h["files"] += 1
        h["pastTarget"] += "Past target" in r["flags"]
        h["idle"] += any(f.startswith("No action") for f in r["flags"])
        h["oldestDays"] = max(h["oldestDays"], r["daysAtStage"])
    types = {t.id: t.name for t in (await session.execute(select(ApplicationType))).scalars()}
    routes = [{"typeId": tid, "name": types.get(tid, tid), "path": [rules.STEP_LABEL.get(s, s) for s in steps]} for tid, steps in sorted(version.table.items())]
    return {
        "files": rows, "holders": sorted(holders.values(), key=lambda h: -h["files"]), "routes": routes, "rulesVersion": version.version,
        "summary": {"open": len(rows), "flagged": sum(1 for r in rows if r["flags"]), "pastTarget": sum(1 for r in rows if "Past target" in r["flags"]), "waitingOnInstitution": sum(1 for r in rows if r["clock"] == "paused")},
    }


@router.post("/aicte/routing/{app_id}/reassign", summary="Hand a file to another officer or committee, with the reason recorded")
async def reassign(app_id: str, body: ReassignIn, user: Principal = Depends(require_roles("Bureau head", "Regional officer", "EVC coordinator")), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    if app.stage == "decision":
        raise HTTPException(409, "This file already has a decision.")
    if app.clock == "paused":
        raise HTTPException(409, "The file is waiting on the institution; reassign it after they reply.")
    old, app.holder = app.holder, body.holder.strip()
    await workflow.record(session, app, f"Reassigned to {app.holder}", user.name, user.role, None, f"From {old}. {body.reason.strip()}")
    await session.commit()
    return {"id": app.id, "holder": app.holder}


# ---------------------------------------------------------------- field inspections (expert visits on site or online)
def _inspection_out(fi: FieldInspection, app: Application | None = None, inst: Institution | None = None) -> dict:
    out = {
        "id": fi.id, "applicationId": fi.application_id, "inspectorId": fi.inspector_id, "inspectorName": fi.inspector_name, "assignedBy": fi.assigned_by,
        "assignedAt": fi.assigned_at, "mode": fi.mode, "status": fi.status, "videoUrl": fi.video_url, "startedAt": fi.started_at, "submittedAt": fi.submitted_at,
        "signature": fi.signature or None, "reportSha256": fi.report_sha256, "progress": inspection.progress(fi.items),
    }
    if app:
        out["application"] = {"id": app.id, "typeId": app.type_id, "stage": app.stage, "dueOn": app.due_on}
    if inst:
        out["institution"] = {"id": inst.id, "name": inst.name, "city": inst.city, "lat": inst.lat, "lng": inst.lng}
    return out


async def _inspection(session: AsyncSession, user: Principal, fi_id: str, write: bool = False) -> tuple[FieldInspection, Application]:
    fi = await session.get(FieldInspection, fi_id)
    if not fi:
        raise HTTPException(404, "Not found")
    if user.role == "Inspector" and fi.inspector_id != user.id:
        raise HTTPException(404, "Not found")
    app = await visible_app(session, user, fi.application_id) if user.role != "Inspector" else await session.get(Application, fi.application_id)
    if write:
        if fi.inspector_id != user.id:
            raise HTTPException(403, "Only the assigned inspector fills in this report.")
        if fi.status == "Submitted":
            raise HTTPException(409, "This report is signed and submitted; it cannot be changed.")
    return fi, app


@router.get("/aicte/field", summary="Field inspections: an inspector sees their own; officers see those in their region")
async def field_list(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    stmt = select(FieldInspection, Application, Institution).join(Application, Application.id == FieldInspection.application_id).join(Institution, Institution.id == Application.institution_id)
    if user.role == "Inspector":
        stmt = stmt.where(FieldInspection.inspector_id == user.id)
    elif scope := region_scope(user):
        stmt = stmt.where(Application.region == scope)
    rows = (await session.execute(stmt.order_by(FieldInspection.assigned_at.desc()))).all()
    waiting = []
    if user.role != "Inspector":
        assigned = {fi.application_id for fi, _, _ in rows}
        q = select(Application).where(Application.stage == "evc")
        if scope := region_scope(user):
            q = q.where(Application.region == scope)
        waiting = [{"id": a.id, "institutionId": a.institution_id, "typeId": a.type_id, "dueOn": a.due_on} for a in (await session.execute(q)).scalars() if a.id not in assigned]
    return {"inspections": [_inspection_out(fi, app, inst) for fi, app, inst in rows], "unassigned": waiting}


def _inspector_accounts():
    """Inspectors who can actually sign in: with single sign-on, the people who have signed in through Keycloak."""
    from ..config import settings

    stmt = select(User).where(User.role == "Inspector", User.active.is_(True))
    return stmt.where(User.id.like("kc:%")) if settings.auth_mode == "oidc" else stmt


@router.get("/aicte/field/inspectors", summary="Inspectors who can be assigned, with conflicts of interest marked")
async def inspectors(application_id: str = "", user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, application_id) if application_id else None
    linked = set()
    if app:
        linked = {e.name for e in (await session.execute(select(Expert))).scalars() if app.institution_id in e.linked_institutions}
    people = (await session.execute(_inspector_accounts())).scalars()
    load = Counter((await session.execute(select(FieldInspection.inspector_id).where(FieldInspection.status != "Submitted"))).scalars())
    return [{"id": u.id, "name": u.name, "open": load.get(u.id, 0), "conflict": u.name in linked} for u in people]


@router.post("/aicte/field", status_code=201, summary="Assign a field inspection for a file at the expert-visit stage")
async def assign(body: FieldAssignIn, user: Principal = Depends(require_roles("EVC coordinator", "Bureau head", "Regional officer")), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, body.application_id)
    if app.stage != "evc":
        raise HTTPException(409, "Field inspections are assigned when the file is at the expert-visit stage.")
    if (await session.execute(select(FieldInspection).where(FieldInspection.application_id == app.id, FieldInspection.status != "Submitted"))).scalar_one_or_none():
        raise HTTPException(409, "An inspection is already open for this file.")
    person = (await session.execute(_inspector_accounts().where(User.id == body.inspector_id))).scalar_one_or_none()
    if not person:
        raise HTTPException(422, "Choose an active inspector who can sign in.")
    if any(person.name == e.name and app.institution_id in e.linked_institutions for e in (await session.execute(select(Expert))).scalars()):
        raise HTTPException(409, "Conflict of interest: this inspector is linked to the institution.")
    inst = await session.get(Institution, app.institution_id)
    certs = list((await session.execute(select(Certificate).where(Certificate.institution_id == inst.id, Certificate.kind == "Fire and life safety certificate"))).scalars())
    fire = max((c.valid_until for c in certs if c.valid_until), default=None)
    items = inspection.checklist(await courses_of(session, inst.id), f"{fire:%d %b %Y}" if fire else None, old_building=today().year - inst.established > 30)
    fi = FieldInspection(id=f"FI-{app.id[4:]}-{(await session.execute(select(func.count()).select_from(FieldInspection))).scalar_one() + 1}", application_id=app.id, inspector_id=person.id, inspector_name=person.name, assigned_by=user.name, mode=body.mode, status="Assigned", items=items)
    session.add(fi)
    await workflow.record(session, app, f"Field inspection assigned to {person.name} ({body.mode.lower()})", user.name, user.role, "APH 1.9")
    await session.commit()
    return _inspection_out(fi, app, inst)


@router.get("/aicte/field/{fi_id}", summary="One inspection with its checklist")
async def field_detail(fi_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    fi, app = await _inspection(session, user, fi_id)
    inst = await session.get(Institution, app.institution_id)
    campuses = [{"name": c.name, "lat": c.lat, "lng": c.lng} for c in (await session.execute(select(Campus).where(Campus.institution_id == inst.id))).scalars()]
    return {**_inspection_out(fi, app, inst), "items": fi.items, "campuses": campuses, "canEdit": fi.inspector_id == user.id and fi.status != "Submitted"}


@router.put("/aicte/field/{fi_id}/items/{item_id}", summary="Record the finding for one checklist line")
async def field_item(fi_id: str, item_id: str, body: FieldItemIn, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    fi, _ = await _inspection(session, user, fi_id, write=True)
    items = [dict(i) for i in fi.items]
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        raise HTTPException(404, "No such checklist line")
    item["result"], item["note"] = body.result, body.note.strip()
    fi.items = items
    if fi.status == "Assigned":
        fi.status, fi.started_at = "In progress", datetime.now()
    await session.commit()
    return {"item": item, "progress": inspection.progress(items), "status": fi.status}


@router.post("/aicte/field/{fi_id}/items/{item_id}/photo", summary="Attach a photo; its location and time are checked against the campus")
async def field_photo(fi_id: str, item_id: str, file: UploadFile = File(...), lat: float | None = Form(None), lng: float | None = Form(None), taken_at: str | None = Form(None, max_length=19), user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    fi, app = await _inspection(session, user, fi_id, write=True)
    data = await file.read(15 * 1024 * 1024 + 1)
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "Photos up to 15 MB, please.")
    if not data.startswith((b"\xff\xd8", b"\x89PNG")):
        raise HTTPException(422, "Upload a JPEG or PNG photo.")
    meta = geo.read_exif(data)
    if meta.get("lat") is None and lat is not None and lng is not None:
        meta = {**meta, "lat": lat, "lng": lng, "takenAt": taken_at or meta.get("takenAt"), "from": "browser location"}
    inst = await session.get(Institution, app.institution_id)
    verdict = geo.judge(meta, inst.lat, inst.lng, today().isoformat())
    key = await documents.storage.save(data, ".jpg" if data.startswith(b"\xff\xd8") else ".png")
    items = [dict(i) for i in fi.items]
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        raise HTTPException(404, "No such checklist line")
    entry = {"name": (file.filename or "photo.jpg")[:120], "sha256": audit.sha256_hex(data), "key": key, "lat": meta.get("lat"), "lng": meta.get("lng"), "takenAt": meta.get("takenAt"), **verdict}
    item["evidence"] = [*item.get("evidence", []), entry]
    fi.items = items
    if fi.status == "Assigned":
        fi.status, fi.started_at = "In progress", datetime.now()
    await session.commit()
    return {"item": item, "photo": {k: v for k, v in entry.items() if k != "key"}}


@router.put("/aicte/field/{fi_id}/video", summary="Link the visit recording")
async def field_video(fi_id: str, body: dict, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    fi, _ = await _inspection(session, user, fi_id, write=True)
    url = str(body.get("videoUrl", "")).strip()[:300]
    if url and not url.startswith("https://"):
        raise HTTPException(422, "Use an https link to the recording.")
    fi.video_url = url
    await session.commit()
    return {"videoUrl": fi.video_url}


@router.post("/aicte/field/{fi_id}/submit", summary="Sign and submit the report; its fingerprint goes into the file's evidence log")
async def field_submit(fi_id: str, body: FieldSubmitIn, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    fi, app = await _inspection(session, user, fi_id, write=True)
    if body.video_url:
        if not body.video_url.startswith("https://"):
            raise HTTPException(422, "Use an https link to the recording.")
        fi.video_url = body.video_url
    gaps = inspection.missing_for_submit(fi.items, fi.mode, fi.video_url)
    if gaps:
        raise HTTPException(422, f"{len(gaps)} thing{'s' if len(gaps) != 1 else ''} left before signing: " + "; ".join(gaps[:4]) + ("…" if len(gaps) > 4 else ""))
    if not body.declaration:
        raise HTTPException(422, "Confirm the declaration before signing.")
    inst = await session.get(Institution, app.institution_id)
    now = datetime.now().replace(microsecond=0)
    fi.signature = {"name": body.signer_name.strip(), "role": user.role, "at": now.isoformat(), "method": "Signed in ANUMATI with a declaration"}
    fi.status, fi.submitted_at = "Submitted", now
    canonical_items = [{k: v for k, v in i.items() if k != "evidence"} | {"evidence": [{k: v for k, v in e.items() if k != "key"} for e in i["evidence"]]} for i in fi.items]
    _, sha = inspection.report({"id": fi.id, "mode": fi.mode, "items": canonical_items, "videoUrl": fi.video_url, "signature": fi.signature}, {"id": inst.id, "name": inst.name}, app.id)
    fi.report_sha256 = sha
    p = inspection.progress(fi.items)
    await workflow.record(session, app, f"Field inspection report signed by {fi.inspector_name}: {p['concerns']} concern{'s' if p['concerns'] != 1 else ''}", fi.inspector_name, "Inspector", "APH 1.9", f"Report SHA-256 {sha}")
    await notify(session, "aicte", f"Field inspection report submitted for {app.id} ({p['concerns']} concerns)", "brand", app.id, region=app.region)
    await session.commit()
    return _inspection_out(fi, app, inst)


@router.get("/aicte/field/{fi_id}/report", response_class=PlainTextResponse, summary="The inspection report as plain text")
async def field_report(fi_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    fi, app = await _inspection(session, user, fi_id)
    inst = await session.get(Institution, app.institution_id)
    lines = ["ANUMATI FIELD INSPECTION REPORT", f"Inspection   : {fi.id} ({fi.mode})", f"File         : {app.id}", f"Institution  : {inst.name}", f"Inspector    : {fi.inspector_name}", f"Status       : {fi.status}", ""]
    section = None
    for i in fi.items:
        if i["section"] != section:
            section = i["section"]
            lines += ["", section]
        lines.append(f"  [{(i['result'] or 'not checked'):<14}] {i['label']}  (expected: {i['expect']}; {i['clause']})")
        if i["note"]:
            lines.append(f"      note: {i['note']}")
        for e in i.get("evidence", []):
            lines.append(f"      photo: {e['name']} sha256:{e['sha256'][:16]}… {e.get('verdict', '')} {e.get('distanceM') or ''}")
    lines += ["", f"Video        : {fi.video_url or 'none'}"]
    if fi.signature:
        lines += [f"Signed       : {fi.signature['name']} on {fi.signature['at']}", f"Report SHA-256 (in the file's evidence log): {fi.report_sha256}"]
    return "\n".join(lines)


# ---------------------------------------------------------------- institutional verification
@router.get("/aicte/verification", summary="Institutions with records waiting for an officer check")
async def verification_list(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    stmt = select(Institution).order_by(Institution.name)
    if scope := region_scope(user):
        stmt = stmt.where(Institution.region == scope)
    insts = list((await session.execute(stmt)).scalars())
    pending_cert = Counter((await session.execute(select(Certificate.institution_id).where(Certificate.verification == "Pending"))).scalars())
    pending_fac = Counter((await session.execute(select(Faculty.institution_id).where(Faculty.verification == "Pending", Faculty.status == "Active"))).scalars())
    discrepancies = Counter((await session.execute(select(Verification.institution_id).where(Verification.outcome == "Discrepancy"))).scalars())
    last = dict((await session.execute(select(Verification.institution_id, func.max(Verification.checked_at)).group_by(Verification.institution_id))).all())
    expired = Counter(c.institution_id for c in (await session.execute(select(Certificate).where(Certificate.valid_until < today()))).scalars())
    rows = [{
        "id": i.id, "name": i.name, "city": i.city, "region": i.region, "status": i.status, "pendingCertificates": pending_cert.get(i.id, 0), "pendingFaculty": pending_fac.get(i.id, 0),
        "discrepancies": discrepancies.get(i.id, 0), "expiredCertificates": expired.get(i.id, 0), "lastChecked": last.get(i.id),
    } for i in insts]
    return sorted(rows, key=lambda r: (-(r["discrepancies"] + r["expiredCertificates"]), -(r["pendingCertificates"] + r["pendingFaculty"]), r["name"]))


@router.get("/aicte/verification/{inst_id}", summary="One institution's full record with what has been checked")
async def verification_detail(inst_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    inst = await _institution_in_scope(session, user, inst_id)
    infra = await infrastructure_of(session, inst.id)
    progs = (await session.execute(select(Programme).where(Programme.institution_id == inst.id).order_by(Programme.department))).scalars()
    rows = await faculty_rows(session, inst.id)
    leaders = (await session.execute(select(Leader).where(Leader.institution_id == inst.id).order_by(Leader.until.is_not(None), Leader.since))).scalars()
    checks = (await session.execute(select(Verification).where(Verification.institution_id == inst.id).order_by(Verification.checked_at.desc(), Verification.id.desc()))).scalars()
    actions = (await session.execute(select(RegulatoryAction).where(RegulatoryAction.institution_id == inst.id).order_by(RegulatoryAction.decided_at.desc(), RegulatoryAction.id.desc()))).scalars()
    return {
        "institution": InstitutionOut.model_validate(inst), "profile": inst.profile or {}, **infra,
        "programmes": [programme_out(p) for p in progs],
        "faculty": {"norms": norms.check_faculty(await courses_of(session, inst.id), [faculty_out(f) for f in rows]), "pending": [faculty_out(f) for f in rows if f.verification == "Pending" and f.status == "Active"][:40]},
        "leaders": [leader_out(x) for x in leaders],
        "checks": [{"id": c.id, "subject": c.subject, "subjectId": c.subject_id, "subjectLabel": c.subject_label, "outcome": c.outcome, "note": c.note, "source": c.source, "checkedBy": c.checked_by, "checkedAt": c.checked_at} for c in checks],
        "actions": [{"id": a.id, "kind": a.kind, "detail": a.detail, "reason": a.reason, "decidedBy": a.decided_by, "role": a.role, "decidedAt": a.decided_at, "effectiveFrom": a.effective_from, "applicationId": a.application_id} for a in actions],
    }


SUBJECTS = {"Campus": Campus, "Space": Space, "Certificate": Certificate, "Programme": Programme, "Faculty": Faculty, "Leader": Leader}


@router.post("/aicte/verification/{inst_id}", status_code=201, summary="Record an officer check of one record")
async def verify_record(inst_id: str, body: VerificationIn, user: Principal = Depends(case_officer), session: AsyncSession = Depends(get_session)):
    inst = await _institution_in_scope(session, user, inst_id)
    if body.outcome != "Verified" and len(body.note.strip()) < 10:
        raise HTTPException(422, "Describe the discrepancy or what needs following up (at least 10 characters); the institution sees it.")
    if body.subject == "Profile":
        label = "Institution profile"
    else:
        model = SUBJECTS[body.subject]
        numeric = body.subject in ("Space", "Leader")
        if numeric and not (body.subject_id.isdigit() and 0 < int(body.subject_id) <= 2_147_483_647):
            raise HTTPException(404, "No such record for this institution")
        row = await session.get(model, int(body.subject_id) if numeric else body.subject_id)
        if not row or row.institution_id != inst.id:
            raise HTTPException(404, "No such record for this institution")
        label = getattr(row, "kind", None) or getattr(row, "name", body.subject_id)
        if body.subject == "Campus":
            label = f"{row.name} ({row.ownership.lower()} land)"
        if isinstance(row, (Certificate, Faculty)) and body.outcome != "Follow-up":
            row.verification = body.outcome
        if isinstance(row, Certificate):
            row.verified_by, row.verified_at = user.name, datetime.now()
    v = Verification(institution_id=inst.id, subject=body.subject, subject_id=body.subject_id, subject_label=label[:200], outcome=body.outcome, note=body.note.strip(), source=body.source, checked_by=user.name)
    session.add(v)
    await audit.append(session, f"RECORD-{inst.id}", f"Officer check: {label} — {body.outcome.lower()}", user.name, user.role, None, body.note.strip() or None)
    if body.outcome != "Verified":
        await notify(session, "institution", f"AICTE check of {label}: {body.outcome.lower()}. {body.note.strip()[:140]}", "amber" if body.outcome == "Follow-up" else "red", f"RECORD-{inst.id}", institution_id=inst.id)
    await session.commit()
    return {"id": v.id, "subjectLabel": v.subject_label, "outcome": v.outcome}


# ---------------------------------------------------------------- regulatory actions (due process)
@router.post("/aicte/institutions/{inst_id}/actions", status_code=201, summary="Record a warning, show-cause notice or penal action, with reasons")
async def regulatory_action(inst_id: str, body: RegulatoryActionIn, user: Principal = Depends(decider), session: AsyncSession = Depends(get_session)):
    inst = await _institution_in_scope(session, user, inst_id)
    if body.application_id:
        app = await visible_app(session, user, body.application_id)
        if app.institution_id != inst.id:
            raise HTTPException(422, "That file belongs to another institution.")
    if body.kind in PENAL:
        notice = (await session.execute(select(RegulatoryAction).where(RegulatoryAction.institution_id == inst.id, RegulatoryAction.kind == "Show-cause notice"))).scalars().first()
        if not notice:
            raise HTTPException(409, "Issue a show-cause notice first: the institution must be heard before a penal action (APH Chapter VII).")
        if len(body.hearing_note.strip()) < 20:
            raise HTTPException(422, "Record what the Standing Hearing Committee heard and concluded before a penal action.")
    a = RegulatoryAction(institution_id=inst.id, application_id=body.application_id, kind=body.kind, detail=body.detail.strip(), reason=(body.reason.strip() + (f"\nHearing: {body.hearing_note.strip()}" if body.hearing_note.strip() else "")), decided_by=user.name, role=user.role, effective_from=body.effective_from)
    session.add(a)
    await audit.append(session, f"RECORD-{inst.id}", f"{body.kind}: {body.detail.strip()[:120]}", user.name, user.role, "APH Chapter VII", body.reason.strip()[:300])
    await notify(session, "institution", f"{body.kind} from AICTE: {body.detail.strip()[:140]}", "red" if body.kind in PENAL else "amber", f"RECORD-{inst.id}", institution_id=inst.id)
    await session.commit()
    return {"id": a.id, "kind": a.kind, "decidedAt": a.decided_at}


# ---------------------------------------------------------------- documents: checklist status and side-by-side viewer
@router.get("/applications/{app_id}/documents", summary="Each required document with all its versions and its checklist status")
async def app_documents(app_id: str, user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    t = await session.get(ApplicationType, app.type_id)
    docs = list((await session.execute(select(Document).where(Document.application_id == app.id).order_by(Document.doc_kind, Document.version))).scalars())
    by_kind = defaultdict(list)
    for doc in docs:
        by_kind[doc.doc_kind].append(DocumentOut.model_validate(doc).model_dump(by_alias=True))
    rows = []
    for req in t.documents:
        versions = by_kind.pop(req["id"], [])
        latest = versions[-1] if versions else None
        rows.append({"kind": req["id"], "name": req["name"], "clause": req["clause"], "signedBy": req.get("signedBy"), "versions": versions, "status": latest["reviewStatus"] if latest else "missing"})
    for kind, versions in by_kind.items():
        rows.append({"kind": kind, "name": kind, "clause": "", "signedBy": None, "versions": versions, "status": versions[-1]["reviewStatus"]})
    counts = Counter(r["status"] for r in rows)
    return {"documents": rows, "counts": dict(counts), "allVerified": all(r["status"] == "verified" for r in rows)}


@router.post("/aicte/documents/{document_id}/review", summary="Mark a document verified or needing correction")
async def review_document(document_id: str, body: DocumentReviewIn, user: Principal = Depends(case_officer), session: AsyncSession = Depends(get_session)):
    doc = await session.get(Document, document_id)
    if not doc or not doc.application_id:
        raise HTTPException(404, "Not found")
    app = await visible_app(session, user, doc.application_id)
    if body.status == "needs correction" and len(body.note.strip()) < 5:
        raise HTTPException(422, "Say what needs correcting; the institution sees this note.")
    doc.review_status, doc.review_note, doc.reviewed_by, doc.reviewed_at = body.status, body.note.strip() or None, user.name, datetime.now()
    await workflow.record(session, app, f"Document {'verified' if body.status == 'verified' else 'marked for correction'}: {doc.filename} (v{doc.version})", user.name, user.role, "APH 1.8", body.note.strip() or None)
    await session.commit()
    return DocumentOut.model_validate(doc)


@router.get("/documents/{document_id}/file", summary="The stored file itself, for the document viewer")
async def document_file(document_id: str, user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    doc = await session.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Not found")
    if user.portal == "institution":
        if doc.institution_id != user.institution_id:
            raise HTTPException(404, "Not found")
    elif doc.application_id:
        await visible_app(session, user, doc.application_id)
    elif region_scope(user):
        raise HTTPException(404, "Not found")
    data = await documents.storage.read(doc.storage_key)
    kind = "application/pdf" if data.startswith(b"%PDF") else "application/octet-stream"
    # The API's security headers (no framing, no scripts) also apply here; the viewer fetches the file and shows it from a blob URL.
    return Response(data, media_type=kind, headers={"Content-Disposition": f'inline; filename="{doc.filename}"', "Cache-Control": "private, max-age=300"})


# ---------------------------------------------------------------- decision readiness
def _check(label: str, state: str, detail: str, clause: str | None = None) -> dict:
    return {"label": label, "state": state, "detail": detail, "clause": clause}


@router.get("/applications/{app_id}/readiness", summary="Is the file ready for a decision? Checks, a suggested outcome and suggested conditions")
async def readiness(app_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    inst = await session.get(Institution, app.institution_id)
    version = await rules.published(session)
    path = rules.evaluate_path(version.table, **rules.facts_of(app))
    checks, conditions = [], []
    due = lambda days: (today() + timedelta(days=days)).isoformat()  # noqa: E731

    checks.append(_check("With the Executive Committee", "ok" if app.stage == "ec" else "block", "The file is at the Executive Committee." if app.stage == "ec" else f"The file is at {workflow.STAGE_LABEL.get(app.stage, app.stage)}; decisions are recorded at the Executive Committee.", "APH 2.25"))
    open_def = (await session.execute(select(func.count()).select_from(Deficiency).where(Deficiency.application_id == app.id, Deficiency.status == "open"))).scalar_one()
    checks.append(_check("Deficiencies answered", "ok" if not open_def else "block", "No open deficiency." if not open_def else f"{open_def} deficiency still open; the clock is paused.", "APH 1.8(f)"))
    doc_rows = (await app_documents(app.id, user, session))["documents"]
    bad = [r["name"] for r in doc_rows if r["status"] in ("needs correction", "missing")]
    waiting = [r["name"] for r in doc_rows if r["status"] in ("awaiting verification", "uploaded")]
    checks.append(_check("Documents verified", "block" if bad else "warn" if waiting else "ok", f"Needs correction or missing: {', '.join(bad)}" if bad else f"{len(waiting)} still to verify: {', '.join(waiting[:3])}" if waiting else f"All {len(doc_rows)} documents verified.", "APH 1.8"))
    if "evc" in path:
        fi = (await session.execute(select(FieldInspection).where(FieldInspection.application_id == app.id).order_by(FieldInspection.assigned_at.desc()))).scalars().first()
        panel = (await session.execute(select(EvcPanel).where(EvcPanel.application_id == app.id))).scalars().first()
        if fi and fi.status == "Submitted":
            p = inspection.progress(fi.items)
            checks.append(_check("Expert visit report", "warn" if p["failed"] else "ok", f"Signed by {fi.inspector_name}; {p['concerns']} concern(s), {p['failed']} not met.", "APH 1.9"))
            for i in fi.items:
                if i["result"] == "Does not meet":
                    conditions.append({"title": f"Fix: {i['label']} ({i['note'][:80]})", "dueOn": due(120), "clause": i["clause"][:40]})
        else:
            checks.append(_check("Expert visit report", "block" if app.stage == "ec" else "warn", "Report not yet signed." if fi else ("Panel drawn, inspection not assigned." if panel else "No expert visit yet."), "APH 1.9"))
    certs = list((await session.execute(select(Certificate).where(Certificate.institution_id == inst.id, Certificate.kind == "Fire and life safety certificate"))).scalars())
    fire = max((c.valid_until for c in certs if c.valid_until), default=None)
    if not fire:
        checks.append(_check("Fire and life safety certificate", "block", "No certificate on record.", "APH Annexure-3, 3.1(d)"))
    else:
        days = (fire - today()).days
        checks.append(_check("Fire and life safety certificate", "block" if days < 0 else "warn" if days <= 30 else "ok", f"{'Expired' if days < 0 else 'Valid until'} {fire:%d %b %Y}" + (f" ({days} days left)" if 0 <= days <= 30 else ""), "APH Annexure-3, 3.1(d)"))
        if 0 <= days <= 60:
            conditions.append({"title": "Upload the renewed fire and life safety certificate", "dueOn": fire.isoformat(), "clause": "APH Annexure-3, 3.1(d)"})
    infra = await infrastructure_of(session, inst.id)
    land_block = [x for x in infra["landChecks"] if x["severity"] == "blocker"]
    land_warn = [x for x in infra["landChecks"] if x["severity"] == "warning"]
    checks.append(_check("Land and lease", "block" if land_block else "warn" if land_warn else "ok", (land_block or land_warn or [{"title": "Plots and lease meet the norms."}])[0]["title"], "APH 6.17(a)"))
    if land_warn:
        conditions.append({"title": "Extend the land lease so it covers the longest course with margin", "dueOn": due(180), "clause": "APH 6.17(a)"})
    short_rooms = [r for r in infra["norms"]["rows"] if r["short"]] + [a for a in infra["norms"]["areas"] if a["status"] == "short"]
    checks.append(_check("Rooms against the norms", "warn" if short_rooms else "ok", ", ".join(f"{r.get('label', r.get('category'))}: short {r.get('short', '')}".strip() for r in short_rooms[:3]) if short_rooms else "Instructional, administrative and amenities areas meet Annexure-3.", "APH Annexure-3"))
    for r in short_rooms:
        if "kind" in r:
            conditions.append({"title": f"Add {r['short']} {r['label'].lower()} of at least {r['minArea']} m²", "dueOn": due(180), "clause": "APH Annexure-3"})
    fac = norms.check_faculty(await courses_of(session, inst.id), [faculty_out(f) for f in await faculty_rows(session, inst.id)])
    short = fac["required"] - fac["inPost"]
    checks.append(_check("Faculty", "warn" if short > 0 else "ok", f"{fac['inPost']} in post, {fac['required']} needed (short {short})." if short > 0 else f"{fac['inPost']} in post, {fac['required']} needed.", "APH Annexure-1"))
    if short > 0:
        conditions.append({"title": f"Appoint {short} faculty to meet the 1:20 norm", "dueOn": due(90), "clause": "APH Annexure-1"})
    overdue = (await session.execute(select(func.count()).select_from(Obligation).where(Obligation.institution_id == inst.id, Obligation.status.in_(("Overdue", "Escalated"))))).scalar_one()
    checks.append(_check("Earlier conditions", "warn" if overdue else "ok", f"{overdue} earlier condition(s) overdue." if overdue else "No earlier condition overdue.", "APH 2.25"))
    penal = (await session.execute(select(RegulatoryAction).where(RegulatoryAction.institution_id == inst.id, RegulatoryAction.kind.in_(PENAL)))).scalars().first()
    checks.append(_check("Regulatory actions", "block" if penal else "ok", f"{penal.kind} in force since {penal.effective_from:%d %b %Y}." if penal else "No penal action in force.", "APH Chapter VII"))

    blocks = [c for c in checks if c["state"] == "block"]
    warns = [c for c in checks if c["state"] == "warn"]
    approve = "EoA" if app.type_id in ("eoa", "break", "nri", "supernumerary") else "LoA"
    if blocks:
        suggestion = {"outcome": "LoD" if app.stage == "ec" else None, "text": "Not ready: " + "; ".join(b["label"] for b in blocks) + ". A Letter of Deficiency lists what to fix." if app.stage == "ec" else "Not at the Executive Committee yet."}
    elif warns:
        suggestion = {"outcome": approve, "text": f"Approve with {len(conditions)} condition(s) that follow from the checks below."}
    else:
        suggestion = {"outcome": approve, "text": "Every check passes. Approve without conditions."}
    unique = list({c["title"]: c for c in conditions}.values())[:8]
    return {"checks": checks, "suggestion": suggestion, "conditions": unique, "canDecide": user.role in DECIDERS and app.stage == "ec", "note": "A suggestion from the checks. The Executive Committee decides."}


# ---------------------------------------------------------------- why files are sent back
CATEGORIES = [
    ("NOC and affiliation", ("noc", "affiliat", "university"), "Ask the university for the NOC only after the course name is final. The self-check compares the two."),
    ("Signatures and stamp paper", ("dsc", "signed", "signature", "stamp paper"), "Sign with the DSC of the Chairman or Secretary of the Trust; the upload check reads the signer."),
    ("Fire and building safety", ("fire", "structural", "occupancy", "building plan"), "Keep certificates in the infrastructure locker; reminders start 60 days before expiry."),
    ("Land and lease", ("lease", "land", "deed"), "Keep at least 30 years of lease and more than the longest course left."),
    ("Faculty", ("faculty", "1:20", "cadre"), "Check the roster against the seat matrix before asking for more seats."),
    ("Laboratories and equipment", ("laborator", "equipment", "computer"), "Match the equipment list to the university curriculum before the expert visit."),
    ("Trust and bank records", ("resolution", "bank", "trust"), "Date and sign board resolutions; upload a cancelled cheque for bank changes."),
    ("Accreditation", ("nba", "naac", "accredit"), "Renew accreditation six months before it lapses."),
]


def category_of(text: str) -> str:
    t = text.lower()
    return next((name for name, words, _ in CATEGORIES if any(w in t for w in words)), "Other")


@router.get("/aicte/insights/return-reasons", summary="Why files are sent back: reasons grouped, with clauses, stages and time to fix")
async def return_reasons(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    stmt = select(Deficiency, Application.region).join(Application, Application.id == Deficiency.application_id)
    if scope := region_scope(user):
        stmt = stmt.where(Application.region == scope)
    rows = (await session.execute(stmt.order_by(Deficiency.raised_at.desc()))).all()
    groups: dict[str, list[Deficiency]] = defaultdict(list)
    for d, _ in rows:
        groups[category_of(d.text)].append(d)
    total = len(rows)
    advice = {name: tip for name, _, tip in CATEGORIES}
    out = []
    for name, items in groups.items():
        days = [(d.resolved_at - d.raised_at).days for d in items if d.resolved_at]
        out.append({
            "category": name, "count": len(items), "share": round(100 * len(items) / max(1, total)), "open": sum(1 for d in items if d.status == "open"),
            "medianDaysToFix": statistics.median(days) if days else None, "stages": dict(Counter(d.stage for d in items)), "clauses": [c for c, _ in Counter(d.clause for d in items).most_common(3)],
            "example": items[0].text, "advice": advice.get(name, "Read the deficiency letter closely; reply with the corrected document only."),
        })
    out.sort(key=lambda r: -r["count"])
    return {
        "total": total, "files": len({d.application_id for d, _ in rows}), "categories": out,
        "recent": [{"applicationId": d.application_id, "text": d.text, "stage": d.stage, "raisedAt": d.raised_at, "status": d.status} for d, _ in rows[:6]],
        "note": "Grouped by the words in each deficiency; an officer can read every original text in the file history.",
    }


# ---------------------------------------------------------------- user access (administrators)
@router.get("/aicte/admin/users", summary="Every account, its role and whether its access is switched on")
async def admin_users(user: Principal = Depends(require_roles("System administrator", "Bureau head", "Auditor")), session: AsyncSession = Depends(get_session)):
    from ..config import settings

    rows = (await session.execute(select(User).order_by(User.portal, User.role, User.name))).scalars()
    return {
        "users": [{"id": u.id, "name": u.name, "email": u.email, "portal": u.portal, "role": u.role, "region": u.region, "institutionId": u.institution_id, "active": u.active} for u in rows],
        "officerRoles": OFFICER_ROLES, "institutionRoles": INSTITUTION_ROLES, "canEdit": user.role == "System administrator",
        "sso": settings.auth_mode == "oidc",
        "note": "Roles and regions come from each person's single sign-on account (Keycloak) and are read at every sign-in. Here you switch access on or off; it takes effect within 30 seconds." if settings.auth_mode == "oidc" else "Development sign-in: roles belong to the sample accounts. Here you switch access on or off; it takes effect within 30 seconds.",
    }


@router.put("/aicte/admin/users/{user_id}", summary="Switch an account's access on or off")
async def admin_update(user_id: str, body: AdminUserIn, user: Principal = Depends(require_roles("System administrator")), session: AsyncSession = Depends(get_session)):
    u = await session.get(User, user_id)
    if not u:
        raise HTTPException(404, "Not found")
    if u.id == user.id:
        raise HTTPException(409, "You cannot change your own access.")
    if body.active != u.active:
        u.active = body.active
        forget_deactivated()
        await audit.append(session, "ACCESS", f"Access {'switched on' if u.active else 'switched off'} for {u.name} ({u.id})", user.name, user.role)
        await session.commit()
    return {"id": u.id, "role": u.role, "region": u.region, "active": u.active}


# ---------------------------------------------------------------- live navigation badges
@router.get("/me/badges", summary="Counts for the navigation badges, for whoever is signed in")
async def badges(user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    unread = select(func.count()).select_from(Notification).where(Notification.audience == user.portal, Notification.read.is_(False))
    if user.portal == "institution":
        inst = user.institution_id
        unread = unread.where(Notification.institution_id == inst)
        soon = today() + timedelta(days=30)
        drafts = 0
        if may(user, "review"):
            drafts = sum(1 for d in (await session.execute(select(Draft).where(Draft.institution_id == inst))).scalars() if ((d.data or {}).get("review") or {}).get("status") == "awaiting review")
        return {
            "applications": (await session.execute(select(func.count()).select_from(Application).where(Application.institution_id == inst, Application.public_status == "Action needed"))).scalar_one(),
            "compliance": (await session.execute(select(func.count()).select_from(Obligation).where(Obligation.institution_id == inst, Obligation.status.in_(("Due soon", "Overdue", "Escalated"))))).scalar_one(),
            "infrastructure": (await session.execute(select(func.count()).select_from(Certificate).where(Certificate.institution_id == inst, Certificate.valid_until.is_not(None), Certificate.valid_until <= soon))).scalar_one(),
            "notifications": (await session.execute(unread)).scalar_one(),
            "apply": drafts,
        }
    scope = region_scope(user)
    apps = select(func.count()).select_from(Application).where(Application.stage != "decision")
    if scope:
        apps = apps.where(Application.region == scope)
        unread = unread.where((Notification.region == scope) | (Notification.region.is_(None)))
    field = select(func.count()).select_from(FieldInspection).where(FieldInspection.status != "Submitted")
    if user.role == "Inspector":
        field = field.where(FieldInspection.inspector_id == user.id)
    return {
        "queue": (await session.execute(apps)).scalar_one(),
        "breached": (await session.execute(apps.where(Application.clock == "breached"))).scalar_one(),
        "evc": (await session.execute(apps.where(Application.stage == "evc"))).scalar_one(),
        "compliance": (await session.execute(select(func.count()).select_from(Obligation).where(Obligation.status.in_(("Overdue", "Escalated"))))).scalar_one(),
        "field": (await session.execute(field)).scalar_one(),
        "verification": (await session.execute(select(func.count()).select_from(Certificate).where(Certificate.verification == "Pending"))).scalar_one(),
        "notifications": (await session.execute(unread)).scalar_one(),
    }
