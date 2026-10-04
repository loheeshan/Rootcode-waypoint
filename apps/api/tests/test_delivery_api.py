import base64
from datetime import UTC, datetime
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
from test_fleet_schema import make_outlet
from test_loading_api import LATER
from test_loading_api import auth as auth
from test_loading_api import loader as loader
from test_loading_api import loading_clock as loading_clock
from test_optimization_api import body as body
from test_optimization_api import clock as clock
from test_optimization_api import headers as headers
from test_optimization_api import resources as resources
from test_optimization_api import url
from test_order_schema import make_order
from test_publication_api import driver as driver
from test_publication_api import publish_body, publish_url

from app.auth.models import Role, User, UserDepot, UserRole
from app.db.models import (
    DeliveryEvent,
    Depot,
    Order,
    PlanRevision,
    ProofOfDelivery,
    Trip,
    TripStop,
)
from app.delivery.service import get_delivery_time

# 07:00 in Colombo on the delivery date; loading happened the previous day.
DELIVERY_NOW = datetime(2026, 10, 5, 1, 30, tzinfo=UTC)
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 200
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200


@pytest.fixture(autouse=True)
def delivery_clock(app):
    app.dependency_overrides[get_delivery_time] = lambda: DELIVERY_NOW


@pytest.fixture
def driving(users, settings, driver):
    return bearer(driver, settings)


@pytest.fixture
def published(client, engine, resources, headers, body, driver):
    """Trip 'route' visits outlet A (order 1) then B (order 4); trip 'single' carries order 2."""
    with Session(engine) as db:
        second = make_outlet(db.get(Depot, resources["depot"]))
        db.add(second)
        db.flush()
        db.add(
            make_order(
                second, id=UUID(int=4), order_weight_kg=Decimal("1"), order_volume_m3=Decimal("0.1")
            )
        )
        db.commit()
        outlets = [str(resources["outlet"]), str(second.id)]
    points = [None, *outlets]
    body = {
        **body,
        "services": [{"outlet_id": o, "service_seconds": 600} for o in outlets],
        "legs": [
            {"from_outlet_id": a, "to_outlet_id": b, "distance_km": "5.000", "travel_seconds": 900}
            for a in points
            for b in points
            if a != b
        ],
    }
    optimized = client.post(url(resources), headers=headers, json=body)
    assert optimized.status_code == 201, optimized.text
    optimized = optimized.json()
    response = client.post(
        publish_url(resources, optimized), headers=headers, json=publish_body(optimized, driver)
    )
    assert response.status_code == 201, response.text
    trips = sorted(optimized["trips"], key=lambda trip: -len(trip["stops"]))
    assert [len(trip["stops"]) for trip in trips] == [2, 1]
    return {"route": trips[0], "single": trips[1]}


def load(client, auth, trip, outcomes=None):
    """Record a loading outcome per order (default LOADED) and mark the trip ready."""
    sequence = 0
    for stop in trip["stops"]:
        for order_id in stop["order_ids"]:
            status = (outcomes or {}).get(order_id, "LOADED")
            payload = {"event_id": str(uuid4()), "order_id": order_id, "status": status}
            if status != "LOADED":
                payload["note"] = "Not in bay"
            response = client.post(
                f"/api/v1/trips/{trip['id']}/load-events", headers=auth, json=payload
            )
            assert response.status_code == 201, response.text
            sequence = response.json()["sequence_number"]
    ready = {"request_id": str(uuid4()), "last_event_sequence": sequence}
    response = client.post(f"/api/v1/trips/{trip['id']}/ready", headers=auth, json=ready)
    assert response.status_code == 201, response.text


@pytest.fixture
def ready(client, auth, published):
    load(client, auth, published["route"])
    return published["route"]


def ev(**extra):
    return {"event_id": str(uuid4()), **extra}


def path(trip, action, stop=None):
    if stop is None:
        return f"/api/v1/trips/{trip['id']}/{action}"
    return f"/api/v1/trips/{trip['id']}/stops/{stop}/{action}"


def stops(trip):
    return [stop["id"] for stop in trip["stops"]]


