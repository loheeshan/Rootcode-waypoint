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
from test_delivery_api import DELIVERY_NOW
from test_delivery_api import delivery_clock as delivery_clock
from test_delivery_api import driving as driving
from test_delivery_api import published as published
from test_delivery_api import ready as ready
from test_loading_api import auth as auth
from test_loading_api import loader as loader
from test_loading_api import loading_clock as loading_clock
from test_optimization_api import DAY
from test_optimization_api import body as body
from test_optimization_api import clock as clock
from test_optimization_api import headers as headers
from test_optimization_api import resources as resources
from test_publication_api import driver as driver
from test_receipts_api import delivered as delivered
from test_receipts_api import receipt_clock as receipt_clock
from test_receipts_api import receipt_url, request
from test_receipts_api import store as store
from test_sync_api import event, send
from test_sync_api import sync_clock as sync_clock

from app.audit.models import AuditEvent
from app.auth.models import UserDepot
from app.db.models import ReceiptConfirmation
from app.operations.service import get_operations_time

BASE = "/api/v1/operations"


@pytest.fixture(autouse=True)
def operations_clock(app):
    app.dependency_overrides[get_operations_time] = lambda: DELIVERY_NOW


def get(client, headers_, path, expect=200, **params):
    response = client.get(f"{BASE}/{path}", headers=headers_, params=params)
    assert response.status_code == expect, response.text
    return response.json()


def audit_counts(engine):
    with Session(engine) as db:
        return dict(
            db.execute(select(AuditEvent.action, func.count()).group_by(AuditEvent.action)).all()
        )


def test_empty_day_returns_zeroes(client, headers, resources):
    data = get(client, headers, "live")
    assert data["delivery_date"] == str(DAY) and data["published_plans"] == 0
    assert data["draft_plans"] == 1 and set(data["trips_by_status"].values()) == {0}
    assert data["loading"]["orders"] == 0 and set(data["exceptions"].values()) == {0}
    assert get(client, headers, "trips")["total"] == 0
    assert get(client, headers, "exceptions")["items"] == []
    assert get(client, headers, "audit")["total"] == 0


def test_live_summary_counts_each_order_once(client, engine, headers, store, delivered):
    data = get(client, headers, "live")
    assert (data["draft_plans"], data["published_plans"]) == (0, 1)
    assert data["trips_by_status"]["COMPLETED"] == 1 and data["trips_by_status"]["PLANNED"] == 1
    assert data["loading"] == {"orders": 3, "loaded": 2, "missing": 0, "damaged": 0, "pending": 1}
    assert data["delivery"] == {
        "stops_requiring_visit": 2,
        "delivered_stops": 1,
        "failed_stops": 1,
        "open_stops": 0,
        "delivered_orders": 1,
        "receipts_confirmed": 0,
    }
    statuses = {k: v for k, v in data["orders_by_status"].items() if v}
    assert statuses == {"DELIVERED": 1, "OUT_FOR_DELIVERY": 1, "PLANNED": 1, "DEFERRED": 1}
    assert data["deferred_orders"] == 1 and data["receipts_pending"] == 1
    assert data["exceptions"]["DELIVERY_FAILED"] == 1
    assert data["exceptions"]["RECEIPT_PENDING"] == 1
    client.post(receipt_url(delivered["delivered"]), headers=store, json=request())
    after = get(client, headers, "live")
    assert after["receipts_pending"] == 0 and after["delivery"]["receipts_confirmed"] == 1
    assert after["exceptions"]["RECEIPT_PENDING"] == 0
    assert get(client, headers, "live", delivery_date="2026-10-06")["published_plans"] == 0


def test_trips_are_filtered_paginated_and_ordered(client, headers, delivered):
    everything = get(client, headers, "trips")
    assert everything["total"] == 2
    ids = [item["trip"]["trip_id"] for item in everything["items"]]
    page = get(client, headers, "trips", limit=1, offset=1)
    assert page["total"] == 2 and [i["trip"]["trip_id"] for i in page["items"]] == ids[1:]
    completed = get(client, headers, "trips", status="COMPLETED")["items"]
    assert len(completed) == 1 and completed[0]["delivery"]["failed_stops"] == 1
    assert completed[0]["loading"]["loaded"] == 2


def test_exceptions_identify_trip_stop_and_orders(
    client, engine, headers, auth, delivered, published
):
    single = published["single"]
    order = single["stops"][0]["order_ids"][0]
    load = event("LOAD_RECORDED", single, order_id=order, status="MISSING", note="Not staged")
    assert send(client, auth, [load])["results"][0]["outcome"] == "APPLIED"
    items = get(client, headers, "exceptions")["items"]
    kinds = {item["kind"]: item for item in items}
    assert set(kinds) == {"LOAD_MISSING", "DELIVERY_FAILED", "RECEIPT_PENDING"}
    missing = kinds["LOAD_MISSING"]
    assert missing["order_ids"] == [order] and missing["note"] == "Not staged"
    assert missing["trip_id"] == single["id"] and missing["stop_id"] == single["stops"][0]["id"]
    assert missing["severity"] == "FAILURE"
    failed = kinds["DELIVERY_FAILED"]
    assert failed["order_ids"] == [delivered["failed"]] and failed["reason_code"] == "OUTLET_CLOSED"
    pending = kinds["RECEIPT_PENDING"]
    assert pending["severity"] == "PENDING" and pending["order_ids"] == [delivered["delivered"]]
    stamps = [item["occurred_at"] for item in items]
    assert stamps == sorted(stamps, reverse=True)
    only = get(client, headers, "exceptions", kind="LOAD_MISSING", limit=1)
    assert only["total"] == 1 and only["items"][0]["source_id"] == missing["source_id"]


