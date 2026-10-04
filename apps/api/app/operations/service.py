"""Depot-scoped live operations derived from authoritative planning/loading/delivery rows."""

from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.audit.models import AuditAction, AuditEntity, AuditEvent
from app.auth.models import User, UserDepot
from app.delivery.models import DeliveryEvent, DeliveryEventType
from app.loading.models import LoadEvent, LoadStatus
from app.loading.service import as_utc, trip_summary, trip_times
from app.operations.schemas import (
    AuditEventResponse,
    AuditListResponse,
    DeliveryProgress,
    ExceptionKind,
    ExceptionSeverity,
    LoadingProgress,
    OperationsExceptionListResponse,
    OperationsExceptionResponse,
    OperationsSummaryResponse,
    OperationsTripListResponse,
    OperationsTripResponse,
)
from app.orders.models import Order, OrderStatus
from app.planning.assignment_models import AssignmentOutcome, PlanAssignment
from app.planning.models import (
    Plan,
    PlanRevision,
    PlanStatus,
    StopStatus,
    Trip,
    TripStatus,
    TripStop,
)
from app.planning.publication_models import PlanPublication
from app.planning.route_inputs import LOCAL_ZONE
from app.receipts.models import ReceiptConfirmation

DELIVERED_STATES = (OrderStatus.DELIVERED, OrderStatus.RECEIPT_CONFIRMED)


def get_operations_time() -> datetime:
    return datetime.now(UTC)


def _depots(session: Session, user: User, depot_id: UUID | None) -> list[UUID]:
    allowed = sorted(
        session.scalars(select(UserDepot.depot_id).where(UserDepot.user_id == user.id))
    )
    if depot_id is None:
        return allowed
    if depot_id not in allowed:
        raise HTTPException(403, "Insufficient permissions", {"Cache-Control": "no-store"})
    return [depot_id]


def _trips_query(depot_ids: list[UUID], day: date) -> Select[Trip, Plan, PlanPublication]:
    """Trips of each plan's effective published revision for the given depots and date."""
    return (
        select(Trip, Plan, PlanPublication)
        .join(PlanRevision, Trip.plan_revision_id == PlanRevision.id)
        .join(Plan, PlanRevision.plan_id == Plan.id)
        .join(PlanPublication, PlanPublication.plan_revision_id == PlanRevision.id)
        .where(
            PlanRevision.status == PlanStatus.PUBLISHED,
            Plan.depot_id.in_(depot_ids),
            Plan.delivery_date == day,
        )
    )


@dataclass
class _TripState:
    orders: list[UUID] = field(default_factory=list)
    stop_of: dict[UUID, UUID] = field(default_factory=dict)
    outlet_of: dict[UUID, UUID] = field(default_factory=dict)
    latest: dict[UUID, LoadEvent] = field(default_factory=dict)
    stops: dict[UUID, TripStop] = field(default_factory=dict)

    def deliverable(self, stop_id: UUID) -> list[UUID]:
        return [
            order
            for order in self.orders
            if self.stop_of[order] == stop_id
            and order in self.latest
            and self.latest[order].status == LoadStatus.LOADED
        ]


@dataclass
class _Snapshot:
    trips: list[tuple[Trip, Plan, PlanPublication]]
    state: dict[UUID, _TripState]
    order_status: dict[UUID, str]
    receipts: set[UUID]


