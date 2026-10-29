"""ANUMATI API: FastAPI application, start-up and the background deadline scheduler.

Run:   .venv\\Scripts\\python -m uvicorn app.main:app --reload --port 8000
Docs:  http://localhost:8000/docs  (OpenAPI at /openapi.json, metrics at /metrics)
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import text

from . import errors, middleware, observability
from .config import settings
from .db import IS_POSTGRES, SessionLocal, engine, prepare_database, system_session
from .routers import aicte, applications, auth, channels, evc, institution, oversight, public, records, rules_api
from .seed import backfill_if_needed, seed_if_empty
from .services import credentials, documents, workflow

observability.configure_logging(settings.log_format)
log = logging.getLogger("anumati")


async def _scheduler() -> None:
    while True:
        try:
            async with system_session() as s:
                beat = await workflow.tick(s)
            if beat.get("escalated") or beat.get("reminded"):
                log.info("deadline check: %s", beat)
        except Exception:  # the loop must survive a bad tick
            log.exception("deadline check failed")
        await asyncio.sleep(settings.scheduler_interval_seconds)


SEED_LOCK = 26_262_002  # PostgreSQL advisory-lock key: one API process at a time seeds or upgrades the sample data


async def _seed_once() -> None:
    """Loads the sample cycle into an empty database, or builds the records an older database lacks. With several
    API processes starting together, the others wait on the lock and then find the work already done."""
    async def work():
        async with system_session() as s:
            if await seed_if_empty(s):
                log.info("sample cycle loaded into an empty database")
            elif await backfill_if_needed(s):
                log.info("institutional records built for a database from an earlier version")

    if not IS_POSTGRES:
        await work()
        return
    async with engine.connect() as lock:
        await lock.execute(text("SELECT pg_advisory_lock(:k)"), {"k": SEED_LOCK})
        try:
            await work()
        finally:
            await lock.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": SEED_LOCK})


@asynccontextmanager
async def lifespan(_: FastAPI):
    await documents.storage.prepare()
    await prepare_database()
    if settings.seed_on_start:
        await _seed_once()
    task = asyncio.create_task(_scheduler()) if settings.scheduler_enabled else None
    yield
    if task:
        task.cancel()


app = FastAPI(
    title="ANUMATI API",
    version="1.3.0",
    description="Approval workflow, compliance monitoring and alerts for AICTE. Every endpoint the ANUMATI interface needs. Errors use RFC 9457 Problem Details.",
    lifespan=lifespan,
)
errors.install(app)
middleware.install(app)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Request-ID"])

for r in (auth.router, public.router, institution.router, records.router, applications.router, oversight.router, aicte.router, aicte.notifications_router, evc.router, rules_api.router, channels.router):
    app.include_router(r, prefix="/api")


@app.get("/api/health", tags=["Operations"], summary="Liveness: the process is up")
async def health():
    return {"ok": True}


@app.get("/api/ready", tags=["Operations"], summary="Readiness: database, file storage and (if configured) the virus scanner")
async def ready():
    checks = {"database": "ok", "storage": "ok", "virusScan": "not configured" if not settings.clamd_host else "ok"}
    try:
        async with SessionLocal() as s:
            await s.execute(text("SELECT 1"))
    except Exception:
        checks["database"] = "down"
    if not await documents.storage.healthy():
        checks["storage"] = "down"
    if settings.clamd_host and not await documents.clamav_alive():
        checks["virusScan"] = "down"
    ok = "down" not in checks.values()
    body = {"ok": ok, "env": settings.env, "auth": settings.auth_mode, "checks": checks}
    if not ok:
        raise HTTPException(503, f"Not ready: {', '.join(k for k, v in checks.items() if v == 'down')} unavailable")
    return body


@app.get("/metrics", include_in_schema=False)
async def metrics(request: Request):
    if settings.metrics_token and request.headers.get("authorization") != f"Bearer {settings.metrics_token}":
        raise HTTPException(401, "Metrics need the metrics token")
    payload, media = observability.metrics_payload()
    return Response(payload, media_type=media)


@app.get("/.well-known/did.json", tags=["Operations"], summary="did:web document with the letter-signing public key")
async def did():
    return credentials.did_document()
