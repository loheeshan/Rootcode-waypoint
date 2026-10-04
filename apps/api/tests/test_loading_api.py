from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session
from test_auth_api import app as app
from test_auth_api import bearer
from test_auth_api import client as client
from test_auth_api import engine as engine
from test_auth_api import settings as settings
from test_auth_api import stored_password as stored_password
from test_auth_api import users as users
from test_optimization_api import DAY, NOW, url
from test_optimization_api import body as body
from test_optimization_api import clock as clock
from test_optimization_api import headers as headers
from test_optimization_api import resources as resources
from test_order_schema import make_order
from test_publication_api import driver as driver
from test_publication_api import publish_body, publish_url

from app.auth.models import UserDepot
from app.db.models import (
    FuelReservation,
    LoadEvent,
    Order,
    Outlet,
    Plan,
    PlanAssignment,
    Trip,
    TripLoadingCompletion,
    TripStop,
)
from app.loading.service import get_loading_time

LATER = NOW + timedelta(hours=1)


@pytest.fixture(autouse=True)
def loading_clock(app):
    app.dependency_overrides[get_loading_time] = lambda: LATER


@pytest.fixture
def loader(engine, users, resources):
    with Session(engine) as db:
        db.add(UserDepot(user_id=users["LOADER"], depot_id=resources["depot"]))
        db.commit()
    return users["LOADER"]


@pytest.fixture
def auth(users, settings, loader):
    return bearer(loader, settings)


@pytest.fixture
def published(client, engine, resources, headers, body, driver):
    """Two published trips: one with orders 1 and 4, one with order 2; order 3 is deferred."""
    with Session(engine) as db:
        db.add(
            make_order(
                db.get(Outlet, resources["outlet"]),
                id=UUID(int=4),
                order_weight_kg=Decimal("1"),
                order_volume_m3=Decimal("0.1"),
            )
        )
        db.commit()
    optimized = client.post(url(resources), headers=headers, json=body)
    assert optimized.status_code == 201, optimized.text
    optimized = optimized.json()
    response = client.post(
        publish_url(resources, optimized), headers=headers, json=publish_body(optimized, driver)
    )
    assert response.status_code == 201, response.text
    trips = sorted(optimized["trips"], key=lambda trip: -len(trip["stops"][0]["order_ids"]))
    assert [len(trip["stops"][0]["order_ids"]) for trip in trips] == [2, 1]
    return {"optimized": optimized, "big": trips[0], "small": trips[1]}


def event(order_id, status="LOADED", note=None, **extra):
    payload = {"event_id": str(uuid4()), "order_id": str(order_id), "status": status}
    if note is not None:
        payload["note"] = note
    return {**payload, **extra}


def events_url(trip):
    return f"/api/v1/trips/{trip['id']}/load-events"


def ready_url(trip):
    return f"/api/v1/trips/{trip['id']}/ready"


def loading_url(trip):
    return f"/api/v1/trips/{trip['id']}/loading"


def orders_of(trip):
    return trip["stops"][0]["order_ids"]


def snapshot(engine):
    with Session(engine) as db:
        return (
            db.scalar(select(func.count()).select_from(LoadEvent)),
            db.scalar(select(func.count()).select_from(TripLoadingCompletion)),
            tuple(db.scalars(select(Trip.status).order_by(Trip.id))),
            tuple(db.scalars(select(Order.status).order_by(Order.id))),
        )


