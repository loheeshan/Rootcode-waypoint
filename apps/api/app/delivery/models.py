"""Append-only Driver delivery events and proof-of-delivery photos stored in PostgreSQL."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

MAX_POD_BYTES = 1_000_000
FAILURE_SQL = (
    "'OUTLET_CLOSED', 'RECEIVER_UNAVAILABLE', 'ACCESS_BLOCKED', 'DELIVERY_REFUSED', "
    "'VEHICLE_ISSUE', 'OTHER'"
)


class DeliveryEventType(StrEnum):
    TRIP_STARTED = "TRIP_STARTED"
    ARRIVED = "ARRIVED"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    TRIP_COMPLETED = "TRIP_COMPLETED"


class DeliveryFailureReason(StrEnum):
    OUTLET_CLOSED = "OUTLET_CLOSED"
    RECEIVER_UNAVAILABLE = "RECEIVER_UNAVAILABLE"
    ACCESS_BLOCKED = "ACCESS_BLOCKED"
    DELIVERY_REFUSED = "DELIVERY_REFUSED"
    VEHICLE_ISSUE = "VEHICLE_ISSUE"
    OTHER = "OTHER"


class PodMimeType(StrEnum):
    JPEG = "image/jpeg"
    PNG = "image/png"


class ProofOfDelivery(Base):
    """One receiver/photo record per stop, uploaded before the stop can be delivered."""

    __tablename__ = "proof_of_delivery"
    __table_args__ = (
        ForeignKeyConstraint(
            ["trip_stop_id", "trip_id"],
            ["trip_stops.id", "trip_stops.trip_id"],
            ondelete="RESTRICT",
            name="fk_proof_of_delivery_stop_trip",
        ),
        Index("uq_proof_of_delivery_id_stop", "id", "trip_stop_id", unique=True),
        CheckConstraint(
            "length(trim(receiver_name, ' \t\n\r')) > 0", name="receiver_name_not_blank"
        ),
        CheckConstraint(
            "photo_mime_type IN ('image/jpeg', 'image/png')", name="photo_mime_type_allowed"
        ),
        CheckConstraint(
            f"photo_size_bytes > 0 AND photo_size_bytes <= {MAX_POD_BYTES}",
            name="photo_size_bytes_range",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    trip_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    trip_stop_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, unique=True)
    receiver_name: Mapped[str] = mapped_column(String(120), nullable=False)
    photo_mime_type: Mapped[str] = mapped_column(String(32), nullable=False)
    photo_bytes: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    photo_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    photo_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    uploaded_by: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class DeliveryEvent(Base):
    """Client-identified Driver transition; the database allows each transition once."""

    __tablename__ = "delivery_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["trip_stop_id", "trip_id"],
            ["trip_stops.id", "trip_stops.trip_id"],
            ondelete="RESTRICT",
            name="fk_delivery_events_stop_trip",
        ),
        ForeignKeyConstraint(
            ["pod_id", "trip_stop_id"],
            ["proof_of_delivery.id", "proof_of_delivery.trip_stop_id"],
            ondelete="RESTRICT",
            name="fk_delivery_events_pod_stop",
        ),
        UniqueConstraint("trip_id", "sequence_number", name="uq_delivery_events_trip_sequence"),
        CheckConstraint("sequence_number > 0", name="sequence_number_positive"),
        CheckConstraint(
            "event_type IN ('TRIP_STARTED', 'ARRIVED', 'DELIVERED', 'FAILED', 'TRIP_COMPLETED')",
            name="event_type_allowed",
        ),
        CheckConstraint(
            "(event_type IN ('TRIP_STARTED', 'TRIP_COMPLETED') AND trip_stop_id IS NULL) OR "
            "(event_type IN ('ARRIVED', 'DELIVERED', 'FAILED') AND trip_stop_id IS NOT NULL)",
            name="stop_scope_consistent",
        ),
        CheckConstraint(
            "(event_type = 'FAILED' AND reason_code IS NOT NULL AND reason_code IN "
            "(" + FAILURE_SQL + ") AND note IS NOT NULL AND "
            "length(trim(note, ' \t\n\r')) > 0) "
            "OR (event_type <> 'FAILED' AND reason_code IS NULL)",
            name="failure_reason_consistent",
        ),
        CheckConstraint(
            "(event_type = 'DELIVERED' AND pod_id IS NOT NULL) OR "
            "(event_type <> 'DELIVERED' AND pod_id IS NULL)",
            name="pod_consistent",
        ),
        CheckConstraint("note IS NULL OR length(note) <= 500", name="note_length"),
        Index(
            "uq_delivery_events_stop_arrival",
            "trip_stop_id",
            unique=True,
            postgresql_where=text("event_type = 'ARRIVED'"),
            sqlite_where=text("event_type = 'ARRIVED'"),
        ),
        Index(
            "uq_delivery_events_stop_outcome",
            "trip_stop_id",
            unique=True,
            postgresql_where=text("event_type IN ('DELIVERED', 'FAILED')"),
            sqlite_where=text("event_type IN ('DELIVERED', 'FAILED')"),
        ),
        Index(
            "uq_delivery_events_trip_lifecycle",
            "trip_id",
            "event_type",
            unique=True,
            postgresql_where=text("trip_stop_id IS NULL"),
            sqlite_where=text("trip_stop_id IS NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    trip_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("trips.id", ondelete="RESTRICT"), nullable=False
    )
    trip_stop_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    event_type: Mapped[str] = mapped_column(String(24), nullable=False)
    reason_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pod_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recorded_by: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
