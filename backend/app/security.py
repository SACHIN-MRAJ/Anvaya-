"""Sign-in, roles and data scoping.

Every signed-in browser carries one HttpOnly session cookie, signed by this server and valid for
ANUMATI_SESSION_MINUTES. It is issued after development sign-in (sample users) or after Keycloak single sign-on
(see oidc.py); either way every endpoint sees the same Principal. Other systems may instead send a Keycloak access
token as "Authorization: Bearer"; in oidc mode it is verified against the realm's published keys.
"""
import time
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Response, status

from . import oidc
from .config import settings
from .schemas import Principal

COOKIE = "anumati_session"
OFFICER_ROLES = [
    "Dealing officer", "Regional officer", "Bureau head", "Committee member", "Rules administrator",
    "EVC coordinator", "Inspector", "Auditor", "System administrator",
]
REGION_LOCKED = {"Dealing officer", "Regional officer"}
# Roles that work on files. Inspectors fill their own field reports, auditors only read, administrators manage access.
CASE_ROLES = {"Dealing officer", "Regional officer", "Bureau head", "Committee member", "Rules administrator", "EVC coordinator"}
DECIDERS = {"Committee member", "Bureau head"}  # the Executive Committee is the competent authority (APH 2.25)

INSTITUTION_ROLES = ["Principal / Director", "Head of Department", "Compliance staff", "Academic administrator", "Institution staff"]
# What each institution role may do. Only the Principal submits; the Chairman or Secretary of the Trust signs (APH 1.4.6).
PERMISSIONS: dict[str, set[str]] = {
    "submit": {"Principal / Director"},
    "upload": set(INSTITUTION_ROLES),
    "review": {"Principal / Director", "Head of Department"},
    "profile": {"Principal / Director"},
    "infrastructure": {"Principal / Director", "Compliance staff"},
    "academics": {"Principal / Director", "Academic administrator", "Head of Department"},
    "team": {"Principal / Director"},
    "respond": {"Principal / Director", "Head of Department", "Compliance staff"},
}
PERMISSION_LABEL = {
    "submit": "Submit applications", "upload": "Prepare drafts and upload documents", "review": "Review drafts before submission",
    "profile": "Edit the institution profile and signatories", "infrastructure": "Update campuses, buildings and certificates",
    "academics": "Update courses, seats and faculty", "team": "Add people and change their access", "respond": "Reply to AICTE",
}

# Role aliases from the spec document -> internal permission roles
OFFICER_ROLE_ALIASES = {
    "Regulation Bureau Admin": "Bureau head",
    "Scrutiny Reviewer": "Regional officer",
    "EVC Inspector": "Inspector",
    "SHC Compliance Reviewer": "Committee member",
    "Executive Committee Approver": "Committee member",
    "Council Decision Authority": "Bureau head",
}

INSTITUTION_ROLE_ALIASES = {
    "Institution Administrator": "Principal / Director",
    "Institution Staff": "Institution staff",
    "Institution Staff / Application Officer": "Institution staff",
}

_INSTITUTION_PEOPLE = {
    "Principal / Director": ("u-inst-001", "Principal, Narmada Valley Institute of Technology"),
    "Head of Department": ("u-inst-001-hod", "Dr. A. Mehta (HoD, Computer Science)"),
    "Compliance staff": ("u-inst-001-cmp", "S. Joshi (Compliance cell)"),
    "Academic administrator": ("u-inst-001-acd", "P. Nair (Academic office)"),
    "Institution staff": ("u-inst-001-stf", "K. Rao (Office staff)"),
}
_OFFICER_NAMES = {"EVC coordinator": "A. Sharma", "Inspector": "Dr. R. Menon", "Auditor": "L. Fernandes", "System administrator": "T. Singh"}

DEV_USERS: dict[str, Principal] = {
    "institution": Principal(id="u-inst-001", name=_INSTITUTION_PEOPLE["Principal / Director"][1], portal="institution", role="Principal / Director", institution_id="INS-001"),
    **{
        f"institution:{role}": Principal(id=uid, name=name, portal="institution", role=role, institution_id="INS-001")
        for role, (uid, name) in _INSTITUTION_PEOPLE.items()
    },
    **{
        role: Principal(id=f"u-aicte-{i}", name=_OFFICER_NAMES.get(role, "R. Verma"), portal="aicte", role=role, region="CRO" if role in REGION_LOCKED else None)
        for i, role in enumerate(OFFICER_ROLES, start=1)
    },
}


