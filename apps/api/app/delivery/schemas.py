from datetime import datetime, time
from decimal import Decimal
from typing import Self
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_serializer, model_validator

from app.delivery.models import MAX_POD_BYTES, DeliveryEventType, DeliveryFailureReason, PodMimeType
from app.loading.models import LoadStatus
from app.loading.schemas import LoaderTripResponse
from app.orders.models import OrderStatus, TemperatureRequirement
from app.planning.models import StopStatus, TripStatus

# Base64 of MAX_POD_BYTES, rounded up to whole 4-character groups.
MAX_POD_BASE64 = -(-MAX_POD_BYTES // 3) * 4


class EventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    event_id: UUID
    occurred_at: AwareDatetime | None = None


class DeliverRequest(EventRequest):
    pod_id: UUID


class FailRequest(EventRequest):
    reason_code: DeliveryFailureReason
    note: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def note_present(self) -> Self:
        if not self.note.strip():
            raise ValueError("A failure note is required")
        return self


class PodUploadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    pod_id: UUID
    receiver_name: str = Field(min_length=1, max_length=120)
    photo_mime_type: PodMimeType
    photo_base64: str = Field(min_length=4, max_length=MAX_POD_BASE64)
    captured_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def receiver_present(self) -> Self:
        if not self.receiver_name.strip():
            raise ValueError("Receiver name is required")
        return self


class DriverTripResponse(LoaderTripResponse):
    pass


class DriverTripListResponse(BaseModel):
    items: list[DriverTripResponse]
    total: int
    limit: int
    offset: int


class PodResponse(BaseModel):
    pod_id: UUID
    trip_id: UUID
    stop_id: UUID
    receiver_name: str
    photo_mime_type: PodMimeType
    photo_size_bytes: int
    photo_sha256: str
    captured_at: datetime | None
    uploaded_at: datetime
    uploaded_by: UUID


class DriverOrderResponse(BaseModel):
    order_id: UUID
    order_status: OrderStatus
    temperature_requirement: TemperatureRequirement
    order_weight_kg: Decimal
    order_volume_m3: Decimal
    load_status: LoadStatus | None
    deliverable: bool

    @field_serializer("order_weight_kg", "order_volume_m3")
    def serialize_quantity(self, value: Decimal) -> str:
        return format(value, ".3f")


class DriverStopResponse(BaseModel):
    stop_id: UUID
    outlet_id: UUID
    outlet_brand: str
    outlet_district: str
    window_open_time: time
    window_close_time: time
    sequence_number: int
    status: StopStatus
    planned_arrival_time: datetime | None
    requires_visit: bool
    arrived_at: datetime | None
    outcome_at: datetime | None
    failure_reason: DeliveryFailureReason | None
    failure_note: str | None
    pod: PodResponse | None
    orders: list[DriverOrderResponse]


class DriverTripDetailResponse(BaseModel):
    trip: DriverTripResponse
    last_event_sequence: int
    started_at: datetime | None
    completed_at: datetime | None
    stops: list[DriverStopResponse]


class DeliveryEventResponse(BaseModel):
    event_id: UUID
    trip_id: UUID
    stop_id: UUID | None
    event_type: DeliveryEventType
    reason_code: DeliveryFailureReason | None
    note: str | None
    pod_id: UUID | None
    sequence_number: int
    occurred_at: datetime | None
    recorded_at: datetime
    recorded_by: UUID
    trip_status: TripStatus
    stop_status: StopStatus | None
