"""add converting to processing_status enum

Revision ID: 657325957b21
Revises: 2f69676456df
Create Date: 2026-05-06 16:19:36.282957
"""
from typing import Sequence, Union

from alembic import op


revision: str = '657325957b21'
down_revision: Union[str, None] = '2f69676456df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE processingstatus ADD VALUE 'converting'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    # Would require recreating the enum type (skipped for safety).
    pass
