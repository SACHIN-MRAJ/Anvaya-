"""The one institutional record: profile, campuses, rooms, certificates, courses, faculty, signatories and team.

Applications reuse this record instead of asking for the same facts every year. Every change is written to the
institution's evidence chain (ref RECORD-<institution id>) with who made it and what changed, and an officer
verification is reset to "Pending" whenever the institution edits a record that was already checked.
"""
import hashlib
import json
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit
from ..config import today
from ..db import get_session
from ..models import (
    ApplicationType, Campus, Certificate, Draft, Faculty, Institution, Leader, Member, Notification, Programme, RegulatoryAction, Space, User,
)
from ..schemas import (
    AccreditationIn, CampusIn, CertificateIn, DbId, DraftReviewIn, FacultyIn, FacultyUpdateIn, InstitutionOut, LeaderIn, MemberIn, MemberUpdateIn,
    Principal, ProfileIn, ProgrammeChangeIn, SpaceIn,
)
from ..security import INSTITUTION_ROLES, PERMISSION_LABEL, PERMISSIONS, forget_deactivated, require_permission, require_portal
from ..services import norms
from ..services.notify import notify

router = APIRouter(tags=["Institutional record"])
member = require_portal("institution")
SIGNATORY_POSITIONS = {"Chairman of the Trust", "Secretary of the Trust"}  # APH 1.4.6
PROFILE_FIELDS = {"address": "Address", "pincode": "PIN code", "email": "Email", "phone": "Phone", "website": "Website", "registeredUnder": "Registered under", "registrationNo": "Registration number", "university": "Affiliating university"}


async def _log(session: AsyncSession, user: Principal, action: str, note: str | None = None, clause: str | None = None) -> None:
    await audit.append(session, f"RECORD-{user.institution_id}", action, user.name, user.role, clause, note)


async def _own(session: AsyncSession, model, row_id, user: Principal):
    row = await session.get(model, row_id)
    if not row or row.institution_id != user.institution_id:
        raise HTTPException(404, "Not found")
    return row


# ---------------------------------------------------------------- shapes
def campus_out(c: Campus) -> dict:
    return {
        "id": c.id, "name": c.name, "address": c.address, "city": c.city, "state": c.state, "pincode": c.pincode, "lat": c.lat, "lng": c.lng,
        "landAcres": c.land_acres, "ownership": c.ownership, "deedNo": c.deed_no, "leaseStart": c.lease_start, "leaseEnd": c.lease_end, "isMain": c.is_main,
    }


def space_out(s: Space) -> dict:
    return {"id": s.id, "campusId": s.campus_id, "category": s.category, "kind": s.kind, "name": s.name, "building": s.building, "areaSqm": s.area_sqm}


def certificate_out(c: Certificate) -> dict:
    clause, expires = norms.CERTIFICATE_KINDS.get(c.kind, ("", c.valid_until is not None))
    return {
        "id": c.id, "kind": c.kind, "number": c.number, "issuedBy": c.issued_by, "issuedOn": c.issued_on, "validUntil": c.valid_until, "campusId": c.campus_id,
        "documentId": c.document_id, "verification": c.verification, "verifiedBy": c.verified_by, "verifiedAt": c.verified_at, "note": c.note,
        "clause": clause, "expires": expires, **norms.certificate_state(c.valid_until, today()),
    }


def programme_out(p: Programme) -> dict:
    acc = p.accreditation or {}
    acc_state = None
    if acc.get("validUntil"):
        days = (datetime.fromisoformat(acc["validUntil"]).date() - today()).days
        acc_state = "Lapsed" if days < 0 else "Renew soon" if days <= 180 else "Valid"
    return {
        "id": p.id, "department": p.department, "name": p.name, "level": p.level, "durationYears": p.duration_years, "approvedIntake": p.approved_intake,
        "status": p.status, "since": p.since, "xCategory": p.x_category, "accreditation": acc or None, "accreditationState": acc_state,
        "sanctionedStudents": p.approved_intake * p.duration_years,
    }


def faculty_out(f: Faculty) -> dict:
    return {
        "id": f.id, "name": f.name, "designation": f.designation, "department": f.department, "qualification": f.qualification, "employment": f.employment,
        "status": f.status, "verification": f.verification, "joined": f.joined, "panOnFile": bool(f.pan_hash),
    }


