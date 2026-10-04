"""Validated import format for static travel and operational planning snapshots."""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Annotated, Self
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    field_validator,
    model_validator,
)

LOCAL_ZONE = ZoneInfo("Asia/Colombo")
Amount = Annotated[
    Decimal, Field(ge=0, lt=1_000_000_000, max_digits=12, decimal_places=3, allow_inf_nan=False)
]
Efficiency = Annotated[
    Decimal, Field(gt=0, lt=100_000, max_digits=8, decimal_places=3, allow_inf_nan=False)
]
Distance = Annotated[
    Decimal, Field(ge=0, lt=1_000_000, max_digits=9, decimal_places=3, allow_inf_nan=False)
]
Seconds = Annotated[int, Field(strict=True, ge=0, le=172_800)]


class SnapshotModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class TravelLeg(SnapshotModel):
    # null represents the depot; UUIDs represent outlets, avoiding mixed-table IDs.
    from_outlet_id: UUID | None
    to_outlet_id: UUID | None
    distance_km: Distance
    travel_seconds: Seconds

    @model_validator(mode="after")
    def distinct_endpoints(self) -> Self:
        if self.from_outlet_id == self.to_outlet_id:
            raise ValueError("Travel legs require distinct endpoints")
        if self.distance_km > 0 and self.travel_seconds == 0:
            raise ValueError("Positive distance requires positive travel time")
        return self


class RouteOutlet(SnapshotModel):
    outlet_id: UUID
    window_open: time
    window_close: time
    service_seconds: Seconds

    @field_validator("window_open", "window_close")
    @classmethod
    def local_clock(cls, value: time) -> time:
        if value.tzinfo is not None:
            raise ValueError("Outlet windows must be local Colombo clock times without offsets")
        return value

    @model_validator(mode="after")
    def distinct_window(self) -> Self:
        if self.window_open == self.window_close:
            raise ValueError("Equal window endpoints are not a 24-hour window")
        return self


class RouteOrder(SnapshotModel):
    order_id: UUID
    outlet_id: UUID


class VehicleRouteInput(SnapshotModel):
    vehicle_id: UUID
    earliest_departure: AwareDatetime
    latest_return: AwareDatetime
    turnaround_seconds: Seconds
    available_dates: tuple[date, ...] = Field(max_length=2)
    km_per_l: Efficiency
    fuel_week_start: date
    weekly_fuel_quota_l: Amount
    # Explicit null means unknown; it must never silently become zero.
    fuel_used_l: Amount | None
    fuel_reserved_l: Amount | None

    @model_validator(mode="after")
    def ordered_times(self) -> Self:
        if self.latest_return <= self.earliest_departure:
            raise ValueError("Latest return must be after earliest departure")
        if len(set(self.available_dates)) != len(self.available_dates):
            raise ValueError("Duplicate availability date")
        return self


class RouteInputs(SnapshotModel):
    depot_id: UUID
    delivery_date: date
    source: str = Field(min_length=1, max_length=200)
    is_synthetic: StrictBool
    outlets: tuple[RouteOutlet, ...] = Field(max_length=500)
    orders: tuple[RouteOrder, ...] = Field(max_length=500)
    vehicles: tuple[VehicleRouteInput, ...] = Field(max_length=500)
    legs: tuple[TravelLeg, ...] = Field(max_length=50_000)

    @field_validator("source")
    @classmethod
    def source_label(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Travel input source must be identified")
        return value.strip()

    @model_validator(mode="after")
    def consistent_snapshot(self) -> Self:
        if self.delivery_date > date(9999, 12, 24):
            raise ValueError("Plan date must leave room for a complete fuel week")
        outlet_ids = {item.outlet_id for item in self.outlets}
        if len(outlet_ids) != len(self.outlets):
            raise ValueError("Duplicate outlet ID")
        if len({item.order_id for item in self.orders}) != len(self.orders):
            raise ValueError("Duplicate order ID")
        if len({item.vehicle_id for item in self.vehicles}) != len(self.vehicles):
            raise ValueError("Duplicate vehicle ID")
        if any(item.outlet_id not in outlet_ids for item in self.orders):
            raise ValueError("Order references an unknown outlet")
        pairs = {(leg.from_outlet_id, leg.to_outlet_id) for leg in self.legs}
        if len(pairs) != len(self.legs):
            raise ValueError("Duplicate directed travel leg")
        if any(point not in outlet_ids | {None} for pair in pairs for point in pair):
            raise ValueError("Travel leg references an unknown outlet")
        next_day = self.delivery_date + timedelta(days=1)
        horizon = datetime.combine(next_day + timedelta(days=1), time.min, LOCAL_ZONE)
        week_start = self.delivery_date - timedelta(days=self.delivery_date.weekday())
        week_end = datetime.combine(week_start + timedelta(days=7), time.min, LOCAL_ZONE)
        for vehicle in self.vehicles:
            if vehicle.earliest_departure.astimezone(LOCAL_ZONE).date() != self.delivery_date:
                raise ValueError("Vehicle departure must be on the plan date in Colombo")
            if vehicle.latest_return > horizon:
                raise ValueError("Route horizon cannot exceed the following local day")
            if vehicle.fuel_week_start != week_start:
                raise ValueError("Fuel snapshot must cover the plan's Monday-Sunday week")
            if vehicle.latest_return > week_end:
                raise ValueError("Routes spanning fuel weeks need separate budgets; unsupported")
            if set(vehicle.available_dates) - {self.delivery_date, next_day}:
                raise ValueError("Availability must refer to the plan date or following day")
        return self


def load_route_inputs(path: str) -> RouteInputs:
    """Import an explicit JSON snapshot; does not update database or fleet state."""
    from pathlib import Path

    with Path(path).open("rb") as source:
        payload = source.read(10_000_001)
    if len(payload) > 10_000_000:
        raise ValueError("Route input file exceeds 10 MB")
    return RouteInputs.model_validate_json(payload)
