"""One-command demo bootstrap (APP_ENV=demo only), run by the API container before uvicorn.

Idempotent: demo accounts and resources are only added when missing, and the operational
fixture is created once per delivery date. Every planning, loading, delivery and receipt step
calls the same service as its API route, with the real server clock, so production guards apply.

The fixture for today (Asia/Colombo), from one optimized and published plan:
- van trip with the most orders: one order MISSING at loading, the rest delivered with proof;
  one receipt confirmed by the Store, the others left "delivered, awaiting receipt";
- the other van trip: loaded and READY (for the Driver to start);
- the first truck trip: stop failed (outlet closed) and completed;
- the second truck trip: published but not loaded (for the Loader);
- an oversized order deferred with its reason, and a Store order for a future date (CONFIRMED).
Same-day orders are inserted as CONFIRMED rows (the Store API accepts only future dates).
If it is too late today for a same-day route, the next deliverable date is planned instead
(published, one trip READY, nothing executed) and the log says so.
"""

import base64
import os
import sys
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.models import User, UserOutlet
from app.auth.seed import DEMO_ACCOUNTS, seed_demo_users
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
from app.demo.scenario import DEMO_POD, EMAILS, SOURCE
from app.fleet.models import Outlet
from app.fleet.operations_models import VehicleAvailability, VehicleFuelUsage
from app.fleet.seed import (
    DEMO_DEPOT_ID,
    DEMO_REEFER_ID,
    DEMO_STORE_ID,
    DEMO_TRUCK_ID,
    seed_demo_resources,
)
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
from app.receipts.schemas import ReceiptRequest
from app.receipts.service import confirm_receipt

DEMO_ENV = "demo"
# A demo-only outlet open all day, so a same-day route fits whenever the stack is started
# (the regular demo Store closes at 18:00). Assigned to the demo Store Manager too.
DEMO_EXPRESS_ID = uuid5(NAMESPACE_URL, "https://waypoint.demo/seed/v1/express-24h")
EXPRESS = {
    "id": DEMO_EXPRESS_ID,
    "brand": "Waypoint Demo Express (24h demo outlet)",
    "district": "Colombo",
    "depot_id": DEMO_DEPOT_ID,
    "dock_type": "ground",
    "parking_constraint": "none",
    "window_open_time": time(0),
    "window_close_time": time(23, 59, 59),
    "mall_window": False,
}
# Whole consignments (temperature, kg, m3). Chilled orders need the reefer van and cannot all
# share one trip; the ambient pair needs two truck trips; the last order fits no vehicle.
FIXTURE_ORDERS = (
    ("chilled", "700.000", "2.500"),
    ("chilled", "520.000", "2.000"),
    ("chilled", "300.000", "1.200"),
    ("chilled", "60.000", "0.300"),
    ("ambient", "3000.000", "12.000"),
    ("ambient", "2600.000", "12.000"),
    ("ambient", "6000.000", "35.000"),
)
LEAD = timedelta(minutes=25)
VAN_SHIFT = TRUCK_SHIFT = timedelta(hours=1, minutes=50)
GAP = timedelta(minutes=15)


class BootstrapError(RuntimeError):
    pass


def log(message: str) -> None:
    print(f"[demo] {message}", flush=True)


def guard_demo_database(session: Session) -> None:
    """Never seed a database that holds non-demo accounts (for example a developer's main DB)."""
    demo = {email for email, _ in DEMO_ACCOUNTS}
    others = session.scalar(select(func.count()).select_from(User).where(User.email.not_in(demo)))
    if others:
        raise BootstrapError(
            "This database has non-demo accounts; demo seeding refused. Use the demo volume "
            "(`docker compose down -v` resets it) or unset APP_ENV=demo."
        )


def ensure_express_outlet(session: Session) -> None:
    with session.begin():
        outlet = session.get(Outlet, DEMO_EXPRESS_ID)
        if outlet is None:
            session.add(Outlet(**EXPRESS))
            session.flush()
        elif any(getattr(outlet, key) != value for key, value in EXPRESS.items()):
            raise BootstrapError("Conflicting demo outlet record; no changes committed")
        store = session.scalar(select(User).where(User.email == EMAILS["store"]))
        assert store is not None
        if session.get(UserOutlet, (store.id, DEMO_EXPRESS_ID)) is None:
            session.add(UserOutlet(user_id=store.id, outlet_id=DEMO_EXPRESS_ID))


