from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from test_auth_api import app as app
from test_auth_api import bearer
from test_auth_api import client as client
from test_auth_api import engine as engine
from test_auth_api import settings as settings
from test_auth_api import stored_password as stored_password
from test_auth_api import users as users
from test_delivery_api import DELIVERY_NOW, path, pod, post, stops
from test_delivery_api import delivery_clock as delivery_clock
from test_delivery_api import driving as driving
from test_delivery_api import published as published
from test_loading_api import auth as auth
from test_loading_api import loader as loader
from test_loading_api import loading_clock as loading_clock
from test_optimization_api import body as body
from test_optimization_api import clock as clock
from test_optimization_api import headers as headers
from test_optimization_api import resources as resources
from test_publication_api import driver as driver

from app.auth.models import UserDepot
from app.db.models import DeliveryEvent, LoadEvent, SyncEvent, Trip
from app.sync.service import get_sync_time

URL = "/api/v1/sync/events"


@pytest.fixture(autouse=True)
def sync_clock(app):
    app.dependency_overrides[get_sync_time] = lambda: DELIVERY_NOW


def event(kind, trip, stop=None, **payload):
    item = {"event_id": str(uuid4()), "type": kind, "trip_id": trip["id"], "payload": payload}
    if stop is not None:
        item["stop_id"] = stop
    return item


def send(client, auth_, events, device="phone-1", status=200):
    response = client.post(URL, headers=auth_, json={"device_id": device, "events": events})
    assert response.status_code == status, response.text
    return response.json()


def outcomes(data):
    return [item["outcome"] for item in data["results"]]


def loading_batch(trip):
    events = [
        event("LOAD_RECORDED", trip, order_id=order_id, status="LOADED")
        for stop in trip["stops"]
        for order_id in stop["order_ids"]
    ]
    count = len(events)
    return [*events, event("TRIP_READY", trip, last_event_sequence=count)]


def counts(engine):
    with Session(engine) as db:
        return tuple(
            db.scalar(select(func.count()).select_from(model))
            for model in (SyncEvent, LoadEvent, DeliveryEvent)
        )


@pytest.fixture
def ready(client, auth, published):
    trip = published["route"]
    data = send(client, auth, loading_batch(trip))
    assert set(outcomes(data)) == {"APPLIED"}, data
    return trip


def test_loader_batch_applies_in_order_and_replays_after_restart(
    client, app, engine, auth, published
):
    trip = published["route"]
    batch = loading_batch(trip)
    data = send(client, auth, batch)
    assert outcomes(data) == ["APPLIED", "APPLIED", "APPLIED"]
    assert data["counts"]["APPLIED"] == 3 and data["results"][2]["result"]["trip"]["status"] == (
        "READY"
    )
    assert [r["http_status"] for r in data["results"]] == [201, 201, 201]
    assert counts(engine)[:2] == (3, 2)
    # A new client (app restart) resending the same queued events gets the recorded outcomes.
    with TestClient(app) as restarted:
        again = send(restarted, auth, batch)
    assert outcomes(again) == ["DUPLICATE"] * 3
    assert again["results"][0]["result"]["event_id"] == batch[0]["event_id"]
    assert counts(engine)[:2] == (3, 2)
    with Session(engine) as db:
        receipt = db.scalar(select(SyncEvent).where(SyncEvent.event_type == "TRIP_READY"))
        assert receipt.device_id == "phone-1" and receipt.entity_type == "TRIP"


def test_driver_batch_reuses_pod_and_guards(client, engine, driving, ready):
    trip = ready
    first, second = stops(trip)
    start = event("TRIP_STARTED", trip)
    arrive = event("STOP_ARRIVED", trip, first)
    data = send(client, driving, [start, arrive])
    assert outcomes(data) == ["APPLIED", "APPLIED"]
    # Deliver needs an uploaded POD: without one it conflicts and later trip events are skipped.
    deliver = event("STOP_DELIVERED", trip, first, pod_id=str(uuid4()))
    fail = event("STOP_FAILED", trip, second, reason_code="OUTLET_CLOSED", note="Closed")
    data = send(client, driving, [deliver, fail])
    assert outcomes(data) == ["CONFLICT", "SKIPPED"]
    assert data["results"][1]["http_status"] == 424
    proof = pod()
    post(client, driving, path(trip, "pod", first), proof)
    deliver = event("STOP_DELIVERED", trip, first, pod_id=proof["pod_id"])
    arrive_second = event("STOP_ARRIVED", trip, second)
    complete = event("TRIP_COMPLETED", trip)
    data = send(client, driving, [deliver, arrive_second, fail, complete])
    assert outcomes(data) == ["APPLIED"] * 4
    assert data["results"][3]["result"]["trip_status"] == "COMPLETED"


