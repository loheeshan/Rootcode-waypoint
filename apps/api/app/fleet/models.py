"""Fleet master data registered in app.db.models for Alembic.

Vehicle availability, fuel consumption records and planning constraints are separate work.
"""

from __future__ import annotations

from datetime import time
from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Numeric,
    String,
    Time,
    Uuid,
    false,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class VehicleType(StrEnum):
    VAN = "van"
    TRUCK = "truck"


class TemperatureType(StrEnum):
    AMBIENT = "ambient"
    REEFER = "reefer"


class ParkingConstraint(StrEnum):
    NONE = "none"
    VAN_ONLY = "van_only"


class Depot(Base):
    __tablename__ = "depots"
    __table_args__ = (CheckConstraint("length(trim(name)) > 0", name="name_not_blank"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    # RESTRICT keeps referenced master data intact, including when children are loaded.
    outlets: Mapped[list[Outlet]] = relationship(back_populates="depot", passive_deletes="all")
    vehicles: Mapped[list[Vehicle]] = relationship(back_populates="depot", passive_deletes="all")


class Outlet(Base):
    """Local Asia/Colombo clock times; close < open represents an overnight window.

    mall_window marks a mall restriction on the same delivery window. dock_type
    remains a required text label because the source docs do not define its values.
    """

    __tablename__ = "outlets"
    __table_args__ = (
        CheckConstraint("length(trim(brand)) > 0", name="brand_not_blank"),
        CheckConstraint("length(trim(district)) > 0", name="district_not_blank"),
        CheckConstraint("length(trim(dock_type)) > 0", name="dock_type_not_blank"),
        CheckConstraint(
            "parking_constraint IN ('none', 'van_only')", name="parking_constraint_allowed"
        ),
        CheckConstraint("window_open_time <> window_close_time", name="window_not_empty"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    brand: Mapped[str] = mapped_column(String(120), nullable=False)
    district: Mapped[str] = mapped_column(String(120), nullable=False)
    depot_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("depots.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    dock_type: Mapped[str] = mapped_column(String(64), nullable=False)
    parking_constraint: Mapped[str] = mapped_column(String(16), nullable=False)
    window_open_time: Mapped[time] = mapped_column(Time(timezone=False), nullable=False)
    window_close_time: Mapped[time] = mapped_column(Time(timezone=False), nullable=False)
    mall_window: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=false())

    depot: Mapped[Depot] = relationship(back_populates="outlets")


class Vehicle(Base):
    __tablename__ = "vehicles"
    __table_args__ = (
        CheckConstraint("type IN ('van', 'truck')", name="type_allowed"),
        CheckConstraint(
            "temperature_type IN ('ambient', 'reefer')", name="temperature_type_allowed"
        ),
        # Upper limits match Numeric precision and also reject PostgreSQL Numeric NaN.
        CheckConstraint(
            "weight_cap_kg > 0 AND weight_cap_kg < 1000000000", name="weight_cap_kg_range"
        ),
        CheckConstraint(
            "volume_cap_m3 > 0 AND volume_cap_m3 < 1000000000", name="volume_cap_m3_range"
        ),
        CheckConstraint("km_per_l > 0 AND km_per_l < 100000", name="km_per_l_range"),
        CheckConstraint(
            "weekly_fuel_quota_l >= 0 AND weekly_fuel_quota_l < 1000000000",
            name="weekly_fuel_quota_l_range",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    temperature_type: Mapped[str] = mapped_column(String(16), nullable=False)
    weight_cap_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    volume_cap_m3: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    km_per_l: Mapped[Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    weekly_fuel_quota_l: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    depot_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("depots.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    depot: Mapped[Depot] = relationship(back_populates="vehicles")
