"""Persist draft optimization snapshots and idempotency keys."""

import sqlalchemy as sa
from alembic import op

revision = "0008_plan_optimizations"
down_revision = "0007_fleet_operations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_optimizations",
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("plan_revision_id", sa.Uuid(), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("input_snapshot", sa.JSON(), nullable=False),
        sa.Column("result_snapshot", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("request_id", name=op.f("pk_plan_optimizations")),
        sa.ForeignKeyConstraint(
            ["plan_revision_id"],
            ["plan_revisions.id"],
            ondelete="RESTRICT",
            name=op.f("fk_plan_optimizations_plan_revision_id_plan_revisions"),
        ),
        sa.UniqueConstraint(
            "plan_revision_id", name=op.f("uq_plan_optimizations_plan_revision_id")
        ),
    )


def downgrade() -> None:
    op.drop_table("plan_optimizations")
