"""Apply ordered Driver/Loader event batches through the existing domain services."""

import hashlib
import json
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.audit.models import AuditAction, AuditEntity, AuditEvent
from app.audit.service import record_audit
from app.auth.models import RoleCode, User, UserDepot
from app.db.transactions import BeforeCommit
from app.delivery.schemas import DeliverRequest, EventRequest, FailRequest
from app.delivery.service import (
    arrive_at_stop,
    complete_trip,
    deliver_stop,
    fail_stop,
    start_trip,
)
from app.loading.schemas import LoadEventRequest, TripReadyRequest
from app.loading.service import mark_trip_ready, record_load_event
from app.planning.models import Plan, PlanRevision, Trip, TripStop
from app.planning.publication_models import PlanPublication
from app.sync.models import SyncEntityType, SyncEvent, SyncEventType
from app.sync.schemas import (
    SyncBatchRequest,
    SyncBatchResponse,
    SyncEventIn,
    SyncEventResult,
    SyncOutcome,
)

Handler = Callable[..., tuple[BaseModel, bool]]
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _Route:
    role: RoleCode
    request: type[BaseModel]
    id_field: str
    handler: Handler
    entity: SyncEntityType


ROUTES = {
    SyncEventType.LOAD_RECORDED: _Route(
        RoleCode.LOADER, LoadEventRequest, "event_id", record_load_event, SyncEntityType.ORDER
    ),
    SyncEventType.TRIP_READY: _Route(
        RoleCode.LOADER, TripReadyRequest, "request_id", mark_trip_ready, SyncEntityType.TRIP
    ),
    SyncEventType.TRIP_STARTED: _Route(
        RoleCode.DRIVER, EventRequest, "event_id", start_trip, SyncEntityType.TRIP
    ),
    SyncEventType.STOP_ARRIVED: _Route(
        RoleCode.DRIVER, EventRequest, "event_id", arrive_at_stop, SyncEntityType.STOP
    ),
    SyncEventType.STOP_DELIVERED: _Route(
        RoleCode.DRIVER, DeliverRequest, "event_id", deliver_stop, SyncEntityType.STOP
    ),
    SyncEventType.STOP_FAILED: _Route(
        RoleCode.DRIVER, FailRequest, "event_id", fail_stop, SyncEntityType.STOP
    ),
    SyncEventType.TRIP_COMPLETED: _Route(
        RoleCode.DRIVER, EventRequest, "event_id", complete_trip, SyncEntityType.TRIP
    ),
}


def get_sync_time() -> datetime:
    return datetime.now(UTC)


class _Outcome(Exception):
    def __init__(self, outcome: SyncOutcome, status: int, detail: str) -> None:
        super().__init__(detail)
        self.outcome, self.status, self.detail = outcome, status, detail


def _from_http(error: HTTPException) -> _Outcome:
    status = error.status_code
    if status == 409:
        outcome = SyncOutcome.CONFLICT
    elif status >= 500:
        outcome = SyncOutcome.RETRY
    else:
        outcome = SyncOutcome.REJECTED
    return _Outcome(outcome, status, str(error.detail))


