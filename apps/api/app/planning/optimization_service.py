import hashlib
import json
from dataclasses import asdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException
from pydantic import TypeAdapter
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.models import User, UserDepot
from app.fleet.models import Depot, Outlet, ParkingConstraint, TemperatureType, Vehicle, VehicleType
from app.fleet.operations_models import VehicleAvailability, VehicleFuelUsage
from app.orders.models import Order, OrderStatus, TemperatureRequirement
from app.planning.assignment_models import AssignmentOutcome, DeferralDecision, PlanAssignment
from app.planning.compatibility import CompatibilityOrder, CompatibilityVehicle
from app.planning.models import Plan, PlanRevision, PlanStatus, Trip, TripStop
from app.planning.optimization_models import PlanOptimization
from app.planning.optimization_schemas import (
    DeferredOrderResponse,
    OptimizationResponse,
    OptimizeRequest,
    SavedStopResponse,
    SavedTripResponse,
)
from app.planning.optimizer import optimize_draft
from app.planning.publication_models import FuelReservation
from app.planning.route_inputs import (
    LOCAL_ZONE,
    RouteInputs,
    RouteOrder,
    RouteOutlet,
    VehicleRouteInput,
)
from app.planning.validation import validate_draft


def fail(status: int, detail: str) -> HTTPException:
    return HTTPException(status_code=status, detail=detail, headers={"Cache-Control": "no-store"})


def scoped_plan(session: Session, user: User, plan_id: UUID, *, lock: bool = False) -> Plan:
    allowed = select(UserDepot.depot_id).where(UserDepot.user_id == user.id)
    query = select(Plan).where(Plan.id == plan_id, Plan.depot_id.in_(allowed))
    plan = session.scalar(query.with_for_update() if lock else query)
    if plan is None:
        raise fail(404, "Plan not found")
    return plan


def consumed_fuel(
    session: Session, vehicle_ids: list[UUID], week_start: date, today: date
) -> dict[UUID, Decimal]:
    """Authoritative consumed totals for Monday through today; missing days are unknown."""
    last = min(today, week_start + timedelta(days=6))
    days = [week_start + timedelta(days=i) for i in range(max(0, (last - week_start).days + 1))]
    rows = {
        (row.vehicle_id, row.usage_date): row.fuel_used_l
        for row in session.scalars(
            select(VehicleFuelUsage).where(
                VehicleFuelUsage.vehicle_id.in_(vehicle_ids),
                VehicleFuelUsage.usage_date.between(week_start, last),
            )
        )
    }
    if any((vehicle_id, day) not in rows for vehicle_id in vehicle_ids for day in days):
        raise fail(422, "Record daily fuel totals from Monday through today before planning")
    return {
        vehicle_id: sum((rows[vehicle_id, day] for day in days), Decimal(0))
        for vehicle_id in vehicle_ids
    }


def reserved_fuel(
    session: Session, vehicle_ids: list[UUID], week_start: date, today: date
) -> dict[UUID, Decimal]:
    """Published reservations for today and later; earlier days are consumed totals."""
    week_end = week_start + timedelta(days=6)
    unreserved = session.scalar(
        select(Trip.id)
        .join(PlanRevision, Trip.plan_revision_id == PlanRevision.id)
        .join(Plan, PlanRevision.plan_id == Plan.id)
        .outerjoin(FuelReservation, FuelReservation.trip_id == Trip.id)
        .where(
            Trip.vehicle_id.in_(vehicle_ids),
            PlanRevision.status == PlanStatus.PUBLISHED,
            Plan.delivery_date.between(week_start, week_end),
            FuelReservation.id.is_(None),
        )
        .limit(1)
    )
    if unreserved is not None:
        raise fail(409, "Published fleet work without fuel reservations blocks planning")
    totals = dict.fromkeys(vehicle_ids, Decimal(0))
    for reservation in session.scalars(
        select(FuelReservation).where(
            FuelReservation.vehicle_id.in_(vehicle_ids),
            FuelReservation.service_date.between(max(today, week_start), week_end),
        )
    ):
        totals[reservation.vehicle_id] += reservation.fuel_l
    return totals


def get_optimization(
    session: Session, user: User, plan_id: UUID, revision_id: UUID
) -> OptimizationResponse:
    scoped_plan(session, user, plan_id)
    record = session.scalar(
        select(PlanOptimization)
        .join(PlanRevision, PlanOptimization.plan_revision_id == PlanRevision.id)
        .where(PlanRevision.plan_id == plan_id, PlanRevision.id == revision_id)
    )
    if record is None:
        raise fail(404, "Optimization result not found")
    return OptimizationResponse.model_validate(record.result_snapshot)


