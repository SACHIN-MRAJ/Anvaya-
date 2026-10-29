"""Platform behaviour: error format, request guard, observability, idempotency, webhooks and single sign-on."""
import hashlib
import hmac
import time
import uuid
from urllib.parse import parse_qs, urlsplit

import jwt
import pytest
from conftest import login, pdf
from cryptography.hazmat.primitives.asymmetric import rsa

from app import oidc
from app.config import settings


def test_errors_are_problem_details(client):
    login(client, "institution")
    r = client.post("/api/public/assistant/ask", json={"question": ""})
    body = r.json()
    assert r.status_code == 422 and r.headers["content-type"].startswith("application/problem+json")
    assert body["status"] == 422 and isinstance(body["detail"], str) and body["errors"][0]["field"] == "question"
    assert body["requestId"] == r.headers["X-Request-ID"]
    missing = client.get("/api/applications/ANU-2026-9999")
    assert missing.status_code == 404 and missing.json()["title"] == "Not Found" and isinstance(missing.json()["detail"], str)
    spec = client.get("/openapi.json").json()
    assert "Problem" in spec["components"]["schemas"] and "HTTPValidationError" not in spec["components"]["schemas"]


def test_cross_site_requests_are_blocked(client):
    login(client, "aicte", "Bureau head")
    note = {"action": "note", "reason": "Checked the building plan"}
    evil = client.post("/api/applications/ANU-2026-0412/actions", json=note, headers={"Origin": "https://evil.example"})
    assert evil.status_code == 403 and "another website" in evil.json()["detail"]
    assert client.post("/api/applications/ANU-2026-0412/actions", json=note, headers={"Origin": "http://localhost:5180"}).status_code == 200
    assert client.post("/api/applications/ANU-2026-0412/actions", json=note, headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403
    assert client.post("/api/applications/ANU-2026-0412/actions", json=note).status_code == 200  # non-browser client, no Origin


def test_oversized_requests_are_refused(client):
    login(client, "institution")
    r = client.post("/api/public/feedback", content=b"{" + b" " * (settings.max_json_kb * 1024 + 10) + b"}", headers={"Content-Type": "application/json"})
    assert r.status_code == 413
    big = client.post("/api/uploads", data={"doc_kind": "uni"}, files={"file": ("big.pdf", pdf(pad=settings.max_upload_mb * 1024 * 1024 + 1), "application/pdf")})
    assert big.status_code == 413


def test_metrics_and_readiness(client):
    client.get("/api/public/glossary")
    text = client.get("/metrics").text
    assert 'anumati_http_requests_total{method="GET",route="/api/public/glossary",status="200"}' in text
    ready = client.get("/api/ready").json()
    assert ready["ok"] and ready["checks"] == {"database": "ok", "storage": "ok", "virusScan": "not configured"}


def test_activity_is_region_scoped(client):
    login(client, "aicte", "Dealing officer")
    refs = {e["ref"] for e in client.get("/api/aicte/activity", params={"limit": 100}).json()}
    login(client, "aicte", "Bureau head")
    regions = {a["id"]: a["region"] for a in client.get("/api/aicte/queue").json()} | {a["id"]: a["region"] for a in client.get("/api/applications").json()}
    assert refs and all(regions.get(r) == "CRO" for r in refs)


def test_submission_is_idempotent(client):
    login(client, "institution")
    types = {t["id"]: t for t in client.get("/api/public/rules/types").json()}
    docs = [client.post("/api/uploads", data={"doc_kind": d["id"]}, files={"file": (f"{d['id']}.pdf", pdf(), "application/pdf")}).json()["id"] for d in types["intake"]["documents"]]
    body = {"typeId": "intake", "details": {"programme": "B.Tech CSE", "current": 120, "requested": 150}, "documentIds": docs, "signer": "Secretary, Narmada Valley Education Society", "declarations": {"truth": True, "lock": True}}
    key = {"Idempotency-Key": uuid.uuid4().hex}
    first = client.post("/api/applications", json=body, headers=key)
    again = client.post("/api/applications", json=body, headers=key)
    assert first.status_code == 201 and again.status_code == 201 and again.headers["Idempotent-Replayed"] == "true"
    assert first.json()["application"]["id"] == again.json()["application"]["id"]
    changed = client.post("/api/applications", json={**body, "signer": "Chairman, Narmada Valley Education Society"}, headers=key)
    assert changed.status_code == 422
    assert client.post("/api/applications", json=body, headers={"Idempotency-Key": "bad key!"}).status_code == 422


def test_webhooks_need_a_valid_signature(client, monkeypatch):
    monkeypatch.setattr(settings, "webhook_secret", "s3cret-shared-with-the-provider")
    raw = b'{"from": "+919800000001", "text": "What is an EoA?"}'
    assert client.post("/api/channels/whatsapp/webhook", content=raw, headers={"Content-Type": "application/json"}).status_code == 401
    sig = "sha256=" + hmac.new(b"s3cret-shared-with-the-provider", raw, hashlib.sha256).hexdigest()
    ok = client.post("/api/channels/whatsapp/webhook", content=raw, headers={"Content-Type": "application/json", "X-Hub-Signature-256": sig})
    assert ok.status_code == 200 and ok.json()["reply"]


@pytest.fixture
def fake_keycloak(monkeypatch):
    """A stand-in realm: real RSA-signed ID tokens, the same checks as against Keycloak."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    for name, value in {"auth_mode": "oidc", "oidc_issuer": "http://sso.test/realms/anumati", "oidc_client_secret": "client-secret", "web_url": "http://localhost:5180"}.items():
        monkeypatch.setattr(settings, name, value)
    monkeypatch.setattr(oidc, "signing_key", lambda token: key.public_key())
    issued = {}

    def id_token(nonce: str, roles: list[str], groups: list[str]) -> str:
        now = int(time.time())
        claims = {"iss": settings.oidc_issuer, "aud": settings.oidc_client_id, "sub": "7d1c", "nonce": nonce, "iat": now, "exp": now + 300, "name": "S. Iyer", "roles": roles, "groups": groups}
        return jwt.encode(claims, key, algorithm="RS256")

    async def exchange(code: str, verifier: str) -> dict:
        assert code == "one-time-code" and len(verifier) >= 43
        return {"id_token": id_token(issued["nonce"], *issued["account"]), "access_token": "opaque"}

    monkeypatch.setattr(oidc, "exchange_code", exchange)
    return issued


def _sign_in(client, issued: dict, roles: list[str], groups: list[str], next_path: str = "/aicte/queue"):
    client.cookies.clear()
    start = client.get("/api/auth/login", params={"next": next_path}, follow_redirects=False)
    assert start.status_code == 302
    q = parse_qs(urlsplit(start.headers["location"]).query)
    assert q["code_challenge_method"] == ["S256"] and q["redirect_uri"] == ["http://localhost:5180/api/auth/callback"]
    issued.update(nonce=q["nonce"][0], account=(roles, groups))
    return client.get("/api/auth/callback", params={"code": "one-time-code", "state": q["state"][0]}, follow_redirects=False)


def test_single_sign_on_flow(client, fake_keycloak):
    assert client.get("/api/auth/config").json() == {"mode": "oidc", "loginUrl": "/api/auth/login"}
    assert client.post("/api/auth/dev-login", json={"portal": "institution"}).status_code == 404

    done = _sign_in(client, fake_keycloak, ["dealing-officer"], ["/regions/CRO"])
    assert done.status_code == 302 and done.headers["location"] == "http://localhost:5180/aicte/queue"
    me = client.get("/api/me").json()
    assert me["portal"] == "aicte" and me["role"] == "Dealing officer" and me["region"] == "CRO" and me["name"] == "S. Iyer"
    assert {a["region"] for a in client.get("/api/aicte/queue").json()} == {"CRO"}
    out = client.post("/api/auth/logout").json()["logoutUrl"]
    assert out.startswith("http://sso.test/realms/anumati/protocol/openid-connect/logout") and "id_token_hint=" in out

    inst = _sign_in(client, fake_keycloak, ["institution"], ["/institutions/INS-001"], next_path="/aicte")
    assert inst.headers["location"] == "http://localhost:5180/institution"  # never into the other portal
    assert client.get("/api/me").json()["institutionId"] == "INS-001"

    nobody = _sign_in(client, fake_keycloak, ["offline_access"], [])
    assert nobody.status_code == 302 and "/login?reason=sso" in nobody.headers["location"]
    assert client.get("/api/me").status_code == 401


def test_sign_in_rejects_a_forged_state(client, fake_keycloak):
    client.cookies.clear()
    client.get("/api/auth/login", follow_redirects=False)
    r = client.get("/api/auth/callback", params={"code": "one-time-code", "state": "forged"}, follow_redirects=False)
    assert r.status_code == 302 and "reason=sso" in r.headers["location"] and client.get("/api/me").status_code == 401
    assert oidc.safe_next("//evil.example") == "/" and oidc.safe_next("/institution") == "/institution"


def test_clamd_reply_parsing():
    from app.services.documents import clamd_verdict

    assert clamd_verdict("stream: OK\x00") == "clean"
    assert clamd_verdict("stream: Win.Test.EICAR_HDB-1 FOUND\x00") == "infected"
    assert clamd_verdict("INSTREAM size limit exceeded. ERROR\x00") == "unavailable"
    assert clamd_verdict("") == "unavailable"


def test_rate_limit_and_public_cache(client, monkeypatch):
    first = client.get("/api/public/status")
    assert first.headers["Cache-Control"] == "public, max-age=15"
    assert client.get("/api/public/status").json() == first.json()  # served from the 15-second cache
    from app import middleware

    monkeypatch.setattr(settings, "rate_limit_per_minute", 3)
    middleware._hits.clear()
    codes = [client.get("/api/public/glossary").status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200] and codes[3] == 429
    limited = client.get("/api/public/glossary")
    assert limited.headers["Retry-After"] == "60" and limited.json()["status"] == 429
    middleware._hits.clear()


def test_email_alerts_reach_the_right_people(client, monkeypatch):
    import smtplib

    sent = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            self.host = host

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def send_message(self, msg):
            sent.append(msg)

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(settings, "email_mode", "smtp")
    monkeypatch.setattr(settings, "smtp_url", "smtp://mailpit:1025")
    login(client, "aicte", "Bureau head")
    target = next(a for a in client.get("/api/aicte/queue").json() if a["institutionId"] == "INS-001")
    r = client.post("/api/aicte/queue/bulk", json={"action": "remind", "ids": [target["id"]]})
    assert r.status_code == 200 and sent
    msg = sent[-1]
    bcc = set(msg["Bcc"].split(", "))  # only that institution's team, never in To or Cc
    assert "u-inst-001@example.gov.in" in bcc and all(x.startswith("u-inst-001") for x in bcc)
    assert "u-inst-001" not in (msg["To"] or "") and not msg["Cc"]
    assert target["id"] in msg["Subject"] and f"/institution/applications/{target['id']}" in msg.get_content()


def test_rate_limit_falls_back_when_valkey_is_down(client, monkeypatch):
    import asyncio

    from app import middleware

    monkeypatch.setattr(settings, "redis_url", "redis://127.0.0.1:1/0")
    monkeypatch.setattr(settings, "rate_limit_per_minute", 2)
    monkeypatch.setattr(middleware, "_redis", None)
    middleware._hits.clear()
    results = [asyncio.run(middleware.over_limit("203.0.113.9")) for _ in range(3)]
    assert results == [False, False, True]  # the per-process limit still applies
    middleware._hits.clear()