def test_list_and_detail_show_only_scoped_published_trips(
    client, engine, resources, auth, published
):
    response = client.get("/api/v1/loader/trips", headers=auth)
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    data = response.json()
    assert data["total"] == 2 and {item["trip_id"] for item in data["items"]} == {
        published["big"]["id"],
        published["small"]["id"],
    }
    assert all(item["status"] == "PLANNED" and item["driver_id"] for item in data["items"])
    filtered = client.get(
        "/api/v1/loader/trips",
        headers=auth,
        params={"delivery_date": str(DAY + timedelta(days=1)), "status": "PLANNED"},
    ).json()
    assert filtered["total"] == 0 and filtered["items"] == []
    detail = client.get(loading_url(published["big"]), headers=auth).json()
    assert detail["trip"]["order_count"] == 2 and detail["pending_count"] == 2
    assert detail["last_event_sequence"] == 0 and detail["completion"] is None
    stop = detail["stops"][0]
    assert stop["sequence_number"] == 1
    assert [item["order_id"] for item in stop["orders"]] == sorted(orders_of(published["big"]))
    assert stop["orders"][0]["load_status"] is None
    assert stop["orders"][0]["order_weight_kg"] in ("6.000", "1.000")


def test_draft_and_unpublished_trips_are_hidden(client, engine, resources, auth, headers, body):
    optimized = client.post(url(resources), headers=headers, json=body).json()
    trip = optimized["trips"][0]
    assert client.get("/api/v1/loader/trips", headers=auth).json()["total"] == 0
    assert client.get(loading_url(trip), headers=auth).status_code == 404
    response = client.post(events_url(trip), headers=auth, json=event(orders_of(trip)[0]))
    assert response.status_code == 404
    ready = {"request_id": str(uuid4()), "last_event_sequence": 1}
    assert client.post(ready_url(trip), headers=auth, json=ready).status_code == 404
    assert snapshot(engine)[0] == 0


@pytest.mark.parametrize(
    "role,status",
    [
        (None, 401),
        ("inactive", 401),
        ("DISPATCHER", 403),
        ("DRIVER", 403),
        ("STORE_MANAGER", 403),
        ("roleless", 403),
    ],
)
def test_role_guards(client, users, settings, published, role, status):
    auth = {} if role is None else bearer(users[role], settings)
    trip = published["big"]
    assert client.get("/api/v1/loader/trips", headers=auth).status_code == status
    assert client.get(loading_url(trip), headers=auth).status_code == status
    response = client.post(events_url(trip), headers=auth, json=event(orders_of(trip)[0]))
    assert response.status_code == status
    ready = {"request_id": str(uuid4()), "last_event_sequence": 1}
    assert client.post(ready_url(trip), headers=auth, json=ready).status_code == status


def test_revoked_and_cross_depot_access_is_hidden(
    client, engine, users, settings, resources, auth, published
):
    trip = published["big"]
    with Session(engine) as db:
        db.execute(delete(UserDepot).where(UserDepot.user_id == users["LOADER"]))
        foreign = db.get(Plan, resources["foreign"]).depot_id
        db.add(UserDepot(user_id=users["LOADER"], depot_id=foreign))
        db.commit()
    assert client.get("/api/v1/loader/trips", headers=auth).json()["total"] == 0
    assert client.get(loading_url(trip), headers=auth).status_code == 404
    response = client.post(events_url(trip), headers=auth, json=event(orders_of(trip)[0]))
    assert response.status_code == 404
    assert snapshot(engine)[0] == 0


