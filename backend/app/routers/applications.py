"""One application, as seen by its institution or by officers with access, plus the evidence log."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit, rules
from ..db import get_session
from ..observability import CHAIN_FAILURES
from ..models import Application
from ..schemas import ActionIn, ApplicationOut, AuditEntryOut, ChainVerdict, Principal
from ..security import can_see_application, current_user, region_scope, require_portal
from ..services import insight, workflow
from .common import app_context, visible_app

router = APIRouter(tags=["Applications"])
officer = require_portal("aicte")


@router.get("/applications", response_model=list[ApplicationOut], summary="Every application this user may see (officers: by region; institutions: their own)")
async def list_apps(user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    stmt = select(Application).order_by(Application.due_on)
    if user.portal == "institution":
        stmt = stmt.where(Application.institution_id == user.institution_id)
    elif region_scope(user):
        stmt = stmt.where(Application.region == region_scope(user))
    return list((await session.execute(stmt)).scalars())


@router.get("/applications/{app_id}", response_model=ApplicationOut, summary="One application with its stages, clock and history")
async def get_app(app_id: str, user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await visible_app(session, user, app_id)


@router.get("/applications/{app_id}/path", summary="Stage path from the rules version this file was submitted under")
async def path(app_id: str, user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    v = await rules.published(session)
    p = insight.path_for(app, v.table)
    return {"rulesVersion": app.rules_version, "path": p, "current": insight.current_index(app, p)}


@router.get("/applications/{app_id}/eta", summary="Expected decision window")
async def eta(app_id: str, user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    return insight.eta(app, (await rules.published(session)).table)


@router.get("/applications/{app_id}/risk", summary="Delay risk with the reasons behind it")
async def risk(app_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    await insight.refresh_risk(session, app)
    await session.commit()
    return {"risk": app.risk, "reasons": app.risk_reasons, "model": "Transparent additive logistic model; contributions are exact per-factor shares."}


@router.get("/applications/{app_id}/brief", summary="Case brief, every line with its source")
async def brief(app_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    inst, t = await app_context(session, app)
    return insight.brief(app, inst, t)


@router.get("/applications/{app_id}/diff", summary="What changed since the last submission")
async def diff(app_id: str, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    app = await visible_app(session, user, app_id)
    _, t = await app_context(session, app)
    return await insight.diff(session, app, t)


@router.post("/applications/{app_id}/actions", response_model=ApplicationOut, summary="Forward, send back, recommend, note or decide")
async def act(app_id: str, body: ActionIn, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return await workflow.act(session, user, await visible_app(session, user, app_id), body)


@router.get("/audit", response_model=list[AuditEntryOut], summary="Evidence log entries for a reference")
async def entries(ref: str, user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    await _may_read(session, user, ref)
    return await audit.chain(session, ref)


@router.get("/audit/verify", response_model=ChainVerdict, summary="Re-verify the hash chain for a reference")
async def verify(ref: str, user: Principal = Depends(current_user), session: AsyncSession = Depends(get_session)):
    await _may_read(session, user, ref)
    verdict = audit.verify_entries(await audit.chain(session, ref))
    if not verdict["ok"]:
        CHAIN_FAILURES.inc()
    return verdict


@router.get("/audit/root", summary="Today's root hash over every chain (published daily)")
async def root(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return {"root": await audit.daily_root(session), "algorithm": "SHA-256 over sorted chain heads"}


async def _may_read(session: AsyncSession, user: Principal, ref: str) -> None:
    app = await session.get(Application, ref)
    if app:
        if not can_see_application(user, app.institution_id, app.region):
            raise HTTPException(404, "Not found")
    elif user.portal == "institution":
        # an institution reads its own record and vault chains, never another institution's or AICTE's internal ones
        if ref not in (f"RECORD-{user.institution_id}", f"VAULT-{user.institution_id}"):
            raise HTTPException(404, "Not found")
    elif user.portal != "aicte":
        raise HTTPException(404, "Not found")
