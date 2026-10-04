"""Publish one optimized revision after reloading and revalidating current inputs."""

import hashlib
import json
from collections.abc import Sequence
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.audit.models import AuditAction, AuditEntity
from app.audit.service import record_audit
from app.auth.models import Role, RoleCode, User, UserDepot, UserRole
from app.fleet.models import Depot
from app.orders.models import OrderStatus
from app.planning.assignment_models import DeferralReason
from app.planning.models import Plan, PlanRevision, PlanStatus, Trip
from app.planning.optimization_models import PlanOptimization
from app.planning.optimization_schemas import OptimizationResponse
from app.planning.optimization_service import (
    compatibility_inputs,
    consumed_fuel,
    fail,
    load_availability,
    lock_depot_inputs,
    reserved_fuel,
    scoped_plan,
)
from app.planning.optimizer import DraftDeferral, OptimizedDraft
from app.planning.publication_models import FuelReservation, PlanPublication
from app.planning.publication_schemas import (
    FuelBalanceResponse,
    PublicationResponse,
    PublishedTripResponse,
    PublishRequest,
)
from app.planning.route_inputs import (
    LOCAL_ZONE,
    RouteInputs,
    RouteOrder,
    RouteOutlet,
    VehicleRouteInput,
)
from app.planning.routing import RouteSchedule, RouteStatus, ScheduledStop, ScheduledTrip
from app.planning.validation import PlanningValidationError, validate_draft

Interval = tuple[UUID, UUID | None, datetime, datetime]


def stale() -> HTTPException:
    return fail(
        409, "Current orders, fleet or fuel no longer match this revision; run a new optimization"
    )


def get_publication(session: Session, user: User, plan_id: UUID) -> PublicationResponse:
    scoped_plan(session, user, plan_id)
    record = session.scalar(select(PlanPublication).where(PlanPublication.plan_id == plan_id))
    if record is None:
        raise fail(404, "Plan has not been published")
    return PublicationResponse.model_validate(record.result_snapshot)


def _saved_draft(saved: OptimizationResponse) -> OptimizedDraft:
    trips = tuple(
        ScheduledTrip(
            vehicle_id=trip.vehicle_id,
            trip_number=trip.trip_number,
            departure_at=trip.departure_at,
            return_at=trip.return_at,
            stops=tuple(
                ScheduledStop(
                    outlet_id=stop.outlet_id,
                    sequence_number=stop.sequence_number,
                    order_ids=stop.order_ids,
                    arrival_at=stop.arrival_at,
                    service_start_at=stop.service_start_at,
                    departure_at=stop.departure_at,
                )
                for stop in trip.stops
            ),
            distance_km=Decimal(trip.distance_km),
            fuel_l=Decimal(trip.fuel_l),
        )
        for trip in saved.trips
    )
    return OptimizedDraft(
        schedule=RouteSchedule(
            status=RouteStatus.FEASIBLE,
            trips=trips,
            unallocated_order_ids=tuple(item.order_id for item in saved.deferrals),
            unscheduled_order_ids=(),
            source=saved.source,
            is_synthetic=saved.is_synthetic,
        ),
        deferrals=tuple(
            DraftDeferral(item.order_id, DeferralReason(item.reason_code), item.reason_text)
            for item in saved.deferrals
        ),
    )


def _other_published_work(
    session: Session, plan: Plan, vehicle_ids: set[UUID], driver_ids: set[UUID]
) -> list[Interval]:
    """Published trips that can overlap this plan date; times come from saved snapshots."""
    trips = session.scalars(
        select(Trip)
        .join(PlanRevision, Trip.plan_revision_id == PlanRevision.id)
        .join(Plan, PlanRevision.plan_id == Plan.id)
        .where(
            Plan.id != plan.id,
            PlanRevision.status == PlanStatus.PUBLISHED,
            Plan.delivery_date.between(
                plan.delivery_date - timedelta(days=1), plan.delivery_date + timedelta(days=1)
            ),
            or_(Trip.vehicle_id.in_(vehicle_ids), Trip.driver_id.in_(driver_ids)),
        )
    ).all()
    times = {}
    for record in session.scalars(
        select(PlanOptimization).where(
            PlanOptimization.plan_revision_id.in_({trip.plan_revision_id for trip in trips})
        )
    ):
        for saved in OptimizationResponse.model_validate(record.result_snapshot).trips:
            times[saved.id] = (saved.departure_at, saved.return_at)
    if any(trip.id not in times for trip in trips):
        raise fail(409, "Published work without a saved schedule blocks publication")
    return [(trip.vehicle_id, trip.driver_id, *times[trip.id]) for trip in trips]


