"""Add append-only operational audit history."""

import sqlalchemy as sa
from alembic import op

revision = "0014_audit_events"
down_revision = "0013_sync_events"
branch_labels = None
depends_on = None

ACTIONS = (
    "'PLAN_PUBLISHED', 'LOAD_RECORDED', 'TRIP_READY', 'TRIP_STARTED', 'STOP_ARRIVED', "
    "'POD_UPLOADED', 'STOP_DELIVERED', 'STOP_FAILED', 'TRIP_COMPLETED', "
    "'RECEIPT_CONFIRMED', 'SYNC_CONFLICT'"
)


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("entity_type", sa.String(16), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("depot_id", sa.Uuid(), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=True),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("dedupe_key", sa.String(200), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_events")),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_audit_events_actor_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["depot_id"],
            ["depots.id"],
            ondelete="RESTRICT",
            name=op.f("fk_audit_events_depot_id_depots"),
        ),
        sa.ForeignKeyConstraint(
            ["trip_id"],
            ["trips.id"],
            ondelete="RESTRICT",
            name=op.f("fk_audit_events_trip_id_trips"),
        ),
        sa.UniqueConstraint("dedupe_key", name=op.f("uq_audit_events_dedupe_key")),
        sa.CheckConstraint(
            "action IN (" + ACTIONS + ")", name=op.f("ck_audit_events_action_allowed")
        ),
        sa.CheckConstraint(
            "entity_type IN ('PLAN', 'TRIP', 'STOP', 'ORDER')",
            name=op.f("ck_audit_events_entity_type_allowed"),
        ),
    )
    op.create_index("ix_audit_events_depot_occurred", "audit_events", ["depot_id", "occurred_at"])
    op.create_index("ix_audit_events_entity", "audit_events", ["entity_type", "entity_id"])
    op.create_index(op.f("ix_audit_events_actor_id"), "audit_events", ["actor_id"])
    op.create_index(op.f("ix_audit_events_trip_id"), "audit_events", ["trip_id"])


def downgrade() -> None:
    op.drop_table("audit_events")