def lock_depot_inputs(
    session: Session, plan: Plan
) -> tuple[list[tuple[Order, Outlet]], list[Vehicle]]:
    """Lock eligible orders/outlets, then depot vehicles in UUID order (callers lock the depot)."""
    rows = session.execute(
        select(Order, Outlet)
        .join(Outlet, Order.outlet_id == Outlet.id)
        .where(
            Outlet.depot_id == plan.depot_id,
            Order.requested_delivery_date == plan.delivery_date,
            Order.status == OrderStatus.CONFIRMED,
        )
        .order_by(Order.id)
        .limit(101)
        .with_for_update(of=(Order, Outlet))
    ).all()
    fleet = session.scalars(
        select(Vehicle)
        .where(Vehicle.depot_id == plan.depot_id)
        .order_by(Vehicle.id)
        .limit(21)
        .with_for_update()
    ).all()
    if len(rows) > 100 or len(fleet) > 20:
        raise fail(
            422, "Synchronous optimization supports at most 100 orders and 20 depot vehicles"
        )
    return [(order, outlet) for order, outlet in rows], list(fleet)


def load_availability(
    session: Session, fleet: list[Vehicle], day: date
) -> dict[tuple[UUID, date], bool]:
    """Plan-day and following-day records; a missing key means unknown."""
    return {
        (row.vehicle_id, row.availability_date): row.is_available
        for row in session.scalars(
            select(VehicleAvailability).where(
                VehicleAvailability.vehicle_id.in_([vehicle.id for vehicle in fleet]),
                VehicleAvailability.availability_date.in_([day, day + timedelta(days=1)]),
            )
        )
    }


def compatibility_inputs(
    rows: list[tuple[Order, Outlet]],
    fleet: list[Vehicle],
    availability: dict[tuple[UUID, date], bool],
    day: date,
) -> tuple[list[CompatibilityOrder], list[CompatibilityVehicle]]:
    orders = [
        CompatibilityOrder(
            order.id,
            outlet.depot_id,
            TemperatureRequirement(order.temperature_requirement),
            ParkingConstraint(outlet.parking_constraint),
            order.order_weight_kg,
            order.order_volume_m3,
        )
        for order, outlet in rows
    ]
    vehicles = [
        CompatibilityVehicle(
            vehicle.id,
            vehicle.depot_id,
            VehicleType(vehicle.type),
            TemperatureType(vehicle.temperature_type),
            vehicle.weight_cap_kg,
            vehicle.volume_cap_m3,
            availability.get((vehicle.id, day)),
        )
        for vehicle in fleet
    ]
    return orders, vehicles


def _load_inputs(
    session: Session, plan: Plan, payload: OptimizeRequest, now: datetime
) -> tuple[list[CompatibilityOrder], list[CompatibilityVehicle], RouteInputs]:
    today = now.astimezone(LOCAL_ZONE).date()
    if plan.delivery_date < today:
        raise fail(422, "Cannot optimize a past delivery date")
    if plan.delivery_date.year > 9998:
        raise fail(422, "Delivery date is outside the optimizer calendar range")
    rows, fleet = lock_depot_inputs(session, plan)
    services = {item.outlet_id: item.service_seconds for item in payload.services}
    shifts = {item.vehicle_id: item for item in payload.shifts}
    outlet_map = {outlet.id: outlet for _, outlet in rows}
    if set(services) != set(outlet_map):
        raise fail(422, "Service inputs must match every eligible outlet exactly")
    points = {None, *outlet_map}
    if {(leg.from_outlet_id, leg.to_outlet_id) for leg in payload.legs} != {
        (a, b) for a in points for b in points if a != b
    }:
        raise fail(
            422, "Travel inputs must contain every directed eligible outlet/depot pair exactly"
        )
    availability = load_availability(session, fleet, plan.delivery_date)
    if rows and any((vehicle.id, plan.delivery_date) not in availability for vehicle in fleet):
        raise fail(422, "Record plan-day availability for every depot vehicle before optimization")
    available = [
        vehicle for vehicle in fleet if availability.get((vehicle.id, plan.delivery_date)) is True
    ]
    if not rows:
        available = []
    if set(shifts) != {vehicle.id for vehicle in available}:
        raise fail(422, "Shift inputs must match every available depot vehicle exactly")
    week_start = plan.delivery_date - timedelta(days=plan.delivery_date.weekday())
    vehicle_ids = [vehicle.id for vehicle in available]
    consumed = consumed_fuel(session, vehicle_ids, week_start, today)
    reserved = reserved_fuel(session, vehicle_ids, week_start, today)
    route_vehicles = []
    for vehicle in available:
        shift = shifts[vehicle.id]
        if shift.earliest_departure < now:
            raise fail(422, "Earliest departure cannot be before the current time")
        route_vehicles.append(
            VehicleRouteInput(
                **shift.model_dump(),
                available_dates=tuple(
                    day
                    for day in (plan.delivery_date, plan.delivery_date + timedelta(days=1))
                    if availability.get((vehicle.id, day)) is True
                ),
                km_per_l=vehicle.km_per_l,
                fuel_week_start=week_start,
                weekly_fuel_quota_l=vehicle.weekly_fuel_quota_l,
                fuel_used_l=consumed[vehicle.id],
                fuel_reserved_l=reserved[vehicle.id],
            )
        )
    inputs = RouteInputs(
        depot_id=plan.depot_id,
        delivery_date=plan.delivery_date,
        source=payload.source,
        is_synthetic=payload.is_synthetic,
        outlets=tuple(
            RouteOutlet(
                outlet_id=outlet.id,
                window_open=outlet.window_open_time,
                window_close=outlet.window_close_time,
                service_seconds=services[outlet.id],
            )
            for outlet in outlet_map.values()
        ),
        orders=tuple(RouteOrder(order_id=order.id, outlet_id=outlet.id) for order, outlet in rows),
        vehicles=tuple(route_vehicles),
        legs=payload.legs,
    )
    orders, vehicles = compatibility_inputs(rows, fleet, availability, plan.delivery_date)
    return orders, vehicles, inputs


