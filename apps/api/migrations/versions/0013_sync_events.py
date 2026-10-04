"""Add receipts for Driver/Loader events applied through batch synchronization."""

import sqlalchemy as sa
from alembic import op

revision = "0013_sync_events"
down_revision = "0012_receipt_confirmations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sync_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.String(100), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(16), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(24), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sync_events")),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_sync_events_user_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["trip_id"],
            ["trips.id"],
            ondelete="RESTRICT",
            name=op.f("fk_sync_events_trip_id_trips"),
        ),
        sa.UniqueConstraint("event_id", name=op.f("uq_sync_events_event_id")),
        sa.CheckConstraint(
            "event_type IN ('LOAD_RECORDED', 'TRIP_READY', 'TRIP_STARTED', 'STOP_ARRIVED', "
            "'STOP_DELIVERED', 'STOP_FAILED', 'TRIP_COMPLETED')",
            name=op.f("ck_sync_events_event_type_allowed"),
        ),
        sa.CheckConstraint(
            "entity_type IN ('TRIP', 'STOP', 'ORDER')",
            name=op.f("ck_sync_events_entity_type_allowed"),
        ),
        sa.CheckConstraint(
            "length(trim(device_id)) > 0", name=op.f("ck_sync_events_device_id_not_blank")
        ),
    )
    op.create_index(op.f("ix_sync_events_user_id"), "sync_events", ["user_id"])
    op.create_index("ix_sync_events_trip_received", "sync_events", ["trip_id", "received_at"])


def downgrade() -> None:
    op.drop_table("sync_events")