def _check_operational_limits(
    plan: Plan, planned: Sequence[Interval], others: Sequence[Interval]
) -> None:
    for index, (vehicle, driver, start, end) in enumerate(planned):
        for _, other_driver, other_start, other_end in planned[index + 1 :]:
            if driver == other_driver and start < other_end and other_start < end:
                raise fail(422, "A driver cannot be assigned to overlapping trips")
        for other_vehicle, other_driver, other_start, other_end in others:
            if (vehicle == other_vehicle or driver == other_driver) and (
                start < other_end and other_start < end
            ):
                raise fail(409, "An assigned vehicle or driver already has published work then")
    for vehicle in {item[0] for item in planned}:
        same_day = [
            item
            for item in [*planned, *others]
            if item[0] == vehicle and item[2].astimezone(LOCAL_ZONE).date() == plan.delivery_date
        ]
        if len(same_day) > 2:
            raise fail(409, "A vehicle cannot exceed two published trips on the delivery date")


def _check_drivers(session: Session, plan: Plan, driver_ids: list[UUID]) -> None:
    # Row locks serialize concurrent publications assigning the same driver.
    session.scalars(
        select(User.id).where(User.id.in_(driver_ids)).order_by(User.id).with_for_update()
    ).all()
    eligible = set(
        session.scalars(
            select(User.id)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, UserRole.role_id == Role.id)
            .join(UserDepot, UserDepot.user_id == User.id)
            .where(
                User.id.in_(driver_ids),
                User.is_active.is_(True),
                Role.code == RoleCode.DRIVER,
                UserDepot.depot_id == plan.depot_id,
            )
            # Lock the role/depot grants so revocation cannot commit mid-publication.
            .with_for_update(of=(UserRole, UserDepot))
        )
    )
    if eligible != set(driver_ids):
        raise fail(422, "Each driver must be an active Driver assigned to this depot")


