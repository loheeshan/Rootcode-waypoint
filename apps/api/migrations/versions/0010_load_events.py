"""Add append-only loading events and trip readiness records."""

import sqlalchemy as sa
from alembic import op

revision = "0010_load_events"
down_revision = "0009_plan_publications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_plan_assignments_id_trip_order",
        "plan_assignments",
        ["id", "trip_id", "order_id"],
        unique=True,
    )
    op.create_table(
        "load_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("assignment_id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recorded_by", sa.Uuid(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_load_events")),
        sa.ForeignKeyConstraint(
            ["trip_id"],
            ["trips.id"],
            ondelete="RESTRICT",
            name=op.f("fk_load_events_trip_id_trips"),
        ),
        sa.ForeignKeyConstraint(
            ["assignment_id", "trip_id", "order_id"],
            ["plan_assignments.id", "plan_assignments.trip_id", "plan_assignments.order_id"],
            ondelete="RESTRICT",
            name="fk_load_events_assignment_trip_order",
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_load_events_recorded_by_users"),
        ),
        sa.UniqueConstraint("trip_id", "sequence_number", name="uq_load_events_trip_sequence"),
        sa.CheckConstraint(
            "sequence_number > 0", name=op.f("ck_load_events_sequence_number_positive")
        ),
        sa.CheckConstraint(
            "status IN ('LOADED', 'MISSING', 'DAMAGED')", name=op.f("ck_load_events_status_allowed")
        ),
        sa.CheckConstraint(
            "status = 'LOADED' OR (note IS NOT NULL AND length(trim(note, ' \t\n\r')) > 0)",
            name=op.f("ck_load_events_exception_note_required"),
        ),
        sa.CheckConstraint(
            "note IS NULL OR length(note) <= 500", name=op.f("ck_load_events_note_length")
        ),
    )
    op.create_index("ix_load_events_trip_order", "load_events", ["trip_id", "order_id"])
    op.create_index(op.f("ix_load_events_recorded_by"), "load_events", ["recorded_by"])
    op.create_table(
        "trip_loading_completions",
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("last_event_sequence", sa.Integer(), nullable=False),
        sa.Column("loaded_count", sa.Integer(), nullable=False),
        sa.Column("missing_count", sa.Integer(), nullable=False),
        sa.Column("damaged_count", sa.Integer(), nullable=False),
        sa.Column("confirmed_by", sa.Uuid(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("trip_id", name=op.f("pk_trip_loading_completions")),
        sa.ForeignKeyConstraint(
            ["trip_id"],
            ["trips.id"],
            ondelete="RESTRICT",
            name=op.f("fk_trip_loading_completions_trip_id_trips"),
        ),
        sa.ForeignKeyConstraint(
            ["confirmed_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_trip_loading_completions_confirmed_by_users"),
        ),
        sa.UniqueConstraint("request_id", name=op.f("uq_trip_loading_completions_request_id")),
        sa.CheckConstraint(
            "last_event_sequence > 0",
            name=op.f("ck_trip_loading_completions_last_event_sequence_positive"),
        ),
        sa.CheckConstraint(
            "loaded_count > 0 AND missing_count >= 0 AND damaged_count >= 0",
            name=op.f("ck_trip_loading_completions_counts_valid"),
        ),
    )
    op.create_index(
        op.f("ix_trip_loading_completions_confirmed_by"),
        "trip_loading_completions",
        ["confirmed_by"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_trip_loading_completions_confirmed_by"), table_name="trip_loading_completions"
    )
    op.drop_table("trip_loading_completions")
    op.drop_index(op.f("ix_load_events_recorded_by"), table_name="load_events")
    op.drop_index("ix_load_events_trip_order", table_name="load_events")
    op.drop_table("load_events")
    op.drop_index("uq_plan_assignments_id_trip_order", table_name="plan_assignments")