def pod(photo=JPEG, mime="image/jpeg", **extra):
    return {
        "pod_id": str(uuid4()),
        "receiver_name": "Nimal Perera",
        "photo_mime_type": mime,
        "photo_base64": base64.b64encode(photo).decode(),
        **extra,
    }


def post(client, auth, url_, payload, status=201):
    response = client.post(url_, headers=auth, json=payload)
    assert response.status_code == status, response.text
    return response.json()


def state(engine):
    with Session(engine) as db:
        return (
            db.scalar(select(func.count()).select_from(DeliveryEvent)),
            db.scalar(select(func.count()).select_from(ProofOfDelivery)),
            tuple(sorted(db.scalars(select(Trip.status)))),
            tuple(sorted(db.scalars(select(TripStop.status)))),
            tuple(db.scalars(select(Order.status).order_by(Order.id))),
        )


def test_driver_reads_only_own_published_trips(client, engine, users, settings, driving, published):
    listing = client.get("/api/v1/driver/trips", headers=driving)
    assert listing.status_code == 200 and listing.json()["total"] == 2
    detail = client.get(path(published["route"], "").rstrip("/"), headers=driving)
    assert detail.status_code == 200, detail.text
    data = detail.json()
    assert [stop["sequence_number"] for stop in data["stops"]] == [1, 2]
    assert data["stops"][0]["outlet_brand"] and data["stops"][0]["requires_visit"] is False
    assert data["started_at"] is None and data["last_event_sequence"] == 0
    with Session(engine) as db:
        other = User(email="driver2@example.com", password_hash="x")
        role = db.scalar(select(Role).where(Role.code == "DRIVER"))
        other.role_assignments = [UserRole(role=role)]
        db.add(other)
        db.flush()
        depot = db.scalar(select(UserDepot.depot_id).where(UserDepot.user_id == users["DRIVER"]))
        db.add(UserDepot(user_id=other.id, depot_id=depot))
        db.commit()
        other_auth = bearer(other.id, settings)
    assert client.get("/api/v1/driver/trips", headers=other_auth).json()["total"] == 0
    trip_url = path(published["route"], "").rstrip("/")
    assert client.get(trip_url, headers=other_auth).status_code == 404
    assert (
        client.post(path(published["route"], "start"), headers=other_auth, json=ev()).status_code
        == 404
    )


@pytest.mark.parametrize(
    "role,status",
    [(None, 401), ("inactive", 401), ("LOADER", 403), ("DISPATCHER", 403), ("STORE_MANAGER", 403)],
)
def test_role_guards(client, users, settings, published, role, status):
    auth_ = {} if role is None else bearer(users[role], settings)
    trip = published["route"]
    stop = stops(trip)[0]
    assert client.get("/api/v1/driver/trips", headers=auth_).status_code == status
    assert client.get(path(trip, "").rstrip("/"), headers=auth_).status_code == status
    for url_, payload in [
        (path(trip, "start"), ev()),
        (path(trip, "arrive", stop), ev()),
        (path(trip, "pod", stop), pod()),
        (path(trip, "deliver", stop), ev(pod_id=str(uuid4()))),
        (path(trip, "fail", stop), ev(reason_code="OTHER", note="x")),
        (path(trip, "complete"), ev()),
    ]:
        assert client.post(url_, headers=auth_, json=payload).status_code == status


def test_unready_unpublished_and_revoked_trips_cannot_start(
    client, engine, users, resources, headers, body, driving, auth, published
):
    trip = published["route"]
    before = state(engine)
    response = client.post(path(trip, "start"), headers=driving, json=ev())
    assert response.status_code == 409 and "not READY" in response.text
    with Session(engine) as db:
        revision = PlanRevision(plan_id=resources["plan"], revision_number=9)
        db.add(revision)
        db.flush()
        draft = Trip(
            plan_revision_id=revision.id,
            vehicle_id=resources["vehicle"],
            driver_id=users["DRIVER"],
            trip_number=1,
            status="READY",
        )
        db.add(draft)
        db.commit()
        draft_trip = {"id": str(draft.id)}
    assert client.post(path(draft_trip, "start"), headers=driving, json=ev()).status_code == 404
    assert client.get(path(draft_trip, "").rstrip("/"), headers=driving).status_code == 404
    load(client, auth, trip)
    with Session(engine) as db:
        db.execute(delete(UserDepot).where(UserDepot.user_id == users["DRIVER"]))
        db.commit()
    assert client.post(path(trip, "start"), headers=driving, json=ev()).status_code == 404
    assert client.get("/api/v1/driver/trips", headers=driving).json()["total"] == 0
    assert state(engine)[0] == before[0] == 0