def _fingerprint(event: SyncEventIn, request: BaseModel) -> str:
    data: dict[str, Any] = request.model_dump(mode="json")
    occurred = getattr(request, "occurred_at", None)
    if occurred is not None:
        data["occurred_at"] = occurred.astimezone(UTC).isoformat()
    body = {"type": event.type, "trip_id": str(event.trip_id), "stop_id": str(event.stop_id)}
    return hashlib.sha256(
        json.dumps({**body, **data}, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _apply(
    session: Session, user: User, device_id: str, event: SyncEventIn, now: datetime
) -> tuple[SyncOutcome, int, BaseModel]:
    route = ROUTES[event.type]
    roles = {assignment.role.code for assignment in user.role_assignments}
    if route.role not in roles:
        raise _Outcome(SyncOutcome.REJECTED, 403, f"{event.type} requires the {route.role} role")
    if route.id_field in event.payload:
        raise _Outcome(SyncOutcome.REJECTED, 422, f"payload must not contain {route.id_field}")
    try:
        request = route.request.model_validate({**event.payload, route.id_field: event.event_id})
    except ValidationError as error:
        raise _Outcome(SyncOutcome.REJECTED, 422, _validation_detail(error)) from None
    fingerprint = _fingerprint(event, request)
    receipt = session.scalar(select(SyncEvent).where(SyncEvent.event_id == event.event_id))
    if receipt is not None and (receipt.request_hash != fingerprint or receipt.user_id != user.id):
        raise _Outcome(SyncOutcome.CONFLICT, 409, "Event ID was already used with different data")
    entity_id = {
        SyncEntityType.TRIP: event.trip_id,
        SyncEntityType.STOP: event.stop_id,
        SyncEntityType.ORDER: getattr(request, "order_id", None),
    }[route.entity]

    def add_receipt(_: BaseModel) -> None:
        assert entity_id is not None
        session.add(
            SyncEvent(
                event_id=event.event_id,
                device_id=device_id,
                user_id=user.id,
                trip_id=event.trip_id,
                entity_type=route.entity,
                entity_id=entity_id,
                event_type=event.type,
                request_hash=fingerprint,
                received_at=now,
            )
        )

    hook: BeforeCommit | None = add_receipt if receipt is None else None
    args: list[Any] = [session, user, event.trip_id]
    if event.stop_id is not None:
        args.append(event.stop_id)
    result, created = route.handler(*args, request, now, hook)
    return (
        (SyncOutcome.APPLIED if created else SyncOutcome.DUPLICATE),
        (201 if created else 200),
        result,
    )


def _validation_detail(error: ValidationError) -> str:
    first = error.errors()[0]
    location = ".".join(str(part) for part in first.get("loc", ()))
    return f"{location}: {first.get('msg', 'invalid')}" if location else first.get("msg", "")


def _guess_id(raw: Any, field: str) -> UUID | None:
    try:
        return UUID(str(raw.get(field))) if isinstance(raw, dict) else None
    except ValueError:
        return None


def _record_conflict(
    session: Session, user: User, event: SyncEventIn, detail: str, now: datetime
) -> None:
    """Audit a conflicting event for Dispatchers: best effort, bounded, authorized trips only.

    One entry per user, trip, event type and server reason, so varied payloads or fresh
    event IDs cannot grow the history without limit.
    """
    try:
        allowed = select(UserDepot.depot_id).where(UserDepot.user_id == user.id)
        query = (
            select(Plan.depot_id)
            .select_from(Trip)
            .join(PlanRevision, Trip.plan_revision_id == PlanRevision.id)
            .join(Plan, PlanRevision.plan_id == Plan.id)
            .join(PlanPublication, PlanPublication.plan_revision_id == PlanRevision.id)
            .where(Trip.id == event.trip_id, Plan.depot_id.in_(allowed))
        )
        # Same trip scope as the event's own endpoint: Drivers only for assigned trips.
        if ROUTES[event.type].role == RoleCode.DRIVER:
            query = query.where(Trip.driver_id == user.id)
        depot_id = session.scalar(query)
        if depot_id is None:
            return
        stop_id = None
        if event.stop_id is not None:
            stop_id = session.scalar(
                select(TripStop.id).where(
                    TripStop.id == event.stop_id, TripStop.trip_id == event.trip_id
                )
            )
        reason = hashlib.sha256(detail.encode()).hexdigest()[:16]
        suffix = f":{user.id}:{event.type}:{reason}"
        key = f"{AuditAction.SYNC_CONFLICT}:{event.trip_id}{suffix}"
        if session.scalar(select(AuditEvent.id).where(AuditEvent.dedupe_key == key)):
            return
        record_audit(
            session,
            actor_id=user.id,
            action=AuditAction.SYNC_CONFLICT,
            entity_type=AuditEntity.STOP if stop_id else AuditEntity.TRIP,
            entity_id=stop_id or event.trip_id,
            depot_id=depot_id,
            trip_id=event.trip_id,
            source_id=event.trip_id,
            occurred_at=now,
            # Server-generated text only; client-supplied fields are not copied.
            details={"event_type": event.type, "event_id": str(event.event_id), "detail": detail},
            dedupe_suffix=suffix,
        )
        session.commit()
    except SQLAlchemyError:
        # A concurrent identical conflict or database error must not fail the batch.
        session.rollback()


def sync_events(
    session: Session, user: User, batch: SyncBatchRequest, now: datetime
) -> SyncBatchResponse:
    """Process events in array order, each in its own transaction (partial success)."""
    results: list[SyncEventResult] = []
    blocked: set[UUID] = set()
    device_id = batch.device_id.strip()
    for index, raw in enumerate(batch.events):
        try:
            event = SyncEventIn.model_validate(raw)
        except ValidationError as error:
            # Block the trip too, so later events of it are not applied out of order.
            if (trip_id := _guess_id(raw, "trip_id")) is not None:
                blocked.add(trip_id)
            results.append(
                SyncEventResult(
                    index=index,
                    event_id=_guess_id(raw, "event_id"),
                    type=None,
                    trip_id=None,
                    outcome=SyncOutcome.REJECTED,
                    http_status=422,
                    detail=_validation_detail(error),
                    result=None,
                )
            )
            continue

        def record(outcome: SyncOutcome, status: int, detail: str | None, result: Any) -> None:
            results.append(
                SyncEventResult(
                    index=index,
                    event_id=event.event_id,
                    type=event.type,
                    trip_id=event.trip_id,
                    outcome=outcome,
                    http_status=status,
                    detail=detail,
                    result=result,
                )
            )

        if event.trip_id in blocked:
            record(SyncOutcome.SKIPPED, 424, "An earlier event for this trip was not applied", None)
            continue
        try:
            outcome, status, result = _apply(session, user, device_id, event, now)
        except _Outcome as error:
            session.rollback()
            outcome, status, detail = error.outcome, error.status, error.detail
        except HTTPException as error:
            session.rollback()
            mapped = _from_http(error)
            outcome, status, detail = mapped.outcome, mapped.status, mapped.detail
        except (IntegrityError, DBAPIError):
            # Lost receipt races and connection/lock failures: nothing was committed.
            session.rollback()
            outcome, status, detail = (
                SyncOutcome.RETRY,
                503,
                "Sync unavailable; retry this event unchanged",
            )
        except Exception:
            # Deterministic failures would repeat forever if reported as retryable.
            session.rollback()
            logger.exception("Sync event %s could not be processed", event.event_id)
            outcome, status, detail = (
                SyncOutcome.REJECTED,
                500,
                "Event could not be processed; report it to support",
            )
        else:
            record(outcome, status, None, result.model_dump(mode="json"))
            continue
        if outcome == SyncOutcome.CONFLICT:
            _record_conflict(session, user, event, detail, now)
        blocked.add(event.trip_id)
        record(outcome, status, detail, None)
    counts = dict.fromkeys(SyncOutcome, 0)
    for item in results:
        counts[item.outcome] += 1
    return SyncBatchResponse(device_id=device_id, received_at=now, results=results, counts=counts)