def create_optimization(
    session: Session, user: User, plan_id: UUID, payload: OptimizeRequest, now: datetime
) -> tuple[OptimizationResponse, bool]:
    plan = scoped_plan(session, user, plan_id, lock=True)
    fingerprint = hashlib.sha256(
        json.dumps(payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    previous = session.scalar(
        select(PlanOptimization)
        .join(PlanRevision, PlanOptimization.plan_revision_id == PlanRevision.id)
        .where(PlanRevision.plan_id == plan_id, PlanOptimization.request_id == payload.request_id)
    )
    if previous is not None:
        if previous.request_hash != fingerprint:
            raise fail(409, "Request ID was already used with different optimization inputs")
        return OptimizationResponse.model_validate(previous.result_snapshot), False
    if plan.status != PlanStatus.DRAFT:
        raise fail(409, "Published plans cannot be optimized by this draft workflow")
    # Serialize optimizations for different dates of this depot too, before
    # locking shared outlets. Fleet PUTs share the vehicle locks taken below.
    session.scalar(select(Depot.id).where(Depot.id == plan.depot_id).with_for_update())
    orders, vehicles, inputs = _load_inputs(session, plan, payload, now)
    draft = optimize_draft(orders, vehicles, inputs)
    validate_draft(draft, orders, vehicles, inputs)
    number = (
        session.scalar(
            select(func.max(PlanRevision.revision_number)).where(PlanRevision.plan_id == plan.id)
        )
        or 0
    ) + 1
    revision = PlanRevision(
        id=uuid4(), plan_id=plan.id, revision_number=number, status=PlanStatus.DRAFT
    )
    session.add(revision)
    session.flush()
    mapping = {order.order_id: order.outlet_id for order in inputs.orders}
    saved_trips = []
    for route in draft.schedule.trips:
        trip = Trip(
            id=uuid4(),
            plan_revision_id=revision.id,
            vehicle_id=route.vehicle_id,
            trip_number=route.trip_number,
            status="PLANNED",
        )
        session.add(trip)
        session.flush()
        saved_stops = []
        for stop in route.stops:
            stop_id = uuid4()
            session.add(
                TripStop(
                    id=stop_id,
                    trip_id=trip.id,
                    outlet_id=stop.outlet_id,
                    sequence_number=stop.sequence_number,
                    planned_arrival_time=stop.arrival_at,
                    status="PLANNED",
                )
            )
            session.flush()
            saved_stops.append(SavedStopResponse(id=stop_id, **asdict(stop)))
            session.add_all(
                [
                    PlanAssignment(
                        plan_revision_id=revision.id,
                        order_id=order_id,
                        outlet_id=stop.outlet_id,
                        outcome=AssignmentOutcome.SERVED,
                        trip_id=trip.id,
                        trip_stop_id=stop_id,
                    )
                    for order_id in stop.order_ids
                ]
            )
        saved_trips.append(SavedTripResponse.from_schedule(trip.id, route, saved_stops))
    deferred = []
    for item in draft.deferrals:
        assignment = PlanAssignment(
            plan_revision_id=revision.id,
            order_id=item.order_id,
            outlet_id=mapping[item.order_id],
            outcome=AssignmentOutcome.DEFERRED,
        )
        assignment.deferral = DeferralDecision(
            reason_code=item.reason_code, reason_text=item.reason_text
        )
        session.add(assignment)
        deferred.append(DeferredOrderResponse(outlet_id=mapping[item.order_id], **asdict(item)))
    result = OptimizationResponse(
        request_id=payload.request_id,
        plan_id=plan.id,
        revision_id=revision.id,
        revision_number=number,
        created_at=now,
        source=inputs.source,
        is_synthetic=inputs.is_synthetic,
        eligible_order_count=len(orders),
        trips=saved_trips,
        deferrals=deferred,
    )
    session.add(
        PlanOptimization(
            request_id=payload.request_id,
            plan_revision_id=revision.id,
            request_hash=fingerprint,
            result_snapshot=result.model_dump(mode="json"),
            input_snapshot={
                "routes": inputs.model_dump(mode="json"),
                "orders": TypeAdapter(list[CompatibilityOrder]).dump_python(orders, mode="json"),
                "vehicles": TypeAdapter(list[CompatibilityVehicle]).dump_python(
                    vehicles, mode="json"
                ),
            },
        )
    )
    session.flush()
    session.commit()
    return result, True
