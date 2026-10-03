"""Add explicit outlet and depot assignments without granting existing users access.

Revision ID: 0004_user_scopes
Revises: 0003_orders
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_user_scopes"
down_revision: str | Sequence[str] | None = "0003_orders"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_outlets",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("outlet_id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "outlet_id", name=op.f("pk_user_outlets")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE",
                                name=op.f("fk_user_outlets_user_id_users")),
        sa.ForeignKeyConstraint(["outlet_id"], ["outlets.id"], ondelete="CASCADE",
                                name=op.f("fk_user_outlets_outlet_id_outlets")),
    )
    op.create_index(op.f("ix_user_outlets_outlet_id"), "user_outlets", ["outlet_id"], unique=False)
    op.create_table(
        "user_depots",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("depot_id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "depot_id", name=op.f("pk_user_depots")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE",
                                name=op.f("fk_user_depots_user_id_users")),
        sa.ForeignKeyConstraint(["depot_id"], ["depots.id"], ondelete="CASCADE",
                                name=op.f("fk_user_depots_depot_id_depots")),
    )
    op.create_index(op.f("ix_user_depots_depot_id"), "user_depots", ["depot_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_depots_depot_id"), table_name="user_depots")
    op.drop_table("user_depots")
    op.drop_index(op.f("ix_user_outlets_outlet_id"), table_name="user_outlets")
    op.drop_table("user_outlets")
