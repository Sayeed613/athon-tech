"""stamp_initial_schema

Revision ID: f65f053e7d10
Revises: 
Create Date: 2026-06-02 02:05:12.201844

Migration naming convention:
    YYYYMMDD_HHMM_short_description
    Example: 20250601_1200_create_users_table
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'f65f053e7d10'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
