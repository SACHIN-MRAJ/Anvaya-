"""Public portal: no sign-in needed."""
import re

from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, Response, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit, cache, rules
from ..db import _soft_user, get_session, system_session
from ..models import Application, ApplicationType, CalendarEvent, Feedback, GlossaryTerm, Institution, KeyValue, Notice, SuspiciousReport, UnapprovedInstitution
from ..schemas import ApplicationOut, ApplicationTypeOut, AskIn, AssistantOut, CalendarEventOut, FeedbackIn, GlossaryOut, InstitutionOut, NoticeOut, Principal, ReportIn, SubscribeIn, VerifyResult
from ..services import assistant, credentials, insight
from .common import public_base

router = APIRouter(prefix="/public", tags=["Public portal"])


@router.get("/institutions", response_model=list[InstitutionOut], summary="Approved institutions, searchable")
async def institutions(q: str = "", region: str = "", category: str = "", session: AsyncSession = Depends(get_session)):
    stmt = select(Institution).order_by(Institution.name)
    if region:
        stmt = stmt.where(Institution.region == region)
    if category:
        stmt = stmt.where(Institution.category == category)
    rows = list((await session.execute(stmt)).scalars())
    return [i for i in rows if not q or q.lower() in f"{i.name} {i.city} {i.aicte_id}".lower()]


@router.get("/institutions/check", summary="Fake-college shield: unapproved names and lookalikes")
async def check(q: str, session: AsyncSession = Depends(get_session)):
    return await insight.safety_check(session, q)


@router.get("/institutions/{aicte_id}", response_model=InstitutionOut, summary="One approved institution by AICTE ID")
async def institution(aicte_id: str, session: AsyncSession = Depends(get_session)):
    inst = (await session.execute(select(Institution).where(Institution.aicte_id == aicte_id))).scalar_one_or_none()
    if not inst:
        raise HTTPException(404, "Not on the approved list. Do not pay any fee until you confirm.")
    return inst


@router.get("/unapproved", summary="Names on AICTE's public notices of unapproved institutions")
async def unapproved(session: AsyncSession = Depends(get_session)):
    return [{"name": u.name, "city": u.city, "notice": u.notice} for u in (await session.execute(select(UnapprovedInstitution))).scalars()]


@router.post("/reports/suspicious-institution", status_code=201, summary="Report a suspected fake college")
async def report(body: ReportIn):
    # A citizen's report is filed the same way whoever is signed in on this browser, so it is written as the system.
    async with system_session() as session:
        n = (await session.execute(select(func.count()).select_from(SuspiciousReport))).scalar_one()
        r = SuspiciousReport(ref=f"RPT-2026-{1182 + n}", name=body.name, city=body.city, contact=body.contact)
        session.add(r)
        await audit.append(session, "REPORTS", f"Suspicious institution reported: {body.name}", "Public", "Citizen")
        await session.commit()
    return {"ref": r.ref, "message": f"Thank you. Your report reached the regional office (reference {r.ref})."}


@router.get("/approved", summary="Approved list for state counselling bodies (token required)")
async def approved(state: str = "", cycle: str = "2027-28", authorization: str = Header(default=""), session: AsyncSession = Depends(get_session)):
    if not authorization.lower().startswith("bearer ") or len(authorization) < 15:
        raise HTTPException(401, "A counselling-body token is required")
    insts = [i for i in (await session.execute(select(Institution).where(Institution.status == "Approved"))).scalars() if not state or i.state == state]
    out = []
    for i in insts:
        letters = (await session.execute(select(Application).where(Application.institution_id == i.id, Application.stage == "decision"))).scalars().all()
        out.append({"aicteId": i.aicte_id, "name": i.name, "state": i.state, "intake": i.intake, "programmes": i.programmes, "decisions": [{"ref": a.id, "outcome": a.outcome} for a in letters]})
    v = await rules.published(session)
    return {"cycle": cycle, "rulesVersion": v.version, "generatedAt": audit.now_iso(), "institutions": out}


