"""Assigned-Driver trip execution: start, stop outcomes, proof of delivery and completion."""

import base64
import binascii
import hashlib
import json
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth.models import RoleCode, User
from app.db.transactions import BeforeCommit, commit_with
from app.delivery.models import (
    MAX_POD_BYTES,
    DeliveryEvent,
    DeliveryEventType,
    DeliveryFailureReason,
    PodMimeType,
    ProofOfDelivery,
)
from app.delivery.schemas import (
    DeliverRequest,
    DeliveryEventResponse,
    DriverOrderResponse,
    DriverStopResponse,
    DriverTripDetailResponse,
    DriverTripListResponse,
    DriverTripResponse,
    EventRequest,
    FailRequest,
    PodResponse,
    PodUploadRequest,
)
from app.fleet.models import Outlet
from app.loading.models import LoadStatus
from app.loading.service import (
    CLOCK_SKEW,
    as_utc,
    fail,
    latest_load_events,
    scoped_trips,
    trip_counts,
    trip_summary,
    trip_times,
)
from app.orders.models import Order, OrderStatus, TemperatureRequirement
from app.planning.assignment_models import PlanAssignment
from app.planning.models import Plan, StopStatus, Trip, TripStatus, TripStop
from app.planning.publication_models import PlanPublication
from app.planning.route_inputs import LOCAL_ZONE

SIGNATURES = {PodMimeType.JPEG: b"\xff\xd8\xff", PodMimeType.PNG: b"\x89PNG\r\n\x1a\n"}
STOP_EVENTS = (DeliveryEventType.ARRIVED, DeliveryEventType.DELIVERED, DeliveryEventType.FAILED)


def get_delivery_time() -> datetime:
    return datetime.now(UTC)