def test_event_moves_trip_to_loading_and_replays(client, engine, auth, users, published):
    trip = published["big"]
    payload = event(orders_of(trip)[0], occurred_at="2026-10-04T15:00:00+05:30")
    response = client.post(events_url(trip), headers=auth, json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["sequence_number"] == 1 and data["trip_status"] == "LOADING"
    assert data["recorded_by"] == str(users["LOADER"])
    assert data["stop_id"] == trip["stops"][0]["id"]
    again = client.post(events_url(trip), headers=auth, json=payload)
    assert again.status_code == 200 and again.json() == data
    same_instant = {**payload, "occurred_at": "2026-10-04T09:30:00Z"}
    again = client.post(events_url(trip), headers=auth, json=same_instant)
    assert again.status_code == 200 and again.json() == data
    changed = {**payload, "status": "DAMAGED", "note": "Crushed carton"}
    assert client.post(events_url(trip), headers=auth, json=changed).status_code == 409
    other = published["small"]
    moved = {**payload, "order_id": orders_of(other)[0]}
    assert client.post(events_url(other), headers=auth, json=moved).status_code == 409
    with Session(engine) as db:
        statuses = {row.id: row.status for row in db.execute(select(Order.id, Order.status))}
        assert {statuses[UUID(o)] for o in orders_of(trip)} == {"LOADING"}
        assert statuses[UUID(orders_of(other)[0])] == "PLANNED"
        assert statuses[UUID(int=3)] == "DEFERRED"
    assert snapshot(engine)[0] == 1


@pytest.mark.parametrize(
    "payload",
    [
        lambda trip, other: event(orders_of(trip)[0], "MISSING"),
        lambda trip, other: event(orders_of(trip)[0], "DAMAGED", "   "),
        lambda trip, other: event(orders_of(trip)[0], "DAMAGED", "x" * 501),
        lambda trip, other: event(orders_of(trip)[0], "LOST", "Gone"),
        lambda trip, other: event(orders_of(trip)[0], extra_field=1),
        lambda trip, other: event(orders_of(trip)[0], occurred_at="2026-10-04T10:00:00"),
        lambda trip, other: event(orders_of(trip)[0], occurred_at="2026-10-05T10:00:00+00:00"),
        lambda trip, other: event(UUID(int=3)),
        lambda trip, other: event(uuid4()),
        lambda trip, other: event(orders_of(other)[0]),
        lambda trip, other: {
            "event_id": "not-a-uuid",
            "order_id": orders_of(trip)[0],
            "status": "LOADED",
        },
    ],
)
def test_invalid_events_are_rejected_without_changes(client, engine, auth, published, payload):
    before = snapshot(engine)
    trip, other = published["big"], published["small"]
    response = client.post(events_url(trip), headers=auth, json=payload(trip, other))
    assert response.status_code == 422, response.text
    assert snapshot(engine) == before


def record(client, auth, trip, order_id, status="LOADED", note=None):
    response = client.post(events_url(trip), headers=auth, json=event(order_id, status, note))
    assert response.status_code == 201, response.text
    return response.json()["sequence_number"]


def test_readiness_rules_and_finalization(client, engine, auth, published):
    trip = published["big"]
    first, second = orders_of(trip)
    ready = {"request_id": str(uuid4()), "last_event_sequence": 1}
    response = client.post(ready_url(trip), headers=auth, json=ready)
    assert response.status_code == 409 and "refresh" in response.text
    record(client, auth, trip, first, "MISSING", "Not in bay 3")
    response = client.post(ready_url(trip), headers=auth, json=ready)
    assert response.status_code == 409 and "Every assigned order" in response.text
    sequence = record(client, auth, trip, second, "DAMAGED", "Torn wrapping")
    ready = {"request_id": str(uuid4()), "last_event_sequence": sequence}
    response = client.post(ready_url(trip), headers=auth, json=ready)
    assert response.status_code == 409 and "At least one order" in response.text
    # A later event supersedes the earlier exception for the same order.
    sequence = record(client, auth, trip, first)
    stale = {**ready, "last_event_sequence": sequence - 1}
    response = client.post(ready_url(trip), headers=auth, json=stale)
    assert response.status_code == 409 and "refresh" in response.text
    ready = {"request_id": str(uuid4()), "last_event_sequence": sequence}
    response = client.post(ready_url(trip), headers=auth, json=ready)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["trip"]["status"] == "READY" and data["pending_count"] == 0
    assert (data["loaded_count"], data["missing_count"], data["damaged_count"]) == (1, 0, 1)
    assert data["completion"]["last_event_sequence"] == sequence == 3
    damaged = [o for o in data["stops"][0]["orders"] if o["load_status"] == "DAMAGED"]
    assert damaged[0]["note"] == "Torn wrapping"
    again = client.post(ready_url(trip), headers=auth, json=ready)
    assert again.status_code == 200 and again.json() == data
    other_key = {**ready, "request_id": str(uuid4())}
    response = client.post(ready_url(trip), headers=auth, json=other_key)
    assert response.status_code == 409 and "finalized" in response.text
    response = client.post(events_url(trip), headers=auth, json=event(first))
    assert response.status_code == 409 and "finalized" in response.text
    detail = client.get(loading_url(trip), headers=auth).json()
    assert detail["last_event_sequence"] == 3
    with Session(engine) as db:
        trip_row = db.get(Trip, UUID(trip["id"]))
        assert trip_row.driver_id is not None
        assert db.scalar(select(func.count()).select_from(FuelReservation)) == 2


def test_ready_request_id_reused_on_another_trip_conflicts(client, auth, published):
    big, small = published["big"], published["small"]
    sequence = 0
    for order_id in orders_of(big):
        sequence = record(client, auth, big, order_id)
    ready = {"request_id": str(uuid4()), "last_event_sequence": sequence}
    assert client.post(ready_url(big), headers=auth, json=ready).status_code == 201
    one = record(client, auth, small, orders_of(small)[0])
    reuse = {**ready, "last_event_sequence": one}
    assert client.post(ready_url(small), headers=auth, json=reuse).status_code == 409


@pytest.mark.parametrize("target", ["flush", "commit"])
def test_failures_roll_back_loading(client, engine, auth, published, target):
    trip = published["big"]
    before = snapshot(engine)
    with patch(
        f"sqlalchemy.orm.Session.{target}", side_effect=OperationalError("secret", {}, Exception())
    ):
        response = client.post(events_url(trip), headers=auth, json=event(orders_of(trip)[0]))
    assert response.status_code == 503 and "secret" not in response.text
    assert snapshot(engine) == before
    sequence = 0
    for order_id in orders_of(trip):
        sequence = record(client, auth, trip, order_id)
    before = snapshot(engine)
    ready = {"request_id": str(uuid4()), "last_event_sequence": sequence}
    with patch(
        f"sqlalchemy.orm.Session.{target}", side_effect=OperationalError("secret", {}, Exception())
    ):
        response = client.post(ready_url(trip), headers=auth, json=ready)
    assert response.status_code == 503 and "secret" not in response.text
    assert snapshot(engine) == before and "READY" not in before[2]


def routes(engine):
    with Session(engine) as db:
        stops = [
            (s.id, s.outlet_id, s.sequence_number, s.status) for s in db.scalars(select(TripStop))
        ]
        assignments = [
            (a.order_id, a.outcome, a.trip_id, a.trip_stop_id)
            for a in db.scalars(select(PlanAssignment))
        ]
        reservations = [
            (r.trip_id, r.fuel_l, r.service_date) for r in db.scalars(select(FuelReservation))
        ]
        trips = [(t.id, t.vehicle_id, t.driver_id, t.trip_number) for t in db.scalars(select(Trip))]
        return [sorted(rows, key=str) for rows in (stops, assignments, reservations, trips)]


def test_loading_never_changes_routes_drivers_or_reservations(client, engine, auth, published):
    before = routes(engine)
    trip = published["big"]
    first, second = orders_of(trip)
    record(client, auth, trip, first, "MISSING", "Not staged")
    sequence = record(client, auth, trip, second)
    ready = {"request_id": str(uuid4()), "last_event_sequence": sequence}
    assert client.post(ready_url(trip), headers=auth, json=ready).status_code == 201
    assert routes(engine) == before


def test_database_rejects_foreign_assignment_and_unexplained_exceptions(engine, users, published):
    big, small = published["big"], published["small"]
    with Session(engine) as db:
        assignment = db.scalar(
            select(PlanAssignment).where(PlanAssignment.order_id == UUID(orders_of(small)[0]))
        )
        base = dict(
            sequence_number=1,
            request_hash="0" * 64,
            recorded_by=users["LOADER"],
            recorded_at=LATER,
            assignment_id=assignment.id,
        )
        cases = [
            dict(trip_id=UUID(big["id"]), order_id=assignment.order_id, status="LOADED"),
            dict(trip_id=UUID(small["id"]), order_id=assignment.order_id, status="MISSING"),
        ]
        for values in cases:
            db.add(LoadEvent(id=uuid4(), **base, **values))
            with pytest.raises(IntegrityError):
                db.flush()
            db.rollback()


def test_openapi_lists_authenticated_loading_contracts(client):
    schema = client.get("/openapi.json").json()
    for path, method in [
        ("/api/v1/loader/trips", "get"),
        ("/api/v1/trips/{trip_id}/loading", "get"),
        ("/api/v1/trips/{trip_id}/load-events", "post"),
        ("/api/v1/trips/{trip_id}/ready", "post"),
    ]:
        assert schema["paths"][path][method]["security"] == [{"HTTPBearer": []}]


def test_postgres_concurrent_event_and_ready_cannot_bypass_readiness(
    engine, users, loader, published
):
    if engine.dialect.name != "postgresql":
        pytest.skip("Requires real PostgreSQL row locks")
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from fastapi import HTTPException

    from app.auth.models import User
    from app.loading.schemas import LoadEventRequest, TripReadyRequest
    from app.loading.service import mark_trip_ready, record_load_event

    trip = published["big"]
    trip_id = UUID(trip["id"])
    first, second = orders_of(trip)
    with Session(engine) as db:
        user = db.get(User, users["LOADER"])
        for order_id in (first, second):
            record_load_event(db, user, trip_id, LoadEventRequest(**event(order_id)), LATER)
    barrier = Barrier(2)

    def run(action):
        with Session(engine) as db:
            user = db.get(User, users["LOADER"])
            barrier.wait(timeout=10)
            try:
                if action == "ready":
                    request = TripReadyRequest(request_id=uuid4(), last_event_sequence=2)
                    mark_trip_ready(db, user, trip_id, request, LATER)
                else:
                    request = LoadEventRequest(**event(first, "MISSING", "Gone"))
                    record_load_event(db, user, trip_id, request, LATER)
                return 201
            except HTTPException as error:
                db.rollback()
                return error.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, ["ready", "event"]))
    assert sorted(results) == [201, 409]
    with Session(engine) as db:
        completion = db.get(TripLoadingCompletion, trip_id)
        events = db.scalar(select(func.count()).where(LoadEvent.trip_id == trip_id))
        # Ready only succeeds when no newer event exists; a later event never follows it.
        assert (completion is None) == (events == 3)
        if completion is not None:
            assert completion.last_event_sequence == events == 2