def _users(session: Session) -> dict[str, User]:
    users = {
        u.email: u for u in session.scalars(select(User).where(User.email.in_(EMAILS.values())))
    }
    return {role: users[email] for role, email in EMAILS.items()}


def _shifts(
    day: date, now: datetime
) -> tuple[tuple[datetime, datetime], tuple[datetime, datetime]] | None:
    """Van then truck shifts that do not overlap (one demo Driver), or None if they do not fit."""
    start = datetime.combine(day, time(7, 30), LOCAL_ZONE)
    soonest = (now + LEAD).astimezone(LOCAL_ZONE)
    if start < soonest:
        start = soonest.replace(second=0, microsecond=0) + timedelta(minutes=5 - soonest.minute % 5)
    van = (start, start + VAN_SHIFT)
    truck = (van[1] + GAP, van[1] + GAP + TRUCK_SHIFT)
    if truck[1].date() != day:
        return None
    return van, truck


def choose_day(session: Session, now: datetime) -> tuple[date, bool]:
    """Today when a same-day route still fits, else the next date the Store would accept."""
    today = now.astimezone(LOCAL_ZONE).date()
    if _shifts(today, now) is not None:
        return today, True
    return accepted_delivery_date(today + timedelta(days=1), now), False


def _plan_exists(session: Session, day: date) -> bool:
    query = select(Plan.id).where(Plan.depot_id == DEMO_DEPOT_ID, Plan.delivery_date == day)
    return session.scalar(query) is not None


def _record_inputs(session: Session, day: date, now: datetime) -> None:
    """Plan-day availability and the weekly consumed-fuel days the optimizer requires.
    Missing consumption days of a fresh demo database are recorded as 0.000 L (demo only)."""
    today = now.astimezone(LOCAL_ZONE).date()
    week_start = day - timedelta(days=day.weekday())
    days = [
        week_start + timedelta(days=i)
        for i in range(max(0, (min(today, week_start + timedelta(days=6)) - week_start).days + 1))
    ]
    for vehicle in (DEMO_REEFER_ID, DEMO_TRUCK_ID):
        if (
            session.scalar(
                select(VehicleAvailability.id).where(
                    VehicleAvailability.vehicle_id == vehicle,
                    VehicleAvailability.availability_date == day,
                )
            )
            is None
        ):
            session.add(
                VehicleAvailability(vehicle_id=vehicle, availability_date=day, is_available=True)
            )
        for current in days:
            if (
                session.scalar(
                    select(VehicleFuelUsage.id).where(
                        VehicleFuelUsage.vehicle_id == vehicle,
                        VehicleFuelUsage.usage_date == current,
                    )
                )
                is None
            ):
                session.add(
                    VehicleFuelUsage(
                        vehicle_id=vehicle, usage_date=current, fuel_used_l=Decimal("0.000")
                    )
                )
    session.commit()


def _orders(session: Session, store: User, day: date, now: datetime, same_day: bool) -> list[UUID]:
    if same_day:
        rows = [
            Order(
                outlet_id=DEMO_EXPRESS_ID,
                requested_delivery_date=day,
                temperature_requirement=TemperatureRequirement(t),
                order_weight_kg=Decimal(w),
                order_volume_m3=Decimal(v),
                status=OrderStatus.CONFIRMED,
            )
            for t, w, v in FIXTURE_ORDERS
        ]
        session.add_all(rows)
        session.commit()
        return [row.id for row in rows]
    ids = []
    for t, w, v in FIXTURE_ORDERS:
        created = create_store_order(
            session,
            store,
            OrderCreateRequest.model_validate(
                {
                    "outlet_id": str(DEMO_EXPRESS_ID),
                    "requested_delivery_date": day.isoformat(),
                    "temperature_requirement": t,
                    "order_weight_kg": w,
                    "order_volume_m3": v,
                }
            ),
            now,
        )
        ids.append(created.order.id)
    return ids


