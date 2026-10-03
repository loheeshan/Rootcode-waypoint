"""One canonical planning outcome per order/revision; no publication workflow yet."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.orders.models import Order
from app.planning.models import PlanRevision, Trip, TripStop


class AssignmentOutcome(StrEnum):
    SERVED = "SERVED"
    DEFERRED = "DEFERRED"


class DeferralReason(StrEnum):
    NO_COMPATIBLE_VEHICLE = "NO_COMPATIBLE_VEHICLE"
    REEFER_CAPACITY_EXHAUSTED = "REEFER_CAPACITY_EXHAUSTED"
    VAN_CAPACITY_EXHAUSTED = "VAN_CAPACITY_EXHAUSTED"
    WEIGHT_CAPACITY = "WEIGHT_CAPACITY"
    VOLUME_CAPACITY = "VOLUME_CAPACITY"
    TIME_WINDOW = "TIME_WINDOW"
    FUEL_QUOTA = "FUEL_QUOTA"
    VEHICLE_UNAVAILABLE = "VEHICLE_UNAVAILABLE"
    TRIP_LIMIT = "TRIP_LIMIT"


class PlanAssignment(Base):
    __tablename__ = "plan_assignments"
    __table_args__ = (
        UniqueConstraint("plan_revision_id", "order_id", name="uq_plan_assignments_revision_order"),
        UniqueConstraint("plan_revision_id", "order_id", "outcome",
                         name="uq_plan_assignments_revision_order_outcome"),
        CheckConstraint("outcome IN ('SERVED', 'DEFERRED')", name="outcome_allowed"),
        CheckConstraint(
            "(outcome = 'SERVED' AND trip_id IS NOT NULL AND trip_stop_id IS NOT NULL) OR "
            "(outcome = 'DEFERRED' AND trip_id IS NULL AND trip_stop_id IS NULL)",
            name="outcome_route_consistent",
        ),
        ForeignKeyConstraint(["order_id", "outlet_id"], ["orders.id", "orders.outlet_id"],
                             ondelete="RESTRICT", name="fk_plan_assignments_order_outlet"),
        ForeignKeyConstraint(["trip_id", "plan_revision_id"],
                             ["trips.id", "trips.plan_revision_id"], ondelete="RESTRICT",
                             name="fk_plan_assignments_trip_revision"),
        ForeignKeyConstraint(["trip_stop_id", "trip_id", "outlet_id"],
                             ["trip_stops.id", "trip_stops.trip_id", "trip_stops.outlet_id"],
                             ondelete="RESTRICT", name="fk_plan_assignments_stop_trip_outlet"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    plan_revision_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("plan_revisions.id", ondelete="RESTRICT"), nullable=False,
    )
    order_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    outlet_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    trip_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    trip_stop_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    # Set explicit IDs when writing outcomes. View-only joins avoid competing
    # relationship synchronization of shared revision, trip and outlet columns.
    revision: Mapped[PlanRevision] = relationship(viewonly=True)
    order: Mapped[Order] = relationship(viewonly=True)
    trip: Mapped[Trip | None] = relationship(viewonly=True)
    stop: Mapped[TripStop | None] = relationship(viewonly=True)
    deferral: Mapped[DeferralDecision | None] = relationship(
        back_populates="assignment", passive_deletes="all", uselist=False,
    )


class DeferralDecision(Base):
    __tablename__ = "deferral_decisions"
    __table_args__ = (
        UniqueConstraint("plan_revision_id", "order_id",
                         name="uq_deferral_decisions_revision_order"),
        ForeignKeyConstraint(["plan_revision_id", "order_id", "assignment_outcome"],
                             ["plan_assignments.plan_revision_id", "plan_assignments.order_id",
                              "plan_assignments.outcome"], ondelete="RESTRICT",
                             name="fk_deferral_decisions_deferred_assignment"),
        CheckConstraint("assignment_outcome = 'DEFERRED'", name="deferred_only"),
        CheckConstraint(
            "reason_code IN ('NO_COMPATIBLE_VEHICLE', 'REEFER_CAPACITY_EXHAUSTED', "
            "'VAN_CAPACITY_EXHAUSTED', 'WEIGHT_CAPACITY', 'VOLUME_CAPACITY', 'TIME_WINDOW', "
            "'FUEL_QUOTA', 'VEHICLE_UNAVAILABLE', 'TRIP_LIMIT')", name="reason_code_allowed",
        ),
        CheckConstraint("length(trim(reason_text, ' \t\n\r')) > 0", name="reason_text_not_blank"),
        CheckConstraint("length(reason_text) <= 1000", name="reason_text_length"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    plan_revision_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    order_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    assignment_outcome: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=AssignmentOutcome.DEFERRED.value,
    )
    reason_code: Mapped[str] = mapped_column(String(32), nullable=False)
    reason_text: Mapped[str] = mapped_column(String(1000), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    assignment: Mapped[PlanAssignment] = relationship(back_populates="deferral")