def create_publication(
    session: Session,
    user: User,
    plan_id: UUID,
    revision_id: UUID,
    payload: PublishRequest,
    now: datetime,
) -> tuple[PublicationResponse, bool]:
    plan = scoped_plan(session, user, plan_id, lock=True)
    fingerprint = hashlib.sha256(
        json.dumps(
            {
                "revision_id": str(revision_id),
                "request_id": str(payload.request_id),
                # Assignment order carries no meaning; retries may reorder it.
                "driver_assignments": sorted(
                    (str(item.trip_id), str(item.driver_id)) for item in payload.driver_assignments
                ),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    previous = session.get(PlanPublication, payload.request_id)
    if previous is not None:
        if previous.plan_id != plan.id or previous.request_hash != fingerprint:
            raise fail(409, "Request ID was already used with different publication inputs")
        return PublicationResponse.model_validate(previous.result_snapshot), False
    if plan.status != PlanStatus.DRAFT:
        raise fail(409, "This plan already has a published revision")
    record = session.scalar(
        select(PlanOptimization)
        .join(PlanRevision, PlanOptimization.plan_revision_id == PlanRevision.id)
        .where(PlanRevision.plan_id == plan.id, PlanRevision.id == revision_id)
    )
    revision = session.get(PlanRevision, revision_id)
    if record is None or revision is None:
        raise fail(404, "Optimization result not found")
    if revision.status != PlanStatus.DRAFT:
        raise fail(409, "This plan already has a published revision")
    session.scalar(select(Depot.id).where(Depot.id == plan.depot_id).with_for_update())
    today = now.astimezone(LOCAL_ZONE).date()
    if plan.delivery_date < today:
        raise fail(422, "Cannot publish a past delivery date")
    saved = OptimizationResponse.model_validate(record.result_snapshot)
    snapshot = RouteInputs.model_validate(record.input_snapshot["routes"])
    drivers = {item.trip_id: item.driver_id for item in payload.driver_assignments}
    if set(drivers) != {trip.id for trip in saved.trips}:
        raise fail(422, "Assign exactly one driver to every trip in the revision")
    if any(trip.departure_at < now for trip in saved.trips):
        raise fail(409, "A planned departure has passed; run a new optimization")

    # Same lock order as optimization: plan, depot, orders/outlets, vehicles, then drivers.
    rows, fleet = lock_depot_inputs(session, plan)
    availability = load_availability(session, fleet, plan.delivery_date)
    orders, vehicles = compatibility_inputs(rows, fleet, availability, plan.delivery_date)
    fleet_map = {vehicle.id: vehicle for vehicle in fleet}
    used = sorted({trip.vehicle_id for trip in saved.trips})
    if any(vehicle_id not in fleet_map for vehicle_id in used):
        raise stale()
    week_start = plan.delivery_date - timedelta(days=plan.delivery_date.weekday())
    consumed = consumed_fuel(session, used, week_start, today)
    reserved = reserved_fuel(session, used, week_start, today)
    shifts = {item.vehicle_id: item for item in snapshot.vehicles}
    services = {item.outlet_id: item.service_seconds for item in snapshot.outlets}
    outlets = {outlet.id: outlet for _, outlet in rows}
    try:
        current = RouteInputs(
            depot_id=plan.depot_id,
            delivery_date=plan.delivery_date,
            source=snapshot.source,
            is_synthetic=snapshot.is_synthetic,
            outlets=tuple(
                RouteOutlet(
                    outlet_id=outlet.id,
                    window_open=outlet.window_open_time,
                    window_close=outlet.window_close_time,
                    service_seconds=services[outlet.id],
                )
                for outlet in outlets.values()
            ),
            orders=tuple(
                RouteOrder(order_id=order.id, outlet_id=outlet.id) for order, outlet in rows
            ),
            vehicles=tuple(
                VehicleRouteInput(
                    **{
                        **shifts[vehicle_id].model_dump(),
                        "available_dates": tuple(
                            day
                            for day in (plan.delivery_date, plan.delivery_date + timedelta(days=1))
                            if availability.get((vehicle_id, day)) is True
                        ),
                        "km_per_l": fleet_map[vehicle_id].km_per_l,
                        "weekly_fuel_quota_l": fleet_map[vehicle_id].weekly_fuel_quota_l,
                        "fuel_used_l": consumed[vehicle_id],
                        "fuel_reserved_l": reserved[vehicle_id],
                    }
                )
                for vehicle_id in used
            ),
            legs=snapshot.legs,
        )
        validate_draft(_saved_draft(saved), orders, vehicles, current)
    except (KeyError, ValidationError, PlanningValidationError):
        raise stale() from None

    driver_ids = sorted(set(drivers.values()))
    _check_drivers(session, plan, driver_ids)
    planned = [
        (trip.vehicle_id, drivers[trip.id], trip.departure_at, trip.return_at)
        for trip in saved.trips
    ]
    others = _other_published_work(session, plan, set(used), set(driver_ids))
    _check_operational_limits(plan, planned, others)

    trips = {
        trip.id: trip
        for trip in session.scalars(
            select(Trip).where(Trip.plan_revision_id == revision.id).with_for_update()
        )
    }
    if set(trips) != set(drivers):
        raise stale()
    for trip_id, driver_id in drivers.items():
        trips[trip_id].driver_id = driver_id
    session.add_all(
        FuelReservation(
            trip_id=trip.id,
            vehicle_id=trip.vehicle_id,
            service_date=plan.delivery_date,
            fuel_l=Decimal(trip.fuel_l),
        )
        for trip in saved.trips
    )
    served = {
        order_id for trip in saved.trips for stop in trip.stops for order_id in stop.order_ids
    }
    for order, _ in rows:
        order.status = OrderStatus.PLANNED if order.id in served else OrderStatus.DEFERRED
    revision.status = PlanStatus.PUBLISHED
    revision.published_at = now
    plan.status = PlanStatus.PUBLISHED

    planned_fuel = dict.fromkeys(used, Decimal(0))
    for trip in saved.trips:
        planned_fuel[trip.vehicle_id] += Decimal(trip.fuel_l)
    balances = []
    for vehicle_id in used:
        quota = fleet_map[vehicle_id].weekly_fuel_quota_l
        total_reserved = reserved[vehicle_id] + planned_fuel[vehicle_id]
        balances.append(
            FuelBalanceResponse(
                vehicle_id=vehicle_id,
                week_start=week_start,
                weekly_quota_l=format(quota, ".3f"),
                consumed_l=format(consumed[vehicle_id], ".3f"),
                reserved_l=format(total_reserved, ".3f"),
                remaining_l=format(quota - consumed[vehicle_id] - total_reserved, ".3f"),
            )
        )
    result = PublicationResponse(
        request_id=payload.request_id,
        plan_id=plan.id,
        revision_id=revision.id,
        revision_number=revision.revision_number,
        published_at=now,
        published_by=user.id,
        served_order_count=len(served),
        deferred_order_count=len(saved.deferrals),
        trips=[
            PublishedTripResponse(
                trip_id=trip.id,
                vehicle_id=trip.vehicle_id,
                trip_number=trip.trip_number,
                driver_id=drivers[trip.id],
                departure_at=trip.departure_at,
                return_at=trip.return_at,
                fuel_l=trip.fuel_l,
            )
            for trip in saved.trips
        ],
        fuel_balances=balances,
    )
    session.add(
        PlanPublication(
            request_id=payload.request_id,
            plan_id=plan.id,
            plan_revision_id=revision.id,
            request_hash=fingerprint,
            published_by=user.id,
            published_at=now,
            result_snapshot=result.model_dump(mode="json"),
        )
    )
    record_audit(
        session,
        actor_id=user.id,
        action=AuditAction.PLAN_PUBLISHED,
        entity_type=AuditEntity.PLAN,
        entity_id=plan.id,
        depot_id=plan.depot_id,
        trip_id=None,
        source_id=payload.request_id,
        occurred_at=now,
        details={
            "revision_id": str(revision.id),
            "revision_number": revision.revision_number,
            "plan_status": {"from": PlanStatus.DRAFT, "to": PlanStatus.PUBLISHED},
            "trip_count": len(saved.trips),
            "served_order_count": len(served),
            "deferred_order_count": len(saved.deferrals),
        },
    )
    session.flush()
    session.commit()
    return result, True
