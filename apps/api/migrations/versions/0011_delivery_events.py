"""Add Driver delivery events and proof-of-delivery photos."""

import sqlalchemy as sa
from alembic import op

revision = "0011_delivery_events"
down_revision = "0010_load_events"
branch_labels = None
depends_on = None

FAILURE_REASONS = (
    "'OUTLET_CLOSED', 'RECEIVER_UNAVAILABLE', 'ACCESS_BLOCKED', 'DELIVERY_REFUSED', "
    "'VEHICLE_ISSUE', 'OTHER'"
)


def partial(condition: str) -> dict[str, sa.TextClause]:
    return {"postgresql_where": sa.text(condition), "sqlite_where": sa.text(condition)}


def upgrade() -> None:
    op.create_index("uq_trip_stops_id_trip", "trip_stops", ["id", "trip_id"], unique=True)
    op.create_table(
        "proof_of_delivery",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("trip_stop_id", sa.Uuid(), nullable=False),
        sa.Column("receiver_name", sa.String(120), nullable=False),
        sa.Column("photo_mime_type", sa.String(32), nullable=False),
        sa.Column("photo_bytes", sa.LargeBinary(), nullable=False),
        sa.Column("photo_size_bytes", sa.Integer(), nullable=False),
        sa.Column("photo_sha256", sa.String(64), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("uploaded_by", sa.Uuid(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_proof_of_delivery")),
        sa.ForeignKeyConstraint(
            ["trip_stop_id", "trip_id"],
            ["trip_stops.id", "trip_stops.trip_id"],
            ondelete="RESTRICT",
            name="fk_proof_of_delivery_stop_trip",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_proof_of_delivery_uploaded_by_users"),
        ),
        sa.UniqueConstraint("trip_stop_id", name=op.f("uq_proof_of_delivery_trip_stop_id")),
        sa.CheckConstraint(
            "length(trim(receiver_name, ' \t\n\r')) > 0",
            name=op.f("ck_proof_of_delivery_receiver_name_not_blank"),
        ),
        sa.CheckConstraint(
            "photo_mime_type IN ('image/jpeg', 'image/png')",
            name=op.f("ck_proof_of_delivery_photo_mime_type_allowed"),
        ),
        sa.CheckConstraint(
            "photo_size_bytes > 0 AND photo_size_bytes <= 1000000",
            name=op.f("ck_proof_of_delivery_photo_size_bytes_range"),
        ),
    )
    op.create_index(
        "uq_proof_of_delivery_id_stop", "proof_of_delivery", ["id", "trip_stop_id"], unique=True
    )
    op.create_index(op.f("ix_proof_of_delivery_trip_id"), "proof_of_delivery", ["trip_id"])
    op.create_index(op.f("ix_proof_of_delivery_uploaded_by"), "proof_of_delivery", ["uploaded_by"])
    op.create_table(
        "delivery_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("trip_stop_id", sa.Uuid(), nullable=True),
        sa.Column("event_type", sa.String(24), nullable=False),
        sa.Column("reason_code", sa.String(32), nullable=True),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("pod_id", sa.Uuid(), nullable=True),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recorded_by", sa.Uuid(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_delivery_events")),
        sa.ForeignKeyConstraint(
            ["trip_id"],
            ["trips.id"],
            ondelete="RESTRICT",
            name=op.f("fk_delivery_events_trip_id_trips"),
        ),
        sa.ForeignKeyConstraint(
            ["trip_stop_id", "trip_id"],
            ["trip_stops.id", "trip_stops.trip_id"],
            ondelete="RESTRICT",
            name="fk_delivery_events_stop_trip",
        ),
        sa.ForeignKeyConstraint(
            ["pod_id", "trip_stop_id"],
            ["proof_of_delivery.id", "proof_of_delivery.trip_stop_id"],
            ondelete="RESTRICT",
            name="fk_delivery_events_pod_stop",
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_delivery_events_recorded_by_users"),
        ),
        sa.UniqueConstraint("trip_id", "sequence_number", name="uq_delivery_events_trip_sequence"),
        sa.CheckConstraint(
            "sequence_number > 0", name=op.f("ck_delivery_events_sequence_number_positive")
        ),
        sa.CheckConstraint(
            "event_type IN ('TRIP_STARTED', 'ARRIVED', 'DELIVERED', 'FAILED', 'TRIP_COMPLETED')",
            name=op.f("ck_delivery_events_event_type_allowed"),
        ),
        sa.CheckConstraint(
            "(event_type IN ('TRIP_STARTED', 'TRIP_COMPLETED') AND trip_stop_id IS NULL) OR "
            "(event_type IN ('ARRIVED', 'DELIVERED', 'FAILED') AND trip_stop_id IS NOT NULL)",
            name=op.f("ck_delivery_events_stop_scope_consistent"),
        ),
        sa.CheckConstraint(
            "(event_type = 'FAILED' AND reason_code IS NOT NULL AND reason_code IN "
            "(" + FAILURE_REASONS + ") AND note IS NOT NULL AND "
            "length(trim(note, ' \t\n\r')) > 0) "
            "OR (event_type <> 'FAILED' AND reason_code IS NULL)",
            name=op.f("ck_delivery_events_failure_reason_consistent"),
        ),
        sa.CheckConstraint(
            "(event_type = 'DELIVERED' AND pod_id IS NOT NULL) OR "
            "(event_type <> 'DELIVERED' AND pod_id IS NULL)",
            name=op.f("ck_delivery_events_pod_consistent"),
        ),
        sa.CheckConstraint(
            "note IS NULL OR length(note) <= 500", name=op.f("ck_delivery_events_note_length")
        ),
    )
    op.create_index(op.f("ix_delivery_events_recorded_by"), "delivery_events", ["recorded_by"])
    op.create_index(
        "uq_delivery_events_stop_arrival",
        "delivery_events",
        ["trip_stop_id"],
        unique=True,
        **partial("event_type = 'ARRIVED'"),
    )
    op.create_index(
        "uq_delivery_events_stop_outcome",
        "delivery_events",
        ["trip_stop_id"],
        unique=True,
        **partial("event_type IN ('DELIVERED', 'FAILED')"),
    )
    op.create_index(
        "uq_delivery_events_trip_lifecycle",
        "delivery_events",
        ["trip_id", "event_type"],
        unique=True,
        **partial("trip_stop_id IS NULL"),
    )


def downgrade() -> None:
    op.drop_table("delivery_events")
    op.drop_table("proof_of_delivery")
    op.drop_index("uq_trip_stops_id_trip", table_name="trip_stops")
