"""Evidence-log policy: an institution may also write and read the chains of its own obligations.

Tracking a confirmed promise and attaching proof both record an evidence-log entry under the obligation's id.
The obligations policy already limits an institution to its own rows, so the same check is reused here.

Revision ID: 0003_obligation_audit
Revises: 0002_row_security
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0003_obligation_audit"
down_revision: str | None = "0002_row_security"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PORTAL = "coalesce(current_setting('anumati.portal', true), '')"
INST = "current_setting('anumati.institution_id', true)"
REGION = "coalesce(current_setting('anumati.region', true), '')"


def _policy(with_obligations: bool) -> str:
    own_obligation = " OR EXISTS (SELECT 1 FROM obligations o WHERE o.id = audit_log.ref)" if with_obligations else ""
    rule = (
        f"CASE {PORTAL} WHEN 'system' THEN true WHEN 'public' THEN true "  # noqa: S608  (constant SQL, no user input)
        f"WHEN 'institution' THEN ref = 'VAULT-' || {INST} OR EXISTS (SELECT 1 FROM applications a WHERE a.id = audit_log.ref){own_obligation} "
        f"WHEN 'aicte' THEN {REGION} = '' OR ref NOT LIKE 'ANU-%' OR EXISTS (SELECT 1 FROM applications a WHERE a.id = audit_log.ref) "
        f"ELSE false END"
    )
    return f"CREATE POLICY anumati_scope ON audit_log FOR ALL TO anumati_app USING ({rule}) WITH CHECK ({rule})"


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    op.execute("DROP POLICY IF EXISTS anumati_scope ON audit_log")
    op.execute(_policy(with_obligations=True))


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    op.execute("DROP POLICY IF EXISTS anumati_scope ON audit_log")
    op.execute(_policy(with_obligations=False))
