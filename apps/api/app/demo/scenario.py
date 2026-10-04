"""Repeatable development/test demo scenarios built through the real domain services.

Every planning, loading and delivery step calls the same service as its API route, with the
real server clock, so production guards still apply. Travel data is explicitly synthetic.
"""

import argparse
import base64
import json
import sys
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User, UserDepot, UserOutlet
from app.auth.seed import DemoSeedError, ensure_demo_environment
from app.core.config import get_settings
from app.delivery.models import DeliveryFailureReason
from app.delivery.schemas import DeliverRequest, EventRequest, FailRequest, PodUploadRequest
from app.delivery.service import (
    arrive_at_stop,
    complete_trip,
    deliver_stop,
    fail_stop,
    start_trip,
    upload_pod,
)
from app.fleet.models import Depot, Outlet, Vehicle
from app.fleet.operations_models import VehicleAvailability, VehicleFuelUsage
from app.fleet.seed import DEMO_DEPOT_ID, DEMO_REEFER_ID, DEMO_STORE_ID, DEMO_TRUCK_ID
from app.loading.models import LoadStatus
from app.loading.schemas import LoadEventRequest, TripReadyRequest
from app.loading.service import get_trip_loading, mark_trip_ready, record_load_event
from app.orders.models import Order, OrderStatus, TemperatureRequirement
from app.orders.schemas import OrderCreateRequest
from app.orders.service import accepted_delivery_date, create_store_order
from app.planning.models import Plan
from app.planning.optimization_schemas import OptimizeRequest
from app.planning.optimization_service import create_optimization
from app.planning.publication_schemas import PublishRequest
from app.planning.publication_service import create_publication
from app.planning.route_inputs import LOCAL_ZONE
from app.planning.schemas import PlanCreateRequest
from app.planning.service import create_plan

STAGES = ("plan", "published", "ready", "operations")
SOURCE = "Synthetic demo travel matrix (not real road data)"
# Placeholder photo: a minimal JPEG header so the POD type check passes; not a real image.
DEMO_POD = base64.b64decode(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////"
    "////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/a"
    "AAgBAQABPxA="
)
# Whole consignments for the demo Store outlet: (temperature, kg, m3). The last exceeds
# every demo vehicle and is expected to be deferred with NO_COMPATIBLE_VEHICLE.
DEMO_ORDERS = (
    ("ambient", "800.000", "4.000"),
    ("chilled", "250.000", "1.500"),
    ("ambient", "300.000", "2.000"),
    ("ambient", "6000.000", "35.000"),
)
EMAILS = {
    "store": "store@waypoint.demo",
    "dispatcher": "dispatcher@waypoint.demo",
    "loader": "loader@waypoint.demo",
    "driver": "driver@waypoint.demo",
}


class DemoScenarioError(RuntimeError):
    pass


@dataclass
class ScenarioResult:
    delivery_date: date
    stage: str
    plan_id: UUID
    order_ids: list[UUID]
    orders_inserted_directly: bool
    optimize_request: dict[str, Any]
    revision_id: UUID | None = None
    trip_ids: list[UUID] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _users(session: Session) -> dict[str, User]:
    users = {
        user.email: user
        for user in session.scalars(select(User).where(User.email.in_(EMAILS.values())))
    }
    missing = [email for email in EMAILS.values() if email not in users]
    if missing:
        raise DemoScenarioError(
            "Run `python -m app.auth.seed --demo` first; missing: " + ", ".join(missing)
        )
    grants = [
        session.get(UserOutlet, (users[EMAILS["store"]].id, DEMO_STORE_ID)),
        *(
            session.get(UserDepot, (users[EMAILS[role]].id, DEMO_DEPOT_ID))
            for role in ("dispatcher", "loader", "driver")
        ),
    ]
    if session.get(Depot, DEMO_DEPOT_ID) is None or any(grant is None for grant in grants):
        raise DemoScenarioError("Run `python -m app.fleet.seed --demo` first")
    return {role: users[email] for role, email in EMAILS.items()}


