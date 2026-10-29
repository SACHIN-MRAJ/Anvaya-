# ANUMATI API (version 1.3)

The backend for every screen of the ANUMATI website: approvals with fair clocks, rules as versioned data,
document checks with virus scanning, signed decision letters, alerts, fair draws and a hash-chained evidence log,
with Keycloak single sign-on and PostgreSQL row-level security for production. Version 1.3 adds one institutional
record (profile, campuses, rooms against the APH norms, certificates with expiry reminders, courses and seats, faculty,
signatories, team and access) and the officers' oversight tools (routing, field inspections, verification, document
review, decision readiness with conditions, regulatory actions, why files are sent back, user access).

**Python 3.14 · FastAPI · SQLAlchemy (SQLite in development, PostgreSQL 16 with row-level security in staging and
production) · 158 API operations · 37 tables · 22 row-security policies · 87 tests · 85% coverage.**
The full explanation, including which software is used and why and how it was verified, is in
`documents/ANUMATI_Backend.docx`.

## Run it (development)

First time only (PowerShell, in this folder):

```powershell
py -3.14 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Every time:

```powershell
.\run.cmd            # http://127.0.0.1:8000, interactive docs at /docs
.\run.cmd --reload   # restarts on code changes while developing
```

Then start the website with `npm.cmd --prefix ..\frontend run dev` and open http://localhost:5180.
Every screen reads and writes through this API. If the API is off, the website shows its built-in sample data,
labelled as such.

For the full production-shaped stack (website, API, PostgreSQL, Keycloak, object storage, ClamAV, Valkey, Mailpit), see
`../deploy/README.md`: `docker compose up -d --build` in that folder.

## Sign in (development)

`POST /api/auth/dev-login` with `{"portal": "institution", "institutionRole": "Head of Department"}` or
`{"portal": "aicte", "officerRole": "Bureau head"}`.
Institution roles: Principal / Director (default), Head of Department, Compliance staff, Academic administrator,
Institution staff. Officer roles: Dealing officer, Regional officer, Bureau head, Committee member, Rules administrator,
EVC coordinator, Inspector, Auditor, System administrator. What each may do is in `app/security.py` and is enforced on
every request.
With `ANUMATI_AUTH_MODE=oidc` the website instead sends people to Keycloak (`/api/auth/login`), and the API
completes the sign-in and sets an HttpOnly session cookie; no token ever reaches the browser.

## Check it

```powershell
.venv\Scripts\python.exe -m pytest                                    # all tests on SQLite
$env:ANUMATI_TEST_POSTGRES = "postgresql+asyncpg://anumati:<pw>@127.0.0.1:55432/postgres"
.venv\Scripts\python.exe -m pytest                                    # same tests on PostgreSQL, plus row-security tests
.venv\Scripts\python.exe -m ruff check app tests scripts migrations   # lint
.venv\Scripts\python.exe -m bandit -r app -q                          # security scan
.venv\Scripts\python.exe -m pip_audit -r requirements.txt             # known vulnerabilities
.venv\Scripts\python.exe scripts\fuzz.py                              # Schemathesis fuzzing as four kinds of user
.venv\Scripts\python.exe scripts\load_test.py --base http://127.0.0.1:8020 --users 50
```

A scratch PostgreSQL for the tests: `docker run -d --name anumati-pg-scratch -e POSTGRES_USER=anumati
-e POSTGRES_PASSWORD=<pw> -e POSTGRES_DB=anumati -p 127.0.0.1:55432:5432 postgres:16-alpine`.

## Keep the contract in step with the code

```powershell
.venv\Scripts\python.exe scripts\export_contract.py   # documents/backend/openapi.yaml and schema.sql (exactly what migrations run)
node backend\scripts\export_seed.mjs                   # run from the project root: refreshes app/seed/seed.json from frontend/src/data
.venv\Scripts\alembic.exe revision --autogenerate -m "what changed"   # after changing app/models.py (PostgreSQL URL set)
```

## Settings

Every setting is an environment variable starting with `ANUMATI_`; see `.env.example`. Staging and production
refuse to start with development sign-in, SQLite or weak secrets; production also refuses sample data, the fixed
sample date and unsigned webhooks.

New in 1.2: `ANUMATI_REDIS_URL` (Valkey or Redis) shares the rate limit between API processes, falling back to a
per-process limit if it is unreachable; `ANUMATI_EMAIL_MODE=smtp` with `ANUMATI_SMTP_URL` really sends alert email.
Ask ANUMATI (`app/services/assistant.py`) ranks handbook passages with BM25, reads the asker's own files or queue
when signed in, and, with `ANUMATI_AI_API_KEY` (or `ANUMATI_ANTHROPIC_API_KEY`), lets the LLM engine (`ANUMATI_ASSISTANT_MODEL`, default
`neural-assistant-v1`) synthesize the reply from verified handbook sources, falling back to the built-in answer on any failure.

## Layout

| Path | What it holds |
| --- | --- |
| `app/main.py` | Start-up, background clock, health, readiness, metrics |
| `app/config.py` | Settings and the staging/production safety checks |
| `app/middleware.py`, `app/errors.py` | Request guard (rate, size, cross-site, headers, logs, metrics); Problem Details errors |
| `app/db.py`, `app/models.py` | Database connection, row-security context per transaction, the 37 tables |
| `app/security.py`, `app/oidc.py` | Sessions, roles, region scope; Keycloak single sign-on (backend-for-frontend) |
| `app/idempotency.py`, `app/cache.py`, `app/timeutil.py` | Answer-once submissions; short cache for public pages; one clock (India time, offsets written out) |
| `app/audit.py`, `app/rules.py` | Evidence log; rules engine and golden tests |
| `app/routers/` | auth, public, institution, records (the institutional record), applications, oversight (routing, field inspections, verification, readiness, regulatory actions, admin, badges), aicte (+ notifications), evc, rules_api, channels |
| `app/services/` | workflow, norms (APH Annexure-1, 3 and 4), inspection (checklist and report), documents (local or S3, ClamAV, pyHanko), credentials, draws, geo, insight, notify, assistant, undertaking |
| `app/seed/` | The sample cycle and the sample institutional record (with small PDF files); a database from 1.2 is upgraded once at start-up |
| `migrations/` | Alembic: baseline schema; least-privilege role, row-level security, append-only evidence log; obligation evidence (0003); institutional record and oversight (0004) |
| `scripts/` | export_contract.py, export_seed.mjs, fuzz.py, load_test.py |
| `tests/` | 87 tests: 81 on SQLite, all 87 on PostgreSQL (`test_row_security.py` needs PostgreSQL) |
| `Dockerfile`, `docker/entrypoint.sh` | API image: non-root, runs migrations, then 2+ worker processes |
