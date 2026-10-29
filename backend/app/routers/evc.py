"""Expert visits: conflict-free shortlist, commit-then-draw on a public drand round, and the photo check."""
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit
from ..config import today
from ..db import get_session
from ..models import Application, EvcPanel, Expert, Institution, VisitPhoto
from ..schemas import ApplicationOut, EvcProposeIn, ExpertOut, Principal
from ..security import region_scope, require_portal
from ..services import draws, geo, insight
from ..services.notify import notify
from .common import visible_app

router = APIRouter(prefix="/evc", tags=["Expert visits (EVC)"])
officer = require_portal("aicte")


def _panel_out(p: EvcPanel) -> dict:
    return {"id": p.id, "mode": p.mode, "shortlist": p.shortlist, "excluded": p.excluded, "commitment": p.commitment, "committedRound": p.committed_round, "randomness": p.randomness, "chosen": p.chosen, "verified": p.verified}


@router.get("/queue", response_model=list[ApplicationOut], summary="Files waiting for an expert visit")
async def queue(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    stmt = select(Application).where(Application.stage == "evc").order_by(Application.due_on)
    if region_scope(user):
        stmt = stmt.where(Application.region == region_scope(user))
    return list((await session.execute(stmt)).scalars())


@router.get("/{app_id}", summary="The latest panel for a file")
async def latest(app_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    await visible_app(session, user, app_id)
    p = (await session.execute(select(EvcPanel).where(EvcPanel.application_id == app_id).order_by(EvcPanel.id.desc()).limit(1))).scalar_one_or_none()
    return _panel_out(p) if p else None


@router.post("/{app_id}/propose", summary="Conflict-free shortlist and a published commitment")
async def propose(app_id: str, body: EvcProposeIn, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    shortlist, excluded = [], []
    for e in (await session.execute(select(Expert))).scalars():
        full = ExpertOut.model_validate(e).model_dump(by_alias=True)
        if app.institution_id in e.linked_institutions:
            excluded.append({"expert": full, "reason": "Conflict of interest: linked to this institution"})
        elif not e.available:
            excluded.append({"expert": full, "reason": "Not available in the visit window"})
        elif e.load >= e.max_load:
            excluded.append({"expert": full, "reason": f"Load limit reached ({e.load}/{e.max_load} visits)"})
        else:
            shortlist.append({**full, "score": (3 if e.specialisation == body.specialisation else 1) + (e.max_load - e.load) * 0.5})
    shortlist = sorted(shortlist, key=lambda x: -x["score"])[:6]
    if len(shortlist) < 3:
        raise HTTPException(409, "Fewer than three eligible experts. Widen the specialisation or the region.")
    beacon = await draws.fetch()
    committed = beacon["round"] + 2
    p = EvcPanel(application_id=app.id, mode=body.mode, shortlist=shortlist, excluded=excluded, committed_round=committed, commitment=draws.commitment(app.id, [s["id"] for s in shortlist], committed))
    session.add(p)
    await audit.append(session, app.id, f"EVC shortlist committed for drand round {committed}", user.name, user.role, "APH 1.9", f"commitment {p.commitment[:16]}…")
    await session.commit()
    return _panel_out(p)


@router.post("/{app_id}/draw", summary="Reveal: draw the panel with the committed round")
async def draw(app_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    p = (await session.execute(select(EvcPanel).where(EvcPanel.application_id == app.id).order_by(EvcPanel.id.desc()).limit(1))).scalar_one_or_none()
    if not p:
        raise HTTPException(409, "Propose a shortlist first")
    if p.randomness:
        return _panel_out(p)
    beacon = await draws.fetch(p.committed_round)
    if not beacon["randomness"]:
        raise HTTPException(425, f"drand round {p.committed_round} is not published yet. Try again in about 30 seconds.", headers={"Retry-After": "30"})
    ids = [s["id"] for s in p.shortlist]
    chosen = draws.draw_panel(ids, beacon["randomness"], 3)
    p.randomness, p.chosen, p.drawn_at = beacon["randomness"], chosen, datetime.now()
    p.verified = draws.commitment(app.id, ids, p.committed_round) == p.commitment and draws.draw_panel(ids, beacon["randomness"], 3) == chosen
    for e in (await session.execute(select(Expert).where(Expert.id.in_(chosen)))).scalars():
        e.load += 1
    await audit.append(session, app.id, f"EVC panel drawn: {', '.join(chosen)}", user.name, user.role, "APH 1.9", f"drand round {p.committed_round} ({beacon['source']})")
    await insight.refresh_risk(session, app)
    await notify(session, "institution", f"Expert visit panel assigned for {app.id}", "green", app.id, institution_id=app.institution_id)
    await session.commit()
    return _panel_out(p)


@router.post("/{app_id}/photos", summary="Upload visit photos; location and time are checked against the campus")
async def photos(app_id: str, files: list[UploadFile] = File(...), user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    inst = await session.get(Institution, app.institution_id)
    out = []
    for f in files[:20]:
        data = await f.read()
        meta = geo.read_exif(data)
        v = geo.judge(meta, inst.lat, inst.lng, today().isoformat())
        session.add(VisitPhoto(application_id=app.id, filename=(f.filename or "photo.jpg")[:200], sha256=audit.sha256_hex(data), lat=meta.get("lat"), lng=meta.get("lng"), taken_at=meta.get("takenAt"), distance_m=v["distanceM"], verdict=v["verdict"]))
        out.append({"name": f.filename, **meta, **v})
    flagged = [o for o in out if o["verdict"] != "ok"]
    await audit.append(session, app.id, f"{len(out)} visit photos checked; {len(flagged)} flagged", user.name, user.role, "APH 1.9(f)")
    await session.commit()
    return out


@router.post("/{app_id}/photos/check", summary="Check photo metadata already read in the browser")
async def check_meta(app_id: str, items: list[dict], user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    inst = await session.get(Institution, app.institution_id)
    return [{**i, **geo.judge(i, inst.lat, inst.lng, today().isoformat())} for i in items[:50]]


@router.get("/{app_id}/photos", summary="Photos checked for this visit")
async def list_photos(app_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    await visible_app(session, user, app_id)
    rows = (await session.execute(select(VisitPhoto).where(VisitPhoto.application_id == app_id))).scalars()
    return [{"name": r.filename, "lat": r.lat, "lng": r.lng, "takenAt": r.taken_at, "distanceM": r.distance_m, "verdict": r.verdict} for r in rows]