def test_full_delivery_with_failed_stop_and_completion(
    client, engine, users, settings, headers, driving, ready
):
    trip = ready
    first, second = stops(trip)
    start = ev()
    started = post(client, driving, path(trip, "start"), start)
    assert started["trip_status"] == "IN_PROGRESS" and started["sequence_number"] == 1
    assert post(client, driving, path(trip, "start"), start, 200) == started
    assert client.post(path(trip, "start"), headers=driving, json=ev()).status_code == 409
    with Session(engine) as db:
        assert {db.get(Order, UUID(int=n)).status for n in (1, 4)} == {"OUT_FOR_DELIVERY"}
    response = client.post(path(trip, "complete"), headers=driving, json=ev())
    assert response.status_code == 409 and "Every stop" in response.text
    post(client, driving, path(trip, "arrive", first), ev())
    response = client.post(path(trip, "arrive", second), headers=driving, json=ev())
    assert response.status_code == 409 and "current stop" in response.text
    response = client.post(
        path(trip, "deliver", first), headers=driving, json=ev(pod_id=str(uuid4()))
    )
    assert response.status_code == 409 and "proof of delivery" in response.text
    proof = pod(captured_at="2026-10-04T16:00:00+05:30")
    saved = post(client, driving, path(trip, "pod", first), proof)
    assert saved["photo_size_bytes"] == len(JPEG) and saved["receiver_name"] == "Nimal Perera"
    assert post(client, driving, path(trip, "pod", first), proof, 200) == saved
    changed = {**proof, "receiver_name": "Someone Else"}
    assert client.post(path(trip, "pod", first), headers=driving, json=changed).status_code == 409
    another = client.post(path(trip, "pod", first), headers=driving, json=pod())
    assert another.status_code == 409
    delivered = post(client, driving, path(trip, "deliver", first), ev(pod_id=proof["pod_id"]))
    assert delivered["stop_status"] == "DELIVERED" and delivered["pod_id"] == proof["pod_id"]
    post(client, driving, path(trip, "arrive", second), ev())
    failed = post(
        client,
        driving,
        path(trip, "fail", second),
        ev(reason_code="OUTLET_CLOSED", note="Shutters down at 10:05"),
    )
    assert failed["stop_status"] == "FAILED" and failed["reason_code"] == "OUTLET_CLOSED"
    with Session(engine) as db:
        assert db.get(Order, UUID(trip["stops"][0]["order_ids"][0])).status == "DELIVERED"
        assert db.get(Order, UUID(trip["stops"][1]["order_ids"][0])).status == "OUT_FOR_DELIVERY"
    done = post(client, driving, path(trip, "complete"), ev())
    assert done["trip_status"] == "COMPLETED"
    response = client.post(path(trip, "arrive", second), headers=driving, json=ev())
    assert response.status_code == 409
    detail = client.get(path(trip, "").rstrip("/"), headers=driving).json()
    assert detail["started_at"] and detail["completed_at"]
    assert detail["stops"][0]["pod"]["pod_id"] == proof["pod_id"]
    assert detail["stops"][1]["failure_note"] == "Shutters down at 10:05"
    photo = client.get(path(trip, "pod", first), headers=driving)
    assert photo.status_code == 200 and photo.content == JPEG
    assert photo.headers["content-type"] == "image/jpeg"
    assert photo.headers["x-content-type-options"] == "nosniff"
    assert client.get(path(trip, "pod", first), headers=headers).content == JPEG
    assert client.get(path(trip, "pod", second), headers=driving).status_code == 404
    loader_auth = bearer(users["LOADER"], settings)
    assert client.get(path(trip, "pod", first), headers=loader_auth).status_code == 403


