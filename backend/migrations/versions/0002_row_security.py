"""Least-privilege runtime role, an append-only evidence log and row-level security.

The API connects as `anumati_app`. It may read and write data but cannot change the schema, and it may only
INSERT into the evidence log, never UPDATE or DELETE it. Every transaction states who is asking
(SET LOCAL anumati.portal / institution_id / region, see app/db.py), and these policies make PostgreSQL itself
refuse other institutions' rows, and other regions' files for region-locked officers. A transaction that states
no one sees no protected rows.

Revision ID: 0002_row_security
Revises: 0001_baseline
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0002_row_security"
down_revision: str | None = "0001_baseline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PORTAL = "coalesce(current_setting('anumati.portal', true), '')"
INST = "current_setting('anumati.institution_id', true)"
REGION = "coalesce(current_setting('anumati.region', true), '')"

FUNCTIONS = [
    f"""CREATE OR REPLACE FUNCTION anumati_sees_application(inst text, app_region text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE {PORTAL}
    WHEN 'system' THEN true
    WHEN 'public' THEN true            -- public pages publish aggregates and verify letters only
    WHEN 'institution' THEN inst = {INST}
    WHEN 'aicte' THEN {REGION} = '' OR app_region = {REGION}
    ELSE false END
$$""",
    f"""CREATE OR REPLACE FUNCTION anumati_sees_institution_data(inst text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE {PORTAL}
    WHEN 'system' THEN true
    WHEN 'aicte' THEN true
    WHEN 'institution' THEN inst = {INST}
    ELSE false END                    -- documents, drafts, obligations and faculty are never public
$$""",
]

# table -> (USING expression, WITH CHECK expression)
POLICIES = {
    "applications": ("anumati_sees_application(institution_id, region)", None),
    "history_events": ("EXISTS (SELECT 1 FROM applications a WHERE a.id = history_events.application_id)", None),
    "deficiencies": ("EXISTS (SELECT 1 FROM applications a WHERE a.id = deficiencies.application_id)", None),
    "evc_panels": ("EXISTS (SELECT 1 FROM applications a WHERE a.id = evc_panels.application_id)", None),
    "visit_photos": ("EXISTS (SELECT 1 FROM applications a WHERE a.id = visit_photos.application_id)", None),
    "documents": ("anumati_sees_institution_data(institution_id)", None),
    "drafts": ("anumati_sees_institution_data(institution_id)", None),
    "obligations": ("anumati_sees_institution_data(institution_id)", None),
    "faculty": ("anumati_sees_institution_data(institution_id)", None),
    # anyone acting may raise an alert; officers may read and withdraw alerts (bulk undo), an institution only its own
    "notifications": (
        f"CASE {PORTAL} WHEN 'system' THEN true WHEN 'aicte' THEN true "
        f"WHEN 'institution' THEN audience = 'institution' AND institution_id = {INST} ELSE false END",
        "true",
    ),
    # file chains follow their file; vault chains follow their institution; RULES and CALENDAR chains are for officers
    "audit_log": (
        f"CASE {PORTAL} WHEN 'system' THEN true WHEN 'public' THEN true "  # noqa: S608  (constant SQL, no user input)
        f"WHEN 'institution' THEN ref = 'VAULT-' || {INST} OR EXISTS (SELECT 1 FROM applications a WHERE a.id = audit_log.ref) "
        f"WHEN 'aicte' THEN {REGION} = '' OR ref NOT LIKE 'ANU-%' OR EXISTS (SELECT 1 FROM applications a WHERE a.id = audit_log.ref) "
        f"ELSE false END",
        None,
    ),
}


GRANTS = [
    """DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anumati_app') THEN CREATE ROLE anumati_app NOLOGIN; END IF;
END $$""",
    "GRANT USAGE ON SCHEMA public TO anumati_app",
    "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anumati_app",
    "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anumati_app",
    "REVOKE INSERT, UPDATE, DELETE ON alembic_version FROM anumati_app",
    "REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM anumati_app",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anumati_app",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anumati_app",
]
APPEND_ONLY = [
    """CREATE OR REPLACE FUNCTION anumati_forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$""",
    "CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION anumati_forbid_change()",
]


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    for sql in GRANTS + FUNCTIONS:
        op.execute(sql)
    for table, (using, check) in POLICIES.items():
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"CREATE POLICY anumati_scope ON {table} FOR ALL TO anumati_app USING ({using}) WITH CHECK ({check or using})")
    # Belt and braces for the evidence log: even the owner cannot rewrite history without dropping this trigger.
    for sql in APPEND_ONLY:
        op.execute(sql)


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    op.execute("DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log")
    op.execute("DROP FUNCTION IF EXISTS anumati_forbid_change()")
    for table in POLICIES:
        op.execute(f"DROP POLICY IF EXISTS anumati_scope ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.execute("DROP FUNCTION IF EXISTS anumati_sees_application(text, text)")
    op.execute("DROP FUNCTION IF EXISTS anumati_sees_institution_data(text)")
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anumati_app")
    op.execute("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anumati_app")
