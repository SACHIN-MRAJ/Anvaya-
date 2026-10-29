from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse

import jwt
from sqlalchemy import func, select

from .. import oidc
from ..db import system_session
from ..models import Member, User
from ..config import settings
from ..schemas import AuthConfig, DevLogin, LogoutOut, Principal
from ..security import DEV_USERS, INSTITUTION_ROLES, OFFICER_ROLES, clear_session, current_user, issue_session, INSTITUTION_ROLE_ALIASES, OFFICER_ROLE_ALIASES

router = APIRouter(tags=["Sign-in"])


@router.get("/auth/config", response_model=AuthConfig, summary="How this server signs people in")
async def auth_config() -> AuthConfig:
    return AuthConfig(mode=settings.auth_mode, login_url="/api/auth/login" if settings.auth_mode == "oidc" else None)


@router.post("/auth/dev-login", response_model=Principal, summary="Sign in as a sample user (development only)")
async def dev_login(body: DevLogin, response: Response) -> Principal:
    if settings.auth_mode != "dev" or settings.secure:
        raise HTTPException(404, "Use single sign-on")
    if body.portal == "institution":
        raw = body.institution_role or "Principal / Director"
        role = INSTITUTION_ROLE_ALIASES.get(raw, raw)
        if role not in INSTITUTION_ROLES:
            raise HTTPException(422, f"Unknown role. Choose one of: {', '.join(INSTITUTION_ROLES)}")
        user = DEV_USERS[f"institution:{role}"]
    else:
        raw = body.officer_role or "Bureau head"
        role = OFFICER_ROLE_ALIASES.get(raw, raw)
        if role not in OFFICER_ROLES:
            raise HTTPException(422, f"Unknown role. Choose one of: {', '.join(OFFICER_ROLES)}")
        user = DEV_USERS[role]
    issue_session(response, user)
    return user


@router.get("/auth/login", status_code=302, response_class=RedirectResponse, summary="Start single sign-on (Keycloak, authorization code with PKCE)")
async def sso_login(next: str = Query("/", max_length=300)):
    if settings.auth_mode != "oidc":
        raise HTTPException(404, "Single sign-on is not switched on; use development sign-in")
    url, state_cookie = oidc.start(next)
    response = RedirectResponse(url, status_code=302)
    response.set_cookie(oidc.STATE_COOKIE, state_cookie, httponly=True, samesite="lax", secure=settings.secure, max_age=600, path="/api/auth")
    return response


async def _remember(user: Principal, id_token: str) -> Principal:
    """Keeps a users row for everyone who signs in through Keycloak, so alerts reach them and their channel and
    language choices persist. The ID token was verified a moment ago; only its email claim is read here.

    For institution staff the Principal's team list decides: a listed person gets the role given there, and a person
    whose access the Principal switched off is refused."""
    email = str(jwt.decode(id_token, options={"verify_signature": False}).get("email", ""))[:160]
    async with system_session() as s:
        if user.portal == "institution" and email:
            m = (await s.execute(select(Member).where(Member.institution_id == user.institution_id, func.lower(Member.email) == email.lower()))).scalar_one_or_none()
            if m and not m.active:
                raise HTTPException(403, "Your access to this institution's records has been switched off by the Principal.")
            if m:
                user = user.model_copy(update={"role": m.role})
        row = await s.get(User, user.id)
        if row is None:
            row = User(id=user.id, name=user.name, portal=user.portal, role=user.role, channels=["email"])
            s.add(row)
        row.name, row.portal, row.role, row.region, row.institution_id = user.name, user.portal, user.role, user.region, user.institution_id
        row.email = email or row.email
        await s.commit()
    return user


@router.get("/auth/callback", status_code=302, response_class=RedirectResponse, summary="Single sign-on returns here; sets the session cookie")
async def sso_callback(request: Request, code: str = Query("", max_length=4096), state: str = Query("", max_length=200), error: str = Query("", max_length=200)):
    web = settings.web_url.rstrip("/")
    if settings.auth_mode != "oidc":
        raise HTTPException(404, "Single sign-on is not switched on")
    try:
        if error or not code:
            raise oidc.SignInError("Sign-in was cancelled or refused.")
        user, id_token, next_path = await oidc.finish(code, state, request.cookies.get(oidc.STATE_COOKIE))
    except oidc.SignInError as e:
        response = RedirectResponse(f"{web}/login?{urlencode({'reason': 'sso', 'message': str(e)})}", status_code=302)
    except HTTPException as e:  # an account without an ANUMATI role
        response = RedirectResponse(f"{web}/login?{urlencode({'reason': 'sso', 'message': e.detail})}", status_code=302)
    else:
        try:
            user = await _remember(user, id_token)
        except HTTPException as e:
            response = RedirectResponse(f"{web}/login?{urlencode({'reason': 'sso', 'message': e.detail})}", status_code=302)
            response.delete_cookie(oidc.STATE_COOKIE, path="/api/auth")
            return response
        home = "/institution" if user.portal == "institution" else "/aicte"
        response = RedirectResponse(f"{web}{next_path if next_path.startswith(home) else home}", status_code=302)
        issue_session(response, user)
        response.set_cookie(oidc.ID_TOKEN_COOKIE, id_token, httponly=True, samesite="lax", secure=settings.secure, path="/api/auth")
    response.delete_cookie(oidc.STATE_COOKIE, path="/api/auth")
    return response


@router.post("/auth/refresh", response_model=Principal, summary="Extend the session (the idle warning's “Stay signed in”)")
async def refresh(response: Response, user: Principal = Depends(current_user)) -> Principal:
    issue_session(response, user)
    return user


@router.post("/auth/logout", response_model=LogoutOut, summary="Sign out; with single sign-on, also returns the address that ends the Keycloak session")
async def logout(request: Request, response: Response) -> LogoutOut:
    url = oidc.logout_url(request.cookies.get(oidc.ID_TOKEN_COOKIE)) if settings.auth_mode == "oidc" else None
    clear_session(response)
    return LogoutOut(logout_url=url)


@router.get("/me", response_model=Principal, summary="Who is signed in")
async def me(user: Principal = Depends(current_user)) -> Principal:
    return user