async def _letter(session: AsyncSession, ref: str):
    app = (await session.execute(select(Application).where(func.upper(Application.id) == ref.strip().upper(), Application.stage == "decision"))).scalar_one_or_none()
    if not app:
        return None
    inst, t = await session.get(Institution, app.institution_id), await session.get(ApplicationType, app.type_id)
    return app, inst, t


@router.get("/verify/{ref}", response_model=VerifyResult, summary="Is this decision letter genuine?")
async def verify(ref: str, session: AsyncSession = Depends(get_session)):
    hit = await _letter(session, ref)
    if not hit:
        return VerifyResult(status="not-found")
    app, inst, t = hit
    return VerifyResult(status="authentic", app=ApplicationOut.model_validate(app), fingerprint=credentials.fingerprint(credentials.letter_text(app, inst, t)), timestamp=f"{app.stage_entered_on.isoformat()}T17:30:12+05:30")


@router.post("/verify/file", response_model=VerifyResult, summary="Verify an uploaded letter by its SHA-256 fingerprint")
async def verify_file(file: UploadFile = File(...), session: AsyncSession = Depends(get_session)):
    fp = audit.sha256_hex(await file.read())
    for app in (await session.execute(select(Application).where(Application.stage == "decision"))).scalars():
        inst, t = await session.get(Institution, app.institution_id), await session.get(ApplicationType, app.type_id)
        if credentials.fingerprint(credentials.letter_text(app, inst, t)) == fp:
            return VerifyResult(status="authentic", app=ApplicationOut.model_validate(app), fingerprint=fp, timestamp=f"{app.stage_entered_on.isoformat()}T17:30:12+05:30")
    return VerifyResult(status="mismatch", fingerprint=fp)


@router.get("/letters/{ref}", summary="Printable decision letter data")
async def letter(ref: str, request: Request, session: AsyncSession = Depends(get_session)):
    hit = await _letter(session, ref)
    if not hit:
        raise HTTPException(404, "No issued letter with this reference")
    app, inst, t = hit
    text = credentials.letter_text(app, inst, t)
    return {"ref": app.id, "outcome": app.outcome, "outcomeText": credentials.OUTCOME.get(app.outcome or ""), "decidedOn": app.stage_entered_on, "institution": InstitutionOut.model_validate(inst), "request": t.name, "clause": t.clause, "cycle": app.cycle, "text": text, "fingerprint": credentials.fingerprint(text), "verifyUrl": f"{public_base(str(request.url))}/verify?ref={app.id}"}


@router.get("/letters/{ref}/text", response_class=PlainTextResponse, summary="Letter as text (the exact bytes that are fingerprinted)")
async def letter_txt(ref: str, session: AsyncSession = Depends(get_session)):
    hit = await _letter(session, ref)
    if not hit:
        raise HTTPException(404, "No issued letter with this reference")
    return credentials.letter_text(*hit)


@router.get("/letters/{ref}/credential", summary="The letter as a signed W3C verifiable credential")
async def letter_credential(ref: str, request: Request, session: AsyncSession = Depends(get_session)):
    hit = await _letter(session, ref)
    if not hit:
        raise HTTPException(404, "No issued letter with this reference")
    app, inst, t = hit
    return credentials.credential(app, inst, t, f"{public_base(str(request.url))}/verify?ref={app.id}")


@router.post("/credentials/verify", summary="Check a credential's signature")
async def verify_credential(vc: dict):
    return {"valid": credentials.verify_credential(vc), "issuer": vc.get("issuer", {}).get("id")}


@router.get("/notices", response_model=list[NoticeOut], summary="Public notices, optionally for one audience")
async def notices(audience: str = "", session: AsyncSession = Depends(get_session)):
    stmt = select(Notice).order_by(Notice.date.desc())
    if audience and audience != "All":
        stmt = stmt.where(Notice.audience == audience)
    return list((await session.execute(stmt)).scalars())


@router.get("/calendar", response_model=list[CalendarEventOut], summary="Academic calendar with every revision and its reason")
async def calendar(session: AsyncSession = Depends(get_session)):
    return list((await session.execute(select(CalendarEvent).order_by(CalendarEvent.date))).scalars())