def leader_out(lead: Leader) -> dict:
    return {"id": lead.id, "name": lead.name, "position": lead.position, "department": lead.department, "email": lead.email, "isSignatory": lead.is_signatory, "since": lead.since, "until": lead.until}


def member_out(m: Member) -> dict:
    return {"id": m.id, "name": m.name, "email": m.email, "role": m.role, "active": m.active, "addedBy": m.added_by, "addedAt": m.added_at, "deactivatedAt": m.deactivated_at, "can": sorted(p for p, roles in PERMISSIONS.items() if m.role in roles)}


async def courses_of(session: AsyncSession, institution_id: str) -> list[norms.Course]:
    rows = (await session.execute(select(Programme).where(Programme.institution_id == institution_id, Programme.status == "Approved"))).scalars()
    return [norms.Course(p.id, p.name, p.department, p.level, p.duration_years, p.approved_intake, p.x_category) for p in rows]


async def faculty_rows(session: AsyncSession, institution_id: str) -> list[Faculty]:
    return list((await session.execute(select(Faculty).where(Faculty.institution_id == institution_id).order_by(Faculty.department, Faculty.designation, Faculty.name))).scalars())


async def faculty_check(session: AsyncSession, institution_id: str, courses: list[norms.Course] | None = None) -> dict:
    rows = await faculty_rows(session, institution_id)
    return norms.check_faculty(courses if courses is not None else await courses_of(session, institution_id), [faculty_out(f) for f in rows])


async def infrastructure_of(session: AsyncSession, institution_id: str) -> dict:
    inst = await session.get(Institution, institution_id)
    campuses = list((await session.execute(select(Campus).where(Campus.institution_id == institution_id).order_by(Campus.is_main.desc(), Campus.id))).scalars())
    spaces = list((await session.execute(select(Space).where(Space.institution_id == institution_id).order_by(Space.category, Space.kind, Space.id))).scalars())
    certs = list((await session.execute(select(Certificate).where(Certificate.institution_id == institution_id))).scalars())
    c_out = [campus_out(c) for c in campuses]
    land = norms.check_campuses(c_out, inst.longest_course_years, today())
    s_out = [space_out(s) for s in spaces]
    cert_out = sorted((certificate_out(c) for c in certs), key=lambda c: (c["days"] is None, c["days"] if c["days"] is not None else 0))
    return {
        "campuses": c_out, "landChecks": land, "spaces": s_out, "norms": norms.check_spaces(await courses_of(session, institution_id), s_out),
        "certificates": cert_out, "certificateKinds": list(norms.CERTIFICATE_KINDS), "spaceKinds": [r["kind"] for r in norms.required_spaces(await courses_of(session, institution_id))],
    }


# ---------------------------------------------------------------- profile and signatories
def _entry(e) -> dict:
    p = json.loads(e.payload)
    return {"at": e.at, "actor": e.actor, "role": p.get("role"), "action": e.action, "note": p.get("note"), "rule": p.get("rule"), "hash": e.hash}


@router.get("/institution/profile", summary="The institution profile, signatories, change history and any regulatory actions")
async def profile(user: Principal = Depends(member), session: AsyncSession = Depends(get_session)):
    inst = await session.get(Institution, user.institution_id)
    leaders = list((await session.execute(select(Leader).where(Leader.institution_id == inst.id).order_by(Leader.until.is_not(None), Leader.since))).scalars())
    history = await audit.chain(session, f"RECORD-{inst.id}")
    actions = (await session.execute(select(RegulatoryAction).where(RegulatoryAction.institution_id == inst.id).order_by(RegulatoryAction.decided_at.desc(), RegulatoryAction.id.desc()))).scalars()
    filled = sum(1 for k in PROFILE_FIELDS if (inst.profile or {}).get(k))
    signatories = [lead for lead in leaders if lead.is_signatory and lead.until is None]
    return {
        "institution": InstitutionOut.model_validate(inst), "profile": inst.profile or {}, "fields": PROFILE_FIELDS, "completeness": round(100 * filled / len(PROFILE_FIELDS)),
        "leaders": [leader_out(x) for x in leaders], "signatoryOk": any(s.position in SIGNATORY_POSITIONS for s in signatories),
        "history": [_entry(e) for e in reversed(history[-60:])],
        "actions": [{"id": a.id, "kind": a.kind, "detail": a.detail, "reason": a.reason, "decidedBy": a.decided_by, "role": a.role, "decidedAt": a.decided_at, "effectiveFrom": a.effective_from} for a in actions],
    }