def test_missing_order_stop_needs_no_visit_and_order_is_never_delivered(
    client, engine, auth, driving, published
):
    trip = published["route"]
    first, second = stops(trip)
    missing = trip["stops"][1]["order_ids"][0]
    load(client, auth, trip, {missing: "MISSING"})
    post(client, driving, path(trip, "start"), ev())
    for action, payload in [("arrive", ev()), ("fail", ev(reason_code="OTHER", note="n/a"))]:
        response = client.post(path(trip, action, second), headers=driving, json=payload)
        assert response.status_code == 409 and "no loaded orders" in response.text
    post(client, driving, path(trip, "arrive", first), ev())
    proof = pod(mime="image/png", photo=PNG)
    post(client, driving, path(trip, "pod", first), proof)
    post(client, driving, path(trip, "deliver", first), ev(pod_id=proof["pod_id"]))
    post(client, driving, path(trip, "complete"), ev())
    with Session(engine) as db:
        assert db.get(Order, UUID(missing)).status == "LOADING"
        assert db.get(Order, UUID(trip["stops"][0]["order_ids"][0])).status == "DELIVERED"


@pytest.mark.parametrize(
    "case",
    [
        "base64",
        "mismatch",
        "oversize",
        "receiver",
        "gif",
        "extra",
        "future",
    ],
)
def test_pod_validation(client, engine, driving, ready, case):
    trip, stop = ready, stops(ready)[0]
    post(client, driving, path(trip, "start"), ev())
    post(client, driving, path(trip, "arrive", stop), ev())
    payload = {
        "base64": lambda: {**pod(), "photo_base64": "not base64!!"},
        "mismatch": lambda: pod(mime="image/png"),
        "oversize": lambda: pod(photo=b"\xff\xd8\xff" + b"\x00" * 1_000_000),
        "receiver": lambda: pod(receiver_name="   "),
        "gif": lambda: pod(mime="image/gif"),
        "extra": lambda: pod(uploaded_by=str(uuid4())),
        "future": lambda: pod(captured_at="2026-10-06T00:00:00+00:00"),
    }[case]()
    before = state(engine)
    response = client.post(path(trip, "pod", stop), headers=driving, json=payload)
    assert response.status_code == 422, response.text
    assert state(engine) == before


def test_pod_requires_arrival_and_ownership(client, driving, ready, published):
    trip, stop = ready, stops(ready)[0]
    response = client.post(path(trip, "pod", stop), headers=driving, json=pod())
    assert response.status_code == 409
    post(client, driving, path(trip, "start"), ev())
    response = client.post(
        path(trip, "pod", stops(published["single"])[0]), headers=driving, json=pod()
    )
    assert response.status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        ev(reason_code="OTHER"),
        ev(reason_code="OTHER", note="  "),
        ev(reason_code="LOST", note="Gone"),
        ev(reason_code="OTHER", note="x" * 501),
        ev(occurred_at="2026-10-04T10:00:00"),
        ev(occurred_at="2026-10-06T00:00:00+00:00", reason_code="OTHER", note="later"),
    ],
)
def test_invalid_failures(client, engine, driving, ready, payload):
    post(client, driving, path(ready, "start"), ev())
    before = state(engine)
    response = client.post(path(ready, "fail", stops(ready)[0]), headers=driving, json=payload)
    assert response.status_code == 422, response.text
    assert state(engine) == before


def test_failure_without_arrival_and_event_id_reuse(client, engine, driving, ready):
    trip = ready
    first, second = stops(trip)
    start = ev()
    post(client, driving, path(trip, "start"), start)
    reused = client.post(path(trip, "arrive", first), headers=driving, json=start)
    assert reused.status_code == 409 and "different delivery data" in reused.text
    post(
        client,
        driving,
        path(trip, "fail", first),
        ev(reason_code="VEHICLE_ISSUE", note="Flat tyre before reaching outlet"),
    )
    again = client.post(
        path(trip, "fail", first), headers=driving, json=ev(reason_code="OTHER", note="dup")
    )
    assert again.status_code == 409


