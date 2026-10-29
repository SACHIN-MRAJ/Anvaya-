r"""Post-deploy smoke test for the staging stack: real Keycloak sign-in, data isolation, uploads to object storage,
virus scanning, idempotent submission and signed webhooks, all through the website address like a browser.

Run after `docker compose up -d`:   ..\backend\.venv\Scripts\python deploy\smoke_test.py
Reads the sample-account password and webhook secret from deploy/.env. Exits non-zero on the first failure.
"""
import hashlib
import hmac
import re
import sys
import uuid
from html import unescape
from pathlib import Path

import httpx

WEB = "http://localhost:8080"
ENV = dict(line.split("=", 1) for line in (Path(__file__).with_name(".env")).read_text(encoding="utf-8").splitlines() if "=" in line and not line.startswith("#"))
PASSWORD = ENV["ANUMATI_DEMO_PASSWORD"]
EICAR = rb"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
passed = 0


def check(label: str, ok: bool, detail: object = "") -> None:
    global passed
    if not ok:
        print(f"FAIL  {label}  {detail}")
        sys.exit(1)
    passed += 1
    print(f"ok    {label}")


class LocalhostBrowser(httpx.Client):
    """Browsers treat http://localhost as a secure context and send Secure cookies to it; Python's cookie jar
    does not, so each request first marks the jar's cookies as sendable over http (localhost only)."""

    def send(self, request, **kwargs):
        if request.url.host == "localhost":
            for cookie in self.cookies.jar:
                cookie.secure = False
            request.headers.pop("cookie", None)
            self.cookies.set_cookie_header(request) if hasattr(self.cookies, "set_cookie_header") else None
            header = "; ".join(f"{c.name}={c.value}" for c in self.cookies.jar if request.url.path.startswith(c.path or "/"))
            if header:
                request.headers["cookie"] = header
        return super().send(request, **kwargs)


def sign_in(username: str, next_path: str) -> httpx.Client:
    """Follows the real flow: website -> API -> Keycloak login form -> API callback -> website."""
    c = LocalhostBrowser(timeout=30, headers={"Origin": WEB})
    r = c.get(f"{WEB}/api/auth/login", params={"next": next_path}, follow_redirects=True)
    action = re.search(r'<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"', r.text) or re.search(r'action="([^"]+login-actions/authenticate[^"]*)"', r.text)
    check(f"{username}: Keycloak login page", r.status_code == 200 and action is not None, r.status_code)
    r = c.post(unescape(action.group(1)), data={"username": username, "password": PASSWORD, "credentialId": ""}, follow_redirects=False)
    while (r.status_code in (302, 303) and not r.headers["location"].startswith(f"{WEB}/")) or "/api/auth/callback" in r.headers.get("location", ""):
        r = c.get(r.headers["location"], follow_redirects=False)
    check(f"{username}: back on the website", r.status_code == 302 and r.headers["location"].startswith(WEB), r.headers.get("location"))
    return c


def pdf() -> bytes:
    return b"%PDF-1.7\n1 0 obj<</Type /Page>>endobj\n2 0 obj<</Type /Page>>endobj\n" + b" " * 30_000