@router.put("/institution/profile", summary="Update contact and trust details; each change is recorded with its old and new value")
async def update_profile(body: ProfileIn, user: Principal = Depends(require_permission("profile")), session: AsyncSession = Depends(get_session)):
    inst = await session.get(Institution, user.institution_id)
    current = dict(inst.profile or {})
    changes = []
    for key, value in body.model_dump(by_alias=True, exclude_none=True).items():
        value = value.strip() if isinstance(value, str) else value
        if current.get(key) != value:
            changes.append(f"{PROFILE_FIELDS.get(key, key)}: “{current.get(key) or '—'}” → “{value}”")
            current[key] = value
    if not changes:
        return {"changed": 0, "profile": current}
    inst.profile = current
    await _log(session, user, f"Profile updated ({len(changes)} field{'s' if len(changes) != 1 else ''})", "; ".join(changes)[:1000])
    await session.commit()
    return {"changed": len(changes), "profile": current}


@router.post("/institution/leaders", status_code=201, summary="Add a leader or authorised signatory")
async def add_leader(body: LeaderIn, user: Principal = Depends(require_permission("profile")), session: AsyncSession = Depends(get_session)):
    if body.is_signatory and body.position not in SIGNATORY_POSITIONS:
        raise HTTPException(422, "Only the Chairman or the Secretary of the Trust may sign applications (APH 1.4.6). Others may review internally.")
    lead = Leader(institution_id=user.institution_id, name=body.name.strip(), position=body.position, department=body.department, email=body.email, is_signatory=body.is_signatory, since=body.since)
    session.add(lead)
    await _log(session, user, f"Leader added: {lead.name} ({lead.position}{', signatory' if lead.is_signatory else ''})", clause="APH 1.4.6" if lead.is_signatory else None)
    await session.commit()
    return leader_out(lead)


@router.post("/institution/leaders/{leader_id}/end", summary="Record that a leader has left the post (kept in history)")
async def end_leader(leader_id: DbId, user: Principal = Depends(require_permission("profile")), session: AsyncSession = Depends(get_session)):
    lead = await _own(session, Leader, leader_id, user)
    if lead.until:
        raise HTTPException(409, "Already recorded as left")
    if lead.is_signatory:
        others = (await session.execute(select(func.count()).select_from(Leader).where(Leader.institution_id == user.institution_id, Leader.is_signatory.is_(True), Leader.until.is_(None), Leader.id != lead.id))).scalar_one()
        if not others:
            raise HTTPException(409, "Add the new Chairman or Secretary as a signatory first, so applications can still be signed.")
    lead.until = today()
    await _log(session, user, f"Leader left: {lead.name} ({lead.position})")
    await session.commit()
    return leader_out(lead)


# ---------------------------------------------------------------- infrastructure locker
@router.get("/institution/infrastructure", summary="Campuses, rooms against the APH norms, and certificates with their expiry")
async def infrastructure(user: Principal = Depends(member), session: AsyncSession = Depends(get_session)):
    return await infrastructure_of(session, user.institution_id)


@router.post("/institution/campuses", status_code=201, summary="Add a campus or plot")
async def add_campus(body: CampusIn, user: Principal = Depends(require_permission("infrastructure")), session: AsyncSession = Depends(get_session)):
    count = (await session.execute(select(func.count()).select_from(Campus).where(Campus.institution_id == user.institution_id))).scalar_one()
    if count >= 3:
        raise HTTPException(409, "An institution may have at most three plots, all within 2 km (APH Annexure-3, 3.1(g)).")
    if body.ownership == "Leased" and not (body.lease_start and body.lease_end):
        raise HTTPException(422, "Give the lease start and end dates for leased land.")
    c = Campus(id=f"CMP-{user.institution_id[-3:]}-{count + 1}-{secrets.token_hex(2)}", institution_id=user.institution_id, **body.model_dump())
    if c.is_main:
        for other in (await session.execute(select(Campus).where(Campus.institution_id == user.institution_id))).scalars():
            other.is_main = False
    session.add(c)
    await _log(session, user, f"Campus added: {c.name} ({c.ownership}, {c.land_acres} acres)", clause="APH Annexure-3, 3.1(g)")
    await session.commit()
    return campus_out(c)


