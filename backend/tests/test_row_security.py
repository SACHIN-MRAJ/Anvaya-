"""PostgreSQL row-level security: the database refuses rows even when a query forgets its filter.

Runs only on PostgreSQL (set ANUMATI_TEST_POSTGRES); every query here is deliberately unfiltered.
"""
import asyncio

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.db import IS_POSTGRES, SessionLocal, scoped_session, system_session
from app.models import Application, Campus, Certificate, Document, Faculty, FieldInspection, Member, Notification, Obligation, Programme, RegulatoryAction, Space, Verification
from app.schemas import Principal

pytestmark = pytest.mark.skipif(not IS_POSTGRES, reason="row-level security is a PostgreSQL feature")

INSTITUTION = Principal(id="u-inst-001", name="Principal", portal="institution", role="Principal / Director", institution_id="INS-001")
DEALING = Principal(id="u-aicte-1", name="R. Verma", portal="aicte", role="Dealing officer", region="CRO")
BUREAU = Principal(id="u-aicte-3", name="R. Verma", portal="aicte", role="Bureau head")


def run(coro):
    return asyncio.run(coro)


async def count(session, model, *where):
    return (await session.execute(select(func.count()).select_from(model).where(*where))).scalar_one()


def test_institution_sees_only_its_own_rows(client):
    async def check():
        async with system_session() as s:
            total, own = await count(s, Application), await count(s, Application, Application.institution_id == "INS-001")
            other_obligations = await count(s, Obligation, Obligation.institution_id != "INS-001")
        async with scoped_session(INSTITUTION) as s:
            assert await count(s, Application) == own < total  # no WHERE clause, still only its own files
            assert await count(s, Obligation, Obligation.institution_id != "INS-001") == 0 < other_obligations
            assert await count(s, Document, Document.institution_id != "INS-001") == 0
            assert await count(s, Notification, Notification.audience == "aicte") == 0

    run(check())


def test_region_lock_and_full_view(client):
    async def check():
        async with scoped_session(DEALING) as s:
            regions = set((await s.execute(select(Application.region).distinct())).scalars())
        async with scoped_session(BUREAU) as s:
            all_regions = set((await s.execute(select(Application.region).distinct())).scalars())
        assert regions == {"CRO"} and len(all_regions) > 1

    run(check())


def test_no_context_sees_nothing(client):
    async def check():
        async with SessionLocal() as s:  # a session that never said who is asking
            assert await count(s, Application) == 0
            assert await count(s, Obligation) == 0

    run(check())


def test_cannot_write_into_another_institution(client):
    async def attempt():
        async with scoped_session(INSTITUTION) as s:
            await s.execute(text("UPDATE obligations SET status = 'Met' WHERE institution_id <> 'INS-001'"))
            changed = (await s.execute(text("SELECT count(*) FROM obligations WHERE institution_id <> 'INS-001' AND status = 'Met'"))).scalar_one()
            await s.rollback()
            return changed

    assert run(attempt()) == 0  # other rows are invisible, so the UPDATE touches none of them

    async def forge():
        async with scoped_session(INSTITUTION) as s:
            await s.execute(text("INSERT INTO drafts (id, institution_id, type_id, data) VALUES ('DRF-forged', 'INS-002', 'intake', '{}')"))
            await s.commit()

    with pytest.raises(DBAPIError, match="row-level security"):
        run(forge())


def test_evidence_log_is_append_only_for_the_api(client):
    async def rewrite():
        async with system_session() as s:
            await s.execute(text("DELETE FROM audit_log WHERE ref = 'ANU-2026-0412'"))
            await s.commit()

    with pytest.raises(DBAPIError, match="permission denied"):
        run(rewrite())


def test_institutional_record_is_scoped_too(client):
    """The new record tables follow the same rule: an institution sees only its own rows, and never field inspections."""
    async def check():
        tables = (Campus, Space, Certificate, Programme, Faculty, Member, Verification, RegulatoryAction)
        async with system_session() as s:
            others = {m.__name__: await count(s, m, m.institution_id != "INS-001") for m in tables}
            inspections = await count(s, FieldInspection)
        async with scoped_session(INSTITUTION) as s:
            for m in tables:
                assert await count(s, m, m.institution_id != "INS-001") == 0, m.__name__
            assert await count(s, Campus) >= 1 and await count(s, FieldInspection) == 0
        async with scoped_session(DEALING) as s:
            assert await count(s, FieldInspection) == inspections > 0
        assert others["Campus"] > 0 and others["Certificate"] > 0 and others["Programme"] > 0

    run(check())