def _plan_exists(session: Session, day: date) -> bool:
    return (
        session.scalar(
            select(Plan.id).where(Plan.depot_id == DEMO_DEPOT_ID, Plan.delivery_date == day)
        )
        is not None
    )


def choose_date(session: Session, stage: str, requested: date | None, now: datetime) -> date:
    today = now.astimezone(LOCAL_ZONE).date()
    if stage == "operations":
        # Drivers can only start trips on their delivery date.
        if requested not in (None, today):
            raise DemoScenarioError("The operations stage always uses today's date")
        day = today
    elif requested is not None:
        day = requested
    else:
        first = accepted_delivery_date(today + timedelta(days=1), now)
        free = next(
            (
                first + timedelta(days=offset)
                for offset in range(60)
                if not _plan_exists(session, first + timedelta(days=offset))
            ),
            None,
        )
        if free is None:
            raise DemoScenarioError("No free demo date in the next 60 days; use a fresh database")
        day = free
    if day < today:
        raise DemoScenarioError("Demo dates cannot be in the past")
    if _plan_exists(session, day):
        raise DemoScenarioError(
            f"A demo plan already exists for {day}; choose another --date or use a "
            "fresh disposable database"
        )
    return day


def _shifts(day: date, now: datetime) -> list[tuple[datetime, datetime]]:
    """Non-overlapping van then truck shifts, so the single demo Driver can take both."""
    start = datetime.combine(day, time(7, 30), LOCAL_ZONE)
    soonest = (now + timedelta(minutes=20)).astimezone(LOCAL_ZONE)
    if start < soonest:
        start = soonest.replace(
            minute=soonest.minute - soonest.minute % 5, second=0, microsecond=0
        ) + timedelta(minutes=5)
    van_end = start + timedelta(hours=2, minutes=30)
    truck_start = van_end + timedelta(minutes=15)
    truck_end = truck_start + timedelta(hours=2, minutes=30)
    if truck_end.date() != day:
        raise DemoScenarioError("Too late in the day for a same-day demo route")
    return [(start, van_end), (truck_start, truck_end)]


def _missing_fuel(session: Session, day: date, now: datetime) -> list[tuple[UUID, date]]:
    """Daily consumed-fuel rows the optimizer needs (Monday to today of the plan week)."""
    today = now.astimezone(LOCAL_ZONE).date()
    week_start = day - timedelta(days=day.weekday())
    days = []
    current = week_start
    while current <= min(today, week_start + timedelta(days=6)):
        days.append(current)
        current += timedelta(days=1)
    recorded = {
        (row.vehicle_id, row.usage_date)
        for row in session.execute(
            select(VehicleFuelUsage.vehicle_id, VehicleFuelUsage.usage_date).where(
                VehicleFuelUsage.vehicle_id.in_([DEMO_REEFER_ID, DEMO_TRUCK_ID]),
                VehicleFuelUsage.usage_date.in_(days),
            )
        )
    }
    return [
        (vehicle, current)
        for vehicle in (DEMO_REEFER_ID, DEMO_TRUCK_ID)
        for current in days
        if (vehicle, current) not in recorded
    ]