def test_postgres_duplicate_event_ids_replay_once(engine, users, loader, published):
    if engine.dialect.name != "postgresql":
        pytest.skip("Requires real PostgreSQL row locks")
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from app.auth.models import User
    from app.loading.schemas import LoadEventRequest
    from app.loading.service import record_load_event

    trip = published["big"]
    request = LoadEventRequest(**event(orders_of(trip)[0]))
    barrier = Barrier(2)

    def run(_):
        with Session(engine) as db:
            user = db.get(User, users["LOADER"])
            barrier.wait(timeout=10)
            return record_load_event(db, user, UUID(trip["id"]), request, LATER)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, [0, 1]))
    assert sorted(created for _, created in results) == [False, True]
    assert results[0][0] == results[1][0]


def test_migration_roundtrip_preserves_published_trips(client, engine, auth, published):
    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from test_identity_schema import migration_config

    from app.db.models import Base

    record(client, auth, published["big"], orders_of(published["big"])[0])
    with engine.connect() as connection:
        command.downgrade(migration_config(connection), "0009_plan_publications")
        connection.commit()
        assert connection.scalar(select(func.count()).select_from(Trip)) == 2
        command.upgrade(migration_config(connection), "head")
        assert (
            compare_metadata(
                MigrationContext.configure(connection, opts={"compare_server_default": True}),
                Base.metadata,
            )
            == []
        )
        connection.commit()
    # Loading history is dropped; trip/order statuses written by loading remain.
    events, completions, trips, _ = snapshot(engine)
    assert (events, completions, sorted(trips)) == (0, 0, ["LOADING", "PLANNED"])