@pytest.mark.parametrize("target", ["flush", "commit"])
def test_failures_roll_back_delivery(client, engine, driving, ready, target):
    trip, stop = ready, stops(ready)[0]
    post(client, driving, path(trip, "start"), ev())
    post(client, driving, path(trip, "arrive", stop), ev())
    proof = pod()
    post(client, driving, path(trip, "pod", stop), proof)
    before = state(engine)
    with patch(
        f"sqlalchemy.orm.Session.{target}", side_effect=OperationalError("secret", {}, Exception())
    ):
        response = client.post(
            path(trip, "deliver", stop), headers=driving, json=ev(pod_id=proof["pod_id"])
        )
    assert response.status_code == 503 and "secret" not in response.text
    assert state(engine) == before


def test_database_enforces_evidence_and_single_outcome(engine, users, client, driving, ready):
    trip, stop = ready, stops(ready)[0]
    post(client, driving, path(trip, "start"), ev())
    base = dict(
        trip_id=UUID(trip["id"]),
        trip_stop_id=UUID(stop),
        request_hash="0" * 64,
        recorded_by=users["DRIVER"],
        recorded_at=LATER,
    )
    cases = [
        dict(event_type="DELIVERED", sequence_number=10),
        dict(event_type="FAILED", sequence_number=11, note="x"),
        dict(event_type="TRIP_STARTED", sequence_number=12),
    ]
    with Session(engine) as db:
        for values in cases:
            db.add(DeliveryEvent(id=uuid4(), **{**base, **values}))
            with pytest.raises(IntegrityError):
                db.flush()
            db.rollback()
        db.add(
            DeliveryEvent(
                id=uuid4(),
                **base,
                event_type="FAILED",
                sequence_number=20,
                reason_code="OTHER",
                note="x",
            )
        )
        db.add(
            DeliveryEvent(
                id=uuid4(),
                **base,
                event_type="FAILED",
                sequence_number=21,
                reason_code="OTHER",
                note="y",
            )
        )
        with pytest.raises(IntegrityError):
            db.flush()


def test_openapi_lists_authenticated_driver_contracts(client):
    schema = client.get("/openapi.json").json()
    for route, method in [
        ("/api/v1/driver/trips", "get"),
        ("/api/v1/trips/{trip_id}", "get"),
        ("/api/v1/trips/{trip_id}/start", "post"),
        ("/api/v1/trips/{trip_id}/stops/{stop_id}/arrive", "post"),
        ("/api/v1/trips/{trip_id}/stops/{stop_id}/pod", "post"),
        ("/api/v1/trips/{trip_id}/stops/{stop_id}/pod", "get"),
        ("/api/v1/trips/{trip_id}/stops/{stop_id}/deliver", "post"),
        ("/api/v1/trips/{trip_id}/stops/{stop_id}/fail", "post"),
        ("/api/v1/trips/{trip_id}/complete", "post"),
    ]:
        assert schema["paths"][route][method]["security"] == [{"HTTPBearer": []}]


def test_postgres_concurrent_deliver_and_fail_allow_one_outcome(
    engine, users, client, driving, ready
):
    if engine.dialect.name != "postgresql":
        pytest.skip("Requires real PostgreSQL row locks")
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from fastapi import HTTPException

    from app.delivery.schemas import DeliverRequest, FailRequest
    from app.delivery.service import deliver_stop, fail_stop

    trip, stop = ready, stops(ready)[0]
    post(client, driving, path(trip, "start"), ev())
    post(client, driving, path(trip, "arrive", stop), ev())
    proof = pod()
    post(client, driving, path(trip, "pod", stop), proof)
    barrier = Barrier(2)

    def run(action):
        with Session(engine) as db:
            user = db.get(User, users["DRIVER"])
            barrier.wait(timeout=10)
            try:
                if action == "deliver":
                    request = DeliverRequest(event_id=uuid4(), pod_id=UUID(proof["pod_id"]))
                    deliver_stop(db, user, UUID(trip["id"]), UUID(stop), request, DELIVERY_NOW)
                else:
                    request = FailRequest(event_id=uuid4(), reason_code="OTHER", note="race")
                    fail_stop(db, user, UUID(trip["id"]), UUID(stop), request, DELIVERY_NOW)
                return 201
            except HTTPException as error:
                db.rollback()
                return error.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, ["deliver", "fail"]))
    assert sorted(results) == [201, 409]
    with Session(engine) as db:
        outcomes = db.scalar(
            select(func.count()).where(DeliveryEvent.event_type.in_(["DELIVERED", "FAILED"]))
        )
        assert outcomes == 1


