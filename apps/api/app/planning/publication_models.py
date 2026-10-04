"""Publication replay records and authoritative fuel reservations for published trips."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PlanPublication(Base):
    """One publication per plan; the referenced revision is the effective published one."""

    __tablename__ = "plan_publications"

    request_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    plan_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    plan_revision_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("plan_revisions.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    published_by: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    result_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class FuelReservation(Base):
    """Fuel committed by one published trip; consumed daily totals cover past days."""

    __tablename__ = "fuel_reservations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["trip_id", "vehicle_id"],
            ["trips.id", "trips.vehicle_id"],
            ondelete="RESTRICT",
            name="fk_fuel_reservations_trip_vehicle",
        ),
        CheckConstraint("fuel_l >= 0 AND fuel_l < 1000000000", name="fuel_l_range"),
        Index("ix_fuel_reservations_vehicle_service_date", "vehicle_id", "service_date"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    trip_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, unique=True)
    vehicle_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    service_date: Mapped[date] = mapped_column(Date, nullable=False)
    fuel_l: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