def _snapshot(session: Session, trips: list[tuple[Trip, Plan, PlanPublication]]) -> _Snapshot:
    ids = [trip.id for trip, _, _ in trips]
    state = {trip_id: _TripState() for trip_id in ids}
    for assignment in session.scalars(
        select(PlanAssignment)
        .where(PlanAssignment.trip_id.in_(ids))
        .order_by(PlanAssignment.order_id)
    ):
        if assignment.trip_id is None or assignment.trip_stop_id is None:
            continue
        item = state[assignment.trip_id]
        item.orders.append(assignment.order_id)
        item.stop_of[assignment.order_id] = assignment.trip_stop_id
        item.outlet_of[assignment.order_id] = assignment.outlet_id
    for event in session.scalars(
        select(LoadEvent)
        .where(LoadEvent.trip_id.in_(ids))
        .order_by(LoadEvent.trip_id, LoadEvent.sequence_number)
    ):
        state[event.trip_id].latest[event.order_id] = event
    for stop in session.scalars(select(TripStop).where(TripStop.trip_id.in_(ids))):
        state[stop.trip_id].stops[stop.id] = stop
    orders = [order for item in state.values() for order in item.orders]
    statuses = {
        row.id: row.status
        for row in session.execute(select(Order.id, Order.status).where(Order.id.in_(orders)))
    }
    receipts = set(
        session.scalars(
            select(ReceiptConfirmation.order_id).where(ReceiptConfirmation.order_id.in_(orders))
        )
    )
    return _Snapshot(trips, state, statuses, receipts)


def _progress(snapshot: _Snapshot, trip_id: UUID) -> tuple[LoadingProgress, DeliveryProgress]:
    item = snapshot.state[trip_id]
    outcomes = Counter(LoadStatus(event.status) for event in item.latest.values())
    visit = [stop for stop in item.stops.values() if item.deliverable(stop.id)]
    delivered = sum(stop.status == StopStatus.DELIVERED for stop in visit)
    failed = sum(stop.status == StopStatus.FAILED for stop in visit)
    return (
        LoadingProgress(
            orders=len(item.orders),
            loaded=outcomes[LoadStatus.LOADED],
            missing=outcomes[LoadStatus.MISSING],
            damaged=outcomes[LoadStatus.DAMAGED],
            pending=len(item.orders) - len(item.latest),
        ),
        DeliveryProgress(
            stops_requiring_visit=len(visit),
            delivered_stops=delivered,
            failed_stops=failed,
            open_stops=len(visit) - delivered - failed,
            delivered_orders=sum(
                snapshot.order_status[order] in DELIVERED_STATES for order in item.orders
            ),
            receipts_confirmed=sum(order in snapshot.receipts for order in item.orders),
        ),
    )


def _today(now: datetime) -> date:
    return now.astimezone(LOCAL_ZONE).date()


def list_operation_trips(
    session: Session,
    user: User,
    *,
    delivery_date: date | None,
    depot_id: UUID | None,
    status: TripStatus | None,
    limit: int,
    offset: int,
    now: datetime,
) -> OperationsTripListResponse:
    depots = _depots(session, user, depot_id)
    query = _trips_query(depots, delivery_date or _today(now))
    if status is not None:
        query = query.where(Trip.status == status)
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = [
        (trip, plan, publication)
        for trip, plan, publication in session.execute(
            query.order_by(Plan.depot_id, Trip.vehicle_id, Trip.trip_number, Trip.id)
            .limit(limit)
            .offset(offset)
        )
    ]
    snapshot = _snapshot(session, rows)
    items = []
    for trip, plan, publication in rows:
        loading, delivery = _progress(snapshot, trip.id)
        summary = trip_summary(
            trip,
            plan,
            trip_times(publication),
            len(snapshot.state[trip.id].stops),
            len(snapshot.state[trip.id].orders),
        )
        items.append(OperationsTripResponse(trip=summary, loading=loading, delivery=delivery))
    return OperationsTripListResponse(items=items, total=total, limit=limit, offset=offset)