def _optimize_request(day: date, now: datetime, outlets: list[str]) -> dict[str, object]:
    shifts = _shifts(day, now)
    assert shifts is not None
    points: list[str | None] = [None, *sorted(outlets)]
    return {
        "request_id": str(uuid4()),
        "source": SOURCE,
        "is_synthetic": True,
        "services": [{"outlet_id": outlet, "service_seconds": 600} for outlet in sorted(outlets)],
        "shifts": [
            {
                "vehicle_id": str(vehicle),
                "earliest_departure": start.isoformat(),
                "latest_return": end.isoformat(),
                "turnaround_seconds": 900,
            }
            for vehicle, (start, end) in zip((DEMO_REEFER_ID, DEMO_TRUCK_ID), shifts, strict=True)
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


def _load(
    session: Session, loader: User, trip_id: UUID, now: datetime, *, missing_first: bool
) -> None:
    orders = [
        o.order_id for stop in get_trip_loading(session, loader, trip_id).stops for o in stop.orders
    ]
    last = 0
    for index, order_id in enumerate(orders):
        missing = missing_first and index == 0 and len(orders) > 1
        event, _ = record_load_event(
            session,
            loader,
            trip_id,
            LoadEventRequest(
                event_id=uuid4(),
                order_id=order_id,
                status=LoadStatus.MISSING if missing else LoadStatus.LOADED,
                note="Demo fixture: carton not staged in the bay" if missing else None,
            ),
            now,
        )
        last = event.sequence_number
    mark_trip_ready(
        session,
        loader,
        trip_id,
        TripReadyRequest(request_id=uuid4(), last_event_sequence=last),
        now,
    )


def _drive(
    session: Session, users: dict[str, User], trip_id: UUID, now: datetime, *, deliver: bool
) -> list[UUID]:
    driver, loader = users["driver"], users["loader"]
    delivered: list[UUID] = []
    start_trip(session, driver, trip_id, EventRequest(event_id=uuid4()), now)
    for stop in get_trip_loading(session, loader, trip_id).stops:
        loaded = [o.order_id for o in stop.orders if o.load_status == LoadStatus.LOADED]
        if not loaded:
            continue
        arrive_at_stop(session, driver, trip_id, stop.stop_id, EventRequest(event_id=uuid4()), now)
        if deliver:
            pod_id = uuid4()
            upload_pod(
                session,
                driver,
                trip_id,
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
                trip_id,
                stop.stop_id,
                DeliverRequest(event_id=uuid4(), pod_id=pod_id),
                now,
            )
            delivered.extend(loaded)
        else:
            fail_stop(
                session,
                driver,
                trip_id,
                stop.stop_id,
                FailRequest(
                    event_id=uuid4(),
                    reason_code=DeliveryFailureReason.OUTLET_CLOSED,
                    note="Demo fixture: outlet shutter down on arrival",
                ),
                now,
            )
    complete_trip(session, driver, trip_id, EventRequest(event_id=uuid4()), now)
    return delivered


def seed_operations(session: Session, now: datetime) -> str:
    users = _users(session)
    today = now.astimezone(LOCAL_ZONE).date()
    day, same_day = choose_day(session, now)
    for existing in (today, day):
        if _plan_exists(session, existing):
            return f"Demo operations for {existing} already exist; nothing added"
    _record_inputs(session, day, now)
    order_ids = _orders(session, users["store"], day, now, same_day)
    # A Store order for a future date through the Store service: stays CONFIRMED ("submitted").
    later = accepted_delivery_date(day + timedelta(days=1), now)
    create_store_order(
        session,
        users["store"],
        OrderCreateRequest.model_validate(
            {
                "outlet_id": str(DEMO_STORE_ID),
                "requested_delivery_date": later.isoformat(),
                "temperature_requirement": "ambient",
                "order_weight_kg": "120.000",
                "order_volume_m3": "0.800",
            }
        ),
        now,
    )
    dispatcher = users["dispatcher"]
    plan = create_plan(
        session,
        dispatcher,
        PlanCreateRequest.model_validate(
            {"depot_id": str(DEMO_DEPOT_ID), "delivery_date": day.isoformat()}
        ),
        now,
    )
    optimized, _ = create_optimization(
        session,
        dispatcher,
        plan.id,
        OptimizeRequest.model_validate(_optimize_request(day, now, [str(DEMO_EXPRESS_ID)])),
        now,
    )
    publication, _ = create_publication(
        session,
        dispatcher,
        plan.id,
        optimized.revision_id,
        PublishRequest.model_validate(
            {
                "request_id": str(uuid4()),
                "driver_assignments": [
                    {"trip_id": str(t.id), "driver_id": str(users["driver"].id)}
                    for t in optimized.trips
                ],
            }
        ),
        now,
    )
    trips = sorted(publication.trips, key=lambda t: t.departure_at)
    loader = users["loader"]
    size = {
        t.trip_id: sum(len(s.orders) for s in get_trip_loading(session, loader, t.trip_id).stops)
        for t in trips
    }
    vans = [t for t in trips if t.vehicle_id == DEMO_REEFER_ID]
    trucks = [t for t in trips if t.vehicle_id == DEMO_TRUCK_ID]
    summary = [
        f"Plan {plan.id} for {day}: revision {publication.revision_number} published, "
        f"{len(trips)} trips, {len(optimized.deferrals)} deferred of {len(order_ids)} orders"
    ]
    if not same_day:
        # Trips can only start on their delivery date: publish and make one trip READY only.
        if trips:
            _load(session, loader, trips[0].trip_id, now, missing_first=False)
        summary.append(
            f"Too late for a same-day route; planned {day} instead (one trip READY, none started)"
        )
        return "; ".join(summary)
    busiest = max(vans, key=lambda t: size[t.trip_id]) if vans else None
    if busiest is not None:
        _load(session, loader, busiest.trip_id, now, missing_first=True)
        delivered = _drive(session, users, busiest.trip_id, now, deliver=True)
        if len(delivered) > 1:
            confirm_receipt(
                session, users["store"], delivered[0], ReceiptRequest(request_id=uuid4()), now
            )
        summary.append(
            f"van trip {busiest.trip_id} delivered ({len(delivered)} orders, 1 shortfall)"
        )
    for trip in vans:
        if trip is not busiest:
            _load(session, loader, trip.trip_id, now, missing_first=False)
            summary.append(f"van trip {trip.trip_id} READY for the Driver")
    if trucks:
        _load(session, loader, trucks[0].trip_id, now, missing_first=False)
        _drive(session, users, trucks[0].trip_id, now, deliver=False)
        summary.append(f"truck trip {trucks[0].trip_id} failed stop (outlet closed)")
    for trip in trucks[1:]:
        summary.append(f"truck trip {trip.trip_id} published, not loaded (for the Loader)")
    return "; ".join(summary)


def run(session: Session, password: str, now: datetime, app_env: str) -> list[str]:
    if app_env != DEMO_ENV:
        raise BootstrapError("The demo bootstrap runs only with APP_ENV=demo")
    guard_demo_database(session)
    session.rollback()  # end the read-only check; each seed below owns its transaction
    users = seed_demo_users(session, password, app_env=app_env)
    resources = seed_demo_resources(session, app_env=app_env)
    ensure_express_outlet(session)
    lines = [
        f"Demo accounts: {len(users.created)} created, {len(users.existing)} existing",
        f"Demo resources: {len(resources.created)} created, {len(resources.existing)} existing",
    ]
    try:
        lines.append(seed_operations(session, now))
    except Exception as error:  # the API still starts; the log says what is missing
        session.rollback()
        detail = getattr(error, "detail", None) or f"{type(error).__name__}: {error}"
        lines.append(f"Demo operations not seeded: {detail}")
    return lines


def main() -> int:
    from app.db.session import get_engine

    settings = get_settings()
    password = os.environ.get("DEMO_SEED_PASSWORD", "")
    if not password:
        log("DEMO_SEED_PASSWORD is not set; demo seeding skipped")
        return 1
    try:
        with Session(get_engine()) as session:
            for line in run(session, password, datetime.now(UTC), settings.app_env):
                log(line)
    except Exception as error:
        log(f"Demo bootstrap failed: {error}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