@router.get("/calendar.ics", response_class=PlainTextResponse, summary="Approval calendar for any calendar app")
async def calendar_ics(session: AsyncSession = Depends(get_session)):
    items = [{"title": c.label, "date": c.end_date or c.date, "description": c.clause or "AICTE approval calendar"} for c in (await session.execute(select(CalendarEvent))).scalars()]
    return PlainTextResponse(credentials.ics(items, "AICTE approval calendar 2027-28"), media_type="text/calendar")


@router.get("/rules/types", response_model=list[ApplicationTypeOut], summary="The 22 request types from APH Table 2.3")
async def types(session: AsyncSession = Depends(get_session)):
    return list((await session.execute(select(ApplicationType))).scalars())


@router.post("/rules/evaluate", summary="Stage path for a request, from the published rules")
async def evaluate(body: dict, session: AsyncSession = Depends(get_session)):
    v = await rules.published(session)
    path = rules.evaluate_path(v.table, body.get("typeId", ""), bool(body.get("deficienciesFound")), bool(body.get("appeal")))
    if not path:
        raise HTTPException(404, "Unknown request type")
    return {"rulesVersion": v.version, "path": path}


@router.get("/glossary", response_model=list[GlossaryOut], summary="Plain-language meanings of 30 terms")
async def glossary(session: AsyncSession = Depends(get_session)):
    return list((await session.execute(select(GlossaryTerm).order_by(GlossaryTerm.key))).scalars())


@router.get("/status", summary="Live service health and 90-day uptime")
async def status(response: Response, session: AsyncSession = Depends(get_session)):
    return await cache.public("status", 15, response, lambda: insight.status(session))


@router.get("/status/forecast", summary="Expected submissions per day across the window")
async def forecast(response: Response, session: AsyncSession = Depends(get_session)):
    return await cache.public("forecast", 300, response, lambda: insight.forecast(session))


@router.get("/performance", summary="Open performance data")
async def performance(response: Response, session: AsyncSession = Depends(get_session)):
    return await cache.public("performance", 60, response, lambda: insight.performance(session))


CONTACT = re.compile(r"^(?:[^@\s]{1,64}@[^@\s]{1,190}\.[A-Za-z]{2,}|(?:\+91[- ]?)?[6-9]\d{9})$")


@router.post("/status/subscribe", status_code=201, summary="Get maintenance and incident alerts by email or SMS")
async def subscribe(body: SubscribeIn, session: AsyncSession = Depends(get_session)):
    contact = body.contact.strip()
    if not CONTACT.match(contact):
        raise HTTPException(422, "Enter an email address or a 10-digit Indian mobile number.")
    kv = await session.get(KeyValue, "status:subscribers")
    if kv is None:
        kv = KeyValue(key="status:subscribers", value={"contacts": []})
        session.add(kv)
    contacts = list(kv.value.get("contacts", []))
    already = contact.lower() in (c.lower() for c in contacts)
    if not already and len(contacts) < 10_000:
        kv.value = {"contacts": [*contacts, contact]}
    await session.commit()
    channel = "email" if "@" in contact else "SMS"
    return {"subscribed": True, "channel": channel, "message": f"You are {'already ' if already else ''}subscribed: maintenance and incident alerts will come by {channel}."}


@router.post("/feedback", status_code=201, summary="“Was this page helpful?”")
async def feedback(body: FeedbackIn, session: AsyncSession = Depends(get_session)):
    session.add(Feedback(page=body.page[:200], helpful=body.helpful, comment=body.comment[:1000]))
    await session.commit()
    return {"ok": True}


@router.post("/assistant/ask", response_model=AssistantOut, summary="Ask ANUMATI: handbook answers with clauses, and your own files when signed in")
async def ask(body: AskIn, user: Principal | None = Depends(_soft_user), session: AsyncSession = Depends(get_session)):
    q = body.question.strip()
    if not q:
        raise HTTPException(422, "Ask a question of up to 500 characters.")
    # A file's status is given only to someone signed in who may see that file; visitors get the rules only.
    return await assistant.respond(session, user, q, body.history)
