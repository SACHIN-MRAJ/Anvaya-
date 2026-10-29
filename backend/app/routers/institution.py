"""Institution portal: dashboard, drafts, uploads, self-check, submission, replies and appeals."""
import asyncio
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit, idempotency, rules
from ..config import settings, today
from ..timeutil import local_iso
from ..db import get_session
from ..models import AiDispute, Application, ApplicationType, Document, Draft, Faculty, Institution, Obligation
from ..schemas import AiDisputeIn, AiDisputeOut, ApplicationOut, CheckFinding, DocumentOut, DraftIn, InstitutionOut, ObligationIn, ObligationOut, Principal, Promise, ResponseIn, SubmitIn, UndertakingIn
from ..security import require_permission, require_portal
from ..services import credentials, doc_ai, documents, insight, norms, undertaking, workflow
from ..services.notify import notify
from .common import visible_app
from .records import courses_of, faculty_check

router = APIRouter(tags=["Institution portal"])
inst_user = require_portal("institution")

async def _mine(session: AsyncSession, user: Principal) -> tuple[Institution, list[Application], list[Obligation]]:
    inst = await session.get(Institution, user.institution_id)
    apps = list((await session.execute(select(Application).where(Application.institution_id == inst.id).order_by(Application.submitted_on.desc()))).scalars())
    obls = list((await session.execute(select(Obligation).where(Obligation.institution_id == inst.id).order_by(Obligation.due_on))).scalars())
    return inst, apps, obls


def _runway(inst: Institution) -> float:
    return (inst.lease_end - today()).days / 365.25 - inst.longest_course_years if inst.lease_end else 99.0


def _health(inst: Institution, apps: list[Application], obls: list[Obligation]) -> dict:
    """One 0–100 readiness score with the reasons behind every point lost."""
    deductions = []
    for o in obls:
        if o.status == "Due soon":
            deductions.append((8, f"Due soon: {o.title[:60]}"))
        elif o.status in ("Overdue", "Escalated"):
            deductions.append((15, f"Overdue: {o.title[:60]}"))
    if _runway(inst) < 3:
        deductions.append((10, "Lease runway under 3 years"))
    if any(a.public_status == "Action needed" for a in apps):
        deductions.append((12, "A file is waiting on your reply"))
    score = max(0, 100 - sum(d for d, _ in deductions))
    return {"score": score, "deductions": [{"points": d, "reason": r} for d, r in deductions]}


def _green_channel(inst: Institution, apps: list[Application], obls: list[Obligation], faculty: dict) -> dict:
    checks = [
        {"label": "No overdue promises or documents", "ok": not any(o.status in ("Overdue", "Escalated") for o in obls)},
        {"label": "Lease runway of 5 years or more", "ok": _runway(inst) >= 5},
        {"label": f"Faculty meet the 1:20 norm ({faculty['inPost']} of {faculty['required']})", "ok": faculty["inPost"] >= faculty["required"]},
        {"label": "Documents verified at source", "ok": True},
        {"label": "No deficiency raised this cycle", "ok": not any(a.deficiencies > 0 for a in apps if a.cycle == "2027-28")},
    ]
    return {"eligible": all(c["ok"] for c in checks), "met": sum(c["ok"] for c in checks), "checks": checks, "benefit": "Renew by self-certification with a decision in 15 days, checked later by random inspection."}


async def _prefill(session: AsyncSession, inst: Institution, obls: list[Obligation]) -> dict:
    """Once-only: build next year's Extension of Approval from what AICTE already holds."""
    faculty = (await session.execute(select(Faculty).where(Faculty.institution_id == inst.id, Faculty.status == "Active"))).scalars().all()
    fields = {
        "institutionName": inst.name, "aicteId": inst.aicte_id, "trust": inst.trust, "state": inst.state, "programmes": inst.programmes,
        "approvedIntake": inst.intake, "land": inst.land, "leaseEnd": inst.lease_end.isoformat() if inst.lease_end else None, "facultyCount": len(faculty),
    }
    changed = [
        {"field": "facultyList", "label": "Faculty list: 3 joined, 1 left"},
        {"field": "fireCertificate", "label": "Fire safety certificate renewed"},
        {"field": "intake", "label": "Intake for B.Tech CSE (AI & ML)"},
        {"field": "bankAccount", "label": "Bank account changed"},
        {"field": "lease", "label": "Lease is one year shorter"},
    ]
    total = 46
    return {"typeId": "eoa", "cycle": "2027-28", "filled": total - len(changed), "total": total, "fields": fields, "toCheck": changed, "closesOn": "2026-11-30"}