@router.put("/institution/campuses/{campus_id}", summary="Update a campus; an officer check is reset to pending")
async def update_campus(campus_id: str, body: CampusIn, user: Principal = Depends(require_permission("infrastructure")), session: AsyncSession = Depends(get_session)):
    c = await _own(session, Campus, campus_id, user)
    if body.ownership == "Leased" and not (body.lease_start and body.lease_end):
        raise HTTPException(422, "Give the lease start and end dates for leased land.")
    before = campus_out(c)
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    changed = [k for k, v in campus_out(c).items() if before.get(k) != v]
    await _log(session, user, f"Campus updated: {c.name}", ", ".join(changed) or None)
    await session.commit()
    return campus_out(c)


@router.post("/institution/spaces", status_code=201, summary="Add rooms (carpet area in square metres)")
async def add_space(body: SpaceIn, user: Principal = Depends(require_permission("infrastructure")), session: AsyncSession = Depends(get_session)):
    await _own(session, Campus, body.campus_id, user)
    rows = [
        Space(institution_id=user.institution_id, campus_id=body.campus_id, category=body.category, kind=body.kind, name=f"{body.name} {k}" if body.count > 1 else body.name, building=body.building, area_sqm=body.area_sqm)
        for k in range(1, body.count + 1)
    ]
    session.add_all(rows)
    await _log(session, user, f"{body.count} × {body.kind} added ({body.area_sqm:g} m² each, {body.building or 'no building named'})", clause="APH Annexure-3")
    await session.commit()
    return [space_out(s) for s in rows]


@router.put("/institution/spaces/{space_id}", summary="Correct a room's details")
async def update_space(space_id: DbId, body: SpaceIn, user: Principal = Depends(require_permission("infrastructure")), session: AsyncSession = Depends(get_session)):
    s = await _own(session, Space, space_id, user)
    await _own(session, Campus, body.campus_id, user)
    note = f"{s.area_sqm:g} → {body.area_sqm:g} m²" if s.area_sqm != body.area_sqm else None
    s.campus_id, s.category, s.kind, s.name, s.building, s.area_sqm = body.campus_id, body.category, body.kind, body.name, body.building, body.area_sqm
    await _log(session, user, f"Room updated: {s.name}", note)
    await session.commit()
    return space_out(s)


@router.delete("/institution/spaces/{space_id}", status_code=204, summary="Remove a room that no longer exists")
async def delete_space(space_id: DbId, user: Principal = Depends(require_permission("infrastructure")), session: AsyncSession = Depends(get_session)):
    s = await _own(session, Space, space_id, user)
    await _log(session, user, f"Room removed: {s.name} ({s.kind}, {s.area_sqm:g} m²)")
    await session.delete(s)
    await session.commit()


@router.post("/institution/certificates", status_code=201, summary="Add a certificate with its validity")
async def add_certificate(body: CertificateIn, user: Principal = Depends(require_permission("infrastructure")), session: AsyncSession = Depends(get_session)):
    if body.campus_id:
        await _own(session, Campus, body.campus_id, user)
    if body.valid_until and body.issued_on and body.valid_until <= body.issued_on:
        raise HTTPException(422, "The validity date must be after the issue date.")
    c = Certificate(id=f"CERT-{user.institution_id[-3:]}-{secrets.token_hex(3)}", institution_id=user.institution_id, verification="Pending", reminded=[], **body.model_dump())
    session.add(c)
    await _log(session, user, f"Certificate added: {c.kind}" + (f", valid until {c.valid_until:%d %b %Y}" if c.valid_until else ""), c.number or None, norms.CERTIFICATE_KINDS.get(c.kind, (None,))[0])
    await session.commit()
    return certificate_out(c)