def _hash(data: dict[str, Any]) -> str:
    return hashlib.sha256(
        json.dumps(data, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest()


def _fingerprint(
    trip_id: UUID, stop_id: UUID | None, event_type: DeliveryEventType, payload: BaseModel
) -> str:
    data: dict[str, Any] = payload.model_dump(mode="json")
    occurred = getattr(payload, "occurred_at", None)
    if occurred is not None:
        data["occurred_at"] = occurred.astimezone(UTC).isoformat()
    return _hash({**data, "trip_id": str(trip_id), "stop_id": str(stop_id), "type": event_type})


def _driver_trip(
    session: Session, user: User, trip_id: UUID, *, lock: bool = False
) -> tuple[Trip, Plan, PlanPublication]:
    """The caller's own trip in an effective published revision of a current depot."""
    query = scoped_trips(user).where(Trip.id == trip_id, Trip.driver_id == user.id)
    row = session.execute(query.with_for_update(of=Trip) if lock else query).first()
    if row is None:
        raise fail(404, "Trip not found")
    trip, plan, publication = row
    return trip, plan, publication


def _deliverable(session: Session, trip: Trip) -> dict[UUID, list[UUID]]:
    """Orders per stop whose current loading outcome is LOADED; only these can be delivered."""
    latest, _ = latest_load_events(session, trip.id)
    stops: dict[UUID, list[UUID]] = {}
    for assignment in session.scalars(
        select(PlanAssignment)
        .where(PlanAssignment.trip_id == trip.id)
        .order_by(PlanAssignment.order_id)
    ):
        event = latest.get(assignment.order_id)
        if assignment.trip_stop_id is not None and event and event.status == LoadStatus.LOADED:
            stops.setdefault(assignment.trip_stop_id, []).append(assignment.order_id)
    return stops


def _set_orders(
    session: Session, ids: list[UUID], source: OrderStatus, target: OrderStatus
) -> None:
    for order in session.scalars(
        select(Order)
        .where(Order.id.in_(ids), Order.status == source)
        .order_by(Order.id)
        .with_for_update()
    ):
        order.status = target


def _event_response(
    event: DeliveryEvent, trip: Trip, stop: TripStop | None
) -> DeliveryEventResponse:
    return DeliveryEventResponse(
        event_id=event.id,
        trip_id=event.trip_id,
        stop_id=event.trip_stop_id,
        event_type=DeliveryEventType(event.event_type),
        reason_code=DeliveryFailureReason(event.reason_code) if event.reason_code else None,
        note=event.note,
        pod_id=event.pod_id,
        sequence_number=event.sequence_number,
        occurred_at=as_utc(event.occurred_at) if event.occurred_at else None,
        recorded_at=as_utc(event.recorded_at),
        recorded_by=event.recorded_by,
        trip_status=TripStatus(trip.status),
        stop_status=StopStatus(stop.status) if stop is not None else None,
    )


class _Transition:
    """Locks the trip (and stop), resolves replays and appends one new event."""

    def __init__(
        self,
        session: Session,
        user: User,
        trip_id: UUID,
        stop_id: UUID | None,
        event_type: DeliveryEventType,
        payload: EventRequest,
        now: datetime,
        before_commit: BeforeCommit | None = None,
    ) -> None:
        self.session, self.user, self.now, self.payload = session, user, now, payload
        self.before_commit = before_commit
        self.event_type = event_type
        self.trip, self.plan, _ = _driver_trip(session, user, trip_id, lock=True)
        self.stop: TripStop | None = None
        if stop_id is not None:
            self.stop = session.scalar(
                select(TripStop)
                .where(TripStop.id == stop_id, TripStop.trip_id == self.trip.id)
                .with_for_update()
            )
            if self.stop is None:
                raise fail(404, "Stop not found")
        self.fingerprint = _fingerprint(self.trip.id, stop_id, event_type, payload)
        self.existing = session.get(DeliveryEvent, payload.event_id)
        if self.existing is not None and (
            self.existing.trip_id != self.trip.id or self.existing.request_hash != self.fingerprint
        ):
            raise fail(409, "Event ID was already used with different delivery data")
        if self.existing is None:
            if payload.occurred_at is not None and payload.occurred_at > now + CLOCK_SKEW:
                raise fail(422, "Occurred time cannot be in the future")
            if self.trip.status != TripStatus.IN_PROGRESS and event_type != (
                DeliveryEventType.TRIP_STARTED
            ):
                raise fail(409, "The trip is not in progress")

    def replay(self) -> DeliveryEventResponse | None:
        if self.existing is None:
            return None
        return _event_response(self.existing, self.trip, self.stop)

    def append(self, **values: Any) -> DeliveryEventResponse:
        sequence = (
            self.session.scalar(
                select(func.max(DeliveryEvent.sequence_number)).where(
                    DeliveryEvent.trip_id == self.trip.id
                )
            )
            or 0
        ) + 1
        occurred = self.payload.occurred_at
        event = DeliveryEvent(
            id=self.payload.event_id,
            trip_id=self.trip.id,
            trip_stop_id=self.stop.id if self.stop is not None else None,
            event_type=self.event_type,
            sequence_number=sequence,
            request_hash=self.fingerprint,
            occurred_at=occurred.astimezone(UTC) if occurred else None,
            recorded_by=self.user.id,
            recorded_at=self.now,
            **values,
        )
        self.session.add(event)
        self.session.flush()
        result = _event_response(event, self.trip, self.stop)
        commit_with(self.session, result, self.before_commit)
        return result


def start_trip(
    session: Session,
    user: User,
    trip_id: UUID,
    payload: EventRequest,
    now: datetime,
    before_commit: BeforeCommit | None = None,
) -> tuple[DeliveryEventResponse, bool]:
    step = _Transition(
        session, user, trip_id, None, DeliveryEventType.TRIP_STARTED, payload, now, before_commit
    )
    if (replayed := step.replay()) is not None:
        return replayed, False
    trip = step.trip
    if trip.status != TripStatus.READY:
        started = trip.status in (TripStatus.IN_PROGRESS, TripStatus.COMPLETED)
        raise fail(409, "Trip has already started" if started else "Trip is not READY")
    if now.astimezone(LOCAL_ZONE).date() < step.plan.delivery_date:
        raise fail(409, "Trips can start on their delivery date")
    busy = session.scalar(
        select(Trip.id).where(
            Trip.id != trip.id,
            Trip.status == TripStatus.IN_PROGRESS,
            or_(Trip.driver_id == user.id, Trip.vehicle_id == trip.vehicle_id),
        )
    )
    if busy is not None:
        raise fail(409, "Complete the driver's or vehicle's trip in progress first")
    loaded = [order for orders in _deliverable(session, trip).values() for order in orders]
    _set_orders(session, loaded, OrderStatus.LOADING, OrderStatus.OUT_FOR_DELIVERY)
    trip.status = TripStatus.IN_PROGRESS
    return step.append(), True


def arrive_at_stop(
    session: Session,
    user: User,
    trip_id: UUID,
    stop_id: UUID,
    payload: EventRequest,
    now: datetime,
    before_commit: BeforeCommit | None = None,
) -> tuple[DeliveryEventResponse, bool]:
    step = _Transition(
        session, user, trip_id, stop_id, DeliveryEventType.ARRIVED, payload, now, before_commit
    )
    if (replayed := step.replay()) is not None:
        return replayed, False
    stop = step.stop
    assert stop is not None
    if stop.status != StopStatus.PLANNED:
        raise fail(409, "Stop is not awaiting arrival")
    if stop.id not in _deliverable(session, step.trip):
        raise fail(409, "Stop has no loaded orders to deliver")
    open_stop = session.scalar(
        select(TripStop.id).where(
            TripStop.trip_id == step.trip.id, TripStop.status == StopStatus.ARRIVED
        )
    )
    if open_stop is not None:
        raise fail(409, "Finish the current stop before arriving at another")
    stop.status = StopStatus.ARRIVED
    return step.append(), True


def deliver_stop(
    session: Session,
    user: User,
    trip_id: UUID,
    stop_id: UUID,
    payload: DeliverRequest,
    now: datetime,
    before_commit: BeforeCommit | None = None,
) -> tuple[DeliveryEventResponse, bool]:
    step = _Transition(
        session, user, trip_id, stop_id, DeliveryEventType.DELIVERED, payload, now, before_commit
    )
    if (replayed := step.replay()) is not None:
        return replayed, False
    stop = step.stop
    assert stop is not None
    if stop.status != StopStatus.ARRIVED:
        raise fail(409, "Arrive at the stop before completing delivery")
    pod = session.get(ProofOfDelivery, payload.pod_id)
    if pod is None or pod.trip_stop_id != stop.id:
        raise fail(409, "Upload proof of delivery for this stop first")
    _set_orders(
        session,
        _deliverable(session, step.trip).get(stop.id, []),
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
    )
    stop.status = StopStatus.DELIVERED
    return step.append(pod_id=pod.id), True


def fail_stop(
    session: Session,
    user: User,
    trip_id: UUID,
    stop_id: UUID,
    payload: FailRequest,
    now: datetime,
    before_commit: BeforeCommit | None = None,
) -> tuple[DeliveryEventResponse, bool]:
    step = _Transition(
        session, user, trip_id, stop_id, DeliveryEventType.FAILED, payload, now, before_commit
    )
    if (replayed := step.replay()) is not None:
        return replayed, False
    stop = step.stop
    assert stop is not None
    if stop.status not in (StopStatus.PLANNED, StopStatus.ARRIVED):
        raise fail(409, "Stop already has a delivery outcome")
    if stop.id not in _deliverable(session, step.trip):
        raise fail(409, "Stop has no loaded orders to deliver")
    # Orders stay OUT_FOR_DELIVERY: a failed stop is never reported as delivered.
    stop.status = StopStatus.FAILED
    return step.append(reason_code=payload.reason_code, note=payload.note), True


def complete_trip(
    session: Session,
    user: User,
    trip_id: UUID,
    payload: EventRequest,
    now: datetime,
    before_commit: BeforeCommit | None = None,
) -> tuple[DeliveryEventResponse, bool]:
    step = _Transition(
        session, user, trip_id, None, DeliveryEventType.TRIP_COMPLETED, payload, now, before_commit
    )
    if (replayed := step.replay()) is not None:
        return replayed, False
    required = set(_deliverable(session, step.trip))
    statuses = {
        stop.id: stop.status
        for stop in session.scalars(select(TripStop).where(TripStop.trip_id == step.trip.id))
    }
    if any(
        statuses[stop_id] not in (StopStatus.DELIVERED, StopStatus.FAILED) for stop_id in required
    ):
        raise fail(409, "Every stop with loaded orders needs a delivered or failed outcome")
    step.trip.status = TripStatus.COMPLETED
    return step.append(), True


def _pod_response(pod: ProofOfDelivery) -> PodResponse:
    return PodResponse(
        pod_id=pod.id,
        trip_id=pod.trip_id,
        stop_id=pod.trip_stop_id,
        receiver_name=pod.receiver_name,
        photo_mime_type=PodMimeType(pod.photo_mime_type),
        photo_size_bytes=pod.photo_size_bytes,
        photo_sha256=pod.photo_sha256,
        captured_at=as_utc(pod.captured_at) if pod.captured_at else None,
        uploaded_at=as_utc(pod.uploaded_at),
        uploaded_by=pod.uploaded_by,
    )


def upload_pod(
    session: Session,
    user: User,
    trip_id: UUID,
    stop_id: UUID,
    payload: PodUploadRequest,
    now: datetime,
) -> tuple[PodResponse, bool]:
    trip, _, _ = _driver_trip(session, user, trip_id, lock=True)
    stop = session.scalar(
        select(TripStop)
        .where(TripStop.id == stop_id, TripStop.trip_id == trip.id)
        .with_for_update()
    )
    if stop is None:
        raise fail(404, "Stop not found")
    try:
        photo = base64.b64decode(payload.photo_base64, validate=True)
    except (binascii.Error, ValueError):
        raise fail(422, "Photo must be valid base64") from None
    digest = hashlib.sha256(photo).hexdigest()
    captured = payload.captured_at.astimezone(UTC) if payload.captured_at else None
    fingerprint = _hash(
        {
            "pod_id": str(payload.pod_id),
            "stop_id": str(stop.id),
            "receiver_name": payload.receiver_name,
            "mime": payload.photo_mime_type,
            "sha256": digest,
            "captured_at": captured.isoformat() if captured else None,
        }
    )
    existing = session.get(ProofOfDelivery, payload.pod_id)
    if existing is not None:
        if existing.trip_stop_id != stop.id or existing.request_hash != fingerprint:
            raise fail(409, "POD ID was already used with different data")
        return _pod_response(existing), False
    if trip.status != TripStatus.IN_PROGRESS or stop.status != StopStatus.ARRIVED:
        raise fail(409, "Proof of delivery can only be added after arriving at the stop")
    if session.scalar(select(ProofOfDelivery.id).where(ProofOfDelivery.trip_stop_id == stop.id)):
        raise fail(409, "This stop already has proof of delivery")
    if not 0 < len(photo) <= MAX_POD_BYTES:
        raise fail(422, f"Photo must be between 1 byte and {MAX_POD_BYTES} bytes")
    if not photo.startswith(SIGNATURES[payload.photo_mime_type]):
        raise fail(422, "Photo content does not match its declared JPEG or PNG type")
    if captured is not None and captured > now + CLOCK_SKEW:
        raise fail(422, "Captured time cannot be in the future")
    pod = ProofOfDelivery(
        id=payload.pod_id,
        trip_id=trip.id,
        trip_stop_id=stop.id,
        receiver_name=payload.receiver_name.strip(),
        photo_mime_type=payload.photo_mime_type,
        photo_bytes=photo,
        photo_size_bytes=len(photo),
        photo_sha256=digest,
        request_hash=fingerprint,
        captured_at=captured,
        uploaded_by=user.id,
        uploaded_at=now,
    )
    session.add(pod)
    session.flush()
    result = _pod_response(pod)
    session.commit()
    return result, True


def read_pod(session: Session, user: User, trip_id: UUID, stop_id: UUID) -> ProofOfDelivery:
    """Dispatchers in the depot, or the trip's assigned Driver, may read the photo."""
    query = scoped_trips(user).where(Trip.id == trip_id)
    roles = {assignment.role.code for assignment in user.role_assignments}
    if RoleCode.DISPATCHER not in roles:
        query = query.where(Trip.driver_id == user.id)
    if session.execute(query).first() is None:
        raise fail(404, "Trip not found")
    pod = session.scalar(
        select(ProofOfDelivery).where(
            ProofOfDelivery.trip_id == trip_id, ProofOfDelivery.trip_stop_id == stop_id
        )
    )
    if pod is None:
        raise fail(404, "Proof of delivery not found")
    return pod


def list_driver_trips(
    session: Session,
    user: User,
    *,
    delivery_date: date | None,
    status: TripStatus | None,
    limit: int,
    offset: int,
) -> DriverTripListResponse:
    query = scoped_trips(user).where(Trip.driver_id == user.id)
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
    stops, orders = trip_counts(session, [trip.id for trip, _, _ in rows])
    items = []
    for trip, plan, publication in rows:
        summary = trip_summary(
            trip, plan, trip_times(publication), stops.get(trip.id, 0), orders.get(trip.id, 0)
        )
        items.append(DriverTripResponse(**summary.model_dump()))
    return DriverTripListResponse(items=items, total=total, limit=limit, offset=offset)


def get_driver_trip(session: Session, user: User, trip_id: UUID) -> DriverTripDetailResponse:
    trip, plan, publication = _driver_trip(session, user, trip_id)
    stops = session.execute(
        select(TripStop, Outlet)
        .join(Outlet, TripStop.outlet_id == Outlet.id)
        .where(TripStop.trip_id == trip.id)
        .order_by(TripStop.sequence_number)
    ).all()
    assigned = session.execute(
        select(PlanAssignment, Order)
        .join(Order, PlanAssignment.order_id == Order.id)
        .where(PlanAssignment.trip_id == trip.id)
        .order_by(Order.id)
    ).all()
    latest, _ = latest_load_events(session, trip.id)
    deliverable = _deliverable(session, trip)
    events = session.scalars(
        select(DeliveryEvent)
        .where(DeliveryEvent.trip_id == trip.id)
        .order_by(DeliveryEvent.sequence_number)
    ).all()
    pods = {
        pod.trip_stop_id: pod
        for pod in session.scalars(
            select(ProofOfDelivery).where(ProofOfDelivery.trip_id == trip.id)
        )
    }

    def when(event: DeliveryEvent) -> datetime:
        return as_utc(event.occurred_at or event.recorded_at)

    lifecycle = {event.event_type: when(event) for event in events if event.trip_stop_id is None}
    by_stop: dict[tuple[UUID | None, str], DeliveryEvent] = {
        (event.trip_stop_id, event.event_type): event for event in events
    }
    orders: dict[UUID, list[DriverOrderResponse]] = {}
    for assignment, order in assigned:
        event = latest.get(order.id)
        if assignment.trip_stop_id is None:
            continue
        orders.setdefault(assignment.trip_stop_id, []).append(
            DriverOrderResponse(
                order_id=order.id,
                order_status=OrderStatus(order.status),
                temperature_requirement=TemperatureRequirement(order.temperature_requirement),
                order_weight_kg=order.order_weight_kg,
                order_volume_m3=order.order_volume_m3,
                load_status=LoadStatus(event.status) if event else None,
                deliverable=order.id in deliverable.get(assignment.trip_stop_id, []),
            )
        )
    result_stops = []
    for stop, outlet in stops:
        arrived = by_stop.get((stop.id, DeliveryEventType.ARRIVED))
        outcome = by_stop.get((stop.id, DeliveryEventType.DELIVERED)) or by_stop.get(
            (stop.id, DeliveryEventType.FAILED)
        )
        pod = pods.get(stop.id)
        result_stops.append(
            DriverStopResponse(
                stop_id=stop.id,
                outlet_id=outlet.id,
                outlet_brand=outlet.brand,
                outlet_district=outlet.district,
                window_open_time=outlet.window_open_time,
                window_close_time=outlet.window_close_time,
                sequence_number=stop.sequence_number,
                status=StopStatus(stop.status),
                planned_arrival_time=(
                    as_utc(stop.planned_arrival_time) if stop.planned_arrival_time else None
                ),
                requires_visit=stop.id in deliverable,
                arrived_at=when(arrived) if arrived else None,
                outcome_at=when(outcome) if outcome else None,
                failure_reason=(
                    DeliveryFailureReason(outcome.reason_code)
                    if outcome is not None and outcome.reason_code
                    else None
                ),
                failure_note=outcome.note if outcome is not None else None,
                pod=_pod_response(pod) if pod is not None else None,
                orders=orders.get(stop.id, []),
            )
        )
    summary = trip_summary(trip, plan, trip_times(publication), len(stops), len(assigned))
    return DriverTripDetailResponse(
        trip=DriverTripResponse(**summary.model_dump()),
        last_event_sequence=events[-1].sequence_number if events else 0,
        started_at=lifecycle.get(DeliveryEventType.TRIP_STARTED),
        completed_at=lifecycle.get(DeliveryEventType.TRIP_COMPLETED),
        stops=result_stops,
    )
