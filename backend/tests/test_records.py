"""The institutional record: profile, infrastructure locker and norms, courses and seats, faculty, signatories, team and access."""
from datetime import date, timedelta

from conftest import login

from app.services import norms


def test_norms_follow_annexure_3():
    courses = [
        norms.Course("a", "B.Tech CSE", "CSE", "UG", 4, 240), norms.Course("b", "B.Tech ECE", "ECE", "UG", 4, 120),
        norms.Course("c", "B.Tech Mechanical", "ME", "UG", 4, 120, x_category=True), norms.Course("d", "M.Tech CSE", "CSE", "PG", 2, 30),
    ]
    need = {r["kind"]: (r["rooms"], r["minArea"]) for r in norms.required_spaces(courses)}
    assert need["Classroom"] == (16, 66)  # (4 + 2 + 2) divisions x 4 years x 0.5
    assert need["Tutorial room"] == (5, 33)  # 25% of 17 classrooms
    assert need["Laboratory"] == (21, 66)  # CSE has 4 divisions: 3 a year pro rata; ECE and ME 2 a year; 3 later years each
    assert need["Library"] == (1, 500)  # 400 + 50 for every 60 of intake above 420
    assert need["X-category laboratory"] == (1, 200) and need["Research laboratory"] == (1, 66)
    assert norms.area_minimums(510) == {"Administrative": 1275, "Amenities": 850}
    req = norms.faculty_required(courses)
    assert req["total"] == 100 and req["byDepartment"] == {"CSE": 52, "ECE": 24, "ME": 24}  # UG 1:20, PG 1:15 over all years
    assert norms.computers_needed(courses) == 207


def test_infrastructure_locker_finds_the_gaps(client):
    login(client, "institution")
    d = client.get("/api/institution/infrastructure").json()
    rows = {r["kind"]: r for r in d["norms"]["rows"]}
    assert rows["Tutorial room"]["short"] == 1 and rows["Library"]["short"] == 1  # 4 of 5 rooms; 450 of 500 m2
    assert rows["Classroom"]["undersized"][0]["areaSqm"] == 60  # counted only when it meets 66 m2
    fire = next(c for c in d["certificates"] if c["kind"] == "Fire and life safety certificate" and c["campusId"] == "CMP-001-1")
    assert fire["days"] == 17 and fire["state"] == "Expiring soon"
    assert d["certificates"][0]["days"] == 17  # the radar puts the nearest expiry first
    annex = next(c for c in d["campuses"] if not c["isMain"])
    assert annex["distanceKm"] < 2 and not [x for x in d["landChecks"] if x["severity"] == "blocker"]


def test_profile_changes_are_recorded(client):
    login(client, "institution")
    r = client.put("/api/institution/profile", json={"phone": "0731-2856499", "website": "https://nvit.example.in"})
    assert r.status_code == 200 and r.json()["changed"] == 1  # the website was already the same
    p = client.get("/api/institution/profile").json()
    assert p["history"][0]["action"].startswith("Profile updated") and "2856499" in p["history"][0]["note"]
    assert p["signatoryOk"] and p["completeness"] == 100
    chain = client.get("/api/audit/verify", params={"ref": "RECORD-INS-001"}).json()
    assert chain["ok"]
    assert client.get("/api/audit", params={"ref": "RECORD-INS-008"}).status_code == 404  # never another institution's record


def test_only_trust_officers_sign(client):
    login(client, "institution")
    bad = client.post("/api/institution/leaders", json={"name": "Dr. A. Mehta", "position": "Head of Department", "isSignatory": True, "since": "2026-01-01"})
    assert bad.status_code == 422 and "APH 1.4.6" in bad.json()["detail"]
    ok = client.post("/api/institution/leaders", json={"name": "Shri R. Agrawal", "position": "Trustee", "since": "2026-01-01"})
    assert ok.status_code == 201


def test_certificate_renewal_resets_reminders(client):
    login(client, "institution", "Compliance staff")
    new_until = date(2027, 11, 8)
    r = client.put("/api/institution/certificates/CERT-001-1", json={"kind": "Fire and life safety certificate", "number": "FS/IND/2026/0412", "issuedBy": "Fire and Emergency Services", "issuedOn": "2026-10-20", "validUntil": new_until.isoformat(), "campusId": "CMP-001-1"})
    assert r.status_code == 200 and r.json()["verification"] == "Pending" and r.json()["state"] == "Valid"
    bad = client.post("/api/institution/certificates", json={"kind": "Electrical safety certificate", "issuedOn": "2026-10-20", "validUntil": "2026-01-01"})
    assert bad.status_code == 422


def test_spaces_count_toward_the_norms(client):
    login(client, "institution", "Compliance staff")
    added = client.post("/api/institution/spaces", json={"campusId": "CMP-001-1", "category": "Instructional", "kind": "Tutorial room", "name": "Tutorial room 5", "building": "Academic block A", "areaSqm": 35})
    assert added.status_code == 201
    rows = {r["kind"]: r for r in client.get("/api/institution/infrastructure").json()["norms"]["rows"]}
    assert rows["Tutorial room"]["short"] == 0
    assert client.delete(f"/api/institution/spaces/{added.json()[0]['id']}").status_code == 204


