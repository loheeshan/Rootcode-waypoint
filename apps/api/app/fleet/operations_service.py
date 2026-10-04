import hashlib
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User, UserDepot
from app.fleet.models import Vehicle
from app.fleet.operations_models import VehicleAvailability, VehicleFuelUsage
from app.fleet.operations_schemas import (
    AvailabilityWriteRequest,
    DailyInputResponse,
    FuelUsageWriteRequest,
    VehicleAvailabilityResponse,
    VehicleFuelUsageResponse,
)


def input_error(status: int, detail: str) -> HTTPException:
    return HTTPException(status_code=status, detail=detail, headers={"Cache-Control": "no-store"})


def get_fleet_time() -> datetime:
    return datetime.now(UTC)


def etag(response: DailyInputResponse) -> str:
    # A representation validator, not a monotonic version or audit history.
    return '"' + hashlib.sha256(response.model_dump_json().encode()).hexdigest() + '"'


@dataclass(frozen=True)
class WriteCondition:
    expected_tag: str | None  # None means create only (If-None-Match: *).

    def check(self, current: DailyInputResponse | None) -> None:
        if self.expected_tag is None:
            matches = current is None
        else:
            matches = current is not None and etag(current) == self.expected_tag
        if not matches:
            raise input_error(412, "Daily input changed; reload it before saving")


def write_condition(if_match: list[str] | None, if_none_match: list[str] | None) -> WriteCondition:
    if if_match is None and if_none_match is None:
        raise input_error(428, "Use If-None-Match: * to create or If-Match from GET to replace")
    if if_match is not None and if_none_match is not None:
        raise input_error(400, "Send exactly one conditional write header")
    if if_none_match is not None:
        if len(if_none_match) == 1 and if_none_match[0].strip() == "*":
            return WriteCondition(None)
        raise input_error(400, "If-None-Match must be *")
    if if_match is not None and len(if_match) == 1:
        value = if_match[0].strip()
        if re.fullmatch(r'"[0-9a-f]{64}"', value):
            return WriteCondition(value)
    raise input_error(400, "If-Match must be the single strong ETag returned by GET")


def require_vehicle(session: Session, user: User, vehicle_id: UUID, *, lock: bool = False) -> None:
    allowed = select(UserDepot.depot_id).where(UserDepot.user_id == user.id)
    query = select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.depot_id.in_(allowed))
    if lock:
        # PostgreSQL serializes creates/updates for this vehicle. Read the input AFTER
        # acquiring the lock, and retain it through the comparison/write/commit.
        query = query.with_for_update()
    if session.scalar(query) is None:
        raise input_error(404, "Vehicle not found")


def read_availability(
    session: Session,
    user: User,
    vehicle_id: UUID,
    day: date,
) -> VehicleAvailabilityResponse:
    require_vehicle(session, user, vehicle_id)
    row = session.scalar(
        select(VehicleAvailability).where(
            VehicleAvailability.vehicle_id == vehicle_id,
            VehicleAvailability.availability_date == day,
        )
    )
    if row is None:
        raise input_error(404, "Daily availability not recorded")
    return VehicleAvailabilityResponse.model_validate(row)


def read_fuel_usage(
    session: Session,
    user: User,
    vehicle_id: UUID,
    day: date,
) -> VehicleFuelUsageResponse:
    require_vehicle(session, user, vehicle_id)
    row = session.scalar(
        select(VehicleFuelUsage).where(
            VehicleFuelUsage.vehicle_id == vehicle_id,
            VehicleFuelUsage.usage_date == day,
        )
    )
    if row is None:
        raise input_error(404, "Daily fuel usage not recorded")
    return VehicleFuelUsageResponse.model_validate(row)


def write_availability(
    session: Session,
    user: User,
    vehicle_id: UUID,
    day: date,
    payload: AvailabilityWriteRequest,
    condition: WriteCondition,
) -> tuple[VehicleAvailabilityResponse, bool]:
    require_vehicle(session, user, vehicle_id, lock=True)
    row = session.scalar(
        select(VehicleAvailability).where(
            VehicleAvailability.vehicle_id == vehicle_id,
            VehicleAvailability.availability_date == day,
        )
    )
    created = row is None
    condition.check(VehicleAvailabilityResponse.model_validate(row) if row is not None else None)
    if row is None:
        row = VehicleAvailability(
            vehicle_id=vehicle_id, availability_date=day, is_available=payload.is_available
        )
        session.add(row)
    else:
        row.is_available = payload.is_available
    session.flush()
    result = VehicleAvailabilityResponse.model_validate(row)
    session.commit()
    return result, created


def write_fuel_usage(
    session: Session,
    user: User,
    vehicle_id: UUID,
    day: date,
    payload: FuelUsageWriteRequest,
    condition: WriteCondition,
    now: datetime,
) -> tuple[VehicleFuelUsageResponse, bool]:
    require_vehicle(session, user, vehicle_id, lock=True)
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Fleet clock must be timezone-aware")
    if day > now.astimezone(ZoneInfo("Asia/Colombo")).date():
        raise input_error(422, "Fuel usage date cannot be after today in Asia/Colombo")
    row = session.scalar(
        select(VehicleFuelUsage).where(
            VehicleFuelUsage.vehicle_id == vehicle_id,
            VehicleFuelUsage.usage_date == day,
        )
    )
    created = row is None
    condition.check(VehicleFuelUsageResponse.model_validate(row) if row is not None else None)
    if row is None:
        row = VehicleFuelUsage(
            vehicle_id=vehicle_id, usage_date=day, fuel_used_l=payload.fuel_used_l
        )
        session.add(row)
    else:
        row.fuel_used_l = payload.fuel_used_l
    session.flush()
    result = VehicleFuelUsageResponse.model_validate(row)
    session.commit()
    return result, created
