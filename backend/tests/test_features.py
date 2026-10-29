"""Officer tools and the innovations: draws, photo checks, integrity, rules studio, insights."""
import io
from datetime import datetime, timedelta, timezone

from conftest import BEACON, jpeg_with_gps, login

from app.services import draws


def test_dashboard_and_focus(client):
    login(client, "aicte", "Bureau head")
    d = client.get("/api/aicte/dashboard").json()
    assert d["pending"] >= 51 and len(d["byRegionStage"]) == 10
    nxt = client.get("/api/aicte/queue/next").json()
    first = client.get(f"/api/applications/{nxt['next']}").json()
    assert first["clock"] == "breached"
    assert client.get("/api/aicte/queue", params={"lane": "green"}).json()


def test_eta_matches_tracker(client):
    login(client, "institution")
    e = client.get("/api/applications/ANU-2026-0398/eta").json()
    assert (e["likely"], e["early"], e["late"]) == ("2026-11-23", "2026-11-19", "2026-12-02")


def test_brief_and_risk(client):
    login(client, "aicte", "Bureau head")
    b = client.get("/api/applications/ANU-2026-0822/brief").json()
    assert b["lines"][0]["source"] == "Application" and b["next"].startswith("Act today")
    r = client.get("/api/applications/ANU-2026-0412/risk").json()
    assert 0 < r["risk"] < 1 and r["reasons"]


def test_evc_commit_then_draw(client):
    login(client, "aicte", "Bureau head")
    p = client.post("/api/evc/ANU-2026-0412/propose", json={"specialisation": "Computer Science"}).json()
    assert len(p["shortlist"]) >= 3 and all(x["reason"] and x["expert"]["id"] for x in p["excluded"])
    ids = [s["id"] for s in p["shortlist"]]
    assert p["commitment"] == draws.commitment("ANU-2026-0412", ids, p["committedRound"])
    drawn = client.post("/api/evc/ANU-2026-0412/draw").json()
    assert drawn["verified"] and drawn["chosen"] == draws.draw_panel(ids, BEACON, 3)


def test_visit_photo_check(client):
    login(client, "aicte", "Bureau head")
    on_campus = jpeg_with_gps(22.7205, 75.8604, "2026:10:22 11:02:14")
    delhi = jpeg_with_gps(28.6139, 77.2090, "2026:10:22 12:15:03")
    r = client.post("/api/evc/ANU-2026-0412/photos", files=[("files", ("main.jpg", on_campus, "image/jpeg")), ("files", ("lab.jpg", delhi, "image/jpeg")), ("files", ("x.jpg", b"\xff\xd8\xff\xd9", "image/jpeg"))]).json()
    verdicts = {x["name"]: x["verdict"] for x in r}
    assert verdicts == {"main.jpg": "ok", "lab.jpg": "far", "x.jpg": "nogps"}
    assert 640_000 < next(x for x in r if x["name"] == "lab.jpg")["distanceM"] < 700_000


def test_inspection_draw(client):
    login(client, "aicte", "Bureau head")
    d = client.post("/api/aicte/inspections/draw", json={"k": 5}).json()
    assert len(d["chosen"]) == 5 and sum(c["why"] == "pure random" for c in d["chosen"]) == 1
    assert d["chosen"] == draws.weighted_draw(d["weights"], BEACON, 5, 1)


def test_integrity(client):
    login(client, "aicte", "Bureau head")
    dup = client.get("/api/aicte/integrity/duplicates").json()
    assert len(dup["clusters"]) == 6 and dup["clusters"][0]["records"].__len__() == 3
    assert len(client.post(f"/api/aicte/integrity/{dup['clusters'][0]['panHash']}/ask").json()["asked"]) == 3


def test_rules_studio(client):
    login(client, "aicte", "Rules administrator")
    cur = client.get("/api/rules/current").json()
    assert client.post("/api/rules/test", json={}).json()["passed"] == 50
    table = {k: dict(v) for k, v in cur["table"].items()}
    table["intake"]["evc"] = "none"
    assert client.post("/api/rules/test", json={"table": table}).json()["passed"] < 50
    impact = client.post("/api/rules/impact", json={"table": table}).json()
    assert impact["files"] > 0
    v = client.post("/api/rules/versions", json={"table": table, "reason": "Pilot: no visit for small intake increases", "effectiveFrom": "2026-12-01"}).json()
    assert v["status"] == "proposed" and v["testsPassed"] < 50
    login(client, "aicte", "Bureau head")
    assert client.post(f"/api/rules/versions/{v['version']}/publish").json()["status"] == "published"


