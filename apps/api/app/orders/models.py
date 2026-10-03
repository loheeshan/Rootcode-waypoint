"""Order storage registered in app.db.models for Alembic.

Submission and cutoff handling live in service.py; later status transitions are separate work.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.fleet.models import Outlet


class TemperatureRequirement(StrEnum):
    AMBIENT = "ambient"
    CHILLED = "chilled"


class OrderStatus(StrEnum):
    CONFIRMED = "CONFIRMED"
    PLANNED = "PLANNED"
    DEFERRED = "DEFERRED"
    LOADING = "LOADING"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    RECEIPT_CONFIRMED = "RECEIPT_CONFIRMED"


class Order(Base):
    """Store the accepted delivery date after the Asia/Colombo submission cutoff."""

    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "temperature_requirement IN ('ambient', 'chilled')",
            name="temperature_requirement_allowed",
        ),
        # Match fleet precision and reject PostgreSQL Numeric NaN as well as overflow.
        CheckConstraint(
            "order_weight_kg > 0 AND order_weight_kg < 1000000000",
            name="order_weight_kg_range",
        ),
        CheckConstraint(
            "order_volume_m3 > 0 AND order_volume_m3 < 1000000000",
            name="order_volume_m3_range",
        ),
        CheckConstraint(
            "status IN ('CONFIRMED', 'PLANNED', 'DEFERRED', 'LOADING', "
            "'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIPT_CONFIRMED')",
            name="status_allowed",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    outlet_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("outlets.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    requested_delivery_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    temperature_requirement: Mapped[str] = mapped_column(String(16), nullable=False)
    order_weight_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    order_volume_m3: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default=OrderStatus.CONFIRMED.value
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    outlet: Mapped[Outlet] = relationship()
