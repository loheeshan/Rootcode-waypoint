from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from test_auth_api import app as app
from test_auth_api import bearer
from test_auth_api import client as client
from test_auth_api import engine as engine
from test_auth_api import settings as settings
from test_auth_api import stored_password as stored_password
from test_auth_api import users as users
from test_delivery_api import DELIVERY_NOW, ev, path, pod, post, stops
from test_delivery_api import delivery_clock as delivery_clock
from test_delivery_api import driving as driving
from test_delivery_api import published as published
from test_delivery_api import ready as ready
from test_loading_api import auth as auth
from test_loading_api import loader as loader
from test_loading_api import loading_clock as loading_clock
from test_optimization_api import body as body
from test_optimization_api import clock as clock
from test_optimization_api import headers as headers
from test_optimization_api import resources as resources
from test_publication_api import driver as driver

from app.auth.models import UserOutlet
from app.db.models import Order, ReceiptConfirmation
from app.receipts.service import get_receipt_time

LATER_RECEIPT = DELIVERY_NOW.replace(hour=6)


@pytest.fixture(autouse=True)
def receipt_clock(app):
    app.dependency_overrides[get_receipt_time] = lambda: LATER_RECEIPT


@pytest.fixture
def delivered(client, engine, users, resources, driving, ready):
    """Deliver the outlet-A stop (with POD), fail the other stop, then complete the trip."""
    post(client, driving, path(ready, "start"), ev())
    outcome = {}
    for stop in ready["stops"]:
        stop_id = stop["id"]
        post(client, driving, path(ready, "arrive", stop_id), ev())
        if stop["outlet_id"] == str(resources["outlet"]):
            proof = pod()
            post(client, driving, path(ready, "pod", stop_id), proof)
            post(client, driving, path(ready, "deliver", stop_id), ev(pod_id=proof["pod_id"]))
            outcome["delivered"] = stop["order_ids"][0]
        else:
            post(
                client,
                driving,
                path(ready, "fail", stop_id),
                ev(reason_code="OUTLET_CLOSED", note="Closed"),
            )
            outcome["failed"] = stop["order_ids"][0]
            outcome["failed_outlet"] = stop["outlet_id"]
    post(client, driving, path(ready, "complete"), ev())
    with Session(engine) as db:
        for outlet in (resources["outlet"], UUID(outcome["failed_outlet"])):
            db.add(UserOutlet(user_id=users["STORE_MANAGER"], outlet_id=outlet))
        db.commit()
    assert len(stops(ready)) == 2
    return outcome


@pytest.fixture
def store(users, settings):
    return bearer(users["STORE_MANAGER"], settings)


def receipt_url(order_id):
    return f"/api/v1/store/orders/{order_id}/receipt"


def request():
    return {"request_id": str(uuid4())}


def snapshot(engine):
    with Session(engine) as db:
        return (
            db.scalar(select(func.count()).select_from(ReceiptConfirmation)),
            tuple(db.scalars(select(Order.status).order_by(Order.id))),
        )


