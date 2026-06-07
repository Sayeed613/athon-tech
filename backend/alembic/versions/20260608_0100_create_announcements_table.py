"""Create announcements table

Revision ID: 20260608_0100
Revises: f65f053e7d10
Create Date: 2026-06-08 01:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision: str = "20260608_0100"
down_revision: Union[str, None] = "f65f053e7d10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "announcements",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("school_id", UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("sender_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("audience_type", sa.String(30), nullable=False, server_default="school_wide"),
        sa.Column("class_ids", JSONB, nullable=True),
        sa.Column("priority", sa.String(10), nullable=False, server_default="normal"),
        sa.Column("publish_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_published", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_announcements_school_id"), "announcements", ["school_id"])
    op.create_index(op.f("ix_announcements_sender_id"), "announcements", ["sender_id"])
    op.create_index(op.f("ix_announcements_is_published"), "announcements", ["is_published"])


def downgrade() -> None:
    op.drop_index(op.f("ix_announcements_school_id"), table_name="announcements")
    op.drop_index(op.f("ix_announcements_sender_id"), table_name="announcements")
    op.drop_index(op.f("ix_announcements_is_published"), table_name="announcements")
    op.drop_table("announcements")
