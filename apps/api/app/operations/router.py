from collections.abc import Callable
from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import AwareDatetime
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.audit.models import AuditAction, AuditEntity
from app.auth.dependencies import require_roles
from app.auth.models import RoleCode, User
from app.db.session import get_session
from app.operations.schemas import (
    AuditListResponse,
    ExceptionKind,
    OperationsExceptionListResponse,
    OperationsSummaryResponse,
    OperationsTripListResponse,
)
from app.operations.service import (
    get_operations_time,
    list_audit,
    list_exceptions,
    list_operation_trips,
    live_summary,
)
from app.planning.models import TripStatus

router = APIRouter(prefix="/operations", tags=["operations"])
DispatcherUser = Annotated[User, Depends(require_roles(RoleCode.DISPATCHER))]
Database = Annotated[Session, Depends(get_session)]
Clock = Annotated[datetime, Depends(get_operations_time)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0, le=100_000)]


def _read[T](response: Response, action: Callable[[], T]) -> T:
    try:
        result = action()
    except (SQLAlchemyError, ValueError):
        raise HTTPException(503, "Operations unavailable", {"Cache-Control": "no-store"}) from None
    response.headers["Cache-Control"] = "no-store"
    return result


@router.get("/live", response_model=OperationsSummaryResponse)
def get_live(
    response: Response,
    user: DispatcherUser,
    session: Database,
    now: Clock,
    delivery_date: date | None = None,
    depot_id: UUID | None = None,
) -> OperationsSummaryResponse:
    return _read(
        response,
        lambda: live_summary(
            session, user, delivery_date=delivery_date, depot_id=depot_id, now=now
        ),
    )


@router.get("/trips", response_model=OperationsTripListResponse)
def get_trips(
    response: Response,
    user: DispatcherUser,
    session: Database,
    now: Clock,
    delivery_date: date | None = None,
    depot_id: UUID | None = None,
    status: TripStatus | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> OperationsTripListResponse:
    return _read(
        response,
        lambda: list_operation_trips(
            session,
            user,
            delivery_date=delivery_date,
            depot_id=depot_id,
            status=status,
            limit=limit,
            offset=offset,
            now=now,
        ),
    )


@router.get("/exceptions", response_model=OperationsExceptionListResponse)
def get_exceptions(
    response: Response,
    user: DispatcherUser,
    session: Database,
    now: Clock,
    delivery_date: date | None = None,
    depot_id: UUID | None = None,
    kind: ExceptionKind | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> OperationsExceptionListResponse:
    return _read(
        response,
        lambda: list_exceptions(
            session,
            user,
            delivery_date=delivery_date,
            depot_id=depot_id,
            kind=kind,
            limit=limit,
            offset=offset,
            now=now,
        ),
    )


@router.get("/audit", response_model=AuditListResponse)
def get_audit(
    response: Response,
    user: DispatcherUser,
    session: Database,
    depot_id: UUID | None = None,
    action: AuditAction | None = None,
    entity_type: AuditEntity | None = None,
    entity_id: UUID | None = None,
    trip_id: UUID | None = None,
    occurred_from: AwareDatetime | None = None,
    occurred_to: AwareDatetime | None = None,
    limit: Limit = 50,
    offset: Offset = 0,
) -> AuditListResponse:
    return _read(
        response,
        lambda: list_audit(
            session,
            user,
            depot_id=depot_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            trip_id=trip_id,
            occurred_from=occurred_from,
            occurred_to=occurred_to,
            limit=limit,
            offset=offset,
        ),
    )