def main() -> None:
    ready = httpx.get(f"{WEB}/api/ready").json()
    check("readiness: database, S3 storage, virus scanner", ready["ok"] and ready["checks"] == {"database": "ok", "storage": "ok", "virusScan": "ok"}, ready)
    check("development sign-in is switched off", httpx.post(f"{WEB}/api/auth/dev-login", json={"portal": "institution"}).status_code == 404)

    officer = sign_in("dealing.cro", "/aicte/queue")
    me = officer.get(f"{WEB}/api/me").json()
    check("officer role and region come from Keycloak", me["role"] == "Dealing officer" and me["region"] == "CRO", me)
    queue = officer.get(f"{WEB}/api/aicte/queue").json()
    check("region-locked officer sees only CRO files", queue and {a["region"] for a in queue} == {"CRO"}, {a["region"] for a in queue})

    head = sign_in("bureau.head", "/aicte")
    regions = {a["region"] for a in head.get(f"{WEB}/api/aicte/queue").json()}
    check("bureau head sees every region", len(regions) > 3, regions)
    evil = head.post(f"{WEB}/api/applications/ANU-2026-0412/actions", json={"action": "note", "reason": "smoke test"}, headers={"Origin": "https://evil.example"})
    check("cross-site request is blocked", evil.status_code == 403 and evil.headers["content-type"].startswith("application/problem+json"))

    inst = sign_in("principal.nvit", "/institution")
    own = inst.get(f"{WEB}/api/applications").json()
    check("institution sees only its own files", own and {a["institutionId"] for a in own} == {"INS-001"})
    foreign = next(a["id"] for a in head.get(f"{WEB}/api/applications").json() if a["institutionId"] != "INS-001")
    check("another institution's file is 'not found'", inst.get(f"{WEB}/api/applications/{foreign}").status_code == 404)
    bot = inst.post(f"{WEB}/api/public/assistant/ask", json={"question": "where is my application"}).json()
    check("Ask ANUMATI answers from the institution's own files", bot["source"] == "records" and all(b.split(" ")[0] in {a["id"] for a in own} for b in bot["bullets"] if b.startswith("ANU-")), bot)
    visitor = httpx.post(f"{WEB}/api/public/assistant/ask", json={"question": f"status of {foreign}"}).json()
    check("Ask ANUMATI gives a visitor no file status", not visitor["bullets"] and "can’t share" in visitor["text"], visitor)

    virus = inst.post(f"{WEB}/api/uploads", data={"doc_kind": "uni"}, files={"file": ("eicar.pdf", EICAR, "application/pdf")})
    check("ClamAV stops the EICAR test virus", virus.status_code == 422 and "virus" in virus.json()["detail"], virus.text[:120])
    types = {t["id"]: t for t in inst.get(f"{WEB}/api/public/rules/types").json()}
    docs = []
    for d in types["intake"]["documents"]:
        up = inst.post(f"{WEB}/api/uploads", data={"doc_kind": d["id"]}, files={"file": (f"{d['id']}.pdf", pdf(), "application/pdf")})
        check(f"upload {d['id']} scanned clean and stored in S3", up.status_code == 201 and up.json()["preflight"]["virusScan"] == "clean", up.text[:120])
        docs.append(up.json()["id"])
    body = {"typeId": "intake", "details": {"programme": "B.Tech CSE (AI & ML)", "current": 120, "requested": 150}, "documentIds": docs, "signer": "Secretary, Narmada Valley Education Society", "declarations": {"truth": True, "lock": True}}
    key = {"Idempotency-Key": uuid.uuid4().hex}
    first, again = inst.post(f"{WEB}/api/applications", json=body, headers=key), inst.post(f"{WEB}/api/applications", json=body, headers=key)
    check("submission accepted with a receipt", first.status_code == 201 and len(first.json()["receipt"]["fingerprint"]) == 64, first.text[:160])
    check("repeated submission is answered once", again.headers.get("Idempotent-Replayed") == "true" and again.json()["application"]["id"] == first.json()["application"]["id"])
    ref = first.json()["application"]["id"]
    check("evidence chain verifies", inst.get(f"{WEB}/api/audit/verify", params={"ref": ref}).json()["ok"] is True)
    infra = inst.get(f"{WEB}/api/institution/infrastructure").json()
    check("infrastructure locker checks rooms against the APH norms", infra["norms"]["rows"] and infra["certificates"][0]["days"] is not None, infra["norms"]["shortfalls"])
    sent = inst.get(f"{WEB}/api/applications/{ref}/documents").json()["documents"]
    check("submitted documents await verification", all(d["status"] == "awaiting verification" for d in sent if d["versions"]), [d["status"] for d in sent])
    stored = inst.get(f"{WEB}/api/documents/{sent[0]['versions'][-1]['id']}/file")
    check("the document viewer streams the file back from S3", stored.status_code == 200 and stored.content.startswith(b"%PDF"), stored.status_code)
    out = inst.post(f"{WEB}/api/auth/logout").json()["logoutUrl"]
    check("sign-out also ends the Keycloak session", out.startswith("http://localhost:8081/realms/anumati/protocol/openid-connect/logout"))
    check("signed out", inst.get(f"{WEB}/api/me").status_code == 401)

    raw = b'{"from": "+919800000001", "text": "What is an EoA?"}'
    check("unsigned webhook refused", httpx.post(f"{WEB}/api/channels/whatsapp/webhook", content=raw, headers={"Content-Type": "application/json"}).status_code == 401)
    sig = "sha256=" + hmac.new(ENV["ANUMATI_WEBHOOK_SECRET"].encode(), raw, hashlib.sha256).hexdigest()
    signed = httpx.post(f"{WEB}/api/channels/whatsapp/webhook", content=raw, headers={"Content-Type": "application/json", "X-Hub-Signature-256": sig})
    check("signed webhook answered", signed.status_code == 200 and signed.json()["reply"])

    # Undertakings become tracked obligations; an officer's reminder is really emailed (Mailpit catches it).
    inst = sign_in("principal.nvit", "/institution/documents")
    found = inst.post(f"{WEB}/api/institution/undertakings/read", json={"text": "UNDERTAKING\n1. Six (6) faculty members shall be appointed before 15 July 2027."}).json()
    check("undertaking reader finds the promise and its date", found and found[0]["due"] == "2027-07-15", found)
    tracked = inst.post(f"{WEB}/api/institution/obligations", json={"title": found[0]["promise"], "dueOn": found[0]["due"], "clause": found[0]["clause"]})
    check("confirmed promise is tracked as an obligation", tracked.status_code == 201, tracked.text[:120])
    before = httpx.get("http://localhost:8025/api/v1/messages").json().get("total", 0)
    head = sign_in("bureau.head", "/aicte/compliance")
    reminded = head.post(f"{WEB}/api/aicte/compliance/{tracked.json()['id']}/remind")
    check("officer reminder recorded", reminded.status_code == 200 and "email" in reminded.json()["channels"], reminded.text[:120])
    inbox = httpx.get("http://localhost:8025/api/v1/messages").json()
    check("reminder email delivered to the institution's inbox", inbox.get("total", 0) > before and "Reminder from AICTE" in inbox["messages"][0]["Subject"], inbox.get("total"))
    check("the signed-in principal is among the recipients", any(r["Address"] == "principal@nvit.example" for r in inbox["messages"][0].get("Bcc") or []), inbox["messages"][0].get("Bcc"))

    # Roles at the institution come from Keycloak: an HoD reviews but cannot submit; an auditor only reads.
    hod = sign_in("hod.nvit", "/institution")
    check("HoD's role comes from Keycloak", hod.get(f"{WEB}/api/me").json()["role"] == "Head of Department")
    check("HoD cannot submit an application", hod.post(f"{WEB}/api/applications", json=body, headers={"Idempotency-Key": uuid.uuid4().hex}).status_code == 403)
    auditor = sign_in("auditor", "/aicte")
    check("auditor reads the queue", auditor.get(f"{WEB}/api/aicte/queue").status_code == 200)
    check("auditor cannot act", auditor.post(f"{WEB}/api/aicte/compliance/OB-101/remind").status_code == 403)

    # Oversight: routing, return reasons, and a field inspection assigned to an inspector who signed in by SSO.
    head = sign_in("bureau.head", "/aicte/routing")
    routing = head.get(f"{WEB}/api/aicte/routing").json()
    check("routing monitor lists open files with their holder", routing["summary"]["open"] > 0 and routing["holders"], routing["summary"])
    reasons = head.get(f"{WEB}/api/aicte/insights/return-reasons").json()
    check("why files are sent back is grouped", reasons["total"] > 0 and reasons["categories"], reasons["total"])
    inspector = sign_in("inspector.menon", "/aicte/field")
    check("inspector's role comes from Keycloak", inspector.get(f"{WEB}/api/me").json()["role"] == "Inspector")
    coordinator = sign_in("evc.coordinator", "/aicte/field")
    waiting = coordinator.get(f"{WEB}/api/aicte/field").json()["unassigned"]
    people = coordinator.get(f"{WEB}/api/aicte/field/inspectors", params={"application_id": waiting[0]["id"]}).json() if waiting else []
    menon = next((p for p in people if p["name"].endswith("Menon") and not p["conflict"]), None)
    check("the SSO inspector can be assigned", menon is not None, people)
    assigned = coordinator.post(f"{WEB}/api/aicte/field", json={"applicationId": waiting[0]["id"], "inspectorId": menon["id"], "mode": "Online"}) if menon else None
    check("field inspection assigned", assigned is not None and assigned.status_code == 201, assigned.text[:120] if assigned is not None else "")
    mine = inspector.get(f"{WEB}/api/aicte/field").json()["inspections"]
    check("inspector sees the new inspection", any(i["applicationId"] == waiting[0]["id"] for i in mine), [i["applicationId"] for i in mine])

    # The competent authority decides, with a condition; the letter is then verifiable and signed.
    member = sign_in("committee.member", "/aicte/queue")
    ec = next((a for a in member.get(f"{WEB}/api/aicte/queue").json() if a["stage"] == "ec"), None)
    check("a file is waiting at the Executive Committee", ec is not None)
    ready = member.get(f"{WEB}/api/applications/{ec['id']}/readiness").json()
    check("decision readiness lists its checks", ready["canDecide"] and len(ready["checks"]) >= 6, ready["suggestion"])
    condition = {"title": "Upload the renewed fire and life safety certificate", "dueOn": "2027-03-31", "clause": "APH Annexure-3, 3.1(d)"}
    decided = member.post(f"{WEB}/api/applications/{ec['id']}/actions", json={"action": "decide", "outcome": "EoA", "reason": "All conditions verified at the expert visit.", "conditions": [condition]})
    check("committee member records the decision", decided.status_code == 200 and decided.json()["outcome"] == "EoA", decided.text[:120])
    tracked_conditions = [o for o in member.get(f"{WEB}/api/aicte/compliance").json() if o["kind"] == "Condition" and o["institutionId"] == ec["institutionId"]]
    check("the condition is tracked as an obligation", any(o["dueOn"] == "2027-03-31" for o in tracked_conditions), len(tracked_conditions))
    check("anyone can verify the new letter", httpx.get(f"{WEB}/api/public/verify/{ec['id']}").json()["status"] == "authentic")
    credential = httpx.get(f"{WEB}/api/public/letters/{ec['id']}/credential").json()
    check("the letter is a signed verifiable credential", credential.get("proof", {}).get("type") == "DataIntegrityProof", list(credential))

    # The rate limit is shared through Valkey by every API process.
    try:
        import subprocess

        keys = subprocess.run(["docker", "compose", "exec", "-T", "valkey", "valkey-cli", "--scan", "--pattern", "anumati:rl:*"], cwd=Path(__file__).parent, capture_output=True, text=True, timeout=20).stdout.split()  # noqa: S607
        check("rate-limit counters live in Valkey", len(keys) > 0, keys[:3])
    except (OSError, subprocess.TimeoutExpired):
        print("skip  Valkey check (docker CLI not on PATH)")
    print(f"\n{passed} checks passed")


if __name__ == "__main__":
    main()
