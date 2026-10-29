"""Single sign-on with Keycloak, as a backend-for-frontend (BFF).

1. /api/auth/login sends the browser to Keycloak with PKCE (S256), a random state and a nonce. Those three live
   in a signed, HttpOnly, 10-minute cookie, so the API keeps no server-side login state.
2. Keycloak sends the browser back to /api/auth/callback with a one-time code. The API swaps it for tokens over
   the back channel, verifies the ID token (signature from the realm's published keys, issuer, audience, nonce)
   and maps realm roles and groups to an ANUMATI principal.
3. The browser receives only the usual HttpOnly session cookie. JavaScript never sees a Keycloak token.

Realm conventions (docker/keycloak/anumati-realm.json): realm roles `institution`, `dealing-officer`,
`regional-officer`, `bureau-head`, `committee-member`, `rules-administrator`; groups `/institutions/<id>` and
`/regions/<id>`; the client puts both into the ID token as `roles` and `groups`.
"""
import asyncio
import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import HTTPException, status

from .config import settings
from .schemas import Principal

STATE_COOKIE = "anumati_oidc"
ID_TOKEN_COOKIE = "anumati_idt"  # noqa: S105  # nosec B105  (a cookie name, not a secret)
ROLE_BY_SLUG = {
    "bureau-head": "Bureau head",
    "committee-member": "Committee member",
    "rules-administrator": "Rules administrator",
    "regional-officer": "Regional officer",
    "dealing-officer": "Dealing officer",
    "evc-coordinator": "EVC coordinator",
    "system-administrator": "System administrator",
    "inspector": "Inspector",
    "auditor": "Auditor",
}  # in order of precedence when an account holds several
INSTITUTION_ROLE_BY_SLUG = {
    "institution": "Principal / Director",
    "institution-hod": "Head of Department",
    "institution-compliance": "Compliance staff",
    "institution-academic": "Academic administrator",
    "institution-staff": "Institution staff",
}  # also in order of precedence


class SignInError(Exception):
    """Anything that should send the person back to the sign-in page with a message."""


def _issuer() -> str:
    return settings.oidc_issuer.rstrip("/")


def _internal() -> str:
    return (settings.oidc_internal_issuer or settings.oidc_issuer).rstrip("/")


def redirect_uri() -> str:
    return f"{settings.web_url.rstrip('/')}/api/auth/callback"


def safe_next(path: str | None) -> str:
    """Only paths on this site, so the sign-in flow cannot be used to bounce people to another site."""
    return path if path and path.startswith("/") and not path.startswith("//") and "\\" not in path else "/"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def start(next_path: str | None) -> tuple[str, str]:
    """Returns the Keycloak address to send the browser to, and the signed state cookie to set."""
    verifier = _b64url(secrets.token_bytes(48))
    state, nonce = secrets.token_urlsafe(24), secrets.token_urlsafe(24)
    now = datetime.now(timezone.utc)
    cookie = jwt.encode({"state": state, "nonce": nonce, "verifier": verifier, "next": safe_next(next_path), "iat": now, "exp": now + timedelta(minutes=10)}, settings.secret_key, algorithm="HS256")
    params = {
        "client_id": settings.oidc_client_id,
        "response_type": "code",
        "scope": "openid profile email",
        "redirect_uri": redirect_uri(),
        "state": state,
        "nonce": nonce,
        "code_challenge": _b64url(hashlib.sha256(verifier.encode()).digest()),
        "code_challenge_method": "S256",
    }
    return f"{_issuer()}/protocol/openid-connect/auth?{urlencode(params)}", cookie


async def exchange_code(code: str, verifier: str) -> dict:
    data = {
        "grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri(), "code_verifier": verifier,
        "client_id": settings.oidc_client_id, "client_secret": settings.oidc_client_secret,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(f"{_internal()}/protocol/openid-connect/token", data=data)
    except httpx.HTTPError as e:
        raise SignInError("The sign-in service could not be reached. Please try again.") from e
    if r.status_code != 200:
        raise SignInError("The sign-in service did not accept this sign-in. Please try again.")
    return r.json()


@lru_cache
def _jwks() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{_internal()}/protocol/openid-connect/certs", cache_keys=True, lifespan=3600)


def signing_key(token: str):
    return _jwks().get_signing_key_from_jwt(token).key


def verify(token: str, audience: str, nonce: str | None = None) -> dict:
    claims = jwt.decode(token, signing_key(token), algorithms=["RS256"], audience=audience, issuer=_issuer(), leeway=30)
    if nonce is not None and not secrets.compare_digest(str(claims.get("nonce", "")), nonce):
        raise jwt.InvalidTokenError("nonce mismatch")
    return claims


async def finish(code: str, state: str, cookie: str | None) -> tuple[Principal, str, str]:
    """Completes the sign-in. Returns the principal, the ID token (for single sign-out) and where to go next."""
    if not cookie:
        raise SignInError("The sign-in took too long or cookies are blocked. Please try again.")
    try:
        saved = jwt.decode(cookie, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as e:
        raise SignInError("The sign-in took too long. Please try again.") from e
    if not secrets.compare_digest(saved["state"], state):
        raise SignInError("This sign-in link was not started here. Please try again.")
    tokens = await exchange_code(code, saved["verifier"])
    try:
        claims = await asyncio.to_thread(verify, tokens["id_token"], settings.oidc_client_id, saved["nonce"])
    except (KeyError, jwt.PyJWTError) as e:
        raise SignInError("The sign-in could not be verified. Please try again.") from e
    return principal_from_claims(claims), tokens["id_token"], saved["next"]


def principal_from_claims(claims: dict) -> Principal:
    roles = set(claims.get("roles") or claims.get("realm_access", {}).get("roles", []))
    groups: list[str] = claims.get("groups") or []

    def group(kind: str) -> str | None:
        return next((g.rsplit("/", 1)[-1] for g in groups if g.startswith(f"/{kind}/")), None)

    name = claims.get("name") or claims.get("preferred_username") or "ANUMATI user"
    inst_role = next((role for slug, role in INSTITUTION_ROLE_BY_SLUG.items() if slug in roles), None)
    if inst_role:
        inst = group("institutions")
        if not inst:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is not linked to an institution yet. Contact the AICTE help desk.")
        return Principal(id=f"kc:{claims['sub']}", name=name, portal="institution", role=inst_role, institution_id=inst)
    officer = next((role for slug, role in ROLE_BY_SLUG.items() if slug in roles), None)
    if not officer:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has no ANUMATI role. Contact the AICTE help desk.")
    region = group("regions")
    if officer in ("Dealing officer", "Regional officer") and not region:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This officer account has no region. Contact the AICTE help desk.")
    return Principal(id=f"kc:{claims['sub']}", name=name, portal="aicte", role=officer, region=region if officer in ("Dealing officer", "Regional officer") else None)


def logout_url(id_token: str | None) -> str:
    params = {"post_logout_redirect_uri": f"{settings.web_url.rstrip('/')}/", "client_id": settings.oidc_client_id}
    if id_token:
        params["id_token_hint"] = id_token
    return f"{_issuer()}/protocol/openid-connect/logout?{urlencode(params)}"
