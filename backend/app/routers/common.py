"""Shared lookups that also enforce who may see what."""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Application, ApplicationType, Institution
from ..schemas import Principal
from ..security import can_see_application


async def visible_app(session: AsyncSession, user: Principal, app_id: str) -> Application:
    app = await session.get(Application, app_id)
    if not app:
        raise HTTPException(404, f"No application {app_id}")
    if not can_see_application(user, app.institution_id, app.region):
        # Same answer as "not found", so references cannot be probed.
        raise HTTPException(404, f"No application {app_id}")
    return app


async def app_context(session: AsyncSession, app: Application) -> tuple[Institution, ApplicationType]:
    return await session.get(Institution, app.institution_id), await session.get(ApplicationType, app.type_id)


def public_base(request_url: str) -> str:
    """Origin used in QR codes and credentials (the frontend's /verify page)."""
    from urllib.parse import urlparse

    u = urlparse(request_url)
    return f"{u.scheme}://{u.hostname}:5180" if u.hostname in ("localhost", "127.0.0.1", "testserver") else f"{u.scheme}://{u.netloc}"
