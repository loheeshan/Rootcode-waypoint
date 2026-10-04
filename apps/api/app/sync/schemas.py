from datetime import datetime
from enum import StrEnum
from typing import Any, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.sync.models import SyncEventType

STOP_EVENTS = {
    SyncEventType.STOP_ARRIVED,
    SyncEventType.STOP_DELIVERED,
    SyncEventType.STOP_FAILED,
}
MAX_BATCH = 50


class SyncOutcome(StrEnum):
    APPLIED = "APPLIED"
    DUPLICATE = "DUPLICATE"
    REJECTED = "REJECTED"
    CONFLICT = "CONFLICT"
    RETRY = "RETRY"
    SKIPPED = "SKIPPED"


class SyncEventIn(BaseModel):
    """Envelope; `payload` is validated by the matching domain request model."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    event_id: UUID
    type: SyncEventType
    trip_id: UUID
    stop_id: UUID | None = None
    payload: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def stop_scope(self) -> Self:
        if (self.type in STOP_EVENTS) != (self.stop_id is not None):
            raise ValueError("stop_id is required for stop events and not allowed otherwise")
        return self


class SyncBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    device_id: str = Field(min_length=1, max_length=100)
    # Items are validated one by one so a malformed event does not reject the batch.
    events: list[Any] = Field(min_length=1, max_length=MAX_BATCH)

    @model_validator(mode="after")
    def device_present(self) -> Self:
        if not self.device_id.strip():
            raise ValueError("device_id is required")
        return self


class SyncEventResult(BaseModel):
    index: int
    event_id: UUID | None
    type: SyncEventType | None
    trip_id: UUID | None
    outcome: SyncOutcome
    http_status: int
    detail: str | None
    result: dict[str, Any] | None


class SyncBatchResponse(BaseModel):
    device_id: str
    received_at: datetime
    results: list[SyncEventResult]
    counts: dict[SyncOutcome, int]