def test_sync_conflicts_are_recorded_once(client, engine, headers, auth, delivered, published):
    single = published["single"]
    stale = event("TRIP_READY", single, last_event_sequence=7)
    for _ in range(2):
        assert send(client, auth, [stale])["results"][0]["outcome"] == "CONFLICT"
    assert audit_counts(engine).get("SYNC_CONFLICT") == 1
    conflicts = get(client, headers, "exceptions", kind="SYNC_CONFLICT")["items"]
    assert len(conflicts) == 1 and conflicts[0]["reason_code"] == "TRIP_READY"
    # A conflict naming a trip the caller cannot access is not recorded.
    order = single["stops"][0]["order_ids"][0]
    applied = event("LOAD_RECORDED", single, order_id=order, status="LOADED")
    assert send(client, auth, [applied])["results"][0]["outcome"] == "APPLIED"
    foreign = {**applied, "trip_id": str(uuid4())}
    assert send(client, auth, [foreign])["results"][0]["outcome"] == "CONFLICT"
    assert audit_counts(engine).get("SYNC_CONFLICT") == 1


def test_audit_history_records_mutations_once(
    client, engine, users, headers, driving, store, delivered
):
    counts = audit_counts(engine)
    assert counts == {
        "PLAN_PUBLISHED": 1,
        "LOAD_RECORDED": 2,
        "TRIP_READY": 1,
        "TRIP_STARTED": 1,
        "STOP_ARRIVED": 2,
        "POD_UPLOADED": 1,
        "STOP_DELIVERED": 1,
        "STOP_FAILED": 1,
        "TRIP_COMPLETED": 1,
    }
    payload = request()
    for _ in range(2):
        client.post(receipt_url(delivered["delivered"]), headers=store, json=payload)
    assert audit_counts(engine)["RECEIPT_CONFIRMED"] == 1
    history = get(client, headers, "audit", limit=100)
    assert history["total"] == 12
    stamps = [item["occurred_at"] for item in history["items"]]
    assert stamps == sorted(stamps, reverse=True)
    receipt = get(client, headers, "audit", action="RECEIPT_CONFIRMED")["items"][0]
    assert receipt["actor_id"] == str(users["STORE_MANAGER"])
    assert receipt["details"]["order_status"] == {"from": "DELIVERED", "to": "RECEIPT_CONFIRMED"}
    pod = get(client, headers, "audit", action="POD_UPLOADED")["items"][0]
    assert set(pod["details"]) == {"pod_id", "photo_mime_type", "photo_size_bytes"}
    assert pod["actor_id"] == str(users["DRIVER"])
    failed = get(client, headers, "audit", action="STOP_FAILED")["items"][0]
    assert failed["details"]["stop_status"] == {"from": "ARRIVED", "to": "FAILED"}
    published_entry = get(client, headers, "audit", action="PLAN_PUBLISHED")["items"][0]
    assert published_entry["actor_id"] == str(users["DISPATCHER"])
    page = get(client, headers, "audit", limit=5, offset=5)
    assert [i["id"] for i in page["items"]] == [i["id"] for i in history["items"][5:10]]
    window = get(client, headers, "audit", occurred_from=DELIVERY_NOW.isoformat())
    # Delivery-day driver actions (7) plus the receipt; earlier loading/publishing excluded.
    assert window["total"] == 8


def test_audit_write_failure_rolls_back_domain_change(client, engine, store, delivered):
    with patch(
        "app.receipts.service.record_audit",
        side_effect=OperationalError("secret", {}, Exception()),
    ):
        response = client.post(receipt_url(delivered["delivered"]), headers=store, json=request())
    assert response.status_code == 503
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(ReceiptConfirmation)) == 0
    assert "RECEIPT_CONFIRMED" not in audit_counts(engine)


def test_database_rejects_duplicate_audit_keys(engine, delivered):
    with Session(engine) as db:
        original = db.scalars(select(AuditEvent)).first()
        copy = AuditEvent(
            occurred_at=original.occurred_at,
            actor_id=original.actor_id,
            action=original.action,
            entity_type=original.entity_type,
            entity_id=original.entity_id,
            depot_id=original.depot_id,
            trip_id=original.trip_id,
            source_id=original.source_id,
            dedupe_key=original.dedupe_key,
            details={},
        )
        db.add(copy)
        with pytest.raises(IntegrityError):
            db.flush()


