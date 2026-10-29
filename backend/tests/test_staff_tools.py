"""Staff oversight tools: roles, routing, field inspections, documents, readiness, regulatory actions, verification, return reasons,
admin, badges. These tests change shared sample data (a decision, actions), so the file sorts after the public-figure tests."""
import io

from conftest import jpeg_with_gps, login


def test_new_roles_are_enforced(client):
    login(client, "aicte", "Auditor")
    assert client.get("/api/aicte/queue").status_code == 200
    r = client.post("/api/aicte/compliance/OB-101/remind")
    assert r.status_code == 403 and "read-only" in r.json()["detail"]
    login(client, "aicte", "Inspector")
    r = client.post("/api/applications/ANU-2026-0412/actions", json={"action": "note", "reason": "Looks fine to me"})
    assert r.status_code == 403 and "field inspection" in r.json()["detail"]
    login(client, "aicte", "System administrator")
    r = client.post("/api/applications/ANU-2026-0412/actions", json={"action": "note", "reason": "Checking access"})
    assert r.status_code == 403 and "does not act on files" in r.json()["detail"]
    assert client.post("/api/auth/dev-login", json={"portal": "institution", "institutionRole": "Dean"}).status_code == 422


def test_routing_monitor_and_reassign(client):
    login(client, "aicte", "Bureau head")
    d = client.get("/api/aicte/routing").json()
    assert d["summary"]["open"] == len(d["files"]) >= 40 and d["holders"] and d["routes"]
    assert d["files"][0]["flags"]  # the most stuck files come first
    target = next(f for f in d["files"] if f["clock"] == "running")
    r = client.post(f"/api/aicte/routing/{target['id']}/reassign", json={"holder": "Dealing officer (S. Rao)", "reason": "Balancing the scrutiny load"})
    assert r.status_code == 200
    app = client.get(f"/api/applications/{target['id']}").json()
    assert app["holder"] == "Dealing officer (S. Rao)" and app["history"][-1]["action"].startswith("Reassigned to")
    login(client, "aicte", "Dealing officer")
    assert client.post(f"/api/aicte/routing/{target['id']}/reassign", json={"holder": "Someone else", "reason": "Not allowed"}).status_code == 403


def test_field_inspection_end_to_end(client):
    login(client, "aicte", "Inspector")
    mine = client.get("/api/aicte/field").json()
    assert [i["id"] for i in mine["inspections"]] == ["FI-2026-0412"] and mine["unassigned"] == []
    fi = client.get("/api/aicte/field/FI-2026-0412").json()
    assert fi["canEdit"] and fi["progress"]["done"] == 4 and any(i["expect"].startswith("16 of at least 66") for i in fi["items"])
    early = client.post("/api/aicte/field/FI-2026-0412/submit", json={"signerName": "Dr. R. Menon", "declaration": True})
    assert early.status_code == 422 and "left before signing" in early.json()["detail"]
    for item in fi["items"]:
        if item["photo"]:
            photo = jpeg_with_gps(22.7203, 75.8604, "2026:10:22 11:05:00")
            r = client.post(f"/api/aicte/field/FI-2026-0412/items/{item['id']}/photo", files={"file": ("gate.jpg", io.BytesIO(photo), "image/jpeg")})
            assert r.status_code == 200 and r.json()["photo"]["verdict"] == "ok"
        if not item["result"]:
            result = "Does not meet" if item["id"] == "library" else "Meets"
            r = client.put(f"/api/aicte/field/FI-2026-0412/items/{item['id']}", json={"result": result, "note": "Library is 450 m²; 500 m² needed." if result != "Meets" else ""})
            assert r.status_code == 200
    login(client, "aicte", "Dealing officer")
    assert client.put("/api/aicte/field/FI-2026-0412/items/labs", json={"result": "Meets"}).status_code == 403  # only the assigned inspector
    login(client, "aicte", "Inspector")
    assert client.post("/api/aicte/field/FI-2026-0412/submit", json={"signerName": "Dr. R. Menon", "declaration": False}).status_code == 422
    done = client.post("/api/aicte/field/FI-2026-0412/submit", json={"signerName": "Dr. R. Menon", "declaration": True})
    assert done.status_code == 200 and done.json()["status"] == "Submitted" and len(done.json()["reportSha256"]) == 64
    report = client.get("/api/aicte/field/FI-2026-0412/report").text
    assert done.json()["reportSha256"] in report and "Does not meet" in report
    assert client.put("/api/aicte/field/FI-2026-0412/items/labs", json={"result": "Partly meets", "note": "changed my mind"}).status_code == 409
    login(client, "aicte", "Bureau head")
    history = client.get("/api/applications/ANU-2026-0412").json()["history"]
    assert history[-1]["action"].startswith("Field inspection report signed") and done.json()["reportSha256"] in history[-1]["note"]