def test_insights_simulator_reports(client):
    login(client, "aicte", "Bureau head")
    assert "live" in client.get("/api/aicte/insights/process-map").json()
    sim = client.post("/api/aicte/simulator/run", json={"extraOfficersBottleneck": 4}).json()
    base = client.post("/api/aicte/simulator/run", json={}).json()
    assert len(sim["weeks"]) == 30 and sim["onTime"] > base["onTime"]
    csv = client.get("/api/aicte/reports/pendency").text
    assert csv.startswith("Reference,Institution")


def test_institution_dashboard(client):
    login(client, "institution")
    d = client.get("/api/institution/dashboard").json()
    assert d["renewal"]["filled"] == 41 and d["greenChannel"]["met"] <= 5 and 0 <= d["health"]["score"] <= 100
    assert client.put("/api/institution/drafts/D-1", json={"typeId": "intake", "data": {"step": 2}}).status_code == 200
    assert client.get("/api/institution/drafts/current").json()["data"] == {"step": 2}
    assert "BEGIN:VCALENDAR" in client.get("/api/institution/calendar.ics").text


def test_real_pdf_signature_is_validated(client):
    """Signs a PDF with a self-signed certificate using pyHanko, then checks the server reports it intact."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID
    from pyhanko.pdf_utils import generic
    from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
    from pyhanko.pdf_utils.writer import PdfFileWriter
    from pyhanko.sign import signers
    from asn1crypto import keys as ak, x509 as ax

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Secretary, Narmada Valley Education Society")])
    now = datetime.now(timezone.utc)
    cert = x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(1).not_valid_before(now - timedelta(days=1)).not_valid_after(now + timedelta(days=30)).sign(key, hashes.SHA256())
    signer = signers.SimpleSigner(
        signing_cert=ax.Certificate.load(cert.public_bytes(serialization.Encoding.DER)),
        signing_key=ak.PrivateKeyInfo.load(key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())),
        cert_registry=None,
    )
    w = PdfFileWriter()
    page = generic.DictionaryObject({generic.NameObject("/Type"): generic.NameObject("/Page"), generic.NameObject("/MediaBox"): generic.ArrayObject([generic.NumberObject(n) for n in (0, 0, 595, 842)])})
    w.insert_page(page)
    buf = io.BytesIO()
    w.write(buf)
    buf.seek(0)
    out = signers.sign_pdf(IncrementalPdfFileWriter(buf), signers.PdfSignatureMetadata(field_name="Signature1"), signer=signer)
    login(client, "institution")
    r = client.post("/api/uploads", data={"doc_kind": "aff2"}, files={"file": ("affidavit-signed.pdf", out.getvalue(), "application/pdf")}).json()
    assert r["signed"] is True
    assert r["preflight"]["signatureIntact"] is True and "Narmada" in (r["preflight"]["signer"] or "")


def test_undertaking_reader_and_tracking(client):
    from conftest import login

    login(client, "institution")
    text = "UNDERTAKING\n1. Six (6) faculty members shall be appointed before 15 July 2027.\n2. Library volumes shall be procured before commencement of classes."
    found = client.post("/api/institution/undertakings/read", json={"text": text}).json()
    assert found[0]["due"] == "2027-07-15" and found[0]["clause"].startswith("APH Annexure-1") and found[0]["confidence"] >= 0.85
    assert found[1]["due"] is None and found[1]["confidence"] < 0.85  # undated: flagged for a careful look
    made = client.post("/api/institution/obligations", json={"title": found[0]["promise"], "dueOn": found[0]["due"], "clause": found[0]["clause"]})
    assert made.status_code == 201 and made.json()["status"] == "On track"
    assert any(o["id"] == made.json()["id"] for o in client.get("/api/institution/obligations").json())
    docs = client.get("/api/institution/documents").json()
    assert all("uploadedAt" in d for d in docs)


def test_obligation_remind_and_verify(client):
    from conftest import login

    login(client, "aicte", "Bureau head")
    open_one = next(o for o in client.get("/api/aicte/compliance").json() if o["status"] != "Met")
    r = client.post(f"/api/aicte/compliance/{open_one['id']}/remind")
    assert r.status_code == 200 and r.json()["sent"] is True
    assert client.post(f"/api/aicte/compliance/{open_one['id']}/verify").json()["status"] == "Met"
    assert client.post(f"/api/aicte/compliance/{open_one['id']}/remind").status_code == 404  # nothing left to remind about


def test_integration_status_reflects_configuration(client):
    from conftest import login

    login(client, "aicte", "Bureau head")
    rows = {r["name"]: r for r in client.get("/api/aicte/settings/integrations").json()}
    assert rows["Database"]["status"] == "Live" and rows["Virus scanning"]["status"] == "Not configured"
    assert rows["Email alerts"]["status"] == "Logged" and rows["Single sign-on"]["status"] == "Development"
