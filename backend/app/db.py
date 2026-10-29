"""Database engine and sessions (SQLAlchemy 2, async).

Development uses SQLite with tables created from the models. PostgreSQL is set up by Alembic migrations
(migrations/), and the API connects as `anumati_app`, a role that row-level security applies to. Every
transaction is told who is asking (portal, institution, region), so the database itself refuses rows the
person may not see, even if a query in the code forgets a filter. With no context it shows no protected rows.
"""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, HTTPException, Request
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.pool import NullPool

from .config import settings

IS_POSTGRES = settings.database_url.startswith("postgresql")


class Base(DeclarativeBase):
    pass


if settings.db_pool == "null":
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
else:
    sizing = {"pool_size": settings.db_pool_size, "max_overflow": settings.db_max_overflow, "pool_timeout": settings.db_pool_timeout} if IS_POSTGRES else {}
    engine = create_async_engine(settings.database_url, pool_pre_ping=True, **sizing)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

if not IS_POSTGRES:

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=5000")
        cur.close()


SYSTEM = {"portal": "system", "institution_id": "", "region": ""}
PUBLIC = {"portal": "public", "institution_id": "", "region": ""}


def context_for(user) -> dict[str, str]:
    """Row-security context for a signed-in principal (or the public)."""
    if user is None:
        return PUBLIC
    region = user.region if user.portal == "aicte" and user.role in ("Dealing officer", "Regional officer") else ""
    return {"portal": user.portal, "institution_id": user.institution_id or "", "region": region or ""}


@event.listens_for(Session, "after_begin")
def _apply_row_security(session: Session, _transaction, connection) -> None:
    """Runs at the start of every transaction, including the new one after each commit."""
    if not (IS_POSTGRES and settings.db_row_security):
        return
    ctx = session.info.get("rls")
    if ctx is None:
        return  # no context: policies show no protected rows
    connection.execute(
        text("SELECT set_config('anumati.portal', :p, true), set_config('anumati.institution_id', :i, true), set_config('anumati.region', :r, true)"),
        {"p": ctx["portal"], "i": ctx["institution_id"], "r": ctx["region"]},
    )


def _soft_user(request: Request):
    from .security import optional_user

    try:
        return optional_user(request)
    except HTTPException:
        return None  # an expired cookie on a public page is simply "not signed in"


async def get_session(user=Depends(_soft_user)) -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        session.info["rls"] = context_for(user)
        yield session


@asynccontextmanager
async def system_session() -> AsyncIterator[AsyncSession]:
    """For the background clock and start-up: sees everything, as the scheduler must."""
    async with SessionLocal() as session:
        session.info["rls"] = SYSTEM
        yield session


@asynccontextmanager
async def scoped_session(user) -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        session.info["rls"] = context_for(user)
        yield session


async def prepare_database() -> None:
    """SQLite: create tables from the models. PostgreSQL: the schema comes from `alembic upgrade head`."""
    if IS_POSTGRES:
        return
    from . import models  # noqa: F401  (registers tables)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def create_all() -> None:  # kept for scripts and tests
    from . import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
