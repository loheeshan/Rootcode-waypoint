from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, StrictBool, model_validator

from app.planning.assignment_models import DeferralReason
from app.planning.route_inputs import Seconds, SnapshotModel, TravelLeg
from app.planning.routing import ScheduledTrip


class ServiceInput(SnapshotModel):
    outlet_id: UUID
    service_seconds: Seconds


class ShiftInput(SnapshotModel):
    vehicle_id: UUID
    earliest_departure: AwareDatetime
    latest_return: AwareDatetime
    turnaround_seconds: Seconds


class OptimizeRequest(SnapshotModel):
    request_id: UUID
    source: str = Field(min_length=1, max_length=200)
    is_synthetic: StrictBool
    services: tuple[ServiceInput, ...] = Field(max_length=100)
    shifts: tuple[ShiftInput, ...] = Field(max_length=20)
    legs: tuple[TravelLeg, ...] = Field(max_length=10_100)

    @model_validator(mode="after")
    def unique_inputs(self) -> "OptimizeRequest":
        if not self.source.strip():
            raise ValueError("A travel data source is required")
        if len({item.outlet_id for item in self.services}) != len(self.services):
            raise ValueError("Duplicate service outlet")
        if len({item.vehicle_id for item in self.shifts}) != len(self.shifts):
            raise ValueError("Duplicate vehicle shift")
        if len({(leg.from_outlet_id, leg.to_outlet_id) for leg in self.legs}) != len(self.legs):
            raise ValueError("Duplicate travel leg")
        return self


class DeferredOrderResponse(BaseModel):
    order_id: UUID
    outlet_id: UUID
    reason_code: DeferralReason
    reason_text: str


class SavedStopResponse(BaseModel):
    id: UUID
    outlet_id: UUID
    sequence_number: int
    order_ids: tuple[UUID, ...]
    arrival_at: datetime
    service_start_at: datetime
    departure_at: datetime


class SavedTripResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    trip_number: int
    departure_at: datetime
    return_at: datetime
    distance_km: str
    fuel_l: str
    stops: list[SavedStopResponse]

    @classmethod
    def from_schedule(
        cls, identifier: UUID, trip: ScheduledTrip, stops: list[SavedStopResponse]
    ) -> "SavedTripResponse":
        return cls(
            id=identifier,
            vehicle_id=trip.vehicle_id,
            trip_number=trip.trip_number,
            departure_at=trip.departure_at,
            return_at=trip.return_at,
            distance_km=format(trip.distance_km, ".3f"),
            fuel_l=format(trip.fuel_l, ".3f"),
            stops=stops,
        )


class OptimizationResponse(BaseModel):
    request_id: UUID
    plan_id: UUID
    revision_id: UUID
    revision_number: int
    created_at: datetime
    source: str
    is_synthetic: bool
    validation: Literal["VALIDATED_SNAPSHOT"] = "VALIDATED_SNAPSHOT"
    publishable: Literal[False] = False
    algorithm: Literal["capacity_then_bounded_insertion"] = "capacity_then_bounded_insertion"
    eligible_order_count: int
    trips: list[SavedTripResponse]
    deferrals: list[DeferredOrderResponse]