def preflight(
    session: Session, stage: str, day: date, now: datetime, *, record_missing_fuel: bool
) -> None:
    """Every check that can fail runs here, before the scenario writes anything."""
    today = now.astimezone(LOCAL_ZONE).date()
    if day > today and accepted_delivery_date(day, now) != day:
        raise DemoScenarioError(f"The 16:00 Store cutoff has passed for {day}; choose a later date")
    vehicles = set(session.scalars(select(Vehicle.id).where(Vehicle.depot_id == DEMO_DEPOT_ID)))
    if vehicles != {DEMO_REEFER_ID, DEMO_TRUCK_ID}:
        raise DemoScenarioError("The demo depot must contain exactly the two seeded demo vehicles")
    unavailable = session.scalar(
        select(VehicleAvailability.vehicle_id).where(
            VehicleAvailability.vehicle_id.in_(vehicles),
            VehicleAvailability.availability_date == day,
            VehicleAvailability.is_available.is_(False),
        )
    )
    if unavailable is not None:
        raise DemoScenarioError(f"Vehicle {unavailable} is recorded unavailable on {day}")
    outlet = session.get(Outlet, DEMO_STORE_ID)
    assert outlet is not None
    closing = datetime.combine(day, outlet.window_close_time, LOCAL_ZONE)
    # Arrival (15 min depot leg) plus 10 min service must fit before the Store outlet closes;
    # the operations fixture needs both the van and the truck trips.
    for start, _ in _shifts(day, now)[: 2 if stage == "operations" else 1]:
        if start + timedelta(minutes=25) > closing:
            raise DemoScenarioError(
                f"Too late to reach the demo Store before {outlet.window_close_time:%H:%M} "
                "Colombo time; use a later date or run earlier in the day"
            )
    missing = _missing_fuel(session, day, now)
    if missing and not record_missing_fuel:
        raise DemoScenarioError(
            f"{len(missing)} daily fuel totals are missing for the plan week; record them "
            "through the fleet input API or pass --record-missing-fuel-as-zero"
        )


def _record_inputs(session: Session, day: date, now: datetime) -> list[str]:
    """Explicit plan-day availability and (opt-in, preflight-checked) zero fuel rows."""
    notes = []
    for vehicle in (DEMO_REEFER_ID, DEMO_TRUCK_ID):
        record = session.scalar(
            select(VehicleAvailability).where(
                VehicleAvailability.vehicle_id == vehicle,
                VehicleAvailability.availability_date == day,
            )
        )
        if record is None:
            session.add(
                VehicleAvailability(vehicle_id=vehicle, availability_date=day, is_available=True)
            )
    for vehicle, current in _missing_fuel(session, day, now):
        session.add(
            VehicleFuelUsage(vehicle_id=vehicle, usage_date=current, fuel_used_l=Decimal("0.000"))
        )
        notes.append(f"Recorded 0.000 L demo fuel usage for {vehicle} on {current} (opt-in)")
    session.commit()
    return notes


def _orders(session: Session, store: User, day: date, now: datetime) -> tuple[list[UUID], bool]:
    today = now.astimezone(LOCAL_ZONE).date()
    if day > today:
        ids = []
        for temperature, weight, volume in DEMO_ORDERS:
            created = create_store_order(
                session,
                store,
                OrderCreateRequest.model_validate(
                    {
                        "outlet_id": str(DEMO_STORE_ID),
                        "requested_delivery_date": day.isoformat(),
                        "temperature_requirement": temperature,
                        "order_weight_kg": weight,
                        "order_volume_m3": volume,
                    }
                ),
                now,
            )
            if created.order.requested_delivery_date != day:
                raise DemoScenarioError(
                    f"The Store cutoff moved {day} to {created.order.requested_delivery_date}; "
                    "choose a later --date"
                )
            ids.append(created.order.id)
        return ids, False
    # The Store API only accepts future dates, so same-day fixture orders are seeded rows.
    orders = [
        Order(
            outlet_id=DEMO_STORE_ID,
            requested_delivery_date=day,
            temperature_requirement=TemperatureRequirement(temperature),
            order_weight_kg=Decimal(weight),
            order_volume_m3=Decimal(volume),
            status=OrderStatus.CONFIRMED,
        )
        for temperature, weight, volume in DEMO_ORDERS
    ]
    session.add_all(orders)
    session.commit()
    return [order.id for order in orders], True