def test_assigning_an_inspection(client):
    login(client, "aicte", "EVC coordinator")
    listing = client.get("/api/aicte/field").json()
    assert client.post("/api/aicte/field", json={"applicationId": "ANU-2026-0398", "inspectorId": "u-aicte-7"}).status_code == 409  # not at the expert-visit stage
    target = listing["unassigned"][0]["id"]
    people = client.get("/api/aicte/field/inspectors", params={"application_id": target}).json()
    assert people and people[0]["id"] == "u-aicte-7"
    r = client.post("/api/aicte/field", json={"applicationId": target, "inspectorId": "u-aicte-7", "mode": "Online"})
    assert r.status_code == 201 and r.json()["status"] == "Assigned"
    assert client.post("/api/aicte/field", json={"applicationId": target, "inspectorId": "u-aicte-7"}).status_code == 409  # one open inspection per file


def test_document_checklist_and_viewer(client):
    login(client, "aicte", "Bureau head")
    d = client.get("/api/applications/ANU-2026-0398/documents").json()
    noc = next(r for r in d["documents"] if r["kind"] == "uni")
    assert noc["status"] == "needs correction" and "course title" in noc["versions"][-1]["reviewNote"]
    other = next(r for r in d["documents"] if r["kind"] != "uni")
    f = client.get(f"/api/documents/{other['versions'][-1]['id']}/file")
    assert f.status_code == 200 and f.content.startswith(b"%PDF") and f.headers["content-type"] == "application/pdf" and "default-src 'none'" in f.headers["content-security-policy"]
    reviewed = client.post(f"/api/aicte/documents/{other['versions'][-1]['id']}/review", json={"status": "verified"})
    assert reviewed.json()["reviewStatus"] == "verified" and reviewed.json()["reviewedBy"] == "R. Verma"
    assert client.post(f"/api/aicte/documents/{other['versions'][-1]['id']}/review", json={"status": "needs correction"}).status_code == 422
    login(client, "institution")
    assert client.get(f"/api/documents/{other['versions'][-1]['id']}/file").status_code == 200
    login(client, "aicte", "Bureau head")
    stranger = next(a for a in client.get("/api/aicte/queue").json() if a["institutionId"] != "INS-001")
    doc = client.get(f"/api/applications/{stranger['id']}/documents").json()["documents"][0]["versions"][0]["id"]
    login(client, "institution")
    assert client.get(f"/api/documents/{doc}/file").status_code == 404


def test_readiness_and_approval_with_conditions(client):
    login(client, "aicte", "Committee member")
    ec = next(a for a in client.get("/api/aicte/queue", params={"stage": "ec"}).json() if a["clock"] != "paused")
    r = client.get(f"/api/applications/{ec['id']}/readiness").json()
    assert r["canDecide"] and {c["label"] for c in r["checks"]} >= {"Documents verified", "Faculty", "Fire and life safety certificate"}
    assert r["suggestion"]["text"] and r["note"].endswith("The Executive Committee decides.")
    bad = client.post(f"/api/applications/{ec['id']}/actions", json={"action": "decide", "outcome": "LoD", "conditions": [{"title": "Appoint 6 faculty", "dueOn": "2027-01-31"}]})
    assert bad.status_code == 422
    past = client.post(f"/api/applications/{ec['id']}/actions", json={"action": "decide", "outcome": "EoA", "conditions": [{"title": "Appoint 6 faculty", "dueOn": "2026-01-31"}]})
    assert past.status_code == 422
    ok = client.post(f"/api/applications/{ec['id']}/actions", json={"action": "decide", "outcome": "EoA", "reason": "Approved with conditions", "conditions": [{"title": "Appoint 6 faculty to meet the 1:20 norm", "dueOn": "2027-01-31", "clause": "APH Annexure-1"}]})
    assert ok.status_code == 200 and ok.json()["outcome"] == "EoA" and "with 1 condition" in ok.json()["history"][-1]["action"]
    login(client, "aicte", "Bureau head")
    conditions = [o for o in client.get("/api/aicte/compliance").json() if o["kind"] == "Condition"]
    assert any(o["institutionId"] == ec["institutionId"] and o["dueOn"] == "2027-01-31" for o in conditions)


