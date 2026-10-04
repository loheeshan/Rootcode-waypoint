"""Depot-scoped loading of effective published trips; events are append-only."""

import hashlib
import json
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.auth.models import User, UserDepot
from app.loading.models import LoadEvent, LoadStatus, TripLoadingCompletion
from app.loading.schemas import (
    LoaderTripListResponse,
    LoaderTripResponse,
    LoadEventRequest,
    LoadEventResponse,
    LoadingCompletionResponse,
    LoadingOrderResponse,
    LoadingStopResponse,
    TripLoadingResponse,
    TripReadyRequest,
)
from app.orders.models import Order, OrderStatus, TemperatureRequirement
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
from app.planning.publication_schemas import PublicationResponse

CLOCK_SKEW = timedelta(minutes=5)


def get_loading_time() -> datetime:
    return datetime.now(UTC)


def fail(status: int, detail: str) -> HTTPException:
    return HTTPException(status_code=status, detail=detail, headers={"Cache-Control": "no-store"})


def _scoped(user: User) -> Select[Trip, Plan, PlanPublication]:
    """Trips of each plan's effective published revision in the caller's current depots."""
    allowed = select(UserDepot.depot_id).where(UserDepot.user_id == user.id)
    return (
        select(Trip, Plan, PlanPublication)
        .join(PlanRevision, Trip.plan_revision_id == PlanRevision.id)
        .join(Plan, PlanRevision.plan_id == Plan.id)
        .join(PlanPublication, PlanPublication.plan_revision_id == PlanRevision.id)
        .where(PlanRevision.status == PlanStatus.PUBLISHED, Plan.depot_id.in_(allowed))
    )


def _trip_times(publication: PlanPublication) -> dict[UUID, tuple[datetime, datetime]]:
    saved = PublicationResponse.model_validate(publication.result_snapshot)
    return {trip.trip_id: (trip.departure_at, trip.return_at) for trip in saved.trips}


def _summary(
    trip: Trip,
    plan: Plan,
    times: dict[UUID, tuple[datetime, datetime]],
    stop_count: int,
    order_count: int,
) -> LoaderTripResponse:
    if trip.id not in times:
        raise ValueError("Published snapshot does not contain the trip")
    departure, arrival = times[trip.id]
    return LoaderTripResponse(
        trip_id=trip.id,
        plan_id=plan.id,
        depot_id=plan.depot_id,
        delivery_date=plan.delivery_date,
        vehicle_id=trip.vehicle_id,
        trip_number=trip.trip_number,
        driver_id=trip.driver_id,
        status=TripStatus(trip.status),
        departure_at=departure,
        return_at=arrival,
        stop_count=stop_count,
        order_count=order_count,
    )


def _counts(session: Session, trip_ids: list[UUID]) -> tuple[dict[UUID, int], dict[UUID, int]]:
    stops: dict[UUID, int] = {}
    for trip_id, count in session.execute(
        select(TripStop.trip_id, func.count())
        .where(TripStop.trip_id.in_(trip_ids))
        .group_by(TripStop.trip_id)
    ):
        stops[trip_id] = count
    orders: dict[UUID, int] = {}
    for order_trip_id, count in session.execute(
        select(PlanAssignment.trip_id, func.count())
        .where(PlanAssignment.trip_id.in_(trip_ids))
        .group_by(PlanAssignment.trip_id)
    ):
        if order_trip_id is not None:
            orders[order_trip_id] = count
    return stops, orders


def list_loader_trips(
    session: Session,
    user: User,
    *,
    delivery_date: date | None,
    status: TripStatus | None,
    limit: int,
    offset: int,
) -> LoaderTripListResponse:
    query = _scoped(user)
    if delivery_date is not None:
        query = query.where(Plan.delivery_date == delivery_date)
    if status is not None:
        query = query.where(Trip.status == status)
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = session.execute(
        query.order_by(Plan.delivery_date.desc(), Trip.vehicle_id, Trip.trip_number, Trip.id)
        .limit(limit)
        .offset(offset)
    ).all()
    stops, orders = _counts(session, [trip.id for trip, _, _ in rows])
    times: dict[UUID, dict[UUID, tuple[datetime, datetime]]] = {}
    items = []
    for trip, plan, publication in rows:
        if publication.request_id not in times:
            times[publication.request_id] = _trip_times(publication)
        items.append(
            _summary(
                trip,
                plan,
                times[publication.request_id],
                stops.get(trip.id, 0),
                orders.get(trip.id, 0),
            )
        )
    return LoaderTripListResponse(items=items, total=total, limit=limit, offset=offset)


