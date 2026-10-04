from datetime import date, datetime
from decimal import Decimal
from typing import Self
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_serializer, model_validator

from app.loading.models import LoadStatus
from app.orders.models import OrderStatus, TemperatureRequirement
from app.planning.models import StopStatus, TripStatus


class LoadEventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    event_id: UUID
    order_id: UUID
    status: LoadStatus
    note: str | None = Field(default=None, max_length=500)
    occurred_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def exception_details(self) -> Self:
        if self.note is not None and not self.note.strip():
            raise ValueError("Note cannot be blank")
        if self.status != LoadStatus.LOADED and self.note is None:
            raise ValueError("Missing or damaged loading requires a note")
        return self


class TripReadyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    request_id: UUID
    last_event_sequence: int = Field(strict=True, ge=1)


class LoadEventResponse(BaseModel):
    event_id: UUID
    trip_id: UUID
    stop_id: UUID
    order_id: UUID
    status: LoadStatus
    note: str | None
    sequence_number: int
    occurred_at: datetime | None
    recorded_at: datetime
    recorded_by: UUID
    trip_status: TripStatus


class LoadingOrderResponse(BaseModel):
    order_id: UUID
    order_status: OrderStatus
    temperature_requirement: TemperatureRequirement
    order_weight_kg: Decimal
    order_volume_m3: Decimal
    load_status: LoadStatus | None
    note: str | None
    last_event_id: UUID | None

    @field_serializer("order_weight_kg", "order_volume_m3")
    def serialize_quantity(self, value: Decimal) -> str:
        return format(value, ".3f")


class LoadingStopResponse(BaseModel):
    stop_id: UUID
    outlet_id: UUID
    sequence_number: int
    status: StopStatus
    planned_arrival_time: datetime | None
    orders: list[LoadingOrderResponse]


class LoadingCompletionResponse(BaseModel):
    request_id: UUID
    last_event_sequence: int
    loaded_count: int
    missing_count: int
    damaged_count: int
    confirmed_by: UUID
    confirmed_at: datetime


class LoaderTripResponse(BaseModel):
    trip_id: UUID
    plan_id: UUID
    depot_id: UUID
    delivery_date: date
    vehicle_id: UUID
    trip_number: int
    driver_id: UUID | None
    status: TripStatus
    departure_at: datetime
    return_at: datetime
    stop_count: int
    order_count: int


class LoaderTripListResponse(BaseModel):
    items: list[LoaderTripResponse]
    total: int
    limit: int
    offset: int


class TripLoadingResponse(BaseModel):
    trip: LoaderTripResponse
    last_event_sequence: int
    loaded_count: int
    missing_count: int
    damaged_count: int
    pending_count: int
    stops: list[LoadingStopResponse]
    completion: LoadingCompletionResponse | None
