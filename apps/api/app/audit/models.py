"""Append-only audit history of operational mutations, written with the domain change."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditAction(StrEnum):
    PLAN_PUBLISHED = "PLAN_PUBLISHED"
    LOAD_RECORDED = "LOAD_RECORDED"
    TRIP_READY = "TRIP_READY"
    TRIP_STARTED = "TRIP_STARTED"
    STOP_ARRIVED = "STOP_ARRIVED"
    POD_UPLOADED = "POD_UPLOADED"
    STOP_DELIVERED = "STOP_DELIVERED"
    STOP_FAILED = "STOP_FAILED"
    TRIP_COMPLETED = "TRIP_COMPLETED"
    RECEIPT_CONFIRMED = "RECEIPT_CONFIRMED"
    SYNC_CONFLICT = "SYNC_CONFLICT"


class AuditEntity(StrEnum):
    PLAN = "PLAN"
    TRIP = "TRIP"
    STOP = "STOP"
    ORDER = "ORDER"


ACTIONS_SQL = ", ".join(f"'{action}'" for action in AuditAction)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        CheckConstraint(f"action IN ({ACTIONS_SQL})", name="action_allowed"),
        CheckConstraint(
            "entity_type IN ('PLAN', 'TRIP', 'STOP', 'ORDER')", name="entity_type_allowed"
        ),
        Index("ix_audit_events_depot_occurred", "depot_id", "occurred_at"),
        Index("ix_audit_events_entity", "entity_type", "entity_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actor_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(16), nullable=False)
    entity_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    depot_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("depots.id", ondelete="RESTRICT"), nullable=False
    )
    trip_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("trips.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    # The domain record that caused this entry (event, POD, receipt or publication ID).
    source_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    # Unique per action/source so idempotent replays can never add a second entry.
    dedupe_key: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
