from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.planning.route_inputs import SnapshotModel


class DriverAssignmentInput(SnapshotModel):
    trip_id: UUID
    driver_id: UUID


class PublishRequest(SnapshotModel):
    request_id: UUID
    driver_assignments: tuple[DriverAssignmentInput, ...] = Field(max_length=40)

    @model_validator(mode="after")
    def unique_trips(self) -> "PublishRequest":
        trips = [item.trip_id for item in self.driver_assignments]
        if len(set(trips)) != len(trips):
            raise ValueError("Duplicate trip assignment")
        return self


class PublishedTripResponse(BaseModel):
    trip_id: UUID
    vehicle_id: UUID
    trip_number: int
    driver_id: UUID
    departure_at: datetime
    return_at: datetime
    fuel_l: str


class FuelBalanceResponse(BaseModel):
    vehicle_id: UUID
    week_start: date
    weekly_quota_l: str
    consumed_l: str
    reserved_l: str
    remaining_l: str


class PublicationResponse(BaseModel):
    request_id: UUID
    plan_id: UUID
    revision_id: UUID
    revision_number: int
    published_at: datetime
    published_by: UUID
    validation: Literal["REVALIDATED_AT_PUBLISH"] = "REVALIDATED_AT_PUBLISH"
    served_order_count: int
    deferred_order_count: int
    trips: list[PublishedTripResponse]
    fuel_balances: list[FuelBalanceResponse]