def _exceptions(session: Session, snapshot: _Snapshot) -> list[OperationsExceptionResponse]:
    plans = {trip.id: plan for trip, plan, _ in snapshot.trips}
    items: list[OperationsExceptionResponse] = []

    def add(kind: ExceptionKind, trip_id: UUID, **values: object) -> None:
        plan = plans[trip_id]
        severity = (
            ExceptionSeverity.PENDING
            if kind == ExceptionKind.RECEIPT_PENDING
            else ExceptionSeverity.FAILURE
        )
        items.append(
            OperationsExceptionResponse.model_validate(
                {
                    "kind": kind,
                    "severity": severity,
                    "depot_id": plan.depot_id,
                    "delivery_date": plan.delivery_date,
                    "trip_id": trip_id,
                    "stop_id": None,
                    "outlet_id": None,
                    "order_ids": [],
                    "actor_id": None,
                    "reason_code": None,
                    "note": None,
                    **values,
                }
            )
        )

    for trip_id, item in snapshot.state.items():
        for order, event in item.latest.items():
            if event.status == LoadStatus.LOADED:
                continue
            kind = (
                ExceptionKind.LOAD_MISSING
                if event.status == LoadStatus.MISSING
                else ExceptionKind.LOAD_DAMAGED
            )
            add(
                kind,
                trip_id,
                stop_id=item.stop_of[order],
                outlet_id=item.outlet_of[order],
                order_ids=[order],
                occurred_at=as_utc(event.recorded_at),
                actor_id=event.recorded_by,
                note=event.note,
                source_id=event.id,
            )
    ids = list(snapshot.state)
    for delivery in session.scalars(
        select(DeliveryEvent).where(
            DeliveryEvent.trip_id.in_(ids),
            DeliveryEvent.event_type.in_([DeliveryEventType.FAILED, DeliveryEventType.DELIVERED]),
        )
    ):
        item = snapshot.state[delivery.trip_id]
        assert delivery.trip_stop_id is not None
        stop = item.stops[delivery.trip_stop_id]
        orders = item.deliverable(stop.id)
        common = {
            "stop_id": stop.id,
            "outlet_id": stop.outlet_id,
            "occurred_at": as_utc(delivery.recorded_at),
            "actor_id": delivery.recorded_by,
            "source_id": delivery.id,
        }
        if delivery.event_type == DeliveryEventType.FAILED:
            add(
                ExceptionKind.DELIVERY_FAILED,
                delivery.trip_id,
                order_ids=orders,
                reason_code=delivery.reason_code,
                note=delivery.note,
                **common,
            )
            continue
        pending = [
            order
            for order in orders
            if snapshot.order_status[order] == OrderStatus.DELIVERED
            and order not in snapshot.receipts
        ]
        if pending:
            add(ExceptionKind.RECEIPT_PENDING, delivery.trip_id, order_ids=pending, **common)
    for audit in session.scalars(
        select(AuditEvent).where(
            AuditEvent.trip_id.in_(ids), AuditEvent.action == AuditAction.SYNC_CONFLICT
        )
    ):
        assert audit.trip_id is not None
        add(
            ExceptionKind.SYNC_CONFLICT,
            audit.trip_id,
            stop_id=audit.entity_id if audit.entity_type == AuditEntity.STOP else None,
            occurred_at=as_utc(audit.occurred_at),
            actor_id=audit.actor_id,
            reason_code=audit.details.get("event_type"),
            note=audit.details.get("detail"),
            source_id=audit.id,
        )
    items.sort(key=lambda item: (-item.occurred_at.timestamp(), item.kind, str(item.source_id)))
    return items


def list_exceptions(
    session: Session,
    user: User,
    *,
    delivery_date: date | None,
    depot_id: UUID | None,
    kind: ExceptionKind | None,
    limit: int,
    offset: int,
    now: datetime,
) -> OperationsExceptionListResponse:
    depots = _depots(session, user, depot_id)
    trips = [
        (trip, plan, publication)
        for trip, plan, publication in session.execute(
            _trips_query(depots, delivery_date or _today(now))
        )
    ]
    items = _exceptions(session, _snapshot(session, trips))
    if kind is not None:
        items = [item for item in items if item.kind == kind]
    return OperationsExceptionListResponse(
        items=items[offset : offset + limit], total=len(items), limit=limit, offset=offset
    )


