"""Adds roles and sample accounts from anumati-realm.json to a Keycloak that is already running.

Keycloak imports the realm file only on its first start, so later additions (new roles, new sample accounts) need this.
Existing roles and accounts are skipped and never changed. Accounts without a password get ANUMATI_DEMO_PASSWORD,
which is read inside the Keycloak container from its own environment and never printed. Safe to run again.

    python deploy/keycloak/sync_realm.py        (from the project folder, with the Docker stack running)
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEPLOY = HERE.parent
KCADM = "/opt/keycloak/bin/kcadm.sh"
REMOTE = "/tmp/anumati-sync.json"  # noqa: S108  (a path inside the Keycloak container, removed straight after use)
LOGIN = f'{KCADM} config credentials --server http://localhost:8080 --realm master --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD" >/dev/null 2>&1'


def compose(*args: str) -> str:
    done = subprocess.run(["docker", "compose", *args], cwd=DEPLOY, capture_output=True, text=True, check=False)  # noqa: S603, S607
    if done.returncode:
        sys.exit(f"docker compose {args[0]} failed:\n{done.stderr or done.stdout}")
    return done.stdout


def kcadm(command: str, user: str | None = None) -> str:
    return compose("exec", "-T", *(["-u", user] if user else []), "keycloak", "bash", "-c", f"{LOGIN} && {command}")


def main() -> None:
    realm = json.loads((HERE / "anumati-realm.json").read_text(encoding="utf-8"))
    users = [{k: v for k, v in u.items() if k != "credentials"} for u in realm.get("users", [])]  # passwords are set below
    payload = {"ifResourceExists": "SKIP", "roles": {"realm": realm.get("roles", {}).get("realm", [])}, "users": users}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(payload, f)
        local = f.name
    compose("cp", local, f"keycloak:{REMOTE}")
    Path(local).unlink(missing_ok=True)
    try:
        out = kcadm(f"{KCADM} create partialImport -r anumati -f {REMOTE} -o")
    finally:
        compose("exec", "-T", "-u", "root", "keycloak", "rm", "-f", REMOTE)
    result = json.loads(out[out.index("{"):])
    added = [r["resourceName"] for r in result.get("results", []) if r["action"] == "ADDED"]
    passwords = []
    for u in users:
        found = json.loads(kcadm(f'{KCADM} get users -r anumati -q username="{u["username"]}" -q exact=true --fields id'))
        if not found:
            continue
        uid = found[0]["id"]
        if json.loads(kcadm(f"{KCADM} get users/{uid}/credentials -r anumati")):
            continue
        kcadm(f'{KCADM} set-password -r anumati --userid {uid} --new-password "$ANUMATI_DEMO_PASSWORD"')
        passwords.append(u["username"])
    print(f"added: {', '.join(added) or 'nothing new'}")
    print(f"password set (ANUMATI_DEMO_PASSWORD from deploy/.env) for: {', '.join(passwords) or 'no one; every account already had one'}")
    print(f"already there, unchanged: {result.get('skipped', 0)}")


if __name__ == "__main__":
    main()