def may(user: Principal, permission: str) -> bool:
    return user.portal == "institution" and user.role in PERMISSIONS[permission]


def issue_session(response: Response, user: Principal) -> str:
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {**user.model_dump(), "sub": user.id, "iat": now, "exp": now + timedelta(minutes=settings.session_minutes)},
        settings.secret_key,
        algorithm="HS256",
    )
    response.set_cookie(COOKIE, token, httponly=True, samesite="lax", secure=settings.secure, max_age=settings.session_minutes * 60, path="/")
    return token


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")
    response.delete_cookie(oidc.ID_TOKEN_COOKIE, path="/api/auth")


def _from_bearer(token: str) -> Principal:
    if settings.auth_mode == "oidc":
        return oidc.principal_from_claims(oidc.verify(token, settings.oidc_audience))
    return Principal.model_validate(jwt.decode(token, settings.secret_key, algorithms=["HS256"]))


def optional_user(request: Request) -> Principal | None:
    header = request.headers.get("authorization", "")
    bearer = header[7:] if header.lower().startswith("bearer ") else None
    token = bearer or request.cookies.get(COOKIE)
    if not token:
        return None
    try:
        user = _from_bearer(bearer) if bearer else Principal.model_validate(jwt.decode(token, settings.secret_key, algorithms=["HS256"]))
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired. Please sign in again.") from None
    except (jwt.PyJWTError, jwt.PyJWKClientError, ValueError):
        return None
    request.state.user = user  # read by the request log and by database row security
    return user


def current_user(user: Principal | None = Depends(optional_user)) -> Principal:
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in")
    return user


READS = {"GET", "HEAD", "OPTIONS"}
_inactive: tuple[float, set[str]] = (0.0, set())


async def _deactivated() -> set[str]:
    """Accounts switched off by an administrator or the Principal. Read again every 30 seconds, so access ends quickly
    without a database lookup on every request."""
    global _inactive
    if _inactive[0] > time.monotonic():
        return _inactive[1]
    from sqlalchemy import select

    from .db import system_session
    from .models import User

    async with system_session() as s:
        ids = set((await s.execute(select(User.id).where(User.active.is_(False)))).scalars())
    _inactive = (time.monotonic() + 30, ids)
    return ids


def forget_deactivated() -> None:
    global _inactive
    _inactive = (0.0, set())


def require_portal(portal: str):
    async def dep(request: Request, user: Principal = Depends(current_user)) -> Principal:
        if user.portal != portal:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"This needs the {portal} portal")
        if user.id in await _deactivated():
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your access to ANUMATI has been switched off. Contact your administrator.")
        if request.method not in READS:
            if user.role == "Auditor":
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Auditors have read-only access.")
            if user.role in ("Inspector", "EVC Inspector") and not request.url.path.startswith("/api/aicte/field"):
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Inspectors may only fill in their own field inspection reports.")
        return user

    return dep


def require_roles(*roles: str):
    async def dep(user: Principal = Depends(require_portal("aicte"))) -> Principal:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Only {', '.join(roles)} may do this")
        return user

    return dep


def require_permission(permission: str):
    """Institution portal: the signed-in person's role must carry this permission (see PERMISSIONS)."""

    async def dep(user: Principal = Depends(require_portal("institution"))) -> Principal:
        if user.role not in PERMISSIONS[permission]:
            allowed = " or ".join(sorted(PERMISSIONS[permission]))
            label = PERMISSION_LABEL[permission]
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Your role ({user.role}) cannot {label[0].lower()}{label[1:]}. Ask the {allowed}.")
        return user

    return dep


def region_scope(user: Principal) -> str | None:
    """Dealing and regional officers see only their own region. In PostgreSQL the same rule is
    also enforced by row-level security (see documents/backend/schema.sql)."""
    return user.region if user.portal == "aicte" and user.role in REGION_LOCKED else None


def can_see_application(user: Principal, institution_id: str, region: str) -> bool:
    if user.portal == "institution":
        return user.institution_id == institution_id
    scope = region_scope(user)
    return scope is None or scope == region