def live_summary(
    session: Session,
    user: User,
    *,
    delivery_date: date | None,
    depot_id: UUID | None,
    now: datetime,
) -> OperationsSummaryResponse:
    depots = _depots(session, user, depot_id)
    day = delivery_date or _today(now)
    plans = Counter(
        session.scalars(
            select(Plan.status).where(Plan.depot_id.in_(depots), Plan.delivery_date == day)
        )
    )
    trips = [
        (trip, plan, publication)
        for trip, plan, publication in session.execute(_trips_query(depots, day))
    ]
    snapshot = _snapshot(session, trips)
    loading = Counter[str]()
    delivery = Counter[str]()
    for trip, _, _ in trips:
        trip_loading, trip_delivery = _progress(snapshot, trip.id)
        loading.update(trip_loading.model_dump())
        delivery.update(trip_delivery.model_dump())
    # Order outcomes of the effective published revisions, counted once per order.
    outcomes = session.execute(
        select(PlanAssignment.outcome, Order.status)
        .join(Order, PlanAssignment.order_id == Order.id)
        .join(PlanPublication, PlanPublication.plan_revision_id == PlanAssignment.plan_revision_id)
        .join(Plan, PlanPublication.plan_id == Plan.id)
        .where(Plan.depot_id.in_(depots), Plan.delivery_date == day)
    ).all()
    exceptions = Counter(item.kind for item in _exceptions(session, snapshot))
    return OperationsSummaryResponse(
        delivery_date=day,
        depot_ids=depots,
        draft_plans=plans[PlanStatus.DRAFT],
        published_plans=plans[PlanStatus.PUBLISHED],
        trips_by_status={
            status: sum(trip.status == status for trip, _, _ in trips) for status in TripStatus
        },
        orders_by_status={
            status: sum(row.status == status for row in outcomes) for status in OrderStatus
        },
        loading=LoadingProgress(**{key: loading[key] for key in LoadingProgress.model_fields}),
        delivery=DeliveryProgress(**{key: delivery[key] for key in DeliveryProgress.model_fields}),
        deferred_orders=sum(row.outcome == AssignmentOutcome.DEFERRED for row in outcomes),
        receipts_pending=sum(row.status == OrderStatus.DELIVERED for row in outcomes),
        exceptions={kind: exceptions[kind] for kind in ExceptionKind},
    )


def list_audit(
    session: Session,
    user: User,
    *,
    depot_id: UUID | None,
    action: AuditAction | None,
    entity_type: AuditEntity | None,
    entity_id: UUID | None,
    trip_id: UUID | None,
    occurred_from: datetime | None,
    occurred_to: datetime | None,
    limit: int,
    offset: int,
) -> AuditListResponse:
    depots = _depots(session, user, depot_id)
    query = select(AuditEvent).where(AuditEvent.depot_id.in_(depots))
    for column, value in (
        (AuditEvent.action, action),
        (AuditEvent.entity_type, entity_type),
        (AuditEvent.entity_id, entity_id),
        (AuditEvent.trip_id, trip_id),
    ):
        if value is not None:
            query = query.where(column == value)
    if occurred_from is not None:
        query = query.where(AuditEvent.occurred_at >= occurred_from.astimezone(UTC))
    if occurred_to is not None:
        query = query.where(AuditEvent.occurred_at < occurred_to.astimezone(UTC))
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = session.scalars(
        query.order_by(AuditEvent.occurred_at.desc(), AuditEvent.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return AuditListResponse(
        items=[
            AuditEventResponse(
                id=row.id,
                occurred_at=as_utc(row.occurred_at),
                actor_id=row.actor_id,
                action=AuditAction(row.action),
                entity_type=AuditEntity(row.entity_type),
                entity_id=row.entity_id,
                depot_id=row.depot_id,
                trip_id=row.trip_id,
                source_id=row.source_id,
                details=row.details,
            )
            for row in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