def build_optimize_request(
    session: Session, day: date, now: datetime, request_id: UUID
) -> dict[str, Any]:
    """Synthetic but complete inputs mapped to the actual eligible outlets and vehicles."""
    outlets = sorted(
        {
            str(outlet)
            for outlet in session.scalars(
                select(Order.outlet_id)
                .join(Outlet, Order.outlet_id == Outlet.id)
                .where(
                    Outlet.depot_id == DEMO_DEPOT_ID,
                    Order.requested_delivery_date == day,
                    Order.status == OrderStatus.CONFIRMED,
                )
            )
        }
    )
    vehicles = sorted(
        session.scalars(select(Vehicle).where(Vehicle.depot_id == DEMO_DEPOT_ID)),
        key=lambda vehicle: (vehicle.type != "van", str(vehicle.id)),
    )
    shifts = _shifts(day, now)
    points: list[str | None] = [None, *outlets]
    return {
        "request_id": str(request_id),
        "source": SOURCE,
        "is_synthetic": True,
        "services": [{"outlet_id": outlet, "service_seconds": 600} for outlet in outlets],
        "shifts": [
            {
                "vehicle_id": str(vehicle.id),
                "earliest_departure": start.isoformat(),
                "latest_return": end.isoformat(),
                "turnaround_seconds": 900,
            }
            for vehicle, (start, end) in zip(vehicles, shifts, strict=False)
        ],
        "legs": [
            {
                "from_outlet_id": a,
                "to_outlet_id": b,
                "distance_km": "6.000" if None in (a, b) else "3.000",
                "travel_seconds": 900 if None in (a, b) else 600,
            }
            for a in points
            for b in points
            if a != b
        ],
    }


def run_scenario(
    session: Session,
    *,
    stage: str,
    requested_date: date | None,
    now: datetime,
    record_missing_fuel: bool = False,
) -> ScenarioResult:
    if stage not in STAGES:
        raise DemoScenarioError(f"Unknown stage {stage}")
    users = _users(session)
    day = choose_date(session, stage, requested_date, now)
    preflight(session, stage, day, now, record_missing_fuel=record_missing_fuel)
    try:
        return _run(session, users, stage, day, now)
    except DemoScenarioError:
        raise
    except Exception as error:
        session.rollback()
        detail = getattr(error, "detail", None) or type(error).__name__
        raise DemoScenarioError(
            f"Scenario stopped after writing demo data for {day}: {detail}. Earlier steps "
            "stay committed; use another --date or a fresh disposable database"
        ) from error


def _run(
    session: Session, users: dict[str, User], stage: str, day: date, now: datetime
) -> ScenarioResult:
    notes = _record_inputs(session, day, now)
    order_ids, direct = _orders(session, users["store"], day, now)
    plan = create_plan(
        session,
        users["dispatcher"],
        PlanCreateRequest.model_validate(
            {"depot_id": str(DEMO_DEPOT_ID), "delivery_date": day.isoformat()}
        ),
        now,
    )
    request = build_optimize_request(session, day, now, uuid4())
    result = ScenarioResult(day, stage, plan.id, order_ids, direct, request, notes=notes)
    if stage == "plan":
        return result

    dispatcher = users["dispatcher"]
    optimized, _ = create_optimization(
        session, dispatcher, plan.id, OptimizeRequest.model_validate(request), now
    )
    if not optimized.trips:
        raise DemoScenarioError("Optimization produced no trips; check the date and shifts")
    publication, _ = create_publication(
        session,
        dispatcher,
        plan.id,
        optimized.revision_id,
        PublishRequest.model_validate(
            {
                "request_id": str(uuid4()),
                "driver_assignments": [
                    {"trip_id": str(trip.id), "driver_id": str(users["driver"].id)}
                    for trip in optimized.trips
                ],
            }
        ),
        now,
    )
    result.revision_id = publication.revision_id
    trips = sorted(publication.trips, key=lambda trip: trip.departure_at)
    result.trip_ids = [trip.trip_id for trip in trips]
    result.notes.append(f"Deferred orders: {len(optimized.deferrals)}")
    if stage == "published":
        return result

    loader = users["loader"]
    busiest = max(trips, key=lambda trip: len(_order_ids(session, loader, trip.trip_id)))
    for trip in trips:
        orders = _order_ids(session, loader, trip.trip_id)
        last = 0
        for index, order_id in enumerate(orders):
            # One shortfall on a multi-order trip demonstrates a loading exception.
            missing = stage == "operations" and trip is busiest and index == 0 and len(orders) > 1
            event, _ = record_load_event(
                session,
                loader,
                trip.trip_id,
                LoadEventRequest(
                    event_id=uuid4(),
                    order_id=order_id,
                    status=LoadStatus.MISSING if missing else LoadStatus.LOADED,
                    note="Demo fixture: not staged in bay" if missing else None,
                ),
                now,
            )
            last = event.sequence_number
            if missing:
                result.notes.append(f"Order {order_id} recorded MISSING")
        mark_trip_ready(
            session,
            loader,
            trip.trip_id,
            TripReadyRequest(request_id=uuid4(), last_event_sequence=last),
            now,
        )
    if stage == "ready":
        return result

    driver = users["driver"]
    for number, trip in enumerate(trips):
        start_trip(session, driver, trip.trip_id, EventRequest(event_id=uuid4()), now)
        view = get_trip_loading(session, loader, trip.trip_id)
        for stop in view.stops:
            if not any(order.load_status == LoadStatus.LOADED for order in stop.orders):
                continue
            arrive_at_stop(
                session, driver, trip.trip_id, stop.stop_id, EventRequest(event_id=uuid4()), now
            )
            if number == 0:
                pod_id = uuid4()
                upload_pod(
                    session,
                    driver,
                    trip.trip_id,
                    stop.stop_id,
                    PodUploadRequest(
                        pod_id=pod_id,
                        receiver_name="Demo Receiver",
                        photo_mime_type="image/jpeg",
                        photo_base64=base64.b64encode(DEMO_POD).decode(),
                    ),
                    now,
                )
                deliver_stop(
                    session,
                    driver,
                    trip.trip_id,
                    stop.stop_id,
                    DeliverRequest(event_id=uuid4(), pod_id=pod_id),
                    now,
                )
            else:
                fail_stop(
                    session,
                    driver,
                    trip.trip_id,
                    stop.stop_id,
                    FailRequest(
                        event_id=uuid4(),
                        reason_code=DeliveryFailureReason.OUTLET_CLOSED,
                        note="Demo fixture: outlet closed on arrival",
                    ),
                    now,
                )
        complete_trip(session, driver, trip.trip_id, EventRequest(event_id=uuid4()), now)
        result.notes.append(
            f"Trip {trip.trip_id} {'delivered with POD' if number == 0 else 'failed'} and completed"
        )
    return result


