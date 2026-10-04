from collections.abc import Callable
from datetime import date, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.auth.models import RoleCode, User
from app.db.session import get_session
from app.delivery.schemas import (
    DeliverRequest,
    DeliveryEventResponse,
    DriverTripDetailResponse,
    DriverTripListResponse,
    EventRequest,
    FailRequest,
    PodResponse,
    PodUploadRequest,
)
from app.delivery.service import (
    arrive_at_stop,
    complete_trip,
    deliver_stop,
    fail_stop,
    get_delivery_time,
    get_driver_trip,
    list_driver_trips,
    read_pod,
    start_trip,
    upload_pod,
)
from app.planning.models import TripStatus

router = APIRouter(tags=["delivery"])
DriverUser = Annotated[User, Depends(require_roles(RoleCode.DRIVER))]
PodReader = Annotated[User, Depends(require_roles(RoleCode.DRIVER, RoleCode.DISPATCHER))]
Database = Annotated[Session, Depends(get_session)]
Clock = Annotated[datetime, Depends(get_delivery_time)]
NO_STORE = {"Cache-Control": "no-store"}
REPLAY: dict[int | str, dict[str, Any]] = {200: {"description": "Saved request replay"}}


def _write[T](session: Session, response: Response, action: Callable[[], tuple[T, bool]]) -> T:
    """Shared rollback/error mapping for every Driver write."""
    try:
        result, created = action()
    except HTTPException:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            409, "Delivery conflict; reload the trip before sending another request", NO_STORE
        ) from None
    except (SQLAlchemyError, ValueError):
        session.rollback()
        raise HTTPException(503, "Delivery unavailable; retry with the same ID", NO_STORE) from None
    response.status_code = 201 if created else 200
    response.headers["Cache-Control"] = "no-store"
    return result


def _read[T](response: Response, action: Callable[[], T]) -> T:
    try:
        result = action()
    except (SQLAlchemyError, ValueError):
        raise HTTPException(503, "Delivery unavailable", NO_STORE) from None
    response.headers["Cache-Control"] = "no-store"
    return result


@router.get("/driver/trips", response_model=DriverTripListResponse)
def get_driver_trips(
    response: Response,
    user: DriverUser,
    session: Database,
    delivery_date: date | None = None,
    status: TripStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> DriverTripListResponse:
    return _read(
        response,
        lambda: list_driver_trips(
            session, user, delivery_date=delivery_date, status=status, limit=limit, offset=offset
        ),
    )


@router.get("/trips/{trip_id}", response_model=DriverTripDetailResponse)
def get_trip(
    trip_id: UUID, response: Response, user: DriverUser, session: Database
) -> DriverTripDetailResponse:
    return _read(response, lambda: get_driver_trip(session, user, trip_id))


@router.post(
    "/trips/{trip_id}/start",
    response_model=DeliveryEventResponse,
    status_code=201,
    responses=REPLAY,
)
def post_start(
    trip_id: UUID,
    payload: EventRequest,
    response: Response,
    user: DriverUser,
    session: Database,
    now: Clock,
) -> DeliveryEventResponse:
    return _write(session, response, lambda: start_trip(session, user, trip_id, payload, now))


@router.post(
    "/trips/{trip_id}/stops/{stop_id}/arrive",
    response_model=DeliveryEventResponse,
    status_code=201,
    responses=REPLAY,
)
def post_arrive(
    trip_id: UUID,
    stop_id: UUID,
    payload: EventRequest,
    response: Response,
    user: DriverUser,
    session: Database,
    now: Clock,
) -> DeliveryEventResponse:
    return _write(
        session, response, lambda: arrive_at_stop(session, user, trip_id, stop_id, payload, now)
    )


@router.post(
    "/trips/{trip_id}/stops/{stop_id}/pod",
    response_model=PodResponse,
    status_code=201,
    responses=REPLAY,
)
def post_pod(
    trip_id: UUID,
    stop_id: UUID,
    payload: PodUploadRequest,
    response: Response,
    user: DriverUser,
    session: Database,
    now: Clock,
) -> PodResponse:
    return _write(
        session, response, lambda: upload_pod(session, user, trip_id, stop_id, payload, now)
    )


@router.get(
    "/trips/{trip_id}/stops/{stop_id}/pod",
    response_class=Response,
    responses={200: {"content": {"image/jpeg": {}, "image/png": {}}}},
)
def get_pod(trip_id: UUID, stop_id: UUID, user: PodReader, session: Database) -> Response:
    try:
        pod = read_pod(session, user, trip_id, stop_id)
    except SQLAlchemyError:
        raise HTTPException(503, "Delivery unavailable", NO_STORE) from None
    extension = "png" if pod.photo_mime_type == "image/png" else "jpg"
    return Response(
        content=pod.photo_bytes,
        media_type=pod.photo_mime_type,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'inline; filename="pod-{pod.id}.{extension}"',
        },
    )


@router.post(
    "/trips/{trip_id}/stops/{stop_id}/deliver",
    response_model=DeliveryEventResponse,
    status_code=201,
    responses=REPLAY,
)
def post_deliver(
    trip_id: UUID,
    stop_id: UUID,
    payload: DeliverRequest,
    response: Response,
    user: DriverUser,
    session: Database,
    now: Clock,
) -> DeliveryEventResponse:
    return _write(
        session, response, lambda: deliver_stop(session, user, trip_id, stop_id, payload, now)
    )


@router.post(
    "/trips/{trip_id}/stops/{stop_id}/fail",
    response_model=DeliveryEventResponse,
    status_code=201,
    responses=REPLAY,
)
def post_fail(
    trip_id: UUID,
    stop_id: UUID,
    payload: FailRequest,
    response: Response,
    user: DriverUser,
    session: Database,
    now: Clock,
) -> DeliveryEventResponse:
    return _write(
        session, response, lambda: fail_stop(session, user, trip_id, stop_id, payload, now)
    )


@router.post(
    "/trips/{trip_id}/complete",
    response_model=DeliveryEventResponse,
    status_code=201,
    responses=REPLAY,
)
def post_complete(
    trip_id: UUID,
    payload: EventRequest,
    response: Response,
    user: DriverUser,
    session: Database,
    now: Clock,
) -> DeliveryEventResponse:
    return _write(session, response, lambda: complete_trip(session, user, trip_id, payload, now))
