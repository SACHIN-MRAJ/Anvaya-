"""AICTE officials portal."""
import asyncio
import csv
import io
import json
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit
from ..config import settings, today
from ..timeutil import local_iso
from ..db import get_session, scoped_session
from ..models import AiDispute, Application, AuditEntry, CalendarEvent, Document, Expert, Institution, InspectionDraw, KeyValue, Notification, Obligation, SavedView
from ..schemas import AiDisputeOut, ApplicationOut, DbId, BulkIn, CalendarEventOut, CalendarReviseIn, DashboardStats, ExpertOut, InspectionDrawIn, ObligationOut, Principal, SimulationIn, ViewIn
from ..security import current_user, region_scope, require_portal, require_roles
from ..services import draws, insight, workflow
from ..services.notify import notify

router = APIRouter(tags=["AICTE officials"])
notifications_router = APIRouter(tags=["Notifications"])  # used by both signed-in portals
officer = require_portal("aicte")


@router.get("/aicte/dashboard", response_model=DashboardStats, summary="Pendency, risk, ageing and the region-by-stage heatmap")
async def dashboard(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return await insight.dashboard(session, region_scope(user))


def _visible_activity(user: Principal):
    """Evidence-log entries this officer may see: region-locked roles only see files in their region."""
    stmt = select(AuditEntry)
    if scope := region_scope(user):
        stmt = stmt.where(AuditEntry.ref.in_(select(Application.id).where(Application.region == scope)))
    return stmt


@router.get("/aicte/activity", summary="Recent actions across the evidence log (own region only for region-locked roles)")
async def activity(limit: int = Query(20, ge=1, le=100), user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(_visible_activity(user).order_by(AuditEntry.id.desc()).limit(limit))).scalars()
    return [{"id": r.id, "ref": r.ref, "at": r.at, "actor": r.actor, "action": r.action} for r in rows]


@router.get("/aicte/activity/stream", summary="Live activity (Server-Sent Events)")
async def stream(request: Request, user: Principal = Depends(officer)):
    async def events():
        async with scoped_session(user) as s:
            last = (await s.execute(select(AuditEntry.id).order_by(AuditEntry.id.desc()).limit(1))).scalar() or 0
        yield "retry: 5000\n\n"
        while not await request.is_disconnected():
            async with scoped_session(user) as s:
                rows = list((await s.execute(_visible_activity(user).where(AuditEntry.id > last).order_by(AuditEntry.id))).scalars())
            for r in rows:
                last = r.id
                yield f"data: {json.dumps({'id': r.id, 'ref': r.ref, 'at': r.at, 'actor': r.actor, 'action': r.action})}\n\n"
            yield ": keep-alive\n\n"
            await asyncio.sleep(3)

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _green(a: Application) -> bool:
    return a.risk < 0.25 and a.deficiencies == 0


async def _queue(session: AsyncSession, user: Principal, region: str = "", stage: str = "", clock: str = "", lane: str = "", q: str = "", sort: str = "due") -> list[Application]:
    scope = region_scope(user)
    stmt = select(Application).where(Application.stage != "decision")
    if scope or region:
        stmt = stmt.where(Application.region == (scope or region))
    if stage:
        stmt = stmt.where(Application.stage == stage)
    if clock:
        stmt = stmt.where(Application.clock == clock)
    apps = list((await session.execute(stmt)).scalars())
    if lane == "green":
        apps = [a for a in apps if _green(a)]
    if q:
        names = {i.id: i.name for i in (await session.execute(select(Institution))).scalars()}
        apps = [a for a in apps if q.lower() in f"{a.id} {names.get(a.institution_id, '')}".lower()]
    return sorted(apps, key=(lambda a: -a.risk) if sort == "risk" else (lambda a: a.due_on))


@router.get("/aicte/queue", response_model=list[ApplicationOut], summary="Work queue, limited to the officer's region where the role requires it")
async def queue(region: str = "", stage: str = "", clock: str = "", lane: str = "", q: str = "", sort: str = "due", user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return await _queue(session, user, region, stage, clock, lane, q, sort)


@router.get("/aicte/queue/next", summary="Focus mode: files in the order to work them")
async def next_files(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    apps = await _queue(session, user)
    rank = {"breached": 0, "running": 1, "paused": 2}
    order = sorted(apps, key=lambda a: (rank.get(a.clock, 3), -a.risk, a.due_on))
    return {"order": [a.id for a in order], "next": order[0].id if order else None}


@router.post("/aicte/queue/bulk", summary="Remind or assign many files; returns an undo token valid for 10 seconds")
async def bulk(body: BulkIn, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    apps = [a for a in await _queue(session, user) if a.id in set(body.ids)]
    created = []
    for a in apps:
        if body.action == "remind":
            n = await notify(session, "institution", f"Reminder from AICTE about {a.id}", "amber", a.id, institution_id=a.institution_id)
            created.append(n.id)
        else:
            a.holder = user.name
            await workflow.record(session, a, f"Assigned to {user.name}", user.name, user.role)
    token = secrets.token_urlsafe(12)
    session.add(KeyValue(key=f"undo:{token}", value={"notifications": created, "expires": (datetime.now() + timedelta(seconds=10)).isoformat()}))
    await session.commit()
    return {"count": len(apps), "undoToken": token}


@router.post("/aicte/queue/bulk/{token}/undo", summary="Withdraw bulk reminders before delivery")
async def undo(token: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    kv = await session.get(KeyValue, f"undo:{token}")
    if not kv or datetime.fromisoformat(kv.value["expires"]) < datetime.now():
        raise HTTPException(410, "Too late to undo")
    await session.execute(delete(Notification).where(Notification.id.in_(kv.value["notifications"])))
    await session.delete(kv)
    await session.commit()
    return {"withdrawn": len(kv.value["notifications"])}


@router.get("/aicte/views", summary="Saved views")
async def views(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return [{"id": v.id, "name": v.name, "query": v.query} for v in (await session.execute(select(SavedView).where(SavedView.user_id == user.id))).scalars()]


@router.post("/aicte/views", status_code=201, summary="Save the current queue filters as a named view")
async def save_view(body: ViewIn, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    v = SavedView(user_id=user.id, name=body.name[:80], query=body.query[:300])
    session.add(v)
    await session.commit()
    return {"id": v.id, "name": v.name, "query": v.query}


@router.delete("/aicte/views/{view_id}", status_code=204, summary="Delete a saved view")
async def delete_view(view_id: DbId, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    await session.execute(delete(SavedView).where(SavedView.id == view_id, SavedView.user_id == user.id))
    await session.commit()


@router.get("/aicte/experts", response_model=list[ExpertOut], summary="Expert pool with specialisations and past visits")
async def experts(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return list((await session.execute(select(Expert))).scalars())


@router.get("/aicte/disputes", response_model=list[dict], summary="AI finding disputes pending officer review")
async def list_disputes(status: str = "pending", user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    """Returns disputes enriched with institution name and document filename.
    Uses a single JOIN query to avoid N+1 database hits."""
    from sqlalchemy import String
    from sqlalchemy.orm import aliased

    stmt = (
        select(
            AiDispute,
            Institution.name.label("inst_name"),
            Document.filename.label("doc_filename"),
        )
        .join(Institution, Institution.id == AiDispute.institution_id, isouter=True)
        .join(Document, Document.id == AiDispute.document_id, isouter=True)
        .order_by(AiDispute.created_at.desc())
        .limit(200)
    )
    if status:
        stmt = stmt.where(AiDispute.status == status)
    scope = region_scope(user)
    if scope:
        stmt = stmt.where(Institution.region == scope)

    rows = (await session.execute(stmt)).all()
    return [
        {
            "id": d.id, "documentId": d.document_id, "institutionId": d.institution_id,
            "institutionName": inst_name or d.institution_id,
            "applicationId": d.application_id,
            "filename": doc_filename or d.document_id,
            "findingId": d.finding_id, "findingTitle": d.finding_title,
            "findingDetail": d.finding_detail, "findingClause": d.finding_clause,
            "reason": d.reason, "status": d.status,
            "resolution": d.resolution, "reviewedBy": d.reviewed_by,
            "createdAt": d.created_at.isoformat() if d.created_at else None,
            "resolvedAt": d.resolved_at.isoformat() if d.resolved_at else None,
        }
        for d, inst_name, doc_filename in rows
    ]


@router.post("/aicte/disputes/{dispute_id}/resolve", response_model=AiDisputeOut, summary="Resolve an AI finding dispute")
async def resolve_dispute(dispute_id: int, body: dict, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    """Officer resolves: decision='override' (AI was wrong, document can proceed) or 'confirm' (AI was right)."""
    d = await session.get(AiDispute, dispute_id)
    if not d:
        raise HTTPException(404, "Dispute not found")
    if d.status != "pending":
        raise HTTPException(409, "This dispute has already been resolved.")
    decision = body.get("decision", "")
    if decision not in ("override", "confirm"):
        raise HTTPException(422, "decision must be 'override' or 'confirm'.")
    resolution = body.get("resolution", "").strip()
    if len(resolution) < 5:
        raise HTTPException(422, "Please provide a resolution note of at least 5 characters.")
    d.status = "overridden" if decision == "override" else "confirmed"
    d.resolution = resolution
    d.reviewed_by = user.name
    d.resolved_at = datetime.now()
    doc = await session.get(Document, d.document_id)
    await audit.append(session, f"VAULT-{d.institution_id}", f"AI dispute {d.status}: {d.finding_title} on {doc.filename if doc else d.document_id}", user.name, user.role, d.finding_clause or "APH 1.4", resolution[:120])
    tone = "green" if decision == "override" else "amber"
    msg = f"Your dispute on {doc.filename if doc else 'document'} was reviewed. Officer {'overrode' if decision == 'override' else 'confirmed'} the AI finding: {resolution}"
    await notify(session, "institution", msg, tone, d.document_id, institution_id=d.institution_id)
    await session.commit()
    return d


@router.get("/aicte/compliance", response_model=list[ObligationOut], summary="All obligations with their escalation level")
async def compliance(status: str = "", user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    stmt = select(Obligation).order_by(Obligation.due_on)
    scope = region_scope(user)
    if scope:
        stmt = stmt.join(Institution, Institution.id == Obligation.institution_id).where(Institution.region == scope)
    if status:
        stmt = stmt.where(Obligation.status == status)
    return list((await session.execute(stmt)).scalars())


@router.post("/aicte/compliance/{obligation_id}/verify", response_model=ObligationOut, summary="Accept the evidence: the obligation is met")
async def verify_obligation(obligation_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    o = await session.get(Obligation, obligation_id)
    if not o:
        raise HTTPException(404, "Not found")
    o.status, o.escalation_level = "Met", 0
    await audit.append(session, o.id, "Evidence accepted; obligation met", user.name, user.role, o.clause)
    await session.commit()
    return o


@router.post("/aicte/compliance/{obligation_id}/remind", summary="Remind the institution about an open obligation")
async def remind_obligation(obligation_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    o = await session.get(Obligation, obligation_id)
    if not o or o.status == "Met":
        raise HTTPException(404, "No open obligation with that id")
    n = await notify(session, "institution", f"Reminder from AICTE: {o.title} (due {o.due_on:%d %b %Y})", "amber", o.id, institution_id=o.institution_id)
    await audit.append(session, o.id, "Reminder sent to the institution", user.name, user.role, o.clause)
    await session.commit()
    return {"sent": True, "channels": n.channels}


@router.get("/aicte/integrity/duplicates", summary="The same teacher listed full-time at two or more institutions")
async def duplicates(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return await insight.duplicates(session)


@router.post("/aicte/integrity/{pan_hash}/ask", summary="Ask both institutions to explain")
async def ask_explain(pan_hash: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    dup = next((c for c in (await insight.duplicates(session))["clusters"] if c["panHash"] == pan_hash), None)
    if not dup:
        raise HTTPException(404, "No such duplicate")
    for r in dup["records"]:
        await notify(session, "institution", f"Please explain: {dup['name']} is listed full-time at more than one institution. Reply within 7 days.", "amber", institution_id=r["institutionId"])
    await audit.append(session, "INTEGRITY", f"Explanation requested from {len(dup['records'])} institutions for {pan_hash[:8]}", user.name, user.role, "APH Appendix 7")
    await session.commit()
    return {"asked": [r["institutionId"] for r in dup["records"]]}


@router.get("/aicte/inspections/weights", summary="Risk weights used for surprise inspections")
async def weights(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return await insight.inspection_weights(session)


@router.post("/aicte/inspections/draw", summary="Risk-weighted surprise-inspection draw on a public drand round")
async def draw(body: InspectionDrawIn, user: Principal = Depends(require_roles("Bureau head", "Regional officer")), session: AsyncSession = Depends(get_session)):
    items = await insight.inspection_weights(session)
    beacon = await draws.fetch()
    pure = max(1, round(body.k * 0.2))
    chosen = draws.weighted_draw(items, beacon["randomness"], body.k, pure)
    d = InspectionDraw(drand_round=beacon["round"], randomness=beacon["randomness"], source=beacon["source"], k=body.k, weights=[{"id": i["id"], "weight": i["weight"]} for i in items], chosen=chosen, drawn_by=user.name)
    session.add(d)
    await audit.append(session, "INSPECTIONS", f"Surprise inspections drawn: {', '.join(c['id'] for c in chosen)}", user.name, user.role, "APH 2.3.5", f"drand round {beacon['round']}")
    await session.commit()
    return {"id": d.id, "round": beacon["round"], "randomness": beacon["randomness"], "source": beacon["source"], "chosen": chosen, "weights": items}


@router.get("/aicte/inspections/draws", summary="Past draws, re-checkable from the published round and weights")
async def past_draws(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return [{"id": d.id, "round": d.drand_round, "chosen": d.chosen, "drawnAt": local_iso(d.drawn_at), "source": d.source} for d in (await session.execute(select(InspectionDraw).order_by(InspectionDraw.id.desc()))).scalars()]


@router.get("/aicte/insights/process-map", summary="Where files wait: historical map plus live occupancy")
async def process_map(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return await insight.mining(session)


@router.post("/aicte/simulator/run", summary="What-if simulation of staffing and deadlines")
async def simulate(body: SimulationIn, user: Principal = Depends(officer)):
    return insight.simulate(body.extra_officers_bottleneck, body.extra_experts, body.volume_change, body.calendar_shift_days)


@router.get("/aicte/reports/{name}", summary="Consolidated reports as CSV or JSON")
async def report(name: str, format: str = "csv", user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    if name == "pendency":
        rows = [{"Reference": a.id, "Institution": a.institution_id, "Stage": a.stage, "Due": a.due_on.isoformat(), "Clock": a.clock, "Risk %": round(a.risk * 100)} for a in await _queue(session, user)]
    elif name == "regions":
        rows = (await insight.performance(session))["regions"]
    elif name == "obligations":
        rows = [{"Id": o.id, "Institution": o.institution_id, "Title": o.title, "Due": o.due_on.isoformat(), "Status": o.status, "Level": o.escalation_level} for o in await compliance("", user, session)]
    elif name == "decisions":
        rows = [{"Reference": a.id, "Institution": a.institution_id, "Outcome": a.outcome, "Decided": a.stage_entered_on.isoformat()} for a in (await session.execute(select(Application).where(Application.stage == "decision"))).scalars()]
    else:
        raise HTTPException(404, "Reports: pendency, regions, obligations, decisions")
    if format == "json":
        return rows
    buf = io.StringIO()
    if rows:
        w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return PlainTextResponse(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="anumati-{name}.csv"'})


@router.put("/aicte/calendar/{event_id}", response_model=CalendarEventOut, summary="Revise a date, always with a recorded reason")
async def revise(event_id: str, body: CalendarReviseIn, user: Principal = Depends(require_roles("Bureau head", "Rules administrator")), session: AsyncSession = Depends(get_session)):
    c = await session.get(CalendarEvent, event_id)
    if not c:
        raise HTTPException(404, "Not found")
    if len(body.reason.strip()) < 10:
        raise HTTPException(422, "Give the reason for the revision (it is published with the new date).")
    c.revised_from, c.date, c.end_date, c.revision_reason = c.end_date or c.date, body.date, body.end_date, body.reason.strip()
    await audit.append(session, "CALENDAR", f"Revised “{c.label}” to {body.date}", user.name, user.role, c.clause, body.reason.strip())
    await session.commit()
    return c


@router.get("/aicte/settings/alerts", summary="Alert channels and the escalation ladder")
async def get_alerts(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return (await session.get(KeyValue, "alerts")).value


@router.put("/aicte/settings/alerts", summary="Change alert channels or the escalation ladder")
async def put_alerts(body: dict, user: Principal = Depends(require_roles("Bureau head", "Rules administrator")), session: AsyncSession = Depends(get_session)):
    kv = await session.get(KeyValue, "alerts")
    kv.value = {**kv.value, **{k: v for k, v in body.items() if k in ("ladder", "channels", "remindDaysBefore", "quietHours")}}
    await audit.append(session, "SETTINGS", "Alert settings changed", user.name, user.role, None, json.dumps(body)[:300])
    await session.commit()
    return kv.value


@router.get("/aicte/settings/integrations", summary="Each outside connection and whether it is live, from the running configuration")
async def integrations(user: Principal = Depends(officer)):
    from ..db import IS_POSTGRES
    from ..services.documents import clamav_alive, storage

    scanner = ("Live" if await clamav_alive() else "Down") if settings.clamd_host else "Not configured"
    rows = [
        ("Database", "PostgreSQL with row-level security" if IS_POSTGRES else "SQLite (development)", "Live"),
        ("Single sign-on", "Keycloak (OpenID Connect, PKCE)" if settings.auth_mode == "oidc" else "Development sign-in (no password)", "Live" if settings.auth_mode == "oidc" else "Development"),
        ("Document storage", "S3-compatible object store" if settings.storage_backend == "s3" else "Local folder", "Live" if await storage.healthy() else "Down"),
        ("Virus scanning", "ClamAV, every upload", scanner),
        ("drand (League of Entropy)", "Public randomness for EVC panels and inspections", "Live"),
        ("Email alerts", "SMTP" if settings.email_mode == "smtp" else "Saved and logged (no SMTP account yet)", "Live" if settings.email_mode == "smtp" else "Logged"),
        ("SMS gateway (TRAI DLT)", "Registered reminder templates", "Live" if settings.sms_mode == "http" else "Logged"),
        ("WhatsApp Business API", "Reminders and status replies", "Live" if settings.whatsapp_mode == "http" else "Logged"),
        ("Webhook signatures", "HMAC-SHA256 on WhatsApp and SMS webhooks", "Live" if settings.webhook_secret else "Not configured"),
        ("Bhashini", "Voice notes and 22 languages", "Live" if settings.bhashini_api_key else "Not configured"),
        ("Metrics", "Prometheus at /metrics", "Live (token)" if settings.metrics_token else "Live"),
        ("DigiLocker / API Setu", "Verify documents at source", "Needs onboarding"),
    ]
    return [{"name": n, "purpose": p, "status": st} for n, p, st in rows]


@router.post("/aicte/scheduler/run", summary="Run the deadline check now (normally every minute)")
async def run_scheduler(user: Principal = Depends(require_roles("Bureau head")), session: AsyncSession = Depends(get_session)):
    return await workflow.tick(session)


@notifications_router.get("/notifications", summary="My notifications (both portals)")
async def notifications(user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    stmt = select(Notification).where(Notification.audience == user.portal).order_by(Notification.id.desc()).limit(50)
    if user.portal == "institution":
        stmt = stmt.where(Notification.institution_id == user.institution_id)
    elif region_scope(user):
        stmt = stmt.where((Notification.region == region_scope(user)) | (Notification.region.is_(None)))
    return [{"id": n.id, "title": n.title, "tone": n.tone, "ref": n.ref, "createdAt": local_iso(n.created_at), "read": n.read, "delivery": n.delivery} for n in (await session.execute(stmt)).scalars()]


@notifications_router.post("/notifications/{notification_id}/read", status_code=204, summary="Mark a notification as read")
async def mark_read(notification_id: DbId, user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    n = await session.get(Notification, notification_id)
    if n and n.audience == user.portal and (user.portal != "institution" or n.institution_id == user.institution_id):
        n.read = True
        await session.commit()


@notifications_router.put("/notifications/preferences", summary="Channels and language for my alerts")
async def preferences(body: dict, user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    from ..models import User

    u = await session.get(User, user.id)
    if not u:
        raise HTTPException(404, "Unknown user")
    u.channels = [c for c in body.get("channels", u.channels) if c in ("email", "sms", "whatsapp")]
    u.language = body.get("language", u.language) if body.get("language") in ("en", "hi") else u.language
    await session.commit()
    return {"channels": u.channels, "language": u.language}


@router.get("/aicte/today", summary="The date the clocks use (fixed for the sample cycle)")
async def get_today(user: Principal = Depends(officer)):
    return {"today": today()}