def _scoped_trip(
    session: Session, user: User, trip_id: UUID, *, lock: bool = False
) -> tuple[Trip, Plan, PlanPublication]:
    query = _scoped(user).where(Trip.id == trip_id)
    row = session.execute(query.with_for_update(of=Trip) if lock else query).first()
    if row is None:
        raise fail(404, "Trip not found")
    trip, plan, publication = row
    return trip, plan, publication


def _latest_events(session: Session, trip_id: UUID) -> tuple[dict[UUID, LoadEvent], int]:
    latest: dict[UUID, LoadEvent] = {}
    last = 0
    for event in session.scalars(
        select(LoadEvent).where(LoadEvent.trip_id == trip_id).order_by(LoadEvent.sequence_number)
    ):
        latest[event.order_id] = event
        last = event.sequence_number
    return latest, last


def _completion(record: TripLoadingCompletion | None) -> LoadingCompletionResponse | None:
    if record is None:
        return None
    return LoadingCompletionResponse(
        request_id=record.request_id,
        last_event_sequence=record.last_event_sequence,
        loaded_count=record.loaded_count,
        missing_count=record.missing_count,
        damaged_count=record.damaged_count,
        confirmed_by=record.confirmed_by,
        confirmed_at=_aware(record.confirmed_at),
    )


def _aware(value: datetime) -> datetime:
    # SQLite returns naive values; every stored timestamp is written in UTC.
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _view(
    session: Session, trip: Trip, plan: Plan, publication: PlanPublication
) -> TripLoadingResponse:
    stops = session.scalars(
        select(TripStop).where(TripStop.trip_id == trip.id).order_by(TripStop.sequence_number)
    ).all()
    assigned = session.execute(
        select(PlanAssignment, Order)
        .join(Order, PlanAssignment.order_id == Order.id)
        .where(PlanAssignment.trip_id == trip.id)
        .order_by(Order.id)
    ).all()
    latest, last = _latest_events(session, trip.id)
    by_stop: dict[UUID, list[LoadingOrderResponse]] = {stop.id: [] for stop in stops}
    counts = dict.fromkeys(LoadStatus, 0)
    for assignment, order in assigned:
        event = latest.get(order.id)
        if event is not None:
            counts[LoadStatus(event.status)] += 1
        if assignment.trip_stop_id not in by_stop:
            raise ValueError("Assignment references a stop outside the trip")
        by_stop[assignment.trip_stop_id].append(
            LoadingOrderResponse(
                order_id=order.id,
                order_status=OrderStatus(order.status),
                temperature_requirement=TemperatureRequirement(order.temperature_requirement),
                order_weight_kg=order.order_weight_kg,
                order_volume_m3=order.order_volume_m3,
                load_status=LoadStatus(event.status) if event else None,
                note=event.note if event else None,
                last_event_id=event.id if event else None,
            )
        )
    completion = session.get(TripLoadingCompletion, trip.id)
    return TripLoadingResponse(
        trip=_summary(trip, plan, _trip_times(publication), len(stops), len(assigned)),
        last_event_sequence=last,
        loaded_count=counts[LoadStatus.LOADED],
        missing_count=counts[LoadStatus.MISSING],
        damaged_count=counts[LoadStatus.DAMAGED],
        pending_count=len(assigned) - len(latest),
        stops=[
            LoadingStopResponse(
                stop_id=stop.id,
                outlet_id=stop.outlet_id,
                sequence_number=stop.sequence_number,
                status=StopStatus(stop.status),
                planned_arrival_time=(
                    _aware(stop.planned_arrival_time) if stop.planned_arrival_time else None
                ),
                orders=by_stop[stop.id],
            )
            for stop in stops
        ],
        completion=_completion(completion),
    )


def get_trip_loading(session: Session, user: User, trip_id: UUID) -> TripLoadingResponse:
    return _view(session, *_scoped_trip(session, user, trip_id))


def _event_response(event: LoadEvent, stop_id: UUID, trip: Trip) -> LoadEventResponse:
    return LoadEventResponse(
        event_id=event.id,
        trip_id=event.trip_id,
        stop_id=stop_id,
        order_id=event.order_id,
        status=LoadStatus(event.status),
        note=event.note,
        sequence_number=event.sequence_number,
        occurred_at=_aware(event.occurred_at) if event.occurred_at else None,
        recorded_at=_aware(event.recorded_at),
        recorded_by=event.recorded_by,
        trip_status=TripStatus(trip.status),
    )


