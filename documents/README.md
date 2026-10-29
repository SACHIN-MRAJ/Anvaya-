# ANUMATI Architecture & Specifications

This directory contains the formal technical specifications, database schemas, and architectural blueprints for the ANUMATI ecosystem.

| File | Description |
| --- | --- |
| [`backend/openapi.yaml`](backend/openapi.yaml) | **OpenAPI 3.1 REST Specification**: Formal API contract covering 150 paths and 162 operations, including RFC 9457 Problem Details error formats. |
| [`backend/openapi.json`](backend/openapi.json) | Exported OpenAPI specification in JSON format for automated client generation and Postman/Swagger import. |
| [`backend/schema.sql`](backend/schema.sql) | **Production Database Schema**: Complete DDL for PostgreSQL 16 including 38 tables, the least-privilege `anumati_app` runtime role, 22 Row-Level Security (RLS) policies, and the append-only evidence log table. |
| [`backend/backend-architecture.png`](backend/backend-architecture.png) | High-level system architecture and deployment topology diagram. |
| [`backend/backend-sign-in.png`](backend/backend-sign-in.png) | End-to-end authentication and Single Sign-On (SSO) sequence diagram with Keycloak. |

---

### Exporting the API Contract & Database Schema

To regenerate the OpenAPI contract and SQL schema directly from the FastAPI application and Alembic migrations:

```bash
cd backend
.venv\Scripts\python.exe scripts\export_contract.py
```
