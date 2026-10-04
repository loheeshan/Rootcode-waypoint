from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.auth.models import RoleCode, User
from app.db.session import get_session
from app.planning.allocation import AllocationUnavailable
from app.planning.compatibility_schemas import PlanCompatibilityResponse
from app.planning.compatibility_service import preview_compatibility
from app.planning.models import PlanStatus
from app.planning.optimization_schemas import OptimizationResponse, OptimizeRequest
from app.planning.optimization_service import create_optimization, get_optimization
from app.planning.publication_schemas import PublicationResponse, PublishRequest
from app.planning.publication_service import create_publication, get_publication
from app.planning.routing import RouteSearchUnavailable
from app.planning.schemas import PlanCreateRequest, PlanDetailResponse, PlanListResponse
from app.planning.service import (
    create_plan,
    find_existing_plan_id,
    get_plan,
    get_planning_time,
    list_plans,
)
from app.planning.validation import PlanningValidationError

router = APIRouter(prefix="/plans", tags=["plans"])
DispatcherUser = Annotated[User, Depends(require_roles(RoleCode.DISPATCHER))]
Database = Annotated[Session, Depends(get_session)]


@router.post(
    "/{plan_id}/optimize",
    response_model=OptimizationResponse,
    status_code=201,
    responses={200: {"model": OptimizationResponse, "description": "Saved request replay"}},
)
def post_optimization(
    plan_id: UUID,
    payload: OptimizeRequest,
    response: Response,
    user: DispatcherUser,
    session: Database,
    now: Annotated[datetime, Depends(get_planning_time)],
) -> OptimizationResponse:
    try:
        result, created = create_optimization(session, user, plan_id, payload, now)
    except HTTPException:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Optimization conflict; reload or retry the same request",
            headers={"Cache-Control": "no-store"},
        ) from None
    except ValueError:
        session.rollback()
        raise HTTPException(
            status_code=422,
            detail="Invalid or incomplete route planning inputs",
            headers={"Cache-Control": "no-store"},
        ) from None
    except (
        SQLAlchemyError,
        AllocationUnavailable,
        RouteSearchUnavailable,
        PlanningValidationError,
    ):
        session.rollback()
        raise HTTPException(
            status_code=503,
            detail="Optimization unavailable; retry with the same request ID",
            headers={"Cache-Control": "no-store"},
        ) from None
    response.status_code = 201 if created else 200
    response.headers["Cache-Control"] = "no-store"
    response.headers["Location"] = f"/api/v1/plans/{plan_id}/revisions/{result.revision_id}/results"
    return result


@router.get("/{plan_id}/revisions/{revision_id}/results", response_model=OptimizationResponse)
def get_optimization_result(
    plan_id: UUID, revision_id: UUID, response: Response, user: DispatcherUser, session: Database
) -> OptimizationResponse:
    try:
        result = get_optimization(session, user, plan_id, revision_id)
    except (SQLAlchemyError, ValueError):
        raise HTTPException(
            status_code=503,
            detail="Optimization results unavailable",
            headers={"Cache-Control": "no-store"},
        ) from None
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post(
    "/{plan_id}/revisions/{revision_id}/publish",
    response_model=PublicationResponse,
    status_code=201,
    responses={200: {"model": PublicationResponse, "description": "Saved request replay"}},
)
def post_publication(
    plan_id: UUID,
    revision_id: UUID,
    payload: PublishRequest,
    response: Response,
    user: DispatcherUser,
    session: Database,
    now: Annotated[datetime, Depends(get_planning_time)],
) -> PublicationResponse:
    try:
        result, created = create_publication(session, user, plan_id, revision_id, payload, now)
    except HTTPException:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Publication conflict; reload or retry the same request",
            headers={"Cache-Control": "no-store"},
        ) from None
    except (SQLAlchemyError, ValueError):
        session.rollback()
        raise HTTPException(
            status_code=503,
            detail="Publication unavailable; retry with the same request ID",
            headers={"Cache-Control": "no-store"},
        ) from None
    response.status_code = 201 if created else 200
    response.headers["Cache-Control"] = "no-store"
    response.headers["Location"] = f"/api/v1/plans/{plan_id}/publication"
    return result


@router.get("/{plan_id}/publication", response_model=PublicationResponse)
def get_plan_publication(
    plan_id: UUID, response: Response, user: DispatcherUser, session: Database
) -> PublicationResponse:
    try:
        result = get_publication(session, user, plan_id)
    except (SQLAlchemyError, ValueError):
        raise HTTPException(
            status_code=503,
            detail="Publication unavailable",
            headers={"Cache-Control": "no-store"},
        ) from None
    response.headers["Cache-Control"] = "no-store"
    return result


def unavailable() -> HTTPException:
    return HTTPException(
        status_code=503, detail="Plans unavailable", headers={"Cache-Control": "no-store"}
    )


@router.post("", response_model=PlanDetailResponse, status_code=201)
def post_plan(
    payload: PlanCreateRequest,
    response: Response,
    user: DispatcherUser,
    session: Database,
    now: Annotated[datetime, Depends(get_planning_time)],
) -> PlanDetailResponse:
    try:
        result = create_plan(session, user, payload, now)
    except IntegrityError:
        session.rollback()
        try:
            existing_id = find_existing_plan_id(session, user, payload)
        except SQLAlchemyError:
            raise unavailable() from None
        if existing_id is not None:
            raise HTTPException(
                status_code=409,
                detail="A plan already exists for this depot and delivery date",
                headers={"Cache-Control": "no-store", "Location": f"/api/v1/plans/{existing_id}"},
            ) from None
        raise HTTPException(
            status_code=409,
            detail="Plan could not be created; refresh depot access",
            headers={"Cache-Control": "no-store"},
        ) from None
    except SQLAlchemyError:
        session.rollback()
        raise unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    response.headers["Location"] = f"/api/v1/plans/{result.id}"
    return result


@router.get("", response_model=PlanListResponse)
def get_plans(
    response: Response,
    user: DispatcherUser,
    session: Database,
    depot_id: UUID | None = None,
    delivery_date: date | None = None,
    status: PlanStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PlanListResponse:
    try:
        result = list_plans(
            session,
            user,
            depot_id=depot_id,
            delivery_date=delivery_date,
            status=status,
            limit=limit,
            offset=offset,
        )
    except SQLAlchemyError:
        raise unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    return result


@router.get("/{plan_id}", response_model=PlanDetailResponse)
def get_plan_detail(
    plan_id: UUID,
    response: Response,
    user: DispatcherUser,
    session: Database,
) -> PlanDetailResponse:
    try:
        result = get_plan(session, user, plan_id)
    except SQLAlchemyError:
        raise unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    return result


@router.get("/{plan_id}/compatibility", response_model=PlanCompatibilityResponse)
def get_plan_compatibility(
    plan_id: UUID,
    response: Response,
    user: DispatcherUser,
    session: Database,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PlanCompatibilityResponse:
    try:
        result = preview_compatibility(session, user, plan_id, limit=limit, offset=offset)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Compatibility preview unavailable",
            headers={"Cache-Control": "no-store"},
        ) from None
    response.headers["Cache-Control"] = "no-store"
    return result