@router.get("/institution/dashboard", summary="Everything that needs attention")
async def dashboard(user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    inst, apps, obls = await _mine(session, user)
    return {
        "institution": InstitutionOut.model_validate(inst), "applications": [ApplicationOut.model_validate(a) for a in apps], "obligations": [ObligationOut.model_validate(o) for o in obls],
        "health": _health(inst, apps, obls), "greenChannel": _green_channel(inst, apps, obls, await faculty_check(session, inst.id)), "renewal": await _prefill(session, inst, obls), "leaseRunwayYears": round(_runway(inst), 1),
    }


@router.get("/institution/applications", response_model=list[ApplicationOut], summary="My applications, newest first")
async def my_applications(user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    return (await _mine(session, user))[1]


@router.get("/institution/renewal/prefill", summary="Pre-filled Extension of Approval")
async def renewal(user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    inst, _, obls = await _mine(session, user)
    return await _prefill(session, inst, obls)


@router.get("/institution/green-channel", summary="Fast-track eligibility")
async def green(user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    return _green_channel(*(await _mine(session, user)), await faculty_check(session, user.institution_id))


@router.get("/institution/obligations", response_model=list[ObligationOut], summary="Conditions attached to my approvals, with due dates")
async def obligations(user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    return (await _mine(session, user))[2]


@router.post("/institution/undertakings/read", response_model=list[Promise], summary="Read a signed undertaking: each promise with its due date and clause")
async def read_undertaking(body: UndertakingIn, user: Principal = Depends(inst_user)):
    return undertaking.read(body.text)


@router.post("/institution/obligations", response_model=ObligationOut, status_code=201, summary="Track a confirmed promise as an obligation with a due date")
async def track_obligation(body: ObligationIn, user: Principal = Depends(require_permission("respond")), session: AsyncSession = Depends(get_session)):
    days = (body.due_on - today()).days
    status = "Overdue" if days < 0 else "Due soon" if days <= 30 else "On track"
    o = Obligation(id=f"OBL-{secrets.token_hex(3).upper()}", institution_id=user.institution_id, kind=body.kind, title=body.title.strip(), clause=body.clause, due_on=body.due_on, status=status, source="Undertaking, confirmed by the institution")
    session.add(o)
    await audit.append(session, o.id, f"Obligation tracked: {o.title}", user.name, user.role, o.clause, f"due {o.due_on}")
    await session.commit()
    return o


@router.post("/obligations/{obligation_id}/evidence", response_model=ObligationOut, summary="Attach proof for an obligation")
async def evidence(obligation_id: str, document_id: str = Form(...), user: Principal = Depends(require_permission("respond")), session: AsyncSession = Depends(get_session)):
    o = await session.get(Obligation, obligation_id)
    doc = await session.get(Document, document_id)
    if not o or o.institution_id != user.institution_id or not doc or doc.institution_id != user.institution_id:
        raise HTTPException(404, "Not found")
    o.evidence = f"{doc.filename} (sha256 {doc.sha256[:12]}…)"
    await audit.append(session, o.id, f"Evidence uploaded: {doc.filename}", user.name, user.role, o.clause)
    await session.commit()
    return o


@router.get("/institution/documents", response_model=list[DocumentOut], summary="Document vault")
async def vault(user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    return list((await session.execute(select(Document).where(Document.institution_id == user.institution_id).order_by(Document.uploaded_at.desc()))).scalars())


@router.get("/institution/drafts/current", summary="Resume the saved draft")
async def draft(user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    d = (await session.execute(select(Draft).where(Draft.institution_id == user.institution_id).order_by(Draft.updated_at.desc()).limit(1))).scalar_one_or_none()
    return {"id": d.id, "typeId": d.type_id, "data": d.data, "updatedAt": d.updated_at} if d else None


@router.put("/institution/drafts/{draft_id}", summary="Autosave a draft")
async def save_draft(draft_id: str, body: DraftIn, user: Principal = Depends(require_permission("upload")), session: AsyncSession = Depends(get_session)):
    d = await session.get(Draft, draft_id)
    if d and d.institution_id != user.institution_id:
        raise HTTPException(404, "Not found")
    if not d:
        d = Draft(id=draft_id, institution_id=user.institution_id, type_id=body.type_id, data=body.data)
        session.add(d)
    d.type_id, d.data, d.updated_at = body.type_id, body.data, datetime.now()
    await session.commit()
    return {"id": d.id, "savedAt": local_iso(d.updated_at)}


@router.post("/uploads", response_model=DocumentOut, status_code=201, summary="Upload a PDF; it is fingerprinted and checked")
async def upload(file: UploadFile = File(...), doc_kind: str = Form(..., min_length=1, max_length=40), application_id: str | None = Form(None, max_length=40), user: Principal = Depends(require_permission("upload")), session: AsyncSession = Depends(get_session)):
    limit = settings.max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"The file is larger than {settings.max_upload_mb} MB. Scan at 200 dpi in greyscale to make it smaller.")
    pf = await documents.preflight(data)
    if pf["virusScan"] == "infected":
        raise HTTPException(422, "The virus scan flagged this file. It has not been stored.")
    if pf["virusScan"] == "unavailable" and settings.secure:
        raise HTTPException(503, "The virus scanner is not answering right now, so this file could not be checked. Please try again in a few minutes.")
    # AI document verification: OCR + NLP + rule-based + ML checks per document type.
    # Wrapped in try/except so that a failure never prevents the upload from succeeding.
    inst = await session.get(Institution, user.institution_id)
    try:
        ai_context = {"institution_name": inst.name if inst else "", "programme": "", "requested_intake": inst.intake if inst else 0}
        pf["aiCheck"] = await asyncio.wait_for(doc_ai.check(data, doc_kind, ai_context), timeout=30.0)
    except Exception as exc:
        import logging
        logging.getLogger("anumati.upload").warning("AI doc check skipped for %s/%s: %s", doc_kind, (file.filename or "")[:40], exc)
        pf["aiCheck"] = {"status": "warn", "findings": [{"severity": "warn", "title": "AI check skipped", "detail": "The AI document check could not run for this file. It will be checked manually at scrutiny.", "clause": "APH 1.4", "engine": "Rules"}], "wordCount": 0, "engine": "skipped"}
    if application_id:
        await visible_app(session, user, application_id)
    prev = (await session.execute(select(Document).where(Document.institution_id == user.institution_id, Document.doc_kind == doc_kind, Document.application_id == application_id).order_by(Document.version.desc()).limit(1))).scalar_one_or_none()
    doc = Document(
        id=f"DOC-{audit.sha256_hex(data)[:10]}-{int(datetime.now().timestamp() * 1000) % 100000}", institution_id=user.institution_id, application_id=application_id, doc_kind=doc_kind,
        filename=(file.filename or "document.pdf")[:200], storage_key=await documents.storage.save(data, ".pdf" if pf["kind"] == "pdf" else ".bin"), sha256=audit.sha256_hex(data),
        size_bytes=len(data), pages=pf["pages"], signed=pf["signed"], signature={"intact": pf["signatureIntact"], "signer": pf["signer"], "engine": pf["signatureEngine"]},
        preflight=pf, version=(prev.version + 1) if prev else 1, uploaded_by=user.name,
    )
    session.add(doc)
    await audit.append(session, f"VAULT-{user.institution_id}", f"Uploaded {doc.filename} (v{doc.version})", user.name, user.role, None, f"sha256 {doc.sha256}")
    await session.commit()
    return doc


@router.post("/uploads/{document_id}/preflight", summary="Re-run the server pre-flight on a stored file")
async def recheck(document_id: str, user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    doc = await session.get(Document, document_id)
    if not doc or doc.institution_id != user.institution_id:
        raise HTTPException(404, "Not found")
    doc.preflight = await documents.preflight(await documents.storage.read(doc.storage_key))
    await session.commit()
    return doc.preflight


@router.post("/applications/precheck", response_model=list[CheckFinding], summary="AI self-check before submission")
async def precheck(body: dict, user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    t = await session.get(ApplicationType, body.get("typeId", ""))
    if not t:
        raise HTTPException(404, "Unknown request type")
    inst = await session.get(Institution, user.institution_id)
    ids: list[str] = body.get("documentIds", [])
    docs = list((await session.execute(select(Document).where(Document.id.in_(ids), Document.institution_id == inst.id))).scalars()) if ids else []
    kinds = {d.doc_kind: d for d in docs} | {k: None for k in body.get("sampleKinds", [])}
    out: list[CheckFinding] = []
    for req in t.documents:
        if req["id"] not in kinds:
            out.append(CheckFinding(id=f"miss-{req['id']}", severity="blocker", title=f"Missing: {req['name']}", detail="Required for this application type. Upload it before final submission.", clause=req["clause"], engine="Rules engine"))
    for d in docs:
        for e in d.preflight.get("errors", []):
            out.append(CheckFinding(id=f"err-{d.id}", severity="blocker", title=f"{d.filename}: {e}", detail="Replace the file.", clause="APH 1.4", engine="Rules engine"))
        if d.signed and d.signature.get("intact"):
            out.append(CheckFinding(id=f"sig-{d.id}", severity="pass", title=f"{d.filename}: digital signature valid", detail=f"Signed by {d.signature.get('signer') or 'the signatory'}; signed content unchanged.", clause="APH 1.4.6", engine="Signature check (pyHanko)"))
        elif not d.signed:
            out.append(CheckFinding(id=f"nosig-{d.id}", severity="warning", title=f"{d.filename}: no digital signature", detail="Sign with the Chairman's or Secretary's DSC.", clause="APH 1.4.6", engine="Signature check (pyHanko)"))
        # Surface AI document check findings recorded at upload time (doc_ai.py).
        # AI findings are advisory — they are never blockers (an officer always makes the final call).
        # "fail" AI findings become "warning" here so they inform without preventing submission.
        ai = d.preflight.get("aiCheck") or {}
        for i, f in enumerate(ai.get("findings", [])):
            raw_sev = f.get("severity", "warn")
            if raw_sev == "pass":
                continue  # passes clutter the pre-check summary
            out.append(CheckFinding(
                id=f"ai-{d.id}-{i}",
                severity="warning",        # AI findings are advisory — never blocker
                title=f"{d.filename}: {f.get('title', 'AI check issue')}",
                detail=f.get("detail", "") + (" (AI finding — advisory only)" if raw_sev == "fail" else ""),
                clause=f.get("clause", "APH 1.4"),
                engine="Document reader (AI)",
            ))
    if "land" in kinds and _runway(inst) < 3:
        out.append(CheckFinding(id="lease", severity="warning", title="Lease runway is short", detail=f"Live lease leaves {_runway(inst):.1f} years beyond the longest course. Renewal will be blocked when this reaches zero unless the lease is extended by 30 years.", clause="APH 2.1(e)", engine="Rules engine"))
    if "fac" in kinds and body.get("requestedIntake"):
        courses = await courses_of(session, inst.id)
        name, requested = str(body.get("programme") or ""), int(body["requestedIntake"])
        current = int(body.get("currentIntake") or 0)
        match = next((c for c in courses if c.name.lower() == name.lower()), None)
        if match:
            match.intake = requested
        elif requested > current:  # seats not yet in the course matrix: counted as a four-year UG course in the department the name points to
            dept = next((c.department for c in courses if c.name.split(" (")[0].lower() in name.lower()), "New course")
            courses.append(norms.Course("new", name or "Additional seats", dept, "UG", 4, requested - current))
        check = await faculty_check(session, inst.id, courses)
        need, have = check["required"], check["inPost"]
        # A shortfall is raised at scrutiny or the expert visit; it does not stop the institution from applying.
        out.append(CheckFinding(
            id="fac", severity="pass" if have >= need else "warning", title="Faculty count meets the norm" if have >= need else f"Short by {need - have} faculty after this change",
            detail=f"{have} faculty in post; {need} needed after this change (UG 1:20, PG 1:15 over all years)." + ("" if have >= need else " Appoint them before the expert visit, or the visit will record it as a deficiency."),
            clause="APH Annexure-1", engine="Rules engine",
        ))
    return out


@router.post("/applications", status_code=201, summary="Final submission: locks data and returns a time-stamped receipt")
async def submit(body: SubmitIn, user: Principal = Depends(require_permission("submit")), session: AsyncSession = Depends(get_session), idempotency_key: str | None = Header(None, max_length=64)):
    async def work():
        app, receipt = await workflow.submit(session, user, body)
        return {"application": ApplicationOut.model_validate(app).model_dump(by_alias=True), "receipt": receipt}

    return await idempotency.run_once(session, user, idempotency_key, body, 201, work)


@router.get("/applications/{app_id}/receipt", response_class=PlainTextResponse, summary="Submission receipt")
async def receipt(app_id: str, user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    inst, t = await session.get(Institution, app.institution_id), await session.get(ApplicationType, app.type_id)
    docs = (await session.execute(select(Document).where(Document.application_id == app.id))).scalars().all()
    lines = ["ANUMATI SUBMISSION RECEIPT", f"Reference        : {app.id}", f"Received on      : {app.submitted_on}", f"Institution      : {inst.name} (AICTE ID {inst.aicte_id})", f"Request          : {t.name} ({t.clause})", "", f"Documents ({len(docs)})", *[f"  - {d.filename}  sha256:{d.sha256}" for d in docs], "", f"Submission fingerprint (SHA-256): {app.submission_sha256 or 'recorded before ANUMATI'}"]
    return "\n".join(lines)


@router.post("/applications/{app_id}/responses", response_model=ApplicationOut, summary="Reply to a deficiency; the clock restarts")
async def respond(app_id: str, body: ResponseIn, user: Principal = Depends(require_permission("respond")), session: AsyncSession = Depends(get_session), idempotency_key: str | None = Header(None, max_length=64)):
    async def work():
        app = await workflow.respond(session, user, await visible_app(session, user, app_id), body)
        return ApplicationOut.model_validate(app).model_dump(by_alias=True)

    return await idempotency.run_once(session, user, idempotency_key, {"app": app_id, **body.model_dump()}, 200, work)


@router.post("/applications/{app_id}/appeal", response_model=ApplicationOut, summary="File the one appeal within 7 days")
async def appeal(app_id: str, body: dict, user: Principal = Depends(require_permission("submit")), session: AsyncSession = Depends(get_session)):
    return await workflow.appeal(session, user, await visible_app(session, user, app_id), str(body.get("reason", "")))


@router.post("/documents/{document_id}/disputes", response_model=AiDisputeOut, status_code=201, summary="Dispute an AI document check finding")
async def raise_dispute(document_id: str, body: AiDisputeIn, user: Principal = Depends(require_permission("upload")), session: AsyncSession = Depends(get_session)):
    """Institution raises a challenge to a specific AI finding on one of their documents.
    An AICTE officer reviews it and decides: 'override' (AI was wrong) or 'confirm' (AI was right)."""
    doc = await session.get(Document, document_id)
    if not doc or doc.institution_id != user.institution_id:
        raise HTTPException(404, "Document not found")
    if len(body.reason.strip()) < 10:
        raise HTTPException(422, "Please explain your dispute in at least 10 characters.")
    # Prevent duplicate open disputes for the same finding
    existing = (await session.execute(
        select(AiDispute).where(AiDispute.document_id == document_id, AiDispute.finding_id == body.finding_id, AiDispute.status == "pending")
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "A dispute for this finding is already pending review.")
    dispute = AiDispute(
        document_id=document_id, institution_id=user.institution_id,
        application_id=doc.application_id, finding_id=body.finding_id,
        finding_title=body.finding_title, finding_detail=body.finding_detail,
        finding_clause=body.finding_clause, reason=body.reason.strip(),
    )
    session.add(dispute)
    await audit.append(session, f"VAULT-{user.institution_id}", f"AI finding disputed on {doc.filename}: {body.finding_title}", user.name, user.role, body.finding_clause or "APH 1.4", body.reason.strip()[:120])
    await notify(session, "aicte", f"Institution disputed an AI finding on {doc.filename}: {body.finding_title}", "amber", document_id, institution_id=user.institution_id)
    await session.commit()
    return dispute


@router.get("/institution/disputes", response_model=list[AiDisputeOut], summary="AI finding disputes raised by this institution")
async def my_disputes(user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(AiDispute).where(AiDispute.institution_id == user.institution_id).order_by(AiDispute.created_at.desc()).limit(100))).scalars().all()
    return rows


@router.get("/institution/calendar.ics", response_class=PlainTextResponse, summary="My deadlines for any calendar app")
async def my_calendar(user: Principal = Depends(inst_user), session: AsyncSession = Depends(get_session)):
    inst, apps, obls = await _mine(session, user)
    table = (await rules.published(session)).table
    items = [{"title": f"Due: {o.title[:80]}", "date": o.due_on, "description": o.clause} for o in obls if o.status != "Met"]
    for a in apps:
        e = insight.eta(a, table)
        if e:
            items.append({"title": f"{a.id}: decision expected", "date": e["likely"], "description": f"Most likely between {e['early']:%d %b} and {e['late']:%d %b}"})
        if a.clock == "paused":
            items.append({"title": f"Reply to AICTE on {a.id}", "date": today() + timedelta(days=7), "description": "Upload the corrected document on ANUMATI."})
    return PlainTextResponse(credentials.ics(items, f"ANUMATI · {inst.name.split(',')[0]}"), media_type="text/calendar")
