"""The whole life of an application, end to end, with the fair clock and the evidence log."""
import asyncio
from datetime import timedelta

from conftest import login, pdf

from app.config import today
from app.db import IS_POSTGRES, system_session
from app.models import Application, AuditEntry
from app.services import workflow


def _upload(client, kind: str, data: bytes, name: str = "doc.pdf"):
    r = client.post("/api/uploads", data={"doc_kind": kind}, files={"file": (name, data, "application/pdf")})
    assert r.status_code == 201, r.text
    return r.json()


def test_preflight_rules(client):
    login(client, "institution")
    ok = _upload(client, "fac", pdf(pages=3))
    assert ok["pages"] == 3 and ok["preflight"]["errors"] == [] and ok["preflight"]["warnings"]  # unsigned warning
    bad = client.post("/api/uploads", data={"doc_kind": "x"}, files={"file": ("x.docx", b"hello", "application/octet-stream")}).json()
    assert "Only PDF files are accepted." in bad["preflight"]["errors"]
    locked = _upload(client, "y", pdf(encrypted=True))
    assert any("password" in e for e in locked["preflight"]["errors"])


def test_full_journey(client):
    login(client, "institution")
    types = {t["id"]: t for t in client.get("/api/public/rules/types").json()}
    docs = [_upload(client, d["id"], pdf(), f"{d['id']}.pdf")["id"] for d in types["intake"]["documents"]]
    findings = client.post("/api/applications/precheck", json={"typeId": "intake", "documentIds": docs, "requestedIntake": 180}).json()
    assert not [f for f in findings if f["severity"] == "blocker"]

    body = {"typeId": "intake", "details": {"programme": "B.Tech CSE (AI & ML)", "current": 120, "requested": 180}, "documentIds": docs, "signer": "Secretary, Narmada Valley Education Society"}
    assert client.post("/api/applications", json={**body, "declarations": {"truth": True}}).status_code == 422
    r = client.post("/api/applications", json={**body, "declarations": {"truth": True, "lock": True}})
    assert r.status_code == 201, r.text
    app, receipt = r.json()["application"], r.json()["receipt"]
    ref = app["id"]
    assert len(receipt["fingerprint"]) == 64 and receipt["receivedAt"].endswith("+05:30") and receipt["path"][0] == "Submitted"
    assert app["stage"] == "scrutiny" and app["clock"] == "running"
    assert client.get(f"/api/applications/{ref}/eta").json()["likely"]

    login(client, "aicte", "Bureau head")
    assert client.post(f"/api/applications/{ref}/actions", json={"action": "sendback", "reason": "no"}).status_code == 422
    sent = client.post(f"/api/applications/{ref}/actions", json={"action": "sendback", "reason": "University NOC does not name the course"}).json()
    assert sent["clock"] == "paused" and sent["publicStatus"] == "Action needed"

    login(client, "institution")
    assert any(n["ref"] == ref for n in client.get("/api/notifications").json())
    fixed = _upload(client, "uni", pdf(), "uni-v2.pdf")["id"]
    back = client.post(f"/api/applications/{ref}/responses", json={"documentIds": [fixed], "note": "Corrected NOC"}).json()
    assert back["clock"] == "running" and back["stage"] == "rescrutiny"

    login(client, "aicte", "Bureau head")
    diff = client.get(f"/api/applications/{ref}/diff").json()
    assert [c["docKind"] for c in diff["changed"]] == ["uni"]
    for _ in range(6):
        a = client.get(f"/api/applications/{ref}").json()
        if a["stage"] == "ec":
            break
        assert client.post(f"/api/applications/{ref}/actions", json={"action": "forward"}).status_code == 200
    assert client.get(f"/api/applications/{ref}").json()["stage"] == "ec"

    login(client, "aicte", "Dealing officer")
    assert client.post(f"/api/applications/{ref}/actions", json={"action": "decide", "outcome": "LoD"}).status_code in (403, 404)
    login(client, "aicte", "Committee member")
    done = client.post(f"/api/applications/{ref}/actions", json={"action": "decide", "outcome": "LoD", "reason": "Faculty shortfall"}).json()
    assert done["stage"] == "decision" and done["publicStatus"] == "Decision issued"
    assert client.get(f"/api/public/verify/{ref}").json()["status"] == "authentic"

    login(client, "institution")
    assert client.post(f"/api/applications/{ref}/appeal", json={"reason": "Faculty now appointed"}).json()["stage"] == "appeal"
    chain = client.get("/api/audit/verify", params={"ref": ref}).json()
    assert chain["ok"] and chain["count"] >= 8
    assert "ANUMATI SUBMISSION RECEIPT" in client.get(f"/api/applications/{ref}/receipt").text


def test_tamper_detection(client):
    async def tamper():
        async with system_session() as s:
            from sqlalchemy import select

            e = (await s.execute(select(AuditEntry).where(AuditEntry.ref == "ANU-2026-0398", AuditEntry.seq == 3))).scalar_one()
            e.payload = e.payload.replace("Scrutiny", "Scrutiny (edited)")
            await s.commit()

    login(client, "aicte", "Bureau head")
    assert client.get("/api/audit/verify", params={"ref": "ANU-2026-0398"}).json()["ok"] is True
    if IS_POSTGRES:
        # PostgreSQL refuses the edit outright: the API's role has no UPDATE on the log, and a trigger blocks even the owner.
        import pytest
        from sqlalchemy.exc import DBAPIError

        with pytest.raises(DBAPIError, match=r"permission denied|append-only"):
            asyncio.run(tamper())
        assert client.get("/api/audit/verify", params={"ref": "ANU-2026-0398"}).json()["ok"] is True
        return
    asyncio.run(tamper())  # SQLite has no such guard, so the hash chain must catch it
    bad = client.get("/api/audit/verify", params={"ref": "ANU-2026-0398"}).json()
    assert bad["ok"] is False and bad["brokenAt"] == 3


def test_scheduler_escalates(client):
    async def run():
        async with system_session() as s:
            from sqlalchemy import select

            app = (await s.execute(select(Application).where(Application.clock == "running"))).scalars().first()
            app.due_on, app.escalation_level = today() - timedelta(days=4), 0
            await s.commit()
            beat = await workflow.tick(s)
            await s.refresh(app)
            return app.clock, app.escalation_level, beat

    clock, level, beat = asyncio.run(run())
    assert clock == "breached" and level == 2 and beat["escalated"] >= 1

    async def due_today():
        async with system_session() as s:
            from sqlalchemy import select

            app = (await s.execute(select(Application).where(Application.clock == "running"))).scalars().first()
            app.due_on, app.escalation_level = today(), 0
            await s.commit()
            await workflow.tick(s)
            await s.refresh(app)
            return app.clock, app.escalation_level

    assert asyncio.run(due_today()) == ("running", 0)  # due today is not yet missed


def test_bulk_and_undo(client):
    login(client, "aicte", "Bureau head")
    ids = [a["id"] for a in client.get("/api/aicte/queue").json()[:3]]
    r = client.post("/api/aicte/queue/bulk", json={"action": "remind", "ids": ids}).json()
    assert r["count"] == 3
    assert client.post(f"/api/aicte/queue/bulk/{r['undoToken']}/undo").json()["withdrawn"] == 3