def test_postgres_duplicate_start_replays_once(engine, users, driving, ready):
    if engine.dialect.name != "postgresql":
        pytest.skip("Requires real PostgreSQL row locks")
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from app.delivery.schemas import EventRequest
    from app.delivery.service import start_trip

    request = EventRequest(event_id=uuid4())
    barrier = Barrier(2)

    def run(_):
        with Session(engine) as db:
            user = db.get(User, users["DRIVER"])
            barrier.wait(timeout=10)
            return start_trip(db, user, UUID(ready["id"]), request, DELIVERY_NOW)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, [0, 1]))
    assert sorted(created for _, created in results) == [False, True]


def test_migration_roundtrip_keeps_trip_statuses(client, engine, driving, ready):
    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from test_identity_schema import migration_config

    from app.db.models import Base

    post(client, driving, path(ready, "start"), ev())
    with engine.connect() as connection:
        command.downgrade(migration_config(connection), "0010_load_events")
        connection.commit()
        command.upgrade(migration_config(connection), "head")
        assert (
            compare_metadata(
                MigrationContext.configure(connection, opts={"compare_server_default": True}),
                Base.metadata,
            )
            == []
        )
        connection.commit()
    events, pods, trips, _, _ = state(engine)
    assert (events, pods) == (0, 0) and "IN_PROGRESS" in trips


def test_start_requires_delivery_date_and_one_trip_in_progress(
    client, app, auth, driving, published
):
    route, single = published["route"], published["single"]
    load(client, auth, route)
    load(client, auth, single)
    app.dependency_overrides[get_delivery_time] = lambda: LATER
    response = client.post(path(route, "start"), headers=driving, json=ev())
    assert response.status_code == 409 and "delivery date" in response.text
    app.dependency_overrides[get_delivery_time] = lambda: DELIVERY_NOW
    post(client, driving, path(route, "start"), ev())
    response = client.post(path(single, "start"), headers=driving, json=ev())
    assert response.status_code == 409 and "in progress" in response.text


def test_pod_read_scope(client, engine, users, settings, headers, driving, ready, resources):
    trip, stop = ready, stops(ready)[0]
    post(client, driving, path(trip, "start"), ev())
    post(client, driving, path(trip, "arrive", stop), ev())
    post(client, driving, path(trip, "pod", stop), pod())
    assert client.get(path(trip, "pod", stop), headers=headers).status_code == 200
    with Session(engine) as db:
        other = User(email="driver3@example.com", password_hash="x")
        other.role_assignments = [
            UserRole(role=db.scalar(select(Role).where(Role.code == "DRIVER")))
        ]
        db.add(other)
        db.flush()
        db.add(UserDepot(user_id=other.id, depot_id=resources["depot"]))
        db.commit()
        other_auth = bearer(other.id, settings)
    assert client.get(path(trip, "pod", stop), headers=other_auth).status_code == 404
    with Session(engine) as db:
        db.execute(delete(UserDepot).where(UserDepot.user_id == users["DISPATCHER"]))
        db.commit()
    assert client.get(path(trip, "pod", stop), headers=headers).status_code == 404


def test_oversized_pod_request_is_rejected_before_parsing(client, engine, driving, ready):
    trip, stop = ready, stops(ready)[0]
    before = state(engine)
    response = client.post(
        path(trip, "pod", stop),
        headers={**driving, "Content-Type": "application/json"},
        content=b"{" + b" " * 1_600_000 + b"}",
    )
    assert response.status_code == 413 and response.headers["cache-control"] == "no-store"
    assert state(engine) == before
