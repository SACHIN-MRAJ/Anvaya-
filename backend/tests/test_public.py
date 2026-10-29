"""Public portal: everything works without signing in, and nothing private leaks."""
from conftest import login


def test_reference_data(client):
    assert len(client.get("/api/public/rules/types").json()) == 22
    assert len(client.get("/api/public/institutions").json()) == 20
    assert len(client.get("/api/public/glossary").json()) == 30
    assert client.get("/api/public/institutions", params={"q": "Indore"}).json()[0]["aicteId"] == "1-50986692"


def test_fake_college_shield(client):
    r = client.get("/api/public/institutions/check", params={"q": "Narmada Valley Institute of Technology and Management"}).json()
    assert r["flagged"]["realAicteId"] == "1-50986692"
    assert client.get("/api/public/institutions/check", params={"q": "Narmada"}).json()["flagged"] is None
    assert client.get("/api/public/institutions/check", params={"q": "Narmadha Valy Institute"}).json()["lookalikes"]


def test_verify_letter_and_fingerprint(client):
    v = client.get("/api/public/verify/anu-2026-0117").json()
    assert v["status"] == "authentic" and len(v["fingerprint"]) == 64
    text = client.get("/api/public/letters/ANU-2026-0117/text").text
    up = client.post("/api/public/verify/file", files={"file": ("letter.txt", text.encode())}).json()
    assert up["status"] == "authentic" and up["fingerprint"] == v["fingerprint"]
    assert client.post("/api/public/verify/file", files={"file": ("x.txt", (text + " ").encode())}).json()["status"] == "mismatch"
    assert client.get("/api/public/verify/ANU-2026-9999").json()["status"] == "not-found"


def test_signed_credential(client):
    vc = client.get("/api/public/letters/ANU-2026-0117/credential").json()
    assert vc["proof"]["cryptosuite"] == "eddsa-jcs-2022" and vc["proof"]["proofValue"].startswith("z")
    assert client.post("/api/public/credentials/verify", json=vc).json()["valid"] is True
    vc["credentialSubject"]["decision"] = "Letter of Approval granted (edited)"
    assert client.post("/api/public/credentials/verify", json=vc).json()["valid"] is False
    did = client.get("/.well-known/did.json").json()
    assert did["verificationMethod"][0]["publicKeyMultibase"].startswith("z6Mk")


def test_rules_evaluate(client):
    assert client.post("/api/public/rules/evaluate", json={"typeId": "intake"}).json()["path"][-1] == "Executive Committee"


def test_status_forecast_performance(client):
    s = client.get("/api/public/status").json()
    assert s["checks"]["Database"]["ok"] and len(s["services"]) == 9
    f = client.get("/api/public/status/forecast").json()
    assert 0.4 < f["lastWeekShare"] < 0.55
    p = client.get("/api/public/performance").json()["national"]
    # the same figures the website shows (other tests may add open files to the shared test database)
    assert {k: p[k] for k in ("decided", "missed", "medianDays", "onTimePct")} == {"decided": 16, "missed": 22, "medianDays": 13, "onTimePct": 94}
    assert p["total"] == p["decided"] + p["open"] >= 67


def test_assistant(client):
    client.cookies.clear()  # a visitor: the assistant must not give out a file's status
    a = client.post("/api/public/assistant/ask", json={"question": "Documents for change of site?"}).json()
    assert len(a["bullets"]) == 7 and "APH 2.17" in a["cites"][0]
    private = client.post("/api/public/assistant/ask", json={"question": "status of ANU-2026-0412"}).json()
    assert "sign in" in private["text"].lower() and not private["bullets"]


def test_calendar_and_feedback(client):
    ics = client.get("/api/public/calendar.ics").text
    assert ics.startswith("BEGIN:VCALENDAR") and "TRIGGER:-P3D" in ics
    assert client.post("/api/public/feedback", json={"page": "/", "helpful": True}).status_code == 201
    assert client.post("/api/public/reports/suspicious-institution", json={"name": "Fake Tech College"}).json()["ref"].startswith("RPT-2026-")


def test_counselling_api_needs_token(client):
    client.cookies.clear()
    assert client.get("/api/public/approved").status_code == 401
    r = client.get("/api/public/approved", headers={"Authorization": "Bearer state-counselling-mp"}, params={"state": "Madhya Pradesh"})
    assert r.status_code == 200 and all(i["state"] == "Madhya Pradesh" for i in r.json()["institutions"])


def test_whatsapp_hindi(client):
    r = client.post("/api/channels/whatsapp/webhook", json={"from": "+919800000000", "text": "मेरे आवेदन 0412 की स्थिति?"}).json()
    assert r["lang"] == "hi" and "ANU-2026-0412" in r["reply"]
    login(client, "institution")


def test_status_subscription_and_report(client):
    ok = client.post("/api/public/status/subscribe", json={"contact": "principal@nvit.example"})
    assert ok.status_code == 201 and ok.json()["channel"] == "email"
    again = client.post("/api/public/status/subscribe", json={"contact": "PRINCIPAL@nvit.example"}).json()
    assert "already" in again["message"]
    assert client.post("/api/public/status/subscribe", json={"contact": "+91 9876543210"}).json()["channel"] == "SMS"
    assert client.post("/api/public/status/subscribe", json={"contact": "not a contact"}).status_code == 422
    rpt = client.post("/api/public/reports/suspicious-institution", json={"name": "Narmada Valley Institute of Tech", "city": "Indore"})
    assert rpt.status_code == 201 and rpt.json()["ref"].startswith("RPT-2026-")