def _order_ids(session: Session, loader: User, trip_id: UUID) -> list[UUID]:
    view = get_trip_loading(session, loader, trip_id)
    return [order.order_id for stop in view.stops for order in stop.orders]


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create a demo scenario (development/test only)")
    parser.add_argument(
        "--stage",
        choices=STAGES,
        default="plan",
        help="plan: orders + plan workspace; published; ready; operations "
        "(today only: delivered, failed and shortfall fixture)",
    )
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=None,
        help="Delivery date (YYYY-MM-DD, Asia/Colombo); default: next free date",
    )
    parser.add_argument(
        "--record-missing-fuel-as-zero",
        action="store_true",
        help="Insert 0.000 L for missing daily fuel totals in the plan week",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Write the synthetic optimize request JSON to this file",
    )
    args = parser.parse_args(argv)
    from app.db.session import get_engine

    try:
        ensure_demo_environment(get_settings().app_env)
        with Session(get_engine()) as session:
            result = run_scenario(
                session,
                stage=args.stage,
                requested_date=args.date,
                now=datetime.now(UTC),
                record_missing_fuel=args.record_missing_fuel_as_zero,
            )
    except (DemoSeedError, DemoScenarioError) as error:
        print(str(error), file=sys.stderr)
        return 1
    if args.output is not None:
        args.output.write_text(json.dumps(result.optimize_request, indent=2), encoding="utf-8")
        print(f"Optimize request: {args.output}")
    print(f"Stage: {result.stage}  Delivery date: {result.delivery_date}")
    print(f"Plan: {result.plan_id}  Revision: {result.revision_id or '-'}")
    print("Orders: " + ", ".join(str(order) for order in result.order_ids))
    if result.orders_inserted_directly:
        print("Same-day orders were seeded directly (the Store API accepts future dates only).")
    for trip in result.trip_ids:
        print(f"Trip: {trip}")
    for note in result.notes:
        print(note)
    print(f"Travel data: {SOURCE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