def test_confirm_delivered_order_and_read_it_back(client, engine, users, store, delivered):
    order_id = delivered["delivered"]
    payload = request()
    response = client.post(receipt_url(order_id), headers=store, json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["order_status"] == "RECEIPT_CONFIRMED" and data["order_id"] == order_id
    assert data["request_id"] == payload["request_id"]
    assert data["confirmed_by"] == str(users["STORE_MANAGER"])
    assert response.headers["location"] == f"/api/v1/store/orders/{order_id}/receipt"
    assert response.headers["cache-control"] == "no-store"
    assert client.get(receipt_url(order_id), headers=store).json() == data
    detail = client.get(f"/api/v1/store/orders/{order_id}", headers=store).json()
    assert detail["status"] == "RECEIPT_CONFIRMED"
    listed = client.get(
        "/api/v1/store/orders", headers=store, params={"status": "RECEIPT_CONFIRMED"}
    ).json()
    assert [item["id"] for item in listed["items"]] == [order_id]
    with Session(engine) as db:
        receipt = db.get(ReceiptConfirmation, UUID(payload["request_id"]))
        assert str(receipt.delivery_event_id) == data["delivery_event_id"]


def test_replay_and_conflicting_reuse(client, engine, store, delivered):
    order_id = delivered["delivered"]
    payload = request()
    first = client.post(receipt_url(order_id), headers=store, json=payload)
    assert first.status_code == 201
    before = snapshot(engine)
    again = client.post(receipt_url(order_id), headers=store, json=payload)
    assert again.status_code == 200 and again.json() == first.json()
    response = client.post(receipt_url(order_id), headers=store, json=request())
    assert response.status_code == 409 and "already confirmed" in response.text
    response = client.post(receipt_url(delivered["failed"]), headers=store, json=payload)
    assert response.status_code == 409 and "another receipt" in response.text
    assert snapshot(engine) == before


@pytest.mark.parametrize("order", ["failed", "planned", "deferred"])
def test_undelivered_orders_cannot_be_confirmed(client, engine, store, delivered, order):
    order_id = {
        "failed": delivered["failed"],
        "planned": str(UUID(int=2)),
        "deferred": str(UUID(int=3)),
    }[order]
    before = snapshot(engine)
    response = client.post(receipt_url(order_id), headers=store, json=request())
    assert response.status_code == 409 and "Only delivered" in response.text
    assert client.get(receipt_url(order_id), headers=store).status_code == 404
    assert snapshot(engine) == before


def test_delivered_status_without_delivery_record_is_rejected(client, engine, store, delivered):
    with Session(engine) as db:
        db.execute(update(Order).where(Order.id == UUID(int=2)).values(status="DELIVERED"))
        db.commit()
    response = client.post(receipt_url(UUID(int=2)), headers=store, json=request())
    assert response.status_code == 409 and "No delivery record" in response.text


@pytest.mark.parametrize(
    "role,status",
    [
        (None, 401),
        ("inactive", 401),
        ("DRIVER", 403),
        ("DISPATCHER", 403),
        ("LOADER", 403),
        ("roleless", 403),
    ],
)
def test_role_guards(client, users, settings, delivered, role, status):
    auth_ = {} if role is None else bearer(users[role], settings)
    order_id = delivered["delivered"]
    assert client.post(receipt_url(order_id), headers=auth_, json=request()).status_code == status
    assert client.get(receipt_url(order_id), headers=auth_).status_code == status


def test_revoked_cross_outlet_and_unknown_orders_are_hidden(
    client, engine, users, resources, store, delivered
):
    order_id = delivered["delivered"]
    with Session(engine) as db:
        db.execute(
            delete(UserOutlet).where(
                UserOutlet.user_id == users["STORE_MANAGER"],
                UserOutlet.outlet_id == resources["outlet"],
            )
        )
        db.commit()
    before = snapshot(engine)
    for target in (order_id, str(uuid4())):
        response = client.post(receipt_url(target), headers=store, json=request())
        assert response.status_code == 404 and "Order not found" in response.text
        assert client.get(receipt_url(target), headers=store).status_code == 404
    assert snapshot(engine) == before


@pytest.mark.parametrize("body_", [{}, {"request_id": "x"}, {"request_id": str(uuid4()), "x": 1}])
def test_invalid_bodies(client, store, delivered, body_):
    response = client.post(receipt_url(delivered["delivered"]), headers=store, json=body_)
    assert response.status_code == 422


@pytest.mark.parametrize("target", ["flush", "commit"])
def test_failures_roll_back_receipt(client, engine, store, delivered, target):
    before = snapshot(engine)
    with patch(
        f"sqlalchemy.orm.Session.{target}", side_effect=OperationalError("secret", {}, Exception())
    ):
        response = client.post(receipt_url(delivered["delivered"]), headers=store, json=request())
    assert response.status_code == 503 and "secret" not in response.text
    assert snapshot(engine) == before


def test_openapi_lists_authenticated_receipt_contracts(client):
    schema = client.get("/openapi.json").json()
    for method in ("post", "get"):
        operation = schema["paths"]["/api/v1/store/orders/{order_id}/receipt"][method]
        assert operation["security"] == [{"HTTPBearer": []}]


@pytest.mark.parametrize("same_key", [True, False])
def test_postgres_concurrent_confirmations_create_one_receipt(engine, users, delivered, same_key):
    if engine.dialect.name != "postgresql":
        pytest.skip("Requires real PostgreSQL row locks")
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from fastapi import HTTPException

    from app.auth.models import User
    from app.receipts.schemas import ReceiptRequest
    from app.receipts.service import confirm_receipt

    first = uuid4()
    barrier = Barrier(2)

    def run(identifier):
        with Session(engine) as db:
            user = db.get(User, users["STORE_MANAGER"])
            barrier.wait(timeout=10)
            try:
                _, created = confirm_receipt(
                    db,
                    user,
                    UUID(delivered["delivered"]),
                    ReceiptRequest(request_id=identifier),
                    LATER_RECEIPT,
                )
                return 201 if created else 200
            except HTTPException as error:
                db.rollback()
                return error.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, [first, first if same_key else uuid4()]))
    assert sorted(results) == ([200, 201] if same_key else [201, 409])
    assert snapshot(engine)[0] == 1


def test_migration_roundtrip_keeps_order_statuses(client, engine, store, delivered):
    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from test_identity_schema import migration_config

    from app.db.models import Base

    client.post(receipt_url(delivered["delivered"]), headers=store, json=request())
    with engine.connect() as connection:
        command.downgrade(migration_config(connection), "0011_delivery_events")
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
    receipts, statuses = snapshot(engine)
    assert receipts == 0 and "RECEIPT_CONFIRMED" in statuses


def test_replay_after_outlet_revocation_is_hidden(
    client, engine, users, resources, store, delivered
):
    payload = request()
    order_id = delivered["delivered"]
    assert client.post(receipt_url(order_id), headers=store, json=payload).status_code == 201
    with Session(engine) as db:
        db.execute(delete(UserOutlet).where(UserOutlet.user_id == users["STORE_MANAGER"]))
        db.commit()
    assert client.post(receipt_url(order_id), headers=store, json=payload).status_code == 404
