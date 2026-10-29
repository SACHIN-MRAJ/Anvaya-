"""The request guard every call passes through, outermost first:

request ID → rate limit → body-size limit → cross-site request check → the route → metrics, security headers,
cache policy and one log line. Every refusal is a Problem Details response with the same request ID.
"""
import logging
import time
import uuid
from collections import defaultdict, deque
from urllib.parse import urlsplit

from fastapi import FastAPI, Request

from . import observability as obs
from .config import settings
from .errors import problem

log = logging.getLogger("anumati")
UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}
NO_LIMIT = ("/stream", "/api/health", "/api/ready", "/metrics")
CSRF_EXEMPT = ("/api/channels/",)  # server-to-server webhooks, protected by their HMAC signature instead
_hits: dict[str, deque] = defaultdict(deque)
_redis = None  # created on first use when ANUMATI_REDIS_URL is set


def _local_over_limit(ip: str) -> bool:
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    q.append(now)
    return len(q) > settings.rate_limit_per_minute


async def over_limit(ip: str) -> bool:
    """One-minute window per address. With Valkey/Redis it is shared by every API process and server; if Valkey
    cannot be reached the per-process limit applies, so a cache outage never takes the portal down."""
    global _redis
    if not settings.redis_url:
        return _local_over_limit(ip)
    try:
        if _redis is None:
            import redis.asyncio as aioredis

            _redis = aioredis.from_url(settings.redis_url, socket_timeout=0.3, socket_connect_timeout=0.3)
        key = f"anumati:rl:{ip}:{int(time.time() // 60)}"
        pipe = _redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, 90)
        count, _ = await pipe.execute()
        return int(count) > settings.rate_limit_per_minute
    except Exception:
        log.warning("shared rate limit unavailable; using this process's limit")
        return _local_over_limit(ip)


def _origin(request: Request) -> str | None:
    origin = request.headers.get("origin")
    if origin and origin != "null":
        return origin.rstrip("/")
    referer = request.headers.get("referer")
    if referer:
        u = urlsplit(referer)
        return f"{u.scheme}://{u.netloc}"
    return None


def cross_site(request: Request) -> bool:
    """True for a state-changing browser request that carries the session cookie but comes from another site.

    OWASP's "verify origin with standard headers": the browser always sends Origin (or Sec-Fetch-Site) on such
    requests and a page cannot forge them. Requests with a Bearer token are not cookie-based and are not at risk.
    SameSite=Lax cookies are the second layer.
    """
    if request.method not in UNSAFE or request.url.path.startswith(CSRF_EXEMPT):
        return False
    if "anumati_session" not in request.cookies or request.headers.get("authorization", "").lower().startswith("bearer "):
        return False
    origin = _origin(request)
    if origin is None:
        return request.headers.get("sec-fetch-site", "same-origin") not in ("same-origin", "same-site", "none")
    allowed = {o.rstrip("/") for o in settings.cors_origins} | {settings.web_url.rstrip("/")}
    return origin not in allowed and urlsplit(origin).netloc != request.headers.get("host")


def _too_large(request: Request) -> int | None:
    length = request.headers.get("content-length")
    if not length or not length.isdigit():
        return None
    multipart = request.headers.get("content-type", "").startswith("multipart/")
    limit = settings.max_upload_mb * 21 * 1024 * 1024 if multipart else settings.max_json_kb * 1024  # up to 20 photos per visit
    return limit if int(length) > limit else None


def _route_label(request: Request) -> str:
    """The route template (/api/applications/{app_id}), never the raw path, so metrics stay low-cardinality."""
    route = request.scope.get("route")
    if route is None:
        return "unmatched"
    template = getattr(route, "path_format", None) or route.path
    # routers are included under /api; the matched route reports its path inside that prefix
    return f"/api{template}" if request.url.path.startswith("/api/") and not template.startswith("/api/") else template


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def guard(request: Request, call_next):
        rid = (request.headers.get("x-request-id") or uuid.uuid4().hex[:12])[:64]
        request.state.request_id = rid
        path = request.url.path
        ip = request.client.host if request.client else "unknown"
        start = time.perf_counter()

        refusal = None
        if not path.endswith(NO_LIMIT) and await over_limit(ip):
            refusal = problem(request, 429, "Too many requests. Please wait a minute.", headers={"Retry-After": "60"})
        if refusal is None and (limit := _too_large(request)):
            refusal = problem(request, 413, f"The request is larger than {limit // 1024 // 1024 or 1} MB.")
        if refusal is None and cross_site(request):
            refusal = problem(request, 403, "This request came from another website and was blocked to protect your account.")

        if refusal is not None:
            response = refusal
        else:
            try:
                response = await call_next(request)
            except Exception:
                log.exception("unhandled error rid=%s %s %s", rid, request.method, path)
                response = problem(request, 500, "Something went wrong on our side. Quote this reference to the help desk.")

        seconds = time.perf_counter() - start
        route = _route_label(request)
        obs.REQUESTS.labels(request.method, route, str(response.status_code)).inc()
        obs.LATENCY.labels(route).observe(seconds)

        response.headers.update({
            "X-Request-ID": rid, "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin", "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "Cross-Origin-Opener-Policy": "same-origin",
        })
        if settings.secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        if not path.startswith(("/docs", "/redoc", "/openapi")):
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        user = getattr(request.state, "user", None)
        if user is not None and "cache-control" not in response.headers:
            response.headers["Cache-Control"] = "no-store"  # personal data never stays in shared browser or proxy caches
        log.info("%s %s %s %.0fms rid=%s", request.method, path, response.status_code, seconds * 1000, rid,
                 extra={"request_id": rid, "method": request.method, "path": path, "status": response.status_code, "ms": round(seconds * 1000), "user": getattr(user, "id", None)})
        return response
