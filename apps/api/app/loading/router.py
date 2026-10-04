from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.auth.models import RoleCode, User
from app.db.session import get_session
from app.loading.schemas import (
    LoaderTripListResponse,
    LoadEventRequest,
    LoadEventResponse,
    TripLoadingResponse,
    TripReadyRequest,
)
from app.loading.service import (
    get_loading_time,
    get_trip_loading,
    list_loader_trips,
    mark_trip_ready,
    record_load_event,
)
from app.planning.models import TripStatus

router = APIRouter(tags=["loading"])
LoaderUser = Annotated[User, Depends(require_roles(RoleCode.LOADER))]
Database = Annotated[Session, Depends(get_session)]
Clock = Annotated[datetime, Depends(get_loading_time)]


def unavailable(detail: str = "Loading unavailable") -> HTTPException:
    return HTTPException(status_code=503, detail=detail, headers={"Cache-Control": "no-store"})


def conflict() -> HTTPException:
    return HTTPException(
        status_code=409,
        detail="Loading conflict; refresh and retry the same request",
        headers={"Cache-Control": "no-store"},
    )


@router.get("/loader/trips", response_model=LoaderTripListResponse)
def get_loader_trips(
    response: Response,
    user: LoaderUser,
    session: Database,
    delivery_date: date | None = None,
    status: TripStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> LoaderTripListResponse:
    try:
        result = list_loader_trips(
            session, user, delivery_date=delivery_date, status=status, limit=limit, offset=offset
        )
    except (SQLAlchemyError, ValueError):
        raise unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    return result


@router.get("/trips/{trip_id}/loading", response_model=TripLoadingResponse)
def get_loading(
    trip_id: UUID, response: Response, user: LoaderUser, session: Database
) -> TripLoadingResponse:
    try:
        result = get_trip_loading(session, user, trip_id)
    except (SQLAlchemyError, ValueError):
        raise unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post(
    "/trips/{trip_id}/load-events",
    response_model=LoadEventResponse,
    status_code=201,
    responses={200: {"model": LoadEventResponse, "description": "Saved event replay"}},
)
def post_load_event(
    trip_id: UUID,
    payload: LoadEventRequest,
    response: Response,
    user: LoaderUser,
    session: Database,
    now: Clock,
) -> LoadEventResponse:
    try:
        result, created = record_load_event(session, user, trip_id, payload, now)
    except HTTPException:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        raise conflict() from None
    except (SQLAlchemyError, ValueError):
        session.rollback()
        raise unavailable("Loading unavailable; retry with the same event ID") from None
    response.status_code = 201 if created else 200
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post(
    "/trips/{trip_id}/ready",
    response_model=TripLoadingResponse,
    status_code=201,
    responses={200: {"model": TripLoadingResponse, "description": "Saved readiness replay"}},
)
def post_ready(
    trip_id: UUID,
    payload: TripReadyRequest,
    response: Response,
    user: LoaderUser,
    session: Database,
    now: Clock,
) -> TripLoadingResponse:
    try:
        result, created = mark_trip_ready(session, user, trip_id, payload, now)
    except HTTPException:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        raise conflict() from None
    except (SQLAlchemyError, ValueError):
        session.rollback()
        raise unavailable("Loading unavailable; retry with the same request ID") from None
    response.status_code = 201 if created else 200
    response.headers["Cache-Control"] = "no-store"
    return result
