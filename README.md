# ANUMATI · अनुमति

**Smart India Hackathon (SIH 2026) · Developed by Team Anvaya**  
*Autonomous Approval Workflow, Norms Monitoring and Fraud-Prevention Ecosystem for AICTE*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![19 Platform Novelties](https://img.shields.io/badge/Innovations-19%20Architectural%20Novelties-blueviolet.svg)](NOVELTIES.md)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.14-009688.svg)](backend)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20TypeScript-61DAFB.svg)](frontend)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED.svg)](deploy)

---

## What is ANUMATI? (The Project in Simple Words)

The word **ANUMATI (अनुमति)** translates to *"Permission"* or *"Official Approval"* in Sanskrit and Hindi.

Every year, over **10,000 engineering colleges and technical institutions** across India must obtain official approvals, course additions, and annual renewals from the **All India Council for Technical Education (AICTE)**. Today, this process faces critical challenges:
1. **Bureaucratic Blackouts:** Colleges struggle with 26 disparate PDF manuals, manual paperwork, and 90+ day processing delays where neither side knows who is holding up the file.
2. **Fraud & Deception:** Unapproved lookalike colleges forge approval letters to defraud unsuspecting students, while dishonest institutions register duplicate "ghost faculty" to falsely meet teacher quotas.
3. **Inspection Vulnerabilities:** Expert Visit Committees (EVC) face risks of lobbying during committee selection and fake "desk inspections" with off-site photos.

### How ANUMATI Solves This:
* **For Colleges (Institutions):** Renewal applications come **89% pre-filled** from live institutional lockers. The moment a document is uploaded, client-side AI checks file health, signatures, and expiry dates in seconds before submission.
* **For AICTE Officers:** Every application is tracked on a unified dashboard with **fair countdown clocks** that pause when a college owes a reply. Expert committees are drawn using **quantum randomness (drand)** to prevent lobbying, and inspection photos are verified against campus **GPS geofences**.
* **For Students & Parents:** An open public portal allows anyone to check whether an institution is genuinely approved and verify official decision letters instantly via **high-security QR codes**.

📖 **[Explore all 19 Platform Novelties in NOVELTIES.md](NOVELTIES.md)**

---

## Repository Structure

| Folder / Document | Contents |
| --- | --- |
| [`frontend/`](frontend) | **The Web Application**: React 18 + TypeScript + Vite 5 + Tailwind CSS + Framer Motion + Recharts + React Flow (46 screens). |
| [`backend/`](backend) | **The Core API**: Python 3.14 + FastAPI + SQLAlchemy 2 + Alembic (158 live endpoints; SQLite in dev, PostgreSQL 16 with Row-Level Security in staging/production). |
| [`deploy/`](deploy) | **Production Docker Stack**: Nginx reverse proxy, PostgreSQL RLS, Keycloak 26 SSO, S3/MinIO storage, ClamAV antivirus, Valkey, and Mailpit. |
| [`documents/backend/`](documents/backend) | **Technical Specifications**: OpenAPI 3.1 REST contracts (`openapi.yaml` / `openapi.json`), PostgreSQL schema with 22 RLS policies, and architectural blueprints. |
| [`NOVELTIES.md`](NOVELTIES.md) | **19 Architectural & Policy Novelties**: Complete technical and policy analysis of all system innovations. |
| [`LICENSE`](LICENSE) | **Open Source License**: Standard MIT License (Copyright (c) 2026 Team Anvaya). |

---

## Quick Start Guide

### Prerequisites
* **Node.js 18+** (Node 24 LTS recommended)
* **Python 3.14**
* PowerShell on Windows (use `npm.cmd` instead of `npm`)

### 1. Launch Backend API
```bash
# First time setup
py -3.14 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt

# Start the API server on http://127.0.0.1:8000
backend\run.cmd
```
*Interactive Swagger docs available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).*

### 2. Launch Website (Frontend)
```bash
cd frontend
npm.cmd install
npm.cmd run dev       # Runs locally on http://localhost:5180
npm.cmd run build     # Type-check and production build to frontend/dist/
```

### 3. Sign In (Development Mode)
Open **[http://localhost:5180](http://localhost:5180)**, click **Sign in**, choose *Institution* or *AICTE official*, select any sample role, and click **Sign in**. In development mode, no password is required. Use the **View as** menu in the header to switch roles.

### 4. Full Production Stack (Optional, with Docker Desktop)
```bash
cd deploy
docker compose up -d --build
```
* Website: `http://localhost:8080`
* Keycloak SSO: `http://localhost:8081`
* Mailpit: `http://localhost:8025`

---

## User Roles & Access Control

| Portal | Role | Permissions |
| --- | --- | --- |
| **Institution** | Principal / Director | Complete administrative access; exclusive authority to submit final applications via DSC signature. |
| | Head of Department | Review departmental drafts, verify syllabus and faculty, respond to AICTE queries. |
| | Compliance Officer | Manage campuses, land records, rooms against norms, and regulatory certificates. |
| | Academic Administrator | Roster courses, seat matrix intake, and teacher-student ratios. |
| | Staff Member | Prepare initial drafts and upload compliance evidence. |
| **AICTE** | Dealing / Regional Officer | Process institutional dossiers and scrutiny queues within assigned region. |
| | Bureau Head / Committee Member | Pan-India oversight; Executive Committee decisions and due-process sanctions. |
| | Rules Administrator | Live Approval Process Handbook rule updates and academic calendar governance. |
| | EVC Coordinator | Constitute and schedule Expert Visit Committees. |
| | Inspection Expert | Mobile field inspection checklist execution with GPS verification and signed reports. |
| | System Auditor | Read-only access across all workflows, audit logs, and evidence chains. |

---

## Ask ANUMATI (Handbook AI Assistant)

The platform includes **Ask ANUMATI**, a context-grounded AI assistant:
- Answers queries directly from AICTE Handbook clauses, regulations, glossary, and live notices.
- Handles spelling variations and multi-turn conversational follow-ups.
- For signed-in users, securely queries their own institutional queue without leaking private status to visitors.
- When an AI API key is configured (`ANUMATI_AI_API_KEY` in `backend/.env`), responses are synthesized with cited clauses; otherwise, the built-in deterministic handbook engine provides exact citations.

---

## Verification & Automated Checks

| Verification Check | Result |
| --- | --- |
| Backend Test Suite (SQLite) | 81 passed, 6 PostgreSQL-RLS tests skipped |
| Backend Test Suite (PostgreSQL RLS) | 87 passed |
| Code Quality & Vulnerability Audits | Ruff, Bandit, pip-audit: 0 vulnerabilities |
| Frontend Type Check & Build | Clean TypeScript compilation, Vite production bundle |
| API Surface | 158 live operations, 37 tables, 22 row-security policies |

---

## Team Anvaya (SIH 2026)

* **Team Name**: Anvaya
* **Submission Category**: Smart India Hackathon 2026
* **Domain**: Higher Education Regulation / AICTE Approval & Compliance Ecosystem

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.  
Copyright (c) 2026 Team Anvaya.