def test_conflicting_reuse_changes_nothing(client, engine, auth, driving, ready):
    trip = ready
    start = event("TRIP_STARTED", trip)
    assert outcomes(send(client, driving, [start])) == ["APPLIED"]
    before = counts(engine)
    changed = {**start, "payload": {"occurred_at": "2026-10-05T07:00:00+05:30"}}
    as_other_type = {**start, "type": "TRIP_COMPLETED"}
    data = send(client, driving, [changed])
    assert outcomes(data) == ["CONFLICT"]
    data = send(client, driving, [as_other_type])
    assert outcomes(data) == ["CONFLICT"]
    assert counts(engine) == before
    with Session(engine) as db:
        assert db.get(Trip, UUID(trip["id"])).status == "IN_PROGRESS"


def test_partial_batch_rejections_and_independent_trips(client, engine, auth, published):
    route, single = published["route"], published["single"]
    bad_note = event(
        "LOAD_RECORDED", route, order_id=route["stops"][0]["order_ids"][0], status="MISSING"
    )
    good_other_trip = event(
        "LOAD_RECORDED", single, order_id=single["stops"][0]["order_ids"][0], status="LOADED"
    )
    skipped = event(
        "LOAD_RECORDED", route, order_id=route["stops"][1]["order_ids"][0], status="LOADED"
    )
    malformed = {"event_id": "nope", "type": "LOAD_RECORDED"}
    stop_on_trip_event = {
        **event("TRIP_READY", single, last_event_sequence=1),
        "stop_id": str(uuid4()),
    }
    data = send(client, auth, [bad_note, good_other_trip, skipped, malformed, stop_on_trip_event])
    assert outcomes(data) == ["REJECTED", "APPLIED", "SKIPPED", "REJECTED", "REJECTED"]
    assert data["results"][0]["http_status"] == 422 and "note" in data["results"][0]["detail"]
    assert data["results"][3]["event_id"] is None
    assert counts(engine)[:2] == (1, 1)


def test_role_scope_and_revocation_are_rechecked_on_replay(
    client, engine, users, settings, auth, driving, published
):
    trip = published["route"]
    order_id = trip["stops"][0]["order_ids"][0]
    as_driver = send(
        client, driving, [event("LOAD_RECORDED", trip, order_id=order_id, status="LOADED")]
    )
    assert outcomes(as_driver) == ["REJECTED"] and as_driver["results"][0]["http_status"] == 403
    load = event("LOAD_RECORDED", trip, order_id=order_id, status="LOADED")
    assert outcomes(send(client, auth, [load])) == ["APPLIED"]
    with Session(engine) as db:
        db.execute(delete(UserDepot).where(UserDepot.user_id == users["LOADER"]))
        db.commit()
    replay = send(client, auth, [load])
    assert outcomes(replay) == ["REJECTED"] and replay["results"][0]["http_status"] == 404
    for role, status in [(None, 401), ("STORE_MANAGER", 403), ("DISPATCHER", 403)]:
        auth_ = {} if role is None else bearer(users[role], settings)
        response = client.post(URL, headers=auth_, json={"device_id": "x", "events": [load]})
        assert response.status_code == status


def test_stale_ready_and_out_of_order_driver_events_conflict(
    client, engine, auth, driving, published
):
    trip = published["route"]
    first_order = trip["stops"][0]["order_ids"][0]
    events = [
        event("LOAD_RECORDED", trip, order_id=first_order, status="LOADED"),
        event("TRIP_READY", trip, last_event_sequence=5),
    ]
    assert outcomes(send(client, auth, events)) == ["APPLIED", "CONFLICT"]
    early = send(client, driving, [event("STOP_ARRIVED", trip, stops(trip)[0])])
    assert outcomes(early) == ["CONFLICT"]


def test_failed_commit_is_retryable_and_atomic(client, engine, auth, published):
    trip = published["route"]
    load = event("LOAD_RECORDED", trip, order_id=trip["stops"][0]["order_ids"][0], status="LOADED")
    before = counts(engine)
    with patch(
        "sqlalchemy.orm.Session.commit", side_effect=OperationalError("secret", {}, Exception())
    ):
        data = send(client, auth, [load])
    assert outcomes(data) == ["RETRY"] and "secret" not in str(data)
    assert counts(engine) == before
    assert outcomes(send(client, auth, [load])) == ["APPLIED"]