@router.put("/institution/certificates/{cert_id}", summary="Renew or correct a certificate; reminders restart and the officer check resets")
async def renew_certificate(cert_id: str, body: CertificateIn, user: Principal = Depends(require_permission("infrastructure")), session: AsyncSession = Depends(get_session)):
    c = await _own(session, Certificate, cert_id, user)
    if body.valid_until and body.issued_on and body.valid_until <= body.issued_on:
        raise HTTPException(422, "The validity date must be after the issue date.")
    old = c.valid_until
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    c.verification, c.verified_by, c.verified_at, c.reminded = "Pending", None, None, []
    await _log(session, user, f"Certificate renewed: {c.kind}", f"valid until {old or 'no date'} → {c.valid_until or 'no date'}", norms.CERTIFICATE_KINDS.get(c.kind, (None,))[0])
    await session.commit()
    return certificate_out(c)


# ---------------------------------------------------------------- courses and seats
async def _seat_matrix(session: AsyncSession, institution_id: str) -> dict:
    progs = list((await session.execute(select(Programme).where(Programme.institution_id == institution_id).order_by(Programme.department, Programme.level, Programme.name))).scalars())
    check = await faculty_check(session, institution_id)
    have = {d["department"]: d for d in check["departments"]}
    departments = {}
    for p in progs:
        if p.status != "Approved":
            continue
        row = departments.setdefault(p.department, {"department": p.department, "programmes": 0, "intake": 0, "students": 0})
        row["programmes"] += 1
        row["intake"] += p.approved_intake
        row["students"] += p.approved_intake * p.duration_years
    for dept, row in departments.items():
        row["facultyNeed"], row["facultyHave"] = have.get(dept, {}).get("need", 0), have.get(dept, {}).get("have", 0)
    return {
        "programmes": [programme_out(p) for p in progs], "departments": list(departments.values()),
        "totals": {"intake": sum(r["intake"] for r in departments.values()), "students": sum(r["students"] for r in departments.values()), "facultyNeed": check["required"], "facultyHave": check["inPost"]},
    }


@router.get("/institution/programmes", summary="Course and seat matrix with the faculty each department needs")
async def programmes(user: Principal = Depends(member), session: AsyncSession = Depends(get_session)):
    return await _seat_matrix(session, user.institution_id)


CHANGE_TYPE = {"increase": "intake", "new": "intake", "reduce": "coursename", "rename": "coursename", "close": "closecourse"}


def _apply_change(courses: list[norms.Course], body: ProgrammeChangeIn, target: Programme | None) -> list[norms.Course]:
    out = [norms.Course(**vars(c)) for c in courses]
    if body.change == "new":
        out.append(norms.Course("new", body.new_name or "New course", body.department or "New department", body.level or "UG", body.duration_years or 4, body.new_intake or 60))
    elif target:
        for c in out:
            if c.id == target.id:
                if body.change in ("increase", "reduce"):
                    c.intake = body.new_intake or c.intake
                elif body.change == "close":
                    c.intake = 0
                elif body.change == "rename":
                    c.name = body.new_name or c.name
    return [c for c in out if c.intake > 0]


