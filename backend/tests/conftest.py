import asyncio
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

# A fresh database and file store for every test run; no background scheduler, no network.
# By default the database is SQLite. Set ANUMATI_TEST_POSTGRES to an owner URL of a PostgreSQL server
# (for example postgresql+asyncpg://anumati:pw@127.0.0.1:55432/postgres) to run the same tests on PostgreSQL:
# a new database is created, migrated with Alembic, and the API connects as the row-security role anumati_app.
_tmp = Path(tempfile.mkdtemp(prefix="anumati-test-"))
os.environ.update({
    "ANUMATI_ENV": "test",
    "ANUMATI_DATABASE_URL": f"sqlite+aiosqlite:///{(_tmp / 'test.db').as_posix()}",
    "ANUMATI_STORAGE_DIR": str(_tmp / "storage"),
    "ANUMATI_SCHEDULER_ENABLED": "false",
    "ANUMATI_RATE_LIMIT_PER_MINUTE": "100000",
})

PG_ADMIN = os.environ.get("ANUMATI_TEST_POSTGRES", "")
PG_DB = f"anumati_test_{uuid.uuid4().hex[:8]}"


def _pg(sql: str, db: str = "postgres") -> None:
    import asyncpg

    async def run():
        conn = await asyncpg.connect(PG_ADMIN.replace("postgresql+asyncpg", "postgresql").rsplit("/", 1)[0] + f"/{db}")
        try:
            await conn.execute(sql)
        finally:
            await conn.close()

    asyncio.run(run())


if PG_ADMIN:
    base = PG_ADMIN.rsplit("/", 1)[0]
    _pg(f'CREATE DATABASE "{PG_DB}"')
    owner_url = f"{base}/{PG_DB}"
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=Path(__file__).resolve().parents[1], env={**os.environ, "ANUMATI_DATABASE_URL": owner_url}, check=True, capture_output=True)
    _pg("ALTER ROLE anumati_app WITH LOGIN PASSWORD 'anumati-app-test'", PG_DB)
    host = base.split("@", 1)[1]
    os.environ.update({"ANUMATI_DATABASE_URL": f"postgresql+asyncpg://anumati_app:anumati-app-test@{host}/{PG_DB}", "ANUMATI_DATABASE_ADMIN_URL": owner_url, "ANUMATI_DB_POOL": "null"})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import draws  # noqa: E402

BEACON = "b2f1a0c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d"


@pytest.fixture(scope="session", autouse=True)
def offline_drand():
    async def fake_fetch(round_=None):
        return {"round": round_ or 6_500_000, "randomness": BEACON, "source": "test beacon"}

    original = draws.fetch
    draws.fetch = fake_fetch
    yield
    draws.fetch = original
    shutil.rmtree(_tmp, ignore_errors=True)
    if PG_ADMIN:
        _pg(f'DROP DATABASE IF EXISTS "{PG_DB}" WITH (FORCE)')


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def login(client: TestClient, portal: str, role: str | None = None) -> TestClient:
    client.cookies.clear()
    key = "officerRole" if portal == "aicte" else "institutionRole"
    r = client.post("/api/auth/dev-login", json={"portal": portal, **({key: role} if role else {})})
    assert r.status_code == 200, r.text
    return client


def pdf(pages: int = 2, signed: bool = False, encrypted: bool = False, pad: int = 30_000) -> bytes:
    body = "".join(f"{i} 0 obj<</Type /Page>>endobj\n" for i in range(1, pages + 1))
    if signed:
        body += "9 0 obj<</Type /Sig /ByteRange [0 100 200 300]>>endobj\n"
    if encrypted:
        body += "/Encrypt 5 0 R\n"
    return ("%PDF-1.7\n" + body + " " * pad).encode()


def jpeg_with_gps(lat: float, lng: float, taken: str) -> bytes:
    """A real JPEG APP1/EXIF block with GPS and DateTimeOriginal, built by hand."""
    import struct

    def rat(x: float) -> list[tuple[int, int]]:
        d = int(x)
        m = int((x - d) * 60)
        s = round(((x - d) * 60 - m) * 60 * 100)
        return [(d, 1), (m, 1), (s, 100)]

    t = bytearray(178)
    struct.pack_into("<2sHI", t, 0, b"II", 42, 8)
    entry = lambda at, tag, typ, cnt, val: struct.pack_into("<HHII", t, at, tag, typ, cnt, val)  # noqa: E731
    struct.pack_into("<H", t, 8, 2)
    entry(10, 0x8769, 4, 1, 38)
    entry(22, 0x8825, 4, 1, 56)
    struct.pack_into("<H", t, 38, 1)
    entry(40, 0x9003, 2, 20, 110)
    struct.pack_into("<H", t, 56, 4)
    entry(58, 1, 2, 2, 0)
    t[66] = ord("N")
    entry(70, 2, 5, 3, 130)
    entry(82, 3, 2, 2, 0)
    t[90] = ord("E")
    entry(94, 4, 5, 3, 154)
    t[110:130] = taken.encode() + b"\0"
    for base, value in ((130, lat), (154, lng)):
        for i, (n, d) in enumerate(rat(value)):
            struct.pack_into("<II", t, base + i * 8, n, d)
    app1 = b"Exif\0\0" + bytes(t)
    return b"\xff\xd8\xff\xe1" + struct.pack(">H", len(app1) + 2) + app1 + b"\xff\xd9"