@pytest.mark.parametrize(
    "body_",
    [
        {"device_id": "x", "events": []},
        {"device_id": "  ", "events": [{}]},
        {"device_id": "x", "events": [{}] * 51},
        {"events": [{}]},
        {"device_id": "x", "events": [{}], "user_id": str(uuid4())},
    ],
)
def test_invalid_envelopes(client, auth, body_):
    assert client.post(URL, headers=auth, json=body_).status_code == 422


def test_openapi_lists_authenticated_sync_contract(client):
    schema = client.get("/openapi.json").json()
    assert schema["paths"]["/api/v1/sync/events"]["post"]["security"] == [{"HTTPBearer": []}]


@pytest.mark.parametrize("variant", ["duplicate", "conflicting_payload"])
def test_postgres_concurrent_submissions_apply_once(engine, users, loader, published, variant):
    if engine.dialect.name != "postgresql":
        pytest.skip("Requires real PostgreSQL row locks")
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from app.auth.models import User
    from app.sync.schemas import SyncBatchRequest
    from app.sync.service import sync_events

    trip = published["route"]
    orders = [o for stop in trip["stops"] for o in stop["order_ids"]]
    first = event("LOAD_RECORDED", trip, order_id=orders[0], status="LOADED")
    second = (
        first
        if variant == "duplicate"
        else {
            **event("LOAD_RECORDED", trip, order_id=orders[1], status="LOADED"),
            "event_id": first["event_id"],
        }
    )
    barrier = Barrier(2)

    def run(item):
        with Session(engine) as db:
            user = db.get(User, users["LOADER"])
            barrier.wait(timeout=10)
            batch = SyncBatchRequest(device_id="phone", events=[item])
            return sync_events(db, user, batch, DELIVERY_NOW).results[0].outcome

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = sorted(pool.map(run, [first, second]))
    if variant == "duplicate":
        assert results == ["APPLIED", "DUPLICATE"]
    else:
        assert results[0] == "APPLIED" and results[1] in ("CONFLICT", "RETRY")
    assert counts(engine)[:2] == (1, 1)


def test_migration_roundtrip_keeps_domain_events(client, engine, auth, ready):
    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from test_identity_schema import migration_config

    from app.db.models import Base

    with engine.connect() as connection:
        command.downgrade(migration_config(connection), "0012_receipt_confirmations")
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
    receipts, loads, _ = counts(engine)
    assert receipts == 0 and loads == 2
    # Without receipts, a resent event is still recognized by the domain table.
    with Session(engine) as db:
        stored = db.scalars(select(LoadEvent)).first()
    resent = {
        "event_id": str(stored.id),
        "type": "LOAD_RECORDED",
        "trip_id": ready["id"],
        "payload": {"order_id": str(stored.order_id), "status": "LOADED"},
    }
    assert outcomes(send(client, auth, [resent])) == ["DUPLICATE"]


def test_invalid_envelope_blocks_later_events_of_its_trip(client, engine, auth, published):
    trip = published["route"]
    broken = {**event("LOAD_RECORDED", trip), "stop_id": str(uuid4())}
    later = event("LOAD_RECORDED", trip, order_id=trip["stops"][0]["order_ids"][0], status="LOADED")
    data = send(client, auth, [broken, later])
    assert outcomes(data) == ["REJECTED", "SKIPPED"]
    assert counts(engine)[:2] == (0, 0)


def test_cross_type_reuse_of_a_synced_event_id_conflicts(client, engine, driving, ready):
    start = event("TRIP_STARTED", ready)
    assert outcomes(send(client, driving, [start])) == ["APPLIED"]
    reused = {**event("STOP_ARRIVED", ready, stops(ready)[0]), "event_id": start["event_id"]}
    before = counts(engine)
    assert outcomes(send(client, driving, [reused])) == ["CONFLICT"]
    assert counts(engine) == before


def test_unexpected_error_is_not_retryable_and_rolls_back(client, engine, auth, published):
    trip = published["route"]
    first, second = (o for stop in trip["stops"] for o in stop["order_ids"])
    events = [
        event("LOAD_RECORDED", trip, order_id=first, status="LOADED"),
        event("LOAD_RECORDED", trip, order_id=second, status="LOADED"),
    ]
    with patch("app.loading.service._event_response", side_effect=TypeError("bug")):
        data = send(client, auth, events)
    assert outcomes(data) == ["REJECTED", "SKIPPED"]
    assert data["results"][0]["http_status"] == 500 and "bug" not in str(data)
    assert counts(engine)[:2] == (0, 0)
