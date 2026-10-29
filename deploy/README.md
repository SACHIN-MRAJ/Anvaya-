# ANUMATI staging stack

The whole system on one machine, built the way production is: the website behind nginx, the API (2 worker
processes), PostgreSQL 16 with row-level security, Keycloak single sign-on, S3-compatible object storage (RustFS),
the ClamAV virus scanner, Valkey (a rate limit shared by every API process) and Mailpit (catches every email the
system sends). Needs Docker Desktop (about 2.3 GB of memory while running).

```powershell
cd "C:\Users\sachi\Downloads\ANUMATI UI\deploy"
docker compose up -d --build      # first run builds the images; ClamAV downloads its signatures (a few minutes)
docker compose ps                 # every service should say healthy
```

| Address | What |
| --- | --- |
| http://localhost:8080 | The website (the API is at /api on the same address) |
| http://localhost:8081 | Keycloak sign-in; admin console at /admin (user `admin`, password `KEYCLOAK_ADMIN_PASSWORD` in `.env`) |
| http://localhost:8025 | Mailpit: every alert email the system sends lands here instead of real inboxes |

Only these three ports are published, and only on this computer. The API, database, storage, scanner and Valkey
are reachable only inside the stack's network.

## Sample accounts

Every account uses the password `ANUMATI_DEMO_PASSWORD` from `deploy/.env`.

| Account | Signs in as |
| --- | --- |
| `principal.nvit` | Institution: Narmada Valley Institute of Technology (INS-001) |
| `principal.sahyadri` | Institution: Sahyadri Polytechnic (INS-002) |
| `dealing.cro` | Dealing officer, Central region only |
| `regional.cro` | Regional officer, Central region only |
| `bureau.head` | Bureau head, every region |
| `committee.member` | Executive Committee member |
| `rules.admin` | Rules administrator |
| `hod.nvit` | Head of Department at INS-001: prepares and reviews drafts, cannot submit |
| `compliance.nvit` | Compliance staff at INS-001: campuses, certificates, replies to AICTE |
| `academic.nvit` | Academic administrator at INS-001: courses, seats and faculty |
| `staff.nvit` | Institution staff at INS-001: drafts and uploads only |
| `evc.coordinator` | EVC coordinator: assigns field inspections |
| `inspector.menon` | Inspector: fills in and signs field inspection reports |
| `auditor` | Auditor: read-only on every officer screen |
| `sysadmin` | System administrator: switches accounts on or off |

Roles and regions come from the Keycloak account (realm roles and groups in `keycloak/anumati-realm.json`);
the website's "View as" role switcher is hidden in this mode. For institution staff, the Principal's Team page wins:
a person listed there gets the role given there at sign-in, and a person whose access was switched off is refused.

Keycloak reads the realm file only on its first start. After adding roles or accounts to it on a stack that already
ran, add them with `..\backend\.venv\Scripts\python.exe keycloak\sync_realm.py` (existing ones are left as they are;
new accounts get the `ANUMATI_DEMO_PASSWORD` password, read inside the Keycloak container).

## Check it

```powershell
..\backend\.venv\Scripts\python.exe smoke_test.py   # 70 checks, listed below
```

It signs in through the real Keycloak pages as institutions and officers, then checks: data isolation by
institution and region, the cross-site guard, uploads scanned and stored in S3 (the EICAR test virus is stopped),
an idempotent submission and its evidence chain, single sign-out, signed webhooks, an undertaking tracked as a
promise, a reminder email delivered to Mailpit, the infrastructure locker and a document streamed back from S3 for the viewer, an HoD who cannot submit and an
auditor who cannot act (both signed in through Keycloak), the routing monitor and why files are sent back, a field
inspection assigned to an inspector who signed in through Keycloak, decision readiness and an approval with a
condition that becomes a tracked obligation, a signed verifiable letter, the help bot answering from a college’s own
files (and not for visitors), and the rate limit counters in Valkey.

## Files

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | The eight services, health checks and volumes |
| `.env` | Generated secrets for this machine (never commit); `.env.example` lists them |
| `web.Dockerfile`, `nginx.conf`, `security-headers.conf` | Website build (from `../frontend`) and web tier (strict Content-Security-Policy) |
| `keycloak/anumati-realm.json` | Realm: roles, groups, the `anumati-web` client (PKCE) and sample accounts |
| `keycloak/sync_realm.py` | Adds new roles and accounts from the realm file to a Keycloak that already ran |
| `postgres/initdb.sh` | Creates the `anumati_app` and `keycloak` database roles on first start |
| `smoke_test.py` | Post-deploy checks through the website address |

## Stop, reset

```powershell
docker compose down        # stop; data is kept in volumes
docker compose down -v     # stop and delete all data (the sample cycle is loaded again on next start)
```

## Staging versus production

Staging runs `ANUMATI_ENV=staging`: production security (single sign-on, PostgreSQL, strong secrets) but with the
sample cycle and the fixed sample date. Production also needs HTTPS in front of nginx, Keycloak in production mode
with its own TLS, a managed PostgreSQL with backups, an object store in an Indian region, a real SMTP account in place of Mailpit, SMS and WhatsApp provider accounts,
`ANUMATI_SEED_ON_START=false` and an empty `ANUMATI_FIXED_TODAY`; the API refuses to start otherwise.
