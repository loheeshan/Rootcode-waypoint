"""Planning storage. Authorization, publishing and allocation are separate services."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.auth.models import User
from app.db.base import Base
from app.fleet.models import Depot, Outlet, Vehicle


class PlanStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class TripStatus(StrEnum):
    PLANNED = "PLANNED"
    LOADING = "LOADING"
    READY = "READY"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class StopStatus(StrEnum):
    PLANNED = "PLANNED"
    ARRIVED = "ARRIVED"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


class Plan(Base):
    """One depot/day planning workspace; alternative allocations are revisions."""

    __tablename__ = "plans"
    __table_args__ = (
        UniqueConstraint("depot_id", "delivery_date", name="uq_plans_depot_delivery_date"),
        CheckConstraint("status IN ('DRAFT', 'PUBLISHED')", name="status_allowed"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    depot_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("depots.id", ondelete="RESTRICT"), nullable=False,
    )
    delivery_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=PlanStatus.DRAFT.value,
    )
    created_by: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    depot: Mapped[Depot] = relationship()
    creator: Mapped[User] = relationship()
    revisions: Mapped[list[PlanRevision]] = relationship(
        back_populates="plan", passive_deletes="all",
    )


class PlanRevision(Base):
    __tablename__ = "plan_revisions"
    __table_args__ = (
        UniqueConstraint("plan_id", "revision_number", name="uq_plan_revisions_plan_number"),
        CheckConstraint("revision_number > 0", name="revision_number_positive"),
        CheckConstraint("status IN ('DRAFT', 'PUBLISHED')", name="status_allowed"),
        CheckConstraint(
            "(status = 'DRAFT' AND published_at IS NULL) OR "
            "(status = 'PUBLISHED' AND published_at IS NOT NULL)", name="publication_consistent",
        ),
        # One effective published revision per plan; republication is not supported yet.
        Index("uq_plan_revisions_one_published", "plan_id", unique=True,
              postgresql_where=text("status = 'PUBLISHED'"),
              sqlite_where=text("status = 'PUBLISHED'")),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    plan_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False,
    )
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=PlanStatus.DRAFT.value,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    plan: Mapped[Plan] = relationship(back_populates="revisions")
    trips: Mapped[list[Trip]] = relationship(back_populates="revision", passive_deletes="all")


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        Index("uq_trips_id_revision", "id", "plan_revision_id", unique=True),
        Index("uq_trips_id_vehicle", "id", "vehicle_id", unique=True),
        UniqueConstraint("plan_revision_id", "vehicle_id", "trip_number",
                         name="uq_trips_revision_vehicle_number"),
        CheckConstraint("trip_number IN (1, 2)", name="trip_number_allowed"),
        CheckConstraint(
            "status IN ('PLANNED', 'LOADING', 'READY', 'IN_PROGRESS', 'COMPLETED')",
            name="status_allowed",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    plan_revision_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("plan_revisions.id", ondelete="RESTRICT"), nullable=False,
    )
    vehicle_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("vehicles.id", ondelete="RESTRICT"), nullable=False, index=True,
    )
    driver_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True, index=True,
    )
    trip_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=TripStatus.PLANNED.value,
    )

    revision: Mapped[PlanRevision] = relationship(back_populates="trips")
    vehicle: Mapped[Vehicle] = relationship()
    driver: Mapped[User | None] = relationship()
    stops: Mapped[list[TripStop]] = relationship(back_populates="trip", passive_deletes="all")


class TripStop(Base):
    __tablename__ = "trip_stops"
    __table_args__ = (
        Index("uq_trip_stops_id_trip_outlet", "id", "trip_id", "outlet_id", unique=True),
        UniqueConstraint("trip_id", "sequence_number", name="uq_trip_stops_trip_sequence"),
        UniqueConstraint("trip_id", "outlet_id", name="uq_trip_stops_trip_outlet"),
        CheckConstraint("sequence_number > 0", name="sequence_number_positive"),
        CheckConstraint("status IN ('PLANNED', 'ARRIVED', 'DELIVERED', 'FAILED')",
                        name="status_allowed"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    trip_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("trips.id", ondelete="RESTRICT"), nullable=False,
    )
    outlet_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("outlets.id", ondelete="RESTRICT"), nullable=False, index=True,
    )
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    planned_arrival_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=StopStatus.PLANNED.value,
    )

    trip: Mapped[Trip] = relationship(back_populates="stops")
    outlet: Mapped[Outlet] = relationship()
