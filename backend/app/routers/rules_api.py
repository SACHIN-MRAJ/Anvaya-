"""Rules studio: test, preview the impact of, propose and publish rule changes (maker-checker)."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit, rules
from ..db import get_session
from ..timeutil import local_iso
from ..models import Application, KeyValue, RuleVersion
from ..schemas import Principal, RuleProposalIn
from ..security import require_portal, require_roles

router = APIRouter(prefix="/rules", tags=["Rules studio"])
officer = require_portal("aicte")


async def _golden(session: AsyncSession) -> list[dict]:
    return (await session.get(KeyValue, "golden")).value["cases"]


def _version_out(v: RuleVersion) -> dict:
    return {"version": v.version, "status": v.status, "author": v.author, "approver": v.approver, "reason": v.reason, "effectiveFrom": v.effective_from, "testsPassed": v.tests_passed, "testsTotal": v.tests_total, "createdAt": local_iso(v.created_at), "publishedAt": local_iso(v.published_at)}


@router.get("/versions", summary="Every rule version, who made it and why")
async def versions(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    return [_version_out(v) for v in (await session.execute(select(RuleVersion).order_by(RuleVersion.id.desc()))).scalars()]


@router.get("/current", summary="The published decision table")
async def current(user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    v = await rules.published(session)
    return {"version": v.version, "table": v.table, "targets": v.targets}


@router.post("/test", summary="Run the 50 golden tests against a table")
async def test(body: dict, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    table = body.get("table") or (await rules.published(session)).table
    results = rules.run_golden(table, await _golden(session))
    return {"passed": sum(r["pass"] for r in results), "total": len(results), "results": results}


@router.post("/impact", summary="Which open files and institutions a change would affect")
async def impact(body: dict, user: Principal = Depends(officer), session: AsyncSession = Depends(get_session)):
    base = (await rules.published(session)).table
    open_apps = list((await session.execute(select(Application).where(Application.stage != "decision"))).scalars())
    rows = rules.impact(base, body.get("table", base), open_apps)
    return {"files": len(rows), "institutions": len({r["institutionId"] for r in rows}), "changes": rows}


@router.post("/versions", status_code=201, summary="Propose a change; golden tests run first")
async def propose(body: RuleProposalIn, user: Principal = Depends(require_roles("Rules administrator", "Bureau head")), session: AsyncSession = Depends(get_session)):
    if len(body.reason.strip()) < 10:
        raise HTTPException(422, "Explain the change in at least 10 characters; it is published with the version.")
    cur = await rules.published(session)
    results = rules.run_golden(body.table, await _golden(session))
    major, minor = cur.version.split(".")
    v = RuleVersion(version=f"{major}.{int(minor) + 1}", table=body.table, targets={**cur.targets, **(body.targets or {})}, status="proposed", author=f"{user.name} ({user.role})", reason=body.reason.strip(), effective_from=body.effective_from, tests_passed=sum(r["pass"] for r in results), tests_total=len(results))
    if await session.scalar(select(RuleVersion).where(RuleVersion.version == v.version)):
        raise HTTPException(409, f"Version {v.version} is already proposed. Publish or reject it first.")
    session.add(v)
    await audit.append(session, "RULES", f"Rules v{v.version} proposed ({v.tests_passed}/{v.tests_total} golden tests pass)", user.name, user.role, None, body.reason.strip())
    await session.commit()
    return _version_out(v)


@router.post("/versions/{version}/publish", summary="Approve and publish (a different person from the author)")
async def publish(version: str, user: Principal = Depends(require_roles("Bureau head")), session: AsyncSession = Depends(get_session)):
    v = await session.scalar(select(RuleVersion).where(RuleVersion.version == version))
    if not v or v.status != "proposed":
        raise HTTPException(404, "No proposed version with that number")
    if v.author.startswith(f"{user.name} ({user.role})"):
        raise HTTPException(403, "Maker-checker: the author cannot approve their own change.")
    v.status, v.approver, v.published_at = "published", f"{user.name} ({user.role})", datetime.now()
    await audit.append(session, "RULES", f"Rules v{v.version} published, effective {v.effective_from}", user.name, user.role, None, v.reason)
    await session.commit()
    return _version_out(v)
