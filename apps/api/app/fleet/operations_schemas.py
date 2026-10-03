import re
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StrictBool,
    field_serializer,
    field_validator,
)


def iso_date(value: object) -> date:
    if not isinstance(value, str) or len(value) != 10:
        raise ValueError("Use a date in YYYY-MM-DD format")
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise ValueError("Use a date in YYYY-MM-DD format") from None
    if parsed.isoformat() != value:
        raise ValueError("Use a date in YYYY-MM-DD format")
    return parsed


CalendarDate = Annotated[date, BeforeValidator(iso_date)]


class AvailabilityWriteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_available: StrictBool


class FuelUsageWriteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fuel_used_l: Annotated[
        Decimal,
        Field(ge=0, lt=1_000_000_000, max_digits=12, decimal_places=3, allow_inf_nan=False),
    ]

    @field_validator("fuel_used_l", mode="before", json_schema_input_type=str)
    @classmethod
    def require_decimal_string(cls, value: object) -> object:
        if not isinstance(value, str) or re.fullmatch(r"[0-9]+(?:\.[0-9]{1,3})?", value) is None:
            raise ValueError("Use a nonnegative decimal string with at most three decimal places")
        return value


class DailyInputResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    vehicle_id: UUID
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def normalize_utc(cls, value: datetime) -> datetime:
        # SQLite's database-time default is naive UTC; PostgreSQL retains its zone.
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class VehicleAvailabilityResponse(DailyInputResponse):
    availability_date: date
    is_available: bool


class VehicleFuelUsageResponse(DailyInputResponse):
    usage_date: date
    fuel_used_l: Decimal

    @field_serializer("fuel_used_l")
    def serialize_fuel(self, value: Decimal) -> str:
        return format(value, ".3f")