async def _seat_impact(session: AsyncSession, institution_id: str, body: ProgrammeChangeIn) -> dict:
    target = None
    if body.change != "new":
        if not body.programme_id:
            raise HTTPException(422, "Choose the course to change.")
        target = await session.get(Programme, body.programme_id)
        if not target or target.institution_id != institution_id:
            raise HTTPException(404, "Not found")
        if body.change == "increase" and (body.new_intake or 0) <= target.approved_intake:
            raise HTTPException(422, f"An increase needs a new intake above {target.approved_intake}.")
        if body.change == "reduce" and not (0 < (body.new_intake or 0) < target.approved_intake):
            raise HTTPException(422, f"A reduction needs a new intake between 1 and {target.approved_intake - 1}.")
    elif not (body.new_name and body.new_intake and body.department):
        raise HTTPException(422, "A new course needs a name, a department and an intake.")
    before = await courses_of(session, institution_id)
    after = _apply_change(before, body, target)
    spaces = [space_out(s) for s in (await session.execute(select(Space).where(Space.institution_id == institution_id))).scalars()]
    rows = await faculty_rows(session, institution_id)
    fac_before, fac_after = norms.check_faculty(before, [faculty_out(f) for f in rows]), norms.check_faculty(after, [faculty_out(f) for f in rows])
    sp_before, sp_after = norms.check_spaces(before, spaces), norms.check_spaces(after, spaces)
    rooms = []
    for a in sp_after["rows"]:
        b = next((x for x in sp_before["rows"] if x["kind"] == a["kind"]), {"rooms": 0})
        if a["rooms"] != b["rooms"] or a["short"]:
            rooms.append({"kind": a["kind"], "label": a["label"], "before": b["rooms"], "after": a["rooms"], "have": a["have"], "short": a["short"]})
    t = await session.get(ApplicationType, CHANGE_TYPE[body.change])
    return {
        "typeId": t.id, "typeName": t.name, "clause": t.clause, "documents": [x["name"] for x in t.documents],
        "programme": target.name if target else body.new_name, "currentIntake": target.approved_intake if target else 0,
        "requestedIntake": 0 if body.change == "close" else (body.new_intake if body.new_intake is not None else (target.approved_intake if target else 0)),
        "faculty": {"before": fac_before["required"], "after": fac_after["required"], "inPost": fac_after["inPost"], "short": max(0, fac_after["required"] - fac_after["inPost"])},
        "rooms": rooms, "computers": {"before": norms.computers_needed(before), "after": norms.computers_needed(after)},
        "ready": not any(r["short"] for r in rooms) and fac_after["required"] <= fac_after["inPost"],
    }


@router.post("/institution/programmes/seat-check", summary="What a change of seats or courses would need: faculty, rooms, computers and the request to file")
async def seat_check(body: ProgrammeChangeIn, user: Principal = Depends(member), session: AsyncSession = Depends(get_session)):
    return await _seat_impact(session, user.institution_id, body)


@router.post("/institution/programmes/draft", status_code=201, summary="Start the matching application, pre-filled from the seat check")
async def seat_draft(body: ProgrammeChangeIn, user: Principal = Depends(require_permission("academics")), session: AsyncSession = Depends(get_session)):
    impact = await _seat_impact(session, user.institution_id, body)
    reason = {"increase": "Increase in intake", "new": "Additional course", "reduce": "Reduction in intake", "rename": "Change of course name", "close": "Closure of the course"}[body.change]
    details = {"programme": impact["programme"], "current": impact["currentIntake"], "requested": impact["requestedIntake"], "reason": f"{reason}, prepared from the course and seat matrix.", "change": body.change}
    draft_id = f"DRF-{user.institution_id}-apply"
    d = await session.get(Draft, draft_id)
    data = {"step": 1, "details": details, "decl": {"truth": False, "lock": False}, "uploads": {}, "review": None, "preparedBy": user.name}
    if d:
        d.type_id, d.data, d.updated_at = impact["typeId"], data, datetime.now()
    else:
        session.add(Draft(id=draft_id, institution_id=user.institution_id, type_id=impact["typeId"], data=data))
    await _log(session, user, f"Draft started from the seat matrix: {reason.lower()} for {impact['programme']}")
    await session.commit()
    return {"draftId": draft_id, "typeId": impact["typeId"], "details": details}


@router.put("/institution/programmes/{programme_id}/accreditation", summary="Record NBA or NAAC accreditation for a course")
async def accreditation(programme_id: str, body: AccreditationIn, user: Principal = Depends(require_permission("academics")), session: AsyncSession = Depends(get_session)):
    p = await _own(session, Programme, programme_id, user)
    p.accreditation = {"body": body.body, "number": body.number, "validUntil": body.valid_until.isoformat()}
    await _log(session, user, f"Accreditation recorded for {p.name}: {body.body} until {body.valid_until:%d %b %Y}", body.number)
    await session.commit()
    return programme_out(p)


# ---------------------------------------------------------------- faculty roster
@router.get("/institution/faculty", summary="Faculty roster checked against the 1:20 / 1:15 norms, the 1:2:6 cadre and qualifications")
async def faculty(user: Principal = Depends(member), session: AsyncSession = Depends(get_session)):
    rows = await faculty_rows(session, user.institution_id)
    return {"faculty": [faculty_out(f) for f in rows], "norms": norms.check_faculty(await courses_of(session, user.institution_id), [faculty_out(f) for f in rows])}


