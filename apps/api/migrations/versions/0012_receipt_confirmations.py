"""Add Store receipt confirmations for delivered orders."""

import sqlalchemy as sa
from alembic import op

revision = "0012_receipt_confirmations"
down_revision = "0011_delivery_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "receipt_confirmations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("outlet_id", sa.Uuid(), nullable=False),
        sa.Column("delivery_event_id", sa.Uuid(), nullable=False),
        sa.Column("confirmed_by", sa.Uuid(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_receipt_confirmations")),
        sa.ForeignKeyConstraint(
            ["order_id", "outlet_id"],
            ["orders.id", "orders.outlet_id"],
            ondelete="RESTRICT",
            name="fk_receipt_confirmations_order_outlet",
        ),
        sa.ForeignKeyConstraint(
            ["delivery_event_id"],
            ["delivery_events.id"],
            ondelete="RESTRICT",
            name=op.f("fk_receipt_confirmations_delivery_event_id_delivery_events"),
        ),
        sa.ForeignKeyConstraint(
            ["confirmed_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_receipt_confirmations_confirmed_by_users"),
        ),
        sa.UniqueConstraint("order_id", name=op.f("uq_receipt_confirmations_order_id")),
    )
    for column in ("outlet_id", "delivery_event_id", "confirmed_by"):
        op.create_index(
            op.f(f"ix_receipt_confirmations_{column}"), "receipt_confirmations", [column]
        )


def downgrade() -> None:
    op.drop_table("receipt_confirmations")
