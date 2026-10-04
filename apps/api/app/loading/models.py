"""Append-only loading outcomes per assigned order and the trip readiness record."""

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
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LoadStatus(StrEnum):
    LOADED = "LOADED"
    MISSING = "MISSING"
    DAMAGED = "DAMAGED"


class LoadEvent(Base):
    """One client-identified observation; a later event for the same order supersedes it."""

    __tablename__ = "load_events"
    __table_args__ = (
        # The assignment must be the order's SERVED outcome on this exact trip.
        ForeignKeyConstraint(
            ["assignment_id", "trip_id", "order_id"],
            ["plan_assignments.id", "plan_assignments.trip_id", "plan_assignments.order_id"],
            ondelete="RESTRICT",
            name="fk_load_events_assignment_trip_order",
        ),
        UniqueConstraint("trip_id", "sequence_number", name="uq_load_events_trip_sequence"),
        CheckConstraint("sequence_number > 0", name="sequence_number_positive"),
        CheckConstraint("status IN ('LOADED', 'MISSING', 'DAMAGED')", name="status_allowed"),
        CheckConstraint(
            "status = 'LOADED' OR (note IS NOT NULL AND length(trim(note, ' \t\n\r')) > 0)",
            name="exception_note_required",
        ),
        CheckConstraint("note IS NULL OR length(note) <= 500", name="note_length"),
        Index("ix_load_events_trip_order", "trip_id", "order_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    trip_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("trips.id", ondelete="RESTRICT"), nullable=False
    )
    assignment_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    order_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recorded_by: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class TripLoadingCompletion(Base):
    """The accepted ready request; counts are the outcomes current at that sequence."""

    __tablename__ = "trip_loading_completions"
    __table_args__ = (
        CheckConstraint("last_event_sequence > 0", name="last_event_sequence_positive"),
        CheckConstraint(
            "loaded_count > 0 AND missing_count >= 0 AND damaged_count >= 0",
            name="counts_valid",
        ),
    )

    trip_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("trips.id", ondelete="RESTRICT"), primary_key=True
    )
    request_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, unique=True)
    last_event_sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    loaded_count: Mapped[int] = mapped_column(Integer, nullable=False)
    missing_count: Mapped[int] = mapped_column(Integer, nullable=False)
    damaged_count: Mapped[int] = mapped_column(Integer, nullable=False)
    confirmed_by: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
