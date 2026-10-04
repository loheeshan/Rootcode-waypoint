"""Receipts of Driver/Loader events applied through the batch sync endpoint."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SyncEventType(StrEnum):
    LOAD_RECORDED = "LOAD_RECORDED"
    TRIP_READY = "TRIP_READY"
    TRIP_STARTED = "TRIP_STARTED"
    STOP_ARRIVED = "STOP_ARRIVED"
    STOP_DELIVERED = "STOP_DELIVERED"
    STOP_FAILED = "STOP_FAILED"
    TRIP_COMPLETED = "TRIP_COMPLETED"


class SyncEntityType(StrEnum):
    TRIP = "TRIP"
    STOP = "STOP"
    ORDER = "ORDER"


class SyncEvent(Base):
    """Written in the same transaction as the domain change; never written for failures."""

    __tablename__ = "sync_events"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('LOAD_RECORDED', 'TRIP_READY', 'TRIP_STARTED', 'STOP_ARRIVED', "
            "'STOP_DELIVERED', 'STOP_FAILED', 'TRIP_COMPLETED')",
            name="event_type_allowed",
        ),
        CheckConstraint("entity_type IN ('TRIP', 'STOP', 'ORDER')", name="entity_type_allowed"),
        CheckConstraint("length(trim(device_id)) > 0", name="device_id_not_blank"),
        Index("ix_sync_events_trip_received", "trip_id", "received_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, unique=True)
    device_id: Mapped[str] = mapped_column(String(100), nullable=False)
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    trip_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("trips.id", ondelete="RESTRICT"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(String(16), nullable=False)
    entity_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    event_type: Mapped[str] = mapped_column(String(24), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