@router.post("/institution/faculty", status_code=201, summary="Add a faculty member; only a hash of the PAN is kept")
async def add_faculty(body: FacultyIn, user: Principal = Depends(require_permission("academics")), session: AsyncSession = Depends(get_session)):
    pan_hash = hashlib.sha256(body.pan.upper().encode()).hexdigest()[:16] if body.pan else ""
    elsewhere = []
    if pan_hash:
        elsewhere = list((await session.execute(select(Faculty.institution_id).where(Faculty.pan_hash == pan_hash, Faculty.status == "Active", Faculty.institution_id != user.institution_id))).scalars())
    f = Faculty(
        id=f"F-{user.institution_id[-3:]}-{secrets.token_hex(3)}", name=body.name.strip(), pan_hash=pan_hash, institution_id=user.institution_id, designation=body.designation, joined=body.joined,
        department=body.department, qualification=body.qualification, employment=body.employment, status="Active", verification="Pending",
    )
    session.add(f)
    await _log(session, user, f"Faculty added: {f.name}, {f.designation} ({f.department})", None if pan_hash else "PAN not given", "APH Annexure-1")
    await session.commit()
    warning = "This PAN is already listed as full-time at another institution. AICTE will ask both institutions to explain." if elsewhere else None
    return {**faculty_out(f), "warning": warning}


@router.put("/institution/faculty/{faculty_id}", summary="Update a faculty member, or record that they have left")
async def update_faculty(faculty_id: str, body: FacultyUpdateIn, user: Principal = Depends(require_permission("academics")), session: AsyncSession = Depends(get_session)):
    f = await _own(session, Faculty, faculty_id, user)
    changes = []
    for k, v in body.model_dump(exclude_none=True).items():
        if getattr(f, k) != v:
            changes.append(f"{k}: {getattr(f, k)} → {v}")
            setattr(f, k, v)
    if not changes:
        return faculty_out(f)
    if any(c.startswith(("designation", "qualification")) for c in changes):
        f.verification = "Pending"
    await _log(session, user, f"Faculty {'left' if body.status == 'Left' else 'updated'}: {f.name}", "; ".join(changes))
    await session.commit()
    return faculty_out(f)


# ---------------------------------------------------------------- team and access
@router.get("/institution/team", summary="People working on the institution's records and what each role may do")
async def team(user: Principal = Depends(member), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(Member).where(Member.institution_id == user.institution_id).order_by(Member.active.desc(), Member.role, Member.name))).scalars()
    return {
        "members": [member_out(m) for m in rows], "roles": INSTITUTION_ROLES,
        "permissions": [{"id": p, "label": PERMISSION_LABEL[p], "roles": [r for r in INSTITUTION_ROLES if r in roles]} for p, roles in PERMISSIONS.items()],
        "me": {"role": user.role, "can": sorted(p for p, roles in PERMISSIONS.items() if user.role in roles)},
    }


@router.post("/institution/team", status_code=201, summary="Give a person access with a role")
async def add_member(body: MemberIn, user: Principal = Depends(require_permission("team")), session: AsyncSession = Depends(get_session)):
    if body.role not in INSTITUTION_ROLES:
        raise HTTPException(422, f"Choose one of: {', '.join(INSTITUTION_ROLES)}")
    email = body.email.strip().lower()
    if (await session.execute(select(Member).where(Member.institution_id == user.institution_id, func.lower(Member.email) == email))).scalar_one_or_none():
        raise HTTPException(409, "This person already has access. Change their role instead.")
    uid = f"u-{user.institution_id.lower()}-{secrets.token_hex(3)}"
    m = Member(institution_id=user.institution_id, name=body.name.strip(), email=email, role=body.role, user_id=uid, added_by=user.name)
    session.add_all([m, User(id=uid, name=m.name, email=email, portal="institution", role=m.role, institution_id=user.institution_id, channels=["email"])])
    await _log(session, user, f"Access given: {m.name} as {m.role}", email)
    await session.commit()
    return member_out(m)


