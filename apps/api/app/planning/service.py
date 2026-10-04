from collections.abc import Sequence
from datetime import UTC, date, datetime
from typing import cast
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.auth.models import RoleCode, User, UserDepot
from app.auth.scopes import require_depot_access
from app.planning.assignment_models import AssignmentOutcome, DeferralDecision, PlanAssignment
from app.planning.models import Plan, PlanRevision, PlanStatus, Trip
from app.planning.schemas import (
    PlanCreateRequest,
    PlanDetailResponse,
    PlanListResponse,
    PlanResponse,
    PlanRevisionResponse,
    utc_timestamp,
)

COLOMBO = ZoneInfo("Asia/Colombo")


def get_planning_time() -> datetime:
    return datetime.now(UTC)


def create_plan(
    session: Session,
    user: User,
    payload: PlanCreateRequest,
    now: datetime,
) -> PlanDetailResponse:
    require_depot_access(user, payload.depot_id, role=RoleCode.DISPATCHER)
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Planning clock must be timezone-aware")
    if payload.delivery_date < now.astimezone(COLOMBO).date():
        raise HTTPException(
            status_code=422, detail="Delivery date cannot be before today in Asia/Colombo"
        )
    plan = Plan(
        depot_id=payload.depot_id,
        delivery_date=payload.delivery_date,
        created_by=user.id,
        status=PlanStatus.DRAFT,
    )
    plan.revisions = [PlanRevision(revision_number=1, status=PlanStatus.DRAFT)]
    session.add(plan)
    session.flush()
    result = get_plan(session, user, plan.id)
    session.commit()
    return result


def find_existing_plan_id(session: Session, user: User, payload: PlanCreateRequest) -> UUID | None:
    # Also scope conflict recovery after a concurrent create/failed transaction.
    allowed = select(UserDepot.depot_id).where(UserDepot.user_id == user.id)
    return session.scalar(
        select(Plan.id).where(
            Plan.depot_id == payload.depot_id,
            Plan.delivery_date == payload.delivery_date,
            Plan.depot_id.in_(allowed),
        )
    )


def list_plans(
    session: Session,
    user: User,
    *,
    depot_id: UUID | None,
    delivery_date: date | None,
    status: PlanStatus | None,
    limit: int,
    offset: int,
) -> PlanListResponse:
    if depot_id is not None:
        require_depot_access(user, depot_id, role=RoleCode.DISPATCHER)
    allowed = select(UserDepot.depot_id).where(UserDepot.user_id == user.id)
    query = select(Plan).where(Plan.depot_id.in_(allowed))
    if depot_id is not None:
        query = query.where(Plan.depot_id == depot_id)
    if delivery_date is not None:
        query = query.where(Plan.delivery_date == delivery_date)
    if status is not None:
        query = query.where(Plan.status == status)
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    plans = session.scalars(
        query.order_by(Plan.delivery_date.desc(), Plan.id.desc()).offset(offset).limit(limit)
    ).all()
    return PlanListResponse(
        items=[PlanResponse.from_plan(plan) for plan in plans],
        total=total,
        limit=limit,
        offset=offset,
    )


def get_plan(session: Session, user: User, plan_id: UUID) -> PlanDetailResponse:
    allowed = select(UserDepot.depot_id).where(UserDepot.user_id == user.id)
    plan = session.scalar(select(Plan).where(Plan.id == plan_id, Plan.depot_id.in_(allowed)))
    if plan is None:
        raise HTTPException(
            status_code=404, detail="Plan not found", headers={"Cache-Control": "no-store"}
        )

    # Aggregate each child collection separately; joining trips and outcomes directly
    # would multiply their counts. Every aggregate is restricted to this plan's revisions.
    revision_ids = select(PlanRevision.id).where(PlanRevision.plan_id == plan.id)
    trips = (
        select(Trip.plan_revision_id.label("revision_id"), func.count().label("count"))
        .where(Trip.plan_revision_id.in_(revision_ids))
        .group_by(Trip.plan_revision_id)
        .subquery()
    )
    outcomes = (
        select(
            PlanAssignment.plan_revision_id.label("revision_id"),
            func.sum(case((PlanAssignment.outcome == AssignmentOutcome.SERVED, 1), else_=0)).label(
                "served"
            ),
            func.sum(
                case((PlanAssignment.outcome == AssignmentOutcome.DEFERRED, 1), else_=0)
            ).label("deferred"),
        )
        .where(PlanAssignment.plan_revision_id.in_(revision_ids))
        .group_by(PlanAssignment.plan_revision_id)
        .subquery()
    )
    reasons = (
        select(DeferralDecision.plan_revision_id.label("revision_id"), func.count().label("count"))
        .where(DeferralDecision.plan_revision_id.in_(revision_ids))
        .group_by(DeferralDecision.plan_revision_id)
        .subquery()
    )
    rows = session.execute(
        select(
            PlanRevision,
            func.coalesce(trips.c.count, 0),
            func.coalesce(outcomes.c.served, 0),
            func.coalesce(outcomes.c.deferred, 0),
            func.coalesce(reasons.c.count, 0),
        )
        .outerjoin(trips, trips.c.revision_id == PlanRevision.id)
        .outerjoin(outcomes, outcomes.c.revision_id == PlanRevision.id)
        .outerjoin(reasons, reasons.c.revision_id == PlanRevision.id)
        .where(PlanRevision.plan_id == plan.id)
        .order_by(PlanRevision.revision_number)
    ).all()
    counted_rows = cast(Sequence[tuple[PlanRevision, int, int, int, int]], rows)
    return PlanDetailResponse(
        **PlanResponse.from_plan(plan).model_dump(),
        revisions=[
            PlanRevisionResponse(
                id=revision.id,
                revision_number=revision.revision_number,
                status=PlanStatus(revision.status),
                published_at=(
                    utc_timestamp(revision.published_at)
                    if revision.published_at is not None
                    else None
                ),
                trip_count=trip_count,
                served_order_count=served,
                deferred_order_count=deferred,
                unexplained_deferred_count=deferred - explained,
            )
            for revision, trip_count, served, deferred, explained in counted_rows
        ],
    )
