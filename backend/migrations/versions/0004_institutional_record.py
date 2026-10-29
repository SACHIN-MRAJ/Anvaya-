"""The one institutional record and the oversight tools.

New tables: campuses, spaces, certificates, programmes, leaders, members (the institution's own team), field_inspections,
verifications and regulatory_actions. New columns: institutions.profile, users.active, the document checklist status,
faculty department / qualification / status / verification, and the stage that raised each deficiency.

Row-level security: every institution table follows anumati_sees_institution_data (an institution sees only its own
rows; officers see all). Field inspections are for officers only and follow their file. The evidence-log policy also
lets an institution read and write its own record chain (ref RECORD-<institution id>).

Revision ID: 0004_institutional_record
Revises: 0003_obligation_audit
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_institutional_record"
down_revision: str | None = "0003_obligation_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PORTAL = "coalesce(current_setting('anumati.portal', true), '')"
INST = "current_setting('anumati.institution_id', true)"
REGION = "coalesce(current_setting('anumati.region', true), '')"
INSTITUTION_TABLES = ["campuses", "spaces", "certificates", "programmes", "leaders", "members", "verifications", "regulatory_actions"]


def _audit_policy(with_records: bool) -> str:
    own_record = f" OR ref = 'RECORD-' || {INST}" if with_records else ""
    rule = (
        f"CASE {PORTAL} WHEN 'system' THEN true WHEN 'public' THEN true "  # noqa: S608  (constant SQL, no user input)
        f"WHEN 'institution' THEN ref = 'VAULT-' || {INST}{own_record} OR EXISTS (SELECT 1 FROM applications a WHERE a.id = audit_log.ref) "
        f"OR EXISTS (SELECT 1 FROM obligations o WHERE o.id = audit_log.ref) "
        f"WHEN 'aicte' THEN {REGION} = '' OR ref NOT LIKE 'ANU-%' OR EXISTS (SELECT 1 FROM applications a WHERE a.id = audit_log.ref) "
        f"ELSE false END"
    )
    return f"CREATE POLICY anumati_scope ON audit_log FOR ALL TO anumati_app USING ({rule}) WITH CHECK ({rule})"


def upgrade() -> None:
    inst_id = lambda: sa.Column("institution_id", sa.String(length=20), sa.ForeignKey("institutions.id"), nullable=False)  # noqa: E731
    op.add_column("institutions", sa.Column("profile", sa.JSON(), server_default="{}", nullable=False))
    op.add_column("users", sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column("documents", sa.Column("review_status", sa.String(length=24), server_default="uploaded", nullable=False))
    op.add_column("documents", sa.Column("review_note", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("reviewed_by", sa.String(length=120), nullable=True))
    op.add_column("documents", sa.Column("reviewed_at", sa.DateTime(), nullable=True))
    for name, length, default in (("department", 120, ""), ("qualification", 40, ""), ("employment", 12, "Regular"), ("status", 10, "Active"), ("verification", 12, "Pending")):
        op.add_column("faculty", sa.Column(name, sa.String(length=length), server_default=default, nullable=False))
    op.add_column("deficiencies", sa.Column("stage", sa.String(length=12), server_default="scrutiny", nullable=False))

    op.create_table(
        "campuses",
        sa.Column("id", sa.String(length=24), primary_key=True), inst_id(),
        sa.Column("name", sa.String(length=120), nullable=False), sa.Column("address", sa.Text(), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=False), sa.Column("state", sa.String(length=80), nullable=False),
        sa.Column("pincode", sa.String(length=10), nullable=False), sa.Column("lat", sa.Float(), nullable=True), sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("land_acres", sa.Float(), nullable=False), sa.Column("ownership", sa.String(length=10), nullable=False),
        sa.Column("deed_no", sa.String(length=60), nullable=False), sa.Column("lease_start", sa.Date(), nullable=True), sa.Column("lease_end", sa.Date(), nullable=True),
        sa.Column("is_main", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "spaces",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True), inst_id(),
        sa.Column("campus_id", sa.String(length=24), sa.ForeignKey("campuses.id"), nullable=False),
        sa.Column("category", sa.String(length=16), nullable=False), sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False), sa.Column("building", sa.String(length=80), nullable=False), sa.Column("area_sqm", sa.Float(), nullable=False),
    )
    op.create_table(
        "certificates",
        sa.Column("id", sa.String(length=24), primary_key=True), inst_id(),
        sa.Column("campus_id", sa.String(length=24), sa.ForeignKey("campuses.id"), nullable=True),
        sa.Column("kind", sa.String(length=60), nullable=False), sa.Column("number", sa.String(length=60), nullable=False),
        sa.Column("issued_by", sa.String(length=160), nullable=False), sa.Column("issued_on", sa.Date(), nullable=True), sa.Column("valid_until", sa.Date(), nullable=True),
        sa.Column("document_id", sa.String(length=40), sa.ForeignKey("documents.id"), nullable=True),
        sa.Column("verification", sa.String(length=12), nullable=False), sa.Column("verified_by", sa.String(length=120), nullable=True),
        sa.Column("verified_at", sa.DateTime(), nullable=True), sa.Column("note", sa.Text(), nullable=True), sa.Column("reminded", sa.JSON(), nullable=False),
    )
    op.create_table(
        "programmes",
        sa.Column("id", sa.String(length=24), primary_key=True), inst_id(),
        sa.Column("department", sa.String(length=120), nullable=False), sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("level", sa.String(length=10), nullable=False), sa.Column("duration_years", sa.Integer(), nullable=False),
        sa.Column("approved_intake", sa.Integer(), nullable=False), sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("since", sa.Integer(), nullable=False), sa.Column("x_category", sa.Boolean(), nullable=False), sa.Column("accreditation", sa.JSON(), nullable=False),
    )
    op.create_table(
        "leaders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True), inst_id(),
        sa.Column("name", sa.String(length=120), nullable=False), sa.Column("position", sa.String(length=60), nullable=False),
        sa.Column("department", sa.String(length=120), nullable=False), sa.Column("email", sa.String(length=160), nullable=False),
        sa.Column("is_signatory", sa.Boolean(), nullable=False), sa.Column("since", sa.Date(), nullable=False), sa.Column("until", sa.Date(), nullable=True),
    )
    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True), inst_id(),
        sa.Column("name", sa.String(length=120), nullable=False), sa.Column("email", sa.String(length=160), nullable=False),
        sa.Column("role", sa.String(length=40), nullable=False), sa.Column("user_id", sa.String(length=40), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False), sa.Column("added_by", sa.String(length=120), nullable=False),
        sa.Column("added_at", sa.DateTime(), server_default=sa.func.now(), nullable=False), sa.Column("deactivated_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "field_inspections",
        sa.Column("id", sa.String(length=24), primary_key=True),
        sa.Column("application_id", sa.String(length=20), sa.ForeignKey("applications.id"), nullable=False),
        sa.Column("inspector_id", sa.String(length=40), nullable=False), sa.Column("inspector_name", sa.String(length=120), nullable=False),
        sa.Column("assigned_by", sa.String(length=120), nullable=False), sa.Column("assigned_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("mode", sa.String(length=10), nullable=False), sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False), sa.Column("video_url", sa.String(length=300), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True), sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("signature", sa.JSON(), nullable=False), sa.Column("report_sha256", sa.String(length=64), nullable=True),
    )
    op.create_table(
        "verifications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True), inst_id(),
        sa.Column("subject", sa.String(length=20), nullable=False), sa.Column("subject_id", sa.String(length=40), nullable=False),
        sa.Column("subject_label", sa.String(length=200), nullable=False), sa.Column("outcome", sa.String(length=12), nullable=False),
        sa.Column("note", sa.Text(), nullable=False), sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("checked_by", sa.String(length=120), nullable=False), sa.Column("checked_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "regulatory_actions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True), inst_id(),
        sa.Column("application_id", sa.String(length=20), sa.ForeignKey("applications.id"), nullable=True),
        sa.Column("kind", sa.String(length=30), nullable=False), sa.Column("detail", sa.Text(), nullable=False), sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("decided_by", sa.String(length=120), nullable=False), sa.Column("role", sa.String(length=40), nullable=False),
        sa.Column("decided_at", sa.DateTime(), server_default=sa.func.now(), nullable=False), sa.Column("effective_from", sa.Date(), nullable=False),
    )
    for table in INSTITUTION_TABLES:
        op.create_index(op.f(f"ix_{table}_institution_id"), table, ["institution_id"])
    op.create_index(op.f("ix_spaces_campus_id"), "spaces", ["campus_id"])
    op.create_index(op.f("ix_field_inspections_application_id"), "field_inspections", ["application_id"])
    op.create_index(op.f("ix_field_inspections_inspector_id"), "field_inspections", ["inspector_id"])
    op.create_index(op.f("ix_regulatory_actions_application_id"), "regulatory_actions", ["application_id"])

    if op.get_context().dialect.name != "postgresql":
        return
    # No GRANT here: 0002 set default privileges, so the new tables and sequences are already usable by anumati_app,
    # and a blanket grant would hand it UPDATE and DELETE on the append-only evidence log again.
    for table in INSTITUTION_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"CREATE POLICY anumati_scope ON {table} FOR ALL TO anumati_app USING (anumati_sees_institution_data(institution_id)) WITH CHECK (anumati_sees_institution_data(institution_id))")
    rule = f"{PORTAL} IN ('system', 'aicte') AND EXISTS (SELECT 1 FROM applications a WHERE a.id = field_inspections.application_id)"  # noqa: S608  (constant SQL, no user input)
    op.execute("ALTER TABLE field_inspections ENABLE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY anumati_scope ON field_inspections FOR ALL TO anumati_app USING ({rule}) WITH CHECK ({rule})")
    op.execute("DROP POLICY IF EXISTS anumati_scope ON audit_log")
    op.execute(_audit_policy(with_records=True))


def downgrade() -> None:
    if op.get_context().dialect.name == "postgresql":
        op.execute("DROP POLICY IF EXISTS anumati_scope ON audit_log")
        op.execute(_audit_policy(with_records=False))
    for table in ["regulatory_actions", "verifications", "field_inspections", "members", "leaders", "programmes", "certificates", "spaces", "campuses"]:
        op.drop_table(table)
    op.drop_column("deficiencies", "stage")
    for name in ("verification", "status", "employment", "qualification", "department"):
        op.drop_column("faculty", name)
    for name in ("reviewed_at", "reviewed_by", "review_note", "review_status"):
        op.drop_column("documents", name)
    op.drop_column("users", "active")
    op.drop_column("institutions", "profile")