def _fingerprint(trip_id: UUID, payload: LoadEventRequest) -> str:
    data: dict[str, Any] = {"trip_id": str(trip_id), **payload.model_dump(mode="json")}
    if payload.occurred_at is not None:
        # The same instant with another offset is the same event.
        data["occurred_at"] = payload.occurred_at.astimezone(UTC).isoformat()
    return hashlib.sha256(
        json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def record_load_event(
    session: Session, user: User, trip_id: UUID, payload: LoadEventRequest, now: datetime
) -> tuple[LoadEventResponse, bool]:
    # The trip row lock serializes events and readiness for one trip.
    trip, _, _ = _scoped_trip(session, user, trip_id, lock=True)
    fingerprint = _fingerprint(trip.id, payload)
    existing = session.get(LoadEvent, payload.event_id)
    if existing is not None:
        if existing.trip_id != trip.id or existing.request_hash != fingerprint:
            raise fail(409, "Event ID was already used with different loading data")
        stop_id = session.scalar(
            select(PlanAssignment.trip_stop_id).where(PlanAssignment.id == existing.assignment_id)
        )
        assert stop_id is not None
        return _event_response(existing, stop_id, trip), False
    if trip.status not in (TripStatus.PLANNED, TripStatus.LOADING):
        raise fail(409, "Loading is finalized for this trip")
    if payload.occurred_at is not None and payload.occurred_at > now + CLOCK_SKEW:
        raise fail(422, "Occurred time cannot be in the future")
    assignment = session.scalar(
        select(PlanAssignment).where(
            PlanAssignment.trip_id == trip.id,
            PlanAssignment.order_id == payload.order_id,
            PlanAssignment.outcome == AssignmentOutcome.SERVED,
        )
    )
    if assignment is None or assignment.trip_stop_id is None:
        raise fail(422, "Order is not assigned to this trip")
    if trip.status == TripStatus.PLANNED:
        trip.status = TripStatus.LOADING
        trip_orders = select(PlanAssignment.order_id).where(PlanAssignment.trip_id == trip.id)
        for order in session.scalars(
            select(Order)
            .where(Order.id.in_(trip_orders), Order.status == OrderStatus.PLANNED)
            .order_by(Order.id)
            .with_for_update()
        ):
            order.status = OrderStatus.LOADING
    sequence = (
        session.scalar(
            select(func.max(LoadEvent.sequence_number)).where(LoadEvent.trip_id == trip.id)
        )
        or 0
    ) + 1
    event = LoadEvent(
        id=payload.event_id,
        trip_id=trip.id,
        assignment_id=assignment.id,
        order_id=payload.order_id,
        sequence_number=sequence,
        status=payload.status,
        note=payload.note,
        request_hash=fingerprint,
        # Stored in UTC: SQLite drops offsets, and replays must return the same instant.
        occurred_at=payload.occurred_at.astimezone(UTC) if payload.occurred_at else None,
        recorded_by=user.id,
        recorded_at=now,
    )
    session.add(event)
    session.flush()
    result = _event_response(event, assignment.trip_stop_id, trip)
    session.commit()
    return result, True


def mark_trip_ready(
    session: Session, user: User, trip_id: UUID, payload: TripReadyRequest, now: datetime
) -> tuple[TripLoadingResponse, bool]:
    trip, plan, publication = _scoped_trip(session, user, trip_id, lock=True)
    existing = session.scalar(
        select(TripLoadingCompletion).where(TripLoadingCompletion.request_id == payload.request_id)
    )
    if existing is not None:
        if (
            existing.trip_id != trip.id
            or existing.last_event_sequence != payload.last_event_sequence
        ):
            raise fail(409, "Request ID was already used with different readiness data")
        return _view(session, trip, plan, publication), False
    if trip.status not in (TripStatus.PLANNED, TripStatus.LOADING):
        raise fail(409, "Loading is finalized for this trip")
    latest, last = _latest_events(session, trip.id)
    if last != payload.last_event_sequence:
        raise fail(409, "Loading changed since your last refresh; review it and retry")
    assigned = set(
        session.scalars(select(PlanAssignment.order_id).where(PlanAssignment.trip_id == trip.id))
    )
    if set(latest) != assigned:
        raise fail(409, "Every assigned order needs a loading outcome before the trip is ready")
    outcomes = [LoadStatus(event.status) for event in latest.values()]
    if LoadStatus.LOADED not in outcomes:
        raise fail(409, "At least one order must be loaded before the trip is ready")
    trip.status = TripStatus.READY
    session.add(
        TripLoadingCompletion(
            trip_id=trip.id,
            request_id=payload.request_id,
            last_event_sequence=last,
            loaded_count=outcomes.count(LoadStatus.LOADED),
            missing_count=outcomes.count(LoadStatus.MISSING),
            damaged_count=outcomes.count(LoadStatus.DAMAGED),
            confirmed_by=user.id,
            confirmed_at=now,
        )
    )
    session.flush()
    result = _view(session, trip, plan, publication)
    session.commit()
    return result, True