def test_regulatory_actions_follow_due_process(client):
    login(client, "aicte", "Dealing officer")
    body = {"kind": "Show-cause notice", "detail": "Explain the faculty shortfall found at the visit.", "reason": "Expert visit found 12 faculty short of the norm.", "effectiveFrom": "2026-10-22"}
    assert client.post("/api/aicte/institutions/INS-002/actions", json=body).status_code == 403
    login(client, "aicte", "Committee member")
    penal = {**body, "kind": "Reduction in intake", "detail": "Intake reduced by 60 for 2027-28.", "reason": "Faculty shortfall not corrected after notice and hearing."}
    first = client.post("/api/aicte/institutions/INS-002/actions", json=penal)
    assert first.status_code == 409 and "show-cause" in first.json()["detail"]
    assert client.post("/api/aicte/institutions/INS-002/actions", json=body).status_code == 201
    assert client.post("/api/aicte/institutions/INS-002/actions", json=penal).status_code == 422  # no hearing recorded
    heard = client.post("/api/aicte/institutions/INS-002/actions", json={**penal, "hearingNote": "SHC heard the Chairman and Principal on 20 Oct; shortfall admitted."})
    assert heard.status_code == 201
    actions = client.get("/api/aicte/verification/INS-002").json()["actions"]
    assert [a["kind"] for a in actions][:2] == ["Reduction in intake", "Show-cause notice"] and "Hearing:" in actions[0]["reason"]


def test_institutional_verification(client):
    login(client, "aicte", "Regional officer")
    rows = client.get("/api/aicte/verification").json()
    assert rows and all(r["region"] == "CRO" for r in rows)
    d = client.get("/api/aicte/verification/INS-001").json()
    assert d["certificates"] and d["programmes"] and d["faculty"]["norms"]["required"] == 100
    assert client.post("/api/aicte/verification/INS-001", json={"subject": "Certificate", "subjectId": "CERT-001-3", "outcome": "Discrepancy"}).status_code == 422
    ok = client.post("/api/aicte/verification/INS-001", json={"subject": "Certificate", "subjectId": "CERT-001-3", "outcome": "Verified", "source": "Registry"})
    assert ok.status_code == 201
    assert next(c for c in client.get("/api/aicte/verification/INS-001").json()["certificates"] if c["id"] == "CERT-001-3")["verification"] == "Verified"
    flag = client.post("/api/aicte/verification/INS-001", json={"subject": "Campus", "subjectId": "CMP-001-2", "outcome": "Follow-up", "note": "Sale deed copy is not legible; upload a clear scan."})
    assert flag.status_code == 201
    login(client, "institution")
    assert any("Follow-up" in n["title"] or "follow-up" in n["title"] for n in client.get("/api/notifications").json())


def test_return_reasons(client):
    login(client, "aicte", "Bureau head")
    d = client.get("/api/aicte/insights/return-reasons").json()
    assert d["total"] >= 20 and sum(c["count"] for c in d["categories"]) == d["total"]
    noc = next(c for c in d["categories"] if c["category"] == "NOC and affiliation")
    assert noc["count"] >= 1 and noc["advice"] and noc["medianDaysToFix"] is not None


def test_admin_switches_access_off(client):
    login(client, "aicte", "Bureau head")
    assert client.put("/api/aicte/admin/users/u-aicte-1", json={"active": False}).status_code == 403
    login(client, "aicte", "System administrator")
    users = client.get("/api/aicte/admin/users").json()
    assert users["canEdit"] and any(u["role"] == "Inspector" for u in users["users"])
    assert client.put("/api/aicte/admin/users/u-aicte-1", json={"active": False}).json()["active"] is False
    assert client.put("/api/aicte/admin/users/u-aicte-9", json={"active": False}).status_code == 409  # not your own account
    login(client, "aicte", "Dealing officer")
    assert client.get("/api/aicte/queue").status_code == 403
    login(client, "aicte", "System administrator")
    assert client.put("/api/aicte/admin/users/u-aicte-1", json={"active": True}).json()["active"] is True
    login(client, "aicte", "Dealing officer")
    assert client.get("/api/aicte/queue").status_code == 200


def test_navigation_badges(client):
    login(client, "institution")
    b = client.get("/api/me/badges").json()
    assert set(b) == {"applications", "compliance", "infrastructure", "notifications", "apply"} and b["applications"] >= 1
    login(client, "aicte", "Regional officer")
    o = client.get("/api/me/badges").json()
    assert o["queue"] >= 1 and set(o) >= {"breached", "evc", "field", "verification", "notifications"}


def test_single_sign_on_maps_the_new_roles():
    from app.oidc import principal_from_claims

    hod = principal_from_claims({"sub": "1", "name": "A. Mehta", "realm_access": {"roles": ["institution-hod"]}, "groups": ["/institutions/INS-001"]})
    assert (hod.portal, hod.role, hod.institution_id) == ("institution", "Head of Department", "INS-001")
    inspector = principal_from_claims({"sub": "2", "name": "R. Menon", "realm_access": {"roles": ["inspector"]}})
    assert (inspector.portal, inspector.role, inspector.region) == ("aicte", "Inspector", None)
    both = principal_from_claims({"sub": "3", "name": "Principal", "realm_access": {"roles": ["institution-staff", "institution"]}, "groups": ["/institutions/INS-001"]})
    assert both.role == "Principal / Director"  # the higher role wins when an account holds two
