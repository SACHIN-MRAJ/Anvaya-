r"""Property-based fuzzing of every API operation with Schemathesis, as four kinds of user.

Starts a throwaway API on a free port with its own temporary database and storage, so it never touches real data,
then generates thousands of valid and invalid requests from the OpenAPI schema and fails on any server error (5xx)
or any response that does not match its documented schema.

Run from backend/:  .venv\Scripts\python scripts\fuzz.py [--examples 40]
"""
import argparse
import datetime as dt
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx
import jwt

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
PERSONAS = ["public", "institution", "Bureau head", "Dealing officer"]


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def token(persona: str) -> str | None:
    if persona == "public":
        return None
    from app.config import settings
    from app.security import DEV_USERS

    user = DEV_USERS[persona]
    now = dt.datetime.now(dt.timezone.utc)
    return jwt.encode({**user.model_dump(), "sub": user.id, "iat": now, "exp": now + dt.timedelta(hours=2)}, settings.secret_key, algorithm="HS256")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--examples", type=int, default=40, help="examples per operation and phase")
    args = ap.parse_args()

    work = Path(tempfile.mkdtemp(prefix="anumati-fuzz-"))
    port = free_port()
    env = {
        **os.environ,
        "ANUMATI_DATABASE_URL": f"sqlite+aiosqlite:///{(work / 'fuzz.db').as_posix()}",
        "ANUMATI_STORAGE_DIR": str(work / "storage"),
        "ANUMATI_RATE_LIMIT_PER_MINUTE": "100000000",
        "ANUMATI_SCHEDULER_ENABLED": "false",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1",
    }
    log = open(work / "server.log", "w", encoding="utf-8")  # noqa: SIM115
    server = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(port), "--log-level", "warning"], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)  # noqa: S603
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(100):
            try:
                if httpx.get(f"{base}/api/ready", timeout=1).status_code == 200:
                    break
            except httpx.HTTPError:
                time.sleep(0.2)
        else:
            print("API did not start; see", work / "server.log")
            return 2

        st = Path(sys.executable).with_name("st.exe" if os.name == "nt" else "st")
        results = {}
        for persona in PERSONAS:
            cmd = [str(st), "run", f"{base}/openapi.json", "-c", "not_a_server_error,response_schema_conformance", "-n", str(args.examples),
                   "--workers", "4", "--exclude-path-regex", "stream$", "--no-color"]
            tok = token(persona)
            if tok:
                cmd += ["-H", f"Authorization: Bearer {tok}"]
            out = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")  # noqa: S603
            (work / f"{persona.replace(' ', '-')}.txt").write_text(out.stdout + out.stderr, encoding="utf-8")
            summary = [line for line in out.stdout.splitlines() if "generated" in line or line.strip().startswith(("❌", "Failures"))]
            results[persona] = (out.returncode, summary)
            print(f"{persona:16} exit {out.returncode}  " + " | ".join(s.strip() for s in summary))
        print("Reports and server log:", work)
        return 0 if all(code == 0 for code, _ in results.values()) else 1
    finally:
        server.terminate()
        server.wait(10)
        log.close()


if __name__ == "__main__":
    raise SystemExit(main())