@pytest.mark.parametrize(
    "role,status",
    [
        (None, 401),
        ("inactive", 401),
        ("DRIVER", 403),
        ("LOADER", 403),
        ("STORE_MANAGER", 403),
        ("roleless", 403),
    ],
)
def test_role_guards(client, users, settings, resources, role, status):
    auth_ = {} if role is None else bearer(users[role], settings)
    for path in ("live", "trips", "exceptions", "audit"):
        assert client.get(f"{BASE}/{path}", headers=auth_).status_code == status


def test_revoked_and_cross_depot_scope(client, engine, users, resources, headers, delivered):
    # The other depot's plan exists but is never assigned to this Dispatcher.
    for path in ("live", "trips", "exceptions", "audit"):
        get(client, headers, path, expect=403, depot_id=str(uuid4()))
    with Session(engine) as db:
        db.execute(delete(UserDepot).where(UserDepot.user_id == users["DISPATCHER"]))
        db.commit()
    live = get(client, headers, "live")
    assert live["depot_ids"] == [] and live["published_plans"] == 0
    assert get(client, headers, "trips")["total"] == 0
    assert get(client, headers, "exceptions")["total"] == 0
    assert get(client, headers, "audit")["total"] == 0


@pytest.mark.parametrize(
    "path,params",
    [
        ("trips", {"limit": 0}),
        ("trips", {"limit": 101}),
        ("exceptions", {"kind": "OTHER"}),
        ("audit", {"occurred_from": "2026-10-05T00:00:00"}),
        ("live", {"delivery_date": "x"}),
        ("audit", {"offset": -1}),
    ],
)
def test_invalid_queries(client, headers, resources, path, params):
    get(client, headers, path, expect=422, **params)


def test_migration_roundtrip_drops_only_audit(client, engine, headers, delivered):
    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from test_identity_schema import migration_config

    from app.db.models import Base

    with engine.connect() as connection:
        command.downgrade(migration_config(connection), "0013_sync_events")
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
    assert audit_counts(engine) == {}
    assert get(client, headers, "live")["delivery"]["failed_stops"] == 1


def test_conflict_audit_is_bounded_and_scoped_to_the_actors_trip(
    client, engine, users, settings, auth, driving, delivered, published, resources
):
    from app.auth.models import Role, User, UserRole

    single = published["single"]
    stop = single["stops"][0]["id"]

    def outcome(auth_, item):
        return send(client, auth_, [item])["results"][0]["outcome"]

    # Own trip, not ready: recorded once per type and reason, whatever the event ID.
    start = event("TRIP_STARTED", single)
    assert outcome(driving, start) == "CONFLICT"
    assert outcome(driving, {**start, "event_id": str(uuid4())}) == "CONFLICT"
    assert outcome(driving, event("STOP_ARRIVED", single, stop)) == "CONFLICT"
    # Reusing a synced Loader event ID with a foreign stop: recorded against the trip only.
    loaded = event(
        "LOAD_RECORDED", single, order_id=single["stops"][0]["order_ids"][0], status="LOADED"
    )
    assert outcome(auth, loaded) == "APPLIED"
    reused = {**event("STOP_ARRIVED", single, str(uuid4())), "event_id": loaded["event_id"]}
    assert outcome(driving, reused) == "CONFLICT"
    with Session(engine) as db:
        rows = db.scalars(select(AuditEvent).where(AuditEvent.action == "SYNC_CONFLICT")).all()
        assert sorted(row.entity_type for row in rows) == ["STOP", "TRIP", "TRIP"]
        assert all(row.entity_id in (UUID(stop), UUID(single["id"])) for row in rows)
        assert all("device_id" not in row.details for row in rows)
        other = User(email="driver9@example.com", password_hash="x")
        role = db.scalar(select(Role).where(Role.code == "DRIVER"))
        other.role_assignments = [UserRole(role=role)]
        db.add(other)
        db.flush()
        db.add(UserDepot(user_id=other.id, depot_id=resources["depot"]))
        db.commit()
        other_auth = bearer(other.id, settings)
    # Another driver in the same depot cannot attach conflicts to this trip.
    for payload in ({}, {"occurred_at": "2026-10-05T06:00:00+05:30"}):
        attempt = {
            **event("STOP_ARRIVED", single, stop),
            "event_id": loaded["event_id"],
            "payload": payload,
        }
        assert outcome(other_auth, attempt) == "CONFLICT"
    assert audit_counts(engine)["SYNC_CONFLICT"] == 3


def test_later_loaded_event_clears_load_exception(client, headers, auth, delivered, published):
    single = published["single"]
    order = single["stops"][0]["order_ids"][0]
    send(
        client,
        auth,
        [event("LOAD_RECORDED", single, order_id=order, status="DAMAGED", note="Crushed")],
    )
    assert get(client, headers, "exceptions", kind="LOAD_DAMAGED")["total"] == 1
    send(client, auth, [event("LOAD_RECORDED", single, order_id=order, status="LOADED")])
    assert get(client, headers, "exceptions", kind="LOAD_DAMAGED")["total"] == 0
    assert get(client, headers, "live")["loading"]["damaged"] == 0