def test_seat_check_and_draft(client):
    login(client, "institution", "Academic administrator")
    m = client.get("/api/institution/programmes").json()
    cse = next(p for p in m["programmes"] if p["name"] == "B.Tech CSE")
    assert m["totals"]["facultyNeed"] == 100 and m["totals"]["facultyHave"] == 94
    impact = client.post("/api/institution/programmes/seat-check", json={"change": "increase", "programmeId": cse["id"], "newIntake": 300}).json()
    assert impact["typeId"] == "intake" and impact["faculty"]["after"] == 112 and not impact["ready"]
    assert any(r["kind"] == "Classroom" and r["after"] > r["before"] for r in impact["rooms"])
    assert client.post("/api/institution/programmes/seat-check", json={"change": "increase", "programmeId": cse["id"], "newIntake": 200}).status_code == 422
    d = client.post("/api/institution/programmes/draft", json={"change": "increase", "programmeId": cse["id"], "newIntake": 300})
    details = d.json()["details"]
    assert d.status_code == 201 and (details["programme"], details["current"], details["requested"]) == ("B.Tech CSE", 240, 300)
    login(client, "institution", "Institution staff")
    assert client.post("/api/institution/programmes/draft", json={"change": "increase", "programmeId": cse["id"], "newIntake": 300}).status_code == 403


def test_faculty_roster_and_pan_privacy(client):
    login(client, "institution", "Head of Department")
    f = client.get("/api/institution/faculty").json()
    assert f["norms"]["required"] == 100 and f["norms"]["inPost"] == 94
    assert any("without a PhD" in x["title"] for x in f["norms"]["findings"])
    added = client.post("/api/institution/faculty", json={"name": "Dr. Kiran Joshi", "pan": "ABCDE1234F", "designation": "Professor", "department": "Computer Science and Engineering", "qualification": "PhD", "joined": "2026-10-01"})
    assert added.status_code == 201 and "pan" not in added.json() and added.json()["panOnFile"] and added.json()["verification"] == "Pending"
    left = client.put(f"/api/institution/faculty/{added.json()['id']}", json={"status": "Left"})
    assert left.json()["status"] == "Left"
    assert client.get("/api/institution/faculty").json()["norms"]["inPost"] == 94


def test_team_permissions_are_enforced(client):
    login(client, "institution", "Institution staff")
    assert client.post("/api/applications", json={"typeId": "eoa", "signer": "Secretary", "declarations": {"truth": True, "lock": True}}).status_code == 403
    assert client.put("/api/institution/profile", json={"phone": "1"}).status_code == 403
    me = client.get("/api/institution/team").json()["me"]
    assert me["can"] == ["upload"]
    login(client, "institution")
    t = client.get("/api/institution/team").json()
    assert len(t["members"]) == 5 and {p["id"] for p in t["permissions"]} >= {"submit", "review", "team"}
    new = client.post("/api/institution/team", json={"name": "M. Gupta", "email": "m.gupta@nvit.example.in", "role": "Compliance staff"})
    assert new.status_code == 201 and new.json()["can"] == ["infrastructure", "respond", "upload"]
    assert client.post("/api/institution/team", json={"name": "M. Gupta", "email": "M.GUPTA@nvit.example.in", "role": "Compliance staff"}).status_code == 409
    me_row = next(m for m in t["members"] if m["role"] == "Principal / Director")
    assert client.put(f"/api/institution/team/{me_row['id']}", json={"active": False}).status_code == 409  # not your own access
    staff = next(m for m in t["members"] if m["role"] == "Institution staff")
    assert client.put(f"/api/institution/team/{staff['id']}", json={"active": False}).json()["active"] is False
    login(client, "institution", "Institution staff")
    assert client.get("/api/institution/team").status_code == 403  # switched off
    login(client, "institution")
    assert client.put(f"/api/institution/team/{staff['id']}", json={"active": True}).json()["active"] is True


def test_draft_review_before_the_principal_submits(client):
    login(client, "institution", "Institution staff")
    client.put("/api/institution/drafts/DRF-INS-001-review", json={"typeId": "eoa", "data": {"step": 2}})
    sent = client.post("/api/institution/drafts/DRF-INS-001-review/send-for-review")
    assert sent.json()["review"]["status"] == "awaiting review"
    login(client, "institution", "Head of Department")
    assert client.get("/api/me/badges").json()["apply"] >= 1
    assert client.post("/api/institution/drafts/DRF-INS-001-review/review", json={"decision": "changes"}).status_code == 422
    ok = client.post("/api/institution/drafts/DRF-INS-001-review/review", json={"decision": "approved", "note": "Faculty list checked against the roster."})
    assert ok.json()["review"]["status"] == "approved" and ok.json()["review"]["reviewerRole"] == "Head of Department"


def test_certificate_reminders_follow_the_windows(client):
    login(client, "institution", "Compliance staff")
    soon = (date(2026, 10, 22) + timedelta(days=5)).isoformat()
    assert client.post("/api/institution/certificates", json={"kind": "Electrical safety certificate", "issuedOn": "2025-10-27", "validUntil": soon}).status_code == 201
    login(client, "aicte", "Bureau head")
    beat = client.post("/api/aicte/scheduler/run").json()
    again = client.post("/api/aicte/scheduler/run").json()
    assert beat["certificates"] == 1 and again["certificates"] == 0  # each reminder window is sent once
    login(client, "institution")
    assert any(n["title"].startswith("Electrical safety certificate expires in 5 days") for n in client.get("/api/notifications").json())


def test_out_of_range_ids_are_refused_not_crashing(client):
    """Found by the fuzzer: an id beyond the integer range made the server fail instead of answering 422."""
    login(client, "institution")
    assert client.delete("/api/institution/spaces/34648290100559101952").status_code == 422
    assert client.put("/api/institution/spaces/3041494755465220606394368", json={"campusId": "CMP-001-1", "category": "Instructional", "kind": "Tutorial room", "name": "T", "areaSqm": 30}).status_code == 422
    assert client.put("/api/institution/team/99999999999999999999", json={"active": False}).status_code == 422
    login(client, "aicte", "Bureau head")
    r = client.post("/api/aicte/verification/INS-001", json={"subject": "Space", "subjectId": "99999999999999999999", "outcome": "Verified"})
    assert r.status_code == 404