@router.put("/institution/team/{member_id}", summary="Change a person's role or switch their access off")
async def update_member(member_id: DbId, body: MemberUpdateIn, user: Principal = Depends(require_permission("team")), session: AsyncSession = Depends(get_session)):
    m = await _own(session, Member, member_id, user)
    if body.role is not None and body.role not in INSTITUTION_ROLES:
        raise HTTPException(422, f"Choose one of: {', '.join(INSTITUTION_ROLES)}")
    if m.user_id == user.id and (body.active is False or (body.role and body.role != m.role)):
        raise HTTPException(409, "You cannot change your own access. Ask another Principal or AICTE.")
    losing_principal = m.role == "Principal / Director" and m.active and (body.active is False or (body.role and body.role != "Principal / Director"))
    if losing_principal:
        others = (await session.execute(select(func.count()).select_from(Member).where(Member.institution_id == user.institution_id, Member.role == "Principal / Director", Member.active.is_(True), Member.id != m.id))).scalar_one()
        if not others:
            raise HTTPException(409, "The institution needs at least one active Principal / Director.")
    notes = []
    if body.role and body.role != m.role:
        notes.append(f"role {m.role} → {body.role}")
        m.role = body.role
    if body.active is not None and body.active != m.active:
        notes.append("access switched on" if body.active else "access switched off")
        m.active, m.deactivated_at = body.active, None if body.active else datetime.now()
    if not notes:
        return member_out(m)
    account = await session.get(User, m.user_id) if m.user_id else None
    if account:
        account.role, account.active = m.role, m.active
    forget_deactivated()
    await _log(session, user, f"Access changed for {m.name}", "; ".join(notes))
    await session.commit()
    return member_out(m)


# ---------------------------------------------------------------- prepare, review, submit
def _review_out(d: Draft) -> dict:
    return {"id": d.id, "typeId": d.type_id, "updatedAt": d.updated_at, "review": (d.data or {}).get("review"), "preparedBy": (d.data or {}).get("preparedBy")}


@router.get("/institution/drafts", summary="Drafts and where each one is in the internal review")
async def drafts(user: Principal = Depends(member), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(Draft).where(Draft.institution_id == user.institution_id).order_by(Draft.updated_at.desc()))).scalars()
    return [_review_out(d) for d in rows]


@router.post("/institution/drafts/{draft_id}/send-for-review", summary="Ask the HoD or Principal to review a draft before it is submitted")
async def send_for_review(draft_id: str, user: Principal = Depends(require_permission("upload")), session: AsyncSession = Depends(get_session)):
    d = await _own(session, Draft, draft_id, user)
    d.data = {**(d.data or {}), "review": {"status": "awaiting review", "by": user.name, "role": user.role, "at": datetime.now().isoformat(timespec="seconds")}, "preparedBy": (d.data or {}).get("preparedBy") or user.name}
    await notify(session, "institution", f"A draft ({d.type_id}) is ready for review, prepared by {user.name}", "brand", d.id, institution_id=user.institution_id)
    await _log(session, user, f"Draft sent for review ({d.type_id})")
    await session.commit()
    return _review_out(d)


@router.post("/institution/drafts/{draft_id}/review", summary="Review a draft: approve it for submission or ask for changes (the Principal submits)")
async def review_draft(draft_id: str, body: DraftReviewIn, user: Principal = Depends(require_permission("review")), session: AsyncSession = Depends(get_session)):
    d = await _own(session, Draft, draft_id, user)
    review = (d.data or {}).get("review") or {}
    if review.get("by") == user.name and user.role != "Principal / Director":
        raise HTTPException(409, "Someone other than the person who prepared the draft should review it.")
    if body.decision == "changes" and len(body.note.strip()) < 5:
        raise HTTPException(422, "Say what should change.")
    status = "approved" if body.decision == "approved" else "changes requested"
    d.data = {**(d.data or {}), "review": {**review, "status": status, "reviewer": user.name, "reviewerRole": user.role, "note": body.note.strip(), "reviewedAt": datetime.now().isoformat(timespec="seconds")}}
    text = f"Draft {d.type_id} reviewed by {user.name}: " + ("ready for the Principal to submit" if status == "approved" else f"changes asked: {body.note.strip()[:120]}")
    session.add(Notification(audience="institution", institution_id=user.institution_id, title=text, tone="green" if status == "approved" else "amber", ref=d.id))
    await _log(session, user, f"Draft review: {status}", body.note.strip() or None)
    await session.commit()
    return _review_out(d)
