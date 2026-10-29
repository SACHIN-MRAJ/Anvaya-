"""ai_disputes table for disputing AI document check findings

Revision ID: 0005_ai_disputes
Revises: 0004_institutional_record
Create Date: 2026-10-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_ai_disputes"
down_revision = "0004_institutional_record"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_disputes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("document_id", sa.String(40), sa.ForeignKey("documents.id"), nullable=False, index=True),
        sa.Column("institution_id", sa.String(20), sa.ForeignKey("institutions.id"), nullable=False, index=True),
        sa.Column("application_id", sa.String(20), sa.ForeignKey("applications.id"), nullable=True, index=True),
        sa.Column("finding_id", sa.String(80), nullable=False),
        sa.Column("finding_title", sa.Text, nullable=False),
        sa.Column("finding_detail", sa.Text, nullable=False, server_default=""),
        sa.Column("finding_clause", sa.String(60), nullable=False, server_default=""),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="pending", index=True),
        sa.Column("resolution", sa.Text, nullable=True),
        sa.Column("reviewed_by", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now(), index=True),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("ai_disputes")
