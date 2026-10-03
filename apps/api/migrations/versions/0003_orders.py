"""Create orders while preserving existing identity and fleet records.

Revision ID: 0003_orders
Revises: 0002_fleet_foundation
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_orders"
down_revision: str | Sequence[str] | None = "0002_fleet_foundation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "orders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("outlet_id", sa.Uuid(), nullable=False),
        sa.Column("requested_delivery_date", sa.Date(), nullable=False),
        sa.Column("temperature_requirement", sa.String(16), nullable=False),
        sa.Column("order_weight_kg", sa.Numeric(12, 3), nullable=False),
        sa.Column("order_volume_m3", sa.Numeric(12, 3), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="CONFIRMED"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_orders")),
        sa.ForeignKeyConstraint(
            ["outlet_id"], ["outlets.id"], ondelete="RESTRICT",
            name=op.f("fk_orders_outlet_id_outlets"),
        ),
        sa.CheckConstraint(
            "temperature_requirement IN ('ambient', 'chilled')",
            name=op.f("ck_orders_temperature_requirement_allowed"),
        ),
        sa.CheckConstraint(
            "order_weight_kg > 0 AND order_weight_kg < 1000000000",
            name=op.f("ck_orders_order_weight_kg_range"),
        ),
        sa.CheckConstraint(
            "order_volume_m3 > 0 AND order_volume_m3 < 1000000000",
            name=op.f("ck_orders_order_volume_m3_range"),
        ),
        sa.CheckConstraint(
            "status IN ('CONFIRMED', 'PLANNED', 'DEFERRED', 'LOADING', "
            "'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIPT_CONFIRMED')",
            name=op.f("ck_orders_status_allowed"),
        ),
    )
    op.create_index(op.f("ix_orders_outlet_id"), "orders", ["outlet_id"], unique=False)
    op.create_index(
        op.f("ix_orders_requested_delivery_date"), "orders",
        ["requested_delivery_date"], unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_orders_requested_delivery_date"), table_name="orders")
    op.drop_index(op.f("ix_orders_outlet_id"), table_name="orders")
    op.drop_table("orders")
