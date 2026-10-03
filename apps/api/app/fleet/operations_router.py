from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.auth.models import RoleCode, User
from app.db.session import get_session
from app.fleet.operations_schemas import (
    AvailabilityWriteRequest,
    CalendarDate,
    FuelUsageWriteRequest,
    VehicleAvailabilityResponse,
    VehicleFuelUsageResponse,
)
from app.fleet.operations_service import (
    WriteCondition,
    etag,
    get_fleet_time,
    input_error,
    read_availability,
    read_fuel_usage,
    write_availability,
    write_condition,
    write_fuel_usage,
)

router = APIRouter(prefix="/fleet", tags=["fleet inputs"])
DispatcherUser = Annotated[User, Depends(require_roles(RoleCode.DISPATCHER))]
Database = Annotated[Session, Depends(get_session)]


def conditional_headers(
    if_match: Annotated[list[str] | None, Header()] = None,
    if_none_match: Annotated[list[str] | None, Header()] = None,
) -> WriteCondition:
    return write_condition(if_match, if_none_match)


Condition = Annotated[WriteCondition, Depends(conditional_headers)]


@contextmanager
def input_errors(session: Session) -> Iterator[None]:
    try:
        yield
    except IntegrityError:
        session.rollback()
        raise input_error(409, "Fleet input conflict; reload the record") from None
    except SQLAlchemyError:
        session.rollback()
        raise input_error(503, "Fleet inputs unavailable") from None
    except HTTPException:
        session.rollback()
        raise


@router.get(
    "/{vehicle_id}/availability/{availability_date}", response_model=VehicleAvailabilityResponse
)
def get_availability(
    vehicle_id: UUID,
    availability_date: CalendarDate,
    response: Response,
    user: DispatcherUser,
    session: Database,
) -> VehicleAvailabilityResponse:
    with input_errors(session):
        result = read_availability(session, user, vehicle_id, availability_date)
    response.headers["Cache-Control"] = "no-store"
    response.headers["ETag"] = etag(result)
    return result


@router.put(
    "/{vehicle_id}/availability/{availability_date}",
    response_model=VehicleAvailabilityResponse,
    responses={201: {"description": "Created", "model": VehicleAvailabilityResponse}},
)
def put_availability(
    vehicle_id: UUID,
    availability_date: CalendarDate,
    payload: AvailabilityWriteRequest,
    response: Response,
    user: DispatcherUser,
    session: Database,
    condition: Condition,
) -> VehicleAvailabilityResponse:
    with input_errors(session):
        result, created = write_availability(
            session,
            user,
            vehicle_id,
            availability_date,
            payload,
            condition,
        )
    response.status_code = 201 if created else 200
    response.headers["Cache-Control"] = "no-store"
    if created:
        response.headers["Location"] = (
            f"/api/v1/fleet/{vehicle_id}/availability/{availability_date}"
        )
    # The enriched representation differs from the PUT body. Obtain its ETag via GET.
    return result


@router.get("/{vehicle_id}/fuel-usage/{usage_date}", response_model=VehicleFuelUsageResponse)
def get_fuel_usage(
    vehicle_id: UUID,
    usage_date: CalendarDate,
    response: Response,
    user: DispatcherUser,
    session: Database,
) -> VehicleFuelUsageResponse:
    with input_errors(session):
        result = read_fuel_usage(session, user, vehicle_id, usage_date)
    response.headers["Cache-Control"] = "no-store"
    response.headers["ETag"] = etag(result)
    return result


@router.put(
    "/{vehicle_id}/fuel-usage/{usage_date}",
    response_model=VehicleFuelUsageResponse,
    responses={201: {"description": "Created", "model": VehicleFuelUsageResponse}},
)
def put_fuel_usage(
    vehicle_id: UUID,
    usage_date: CalendarDate,
    payload: FuelUsageWriteRequest,
    response: Response,
    user: DispatcherUser,
    session: Database,
    condition: Condition,
    now: Annotated[datetime, Depends(get_fleet_time)],
) -> VehicleFuelUsageResponse:
    with input_errors(session):
        result, created = write_fuel_usage(
            session,
            user,
            vehicle_id,
            usage_date,
            payload,
            condition,
            now,
        )
    response.status_code = 201 if created else 200
    response.headers["Cache-Control"] = "no-store"
    if created:
        response.headers["Location"] = f"/api/v1/fleet/{vehicle_id}/fuel-usage/{usage_date}"
    return result
