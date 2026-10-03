from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.orders.models import Order, OrderStatus, TemperatureRequirement

Quantity = Annotated[
    Decimal, Field(gt=0, lt=1_000_000_000, max_digits=12, decimal_places=3, allow_inf_nan=False),
]


class OrderCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outlet_id: UUID
    requested_delivery_date: date
    temperature_requirement: TemperatureRequirement
    order_weight_kg: Quantity
    order_volume_m3: Quantity

    @field_validator("requested_delivery_date", mode="before")
    @classmethod
    def require_iso_date(cls, value: object) -> object:
        if not isinstance(value, str) or len(value) != 10:
            raise ValueError("Use a delivery date in YYYY-MM-DD format")
        try:
            parsed = date.fromisoformat(value)
        except ValueError:
            raise ValueError("Use a delivery date in YYYY-MM-DD format") from None
        if parsed.isoformat() != value:
            raise ValueError("Use a delivery date in YYYY-MM-DD format")
        return parsed


class OrderResponse(BaseModel):
    id: UUID
    outlet_id: UUID
    requested_delivery_date: date
    temperature_requirement: TemperatureRequirement
    order_weight_kg: Decimal
    order_volume_m3: Decimal
    status: OrderStatus
    created_at: datetime

    @field_serializer("order_weight_kg", "order_volume_m3")
    def serialize_quantity(self, value: Decimal) -> str:
        return format(value, ".3f")

    @classmethod
    def from_order(cls, order: Order) -> "OrderResponse":
        created_at = order.created_at
        # SQLite's CURRENT_TIMESTAMP is UTC but has no timezone metadata.
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=UTC)
        return cls(
            id=order.id, outlet_id=order.outlet_id,
            requested_delivery_date=order.requested_delivery_date,
            temperature_requirement=TemperatureRequirement(order.temperature_requirement),
            order_weight_kg=order.order_weight_kg, order_volume_m3=order.order_volume_m3,
            status=OrderStatus(order.status), created_at=created_at.astimezone(UTC),
        )


class OrderCreateResponse(BaseModel):
    order: OrderResponse
    submitted_delivery_date: date
    cutoff_applied: bool


class OrderListResponse(BaseModel):
    items: list[OrderResponse]
    total: int
    limit: int
    offset: int
