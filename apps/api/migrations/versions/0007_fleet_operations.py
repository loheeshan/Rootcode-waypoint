"""Add daily vehicle availability and consumed fuel totals.

Revision ID: 0007_fleet_operations
Revises: 0006_plan_outcomes
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_fleet_operations"
down_revision: str | Sequence[str] | None = "0006_plan_outcomes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "vehicle_availability",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("vehicle_id", sa.Uuid(), nullable=False),
        sa.Column("availability_date", sa.Date(), nullable=False),
        sa.Column(
            "is_available",
            sa.Boolean(
                create_constraint=True, name=op.f("ck_vehicle_availability_is_available_boolean")
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_vehicle_availability")),
        sa.ForeignKeyConstraint(
            ["vehicle_id"],
            ["vehicles.id"],
            ondelete="RESTRICT",
            name=op.f("fk_vehicle_availability_vehicle_id_vehicles"),
        ),
        sa.UniqueConstraint(
            "vehicle_id", "availability_date", name=op.f("uq_vehicle_availability_vehicle_date")
        ),
    )
    op.create_table(
        "vehicle_fuel_usage",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("vehicle_id", sa.Uuid(), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("fuel_used_l", sa.Numeric(12, 3), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_vehicle_fuel_usage")),
        sa.ForeignKeyConstraint(
            ["vehicle_id"],
            ["vehicles.id"],
            ondelete="RESTRICT",
            name=op.f("fk_vehicle_fuel_usage_vehicle_id_vehicles"),
        ),
        sa.UniqueConstraint(
            "vehicle_id", "usage_date", name=op.f("uq_vehicle_fuel_usage_vehicle_date")
        ),
        sa.CheckConstraint(
            "fuel_used_l >= 0 AND fuel_used_l < 1000000000",
            name=op.f("ck_vehicle_fuel_usage_fuel_used_l_range"),
        ),
    )


def downgrade() -> None:
    op.drop_table("vehicle_fuel_usage")
    op.drop_table("vehicle_availability")
