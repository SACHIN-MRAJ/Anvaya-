"""Who may see and do what."""
from conftest import login


def test_signed_out(client):
    client.cookies.clear()
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/aicte/dashboard").status_code == 401
    assert client.get("/api/applications/ANU-2026-0412").status_code == 401


def test_portal_separation(client):
    login(client, "institution")
    assert client.get("/api/aicte/queue").status_code == 403
    assert client.get("/api/applications/ANU-2026-0412").status_code == 200  # its own file
    other = next(a for a in client.get("/api/public/institutions").json() if a["id"] != "INS-001")
    login(client, "aicte", "Bureau head")
    foreign = next(a for a in client.get("/api/aicte/queue").json() if a["institutionId"] == other["id"])
    login(client, "institution")
    assert client.get(f"/api/applications/{foreign['id']}").status_code == 404  # never reveals other institutions' files


def test_region_lock(client):
    login(client, "aicte", "Dealing officer")
    q = client.get("/api/aicte/queue").json()
    assert q and {a["region"] for a in q} == {"CRO"}
    login(client, "aicte", "Bureau head")
    assert len({a["region"] for a in client.get("/api/aicte/queue").json()}) > 1


def test_roles(client):
    login(client, "aicte", "Dealing officer")
    assert client.post("/api/aicte/inspections/draw", json={"k": 5}).status_code == 403
    assert client.post("/api/rules/versions/2026.9/publish").status_code == 403
    r = client.post("/api/auth/dev-login", json={"portal": "aicte", "officerRole": "Minister"})
    assert r.status_code == 422


def test_session_refresh_and_logout(client):
    login(client, "institution")
    assert client.post("/api/auth/refresh").json()["portal"] == "institution"
    out = client.post("/api/auth/logout")
    assert out.status_code == 200 and out.json() == {"logoutUrl": None}  # no single sign-on in development
    client.cookies.clear()
    assert client.get("/api/me").status_code == 401


def test_security_headers(client):
    r = client.get("/api/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff" and r.headers["X-Frame-Options"] == "DENY" and "X-Request-ID" in r.headers


def test_list_is_scoped(client):
    login(client, "institution")
    assert {a["institutionId"] for a in client.get("/api/applications").json()} == {"INS-001"}
    login(client, "aicte", "Regional officer")
    assert {a["region"] for a in client.get("/api/applications").json()} == {"CRO"}


def test_production_refuses_dev_shortcuts():
    import pytest
    from app.config import Settings

    with pytest.raises(ValueError) as e:
        Settings(env="production", database_url="sqlite+aiosqlite:///./x.db")  # explicit: the test run may itself be on PostgreSQL
    for hint in ("ANUMATI_SECRET_KEY", "ANUMATI_AUTH_MODE=oidc", "PostgreSQL", "ANUMATI_FIXED_TODAY", "ANUMATI_SEED_ON_START", "ANUMATI_WEBHOOK_SECRET"):
        assert hint in str(e.value)
    sso = {"secret_key": "x" * 40, "auth_mode": "oidc", "oidc_issuer": "https://sso.example/realms/anumati", "oidc_client_secret": "s" * 32, "database_url": "postgresql+asyncpg://u:p@db/anumati"}
    ok = Settings(env="production", fixed_today="", seed_on_start=False, webhook_secret="w" * 32, **sso)
    assert ok.env == "production" and ok.secure
    # staging is production-grade on security but may load the sample cycle
    assert Settings(env="staging", **sso).seed_on_start
    with pytest.raises(ValueError, match="ANUMATI_OIDC_ISSUER"):
        Settings(env="staging", **{**sso, "oidc_issuer": ""})
