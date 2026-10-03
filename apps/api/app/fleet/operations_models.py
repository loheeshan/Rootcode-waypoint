"""Daily fleet inputs; absent records are unknown, never implicit availability/zero fuel."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.fleet.models import Vehicle


class VehicleAvailability(Base):
    """Explicit availability for the whole Asia/Colombo calendar day."""

    __tablename__ = "vehicle_availability"
    __table_args__ = (
        UniqueConstraint(
            "vehicle_id", "availability_date", name="uq_vehicle_availability_vehicle_date"
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    vehicle_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("vehicles.id", ondelete="RESTRICT"), nullable=False
    )
    availability_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_available: Mapped[bool] = mapped_column(
        Boolean(create_constraint=True, name="is_available_boolean"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # No parent collection/cascade: deleting a referenced vehicle must reach RESTRICT.
    vehicle: Mapped[Vehicle] = relationship()


class VehicleFuelUsage(Base):
    """One authoritative consumed-fuel total per local day, not a trip/event ledger."""

    __tablename__ = "vehicle_fuel_usage"
    __table_args__ = (
        UniqueConstraint("vehicle_id", "usage_date", name="uq_vehicle_fuel_usage_vehicle_date"),
        CheckConstraint("fuel_used_l >= 0 AND fuel_used_l < 1000000000", name="fuel_used_l_range"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    vehicle_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("vehicles.id", ondelete="RESTRICT"), nullable=False
    )
    usage_date: Mapped[date] = mapped_column(Date, nullable=False)
    fuel_used_l: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    vehicle: Mapped[Vehicle] = relationship()
