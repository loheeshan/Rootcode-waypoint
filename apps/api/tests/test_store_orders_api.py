"""Store order contract, cutoff boundary, isolation, validation and rollback checks."""

from datetime import UTC, date, datetime
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, event, func, select
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
from test_order_schema import make_order

from app.auth.models import UserOutlet
from app.db.models import Depot, Order
from app.orders.models import OrderStatus
from app.orders.service import accepted_delivery_date, get_order_time

BASE = "/api/v1/store/orders"
NOW = datetime(2026, 10, 3, 10, 29, 59, tzinfo=UTC)  # 15:59:59 in Colombo.


@pytest.fixture(autouse=True)
def clock(app) -> None:
    app.dependency_overrides[get_order_time] = lambda: NOW


@pytest.fixture
def outlets(engine, users):
    with Session(engine) as db:
        depot = Depot(name="Order API Depot")
        owned, other = make_outlet(depot), make_outlet(depot)
        db.add_all([owned, other])
        db.flush()
        db.add(UserOutlet(user_id=users["STORE_MANAGER"], outlet=owned))
        db.commit()
        return owned.id, other.id


@pytest.fixture
def headers(users, settings):
    return bearer(users["STORE_MANAGER"], settings)


def payload(outlet_id, **changes):
    body = {"outlet_id": str(outlet_id), "requested_delivery_date": "2026-10-04",
            "temperature_requirement": "chilled", "order_weight_kg": "125.125",
            "order_volume_m3": "0.875"}
    body.update(changes)
    return body


def test_create_then_list_and_detail_persist_the_same_order(
    client, engine, outlets, headers,
) -> None:
    response = client.post(BASE, headers=headers, json=payload(outlets[0]))
    assert response.status_code == 201
    created = response.json()
    assert created["submitted_delivery_date"] == "2026-10-04"
    assert created["cutoff_applied"] is False
    order = created["order"]
    assert set(order) == {"id", "outlet_id", "requested_delivery_date", "temperature_requirement",
                          "order_weight_kg", "order_volume_m3", "status", "created_at"}
    assert order["status"] == "CONFIRMED"
    assert order["order_weight_kg"] == "125.125"
    assert order["order_volume_m3"] == "0.875"
    assert order["created_at"].endswith("Z")
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["location"] == f"{BASE}/{order['id']}"
    detail = client.get(response.headers["location"], headers=headers)
    assert detail.status_code == 200
    assert detail.json() == order
    assert detail.headers["cache-control"] == "no-store"
    listing = client.get(BASE, headers=headers)
    assert listing.json() == {"items": [order], "total": 1, "limit": 20, "offset": 0}
    assert listing.headers["cache-control"] == "no-store"
    with Session(engine) as db:
        assert db.get(Order, UUID(order["id"])).requested_delivery_date == date(2026, 10, 4)


@pytest.mark.parametrize("utc_now,requested,accepted,shifted", [
    ("2026-10-03T10:29:59+00:00", "2026-10-04", "2026-10-04", False),
    ("2026-10-03T10:30:00+00:00", "2026-10-04", "2026-10-05", True),
    ("2026-10-03T18:29:59+00:00", "2026-10-04", "2026-10-05", True),
    ("2026-10-03T18:30:00+00:00", "2026-10-05", "2026-10-05", False),
    ("2026-10-03T10:30:00+00:00", "2026-10-08", "2026-10-08", False),
    ("2026-12-31T10:30:00+00:00", "2027-01-01", "2027-01-02", True),
])
def test_cutoff_uses_colombo_time_and_persists_the_accepted_date(
    client, app, outlets, headers, utc_now, requested, accepted, shifted,
) -> None:
    app.dependency_overrides[get_order_time] = lambda: datetime.fromisoformat(utc_now)
    response = client.post(BASE, headers=headers, json=payload(
        outlets[0], requested_delivery_date=requested,
    ))
    assert response.status_code == 201
    body = response.json()
    assert body["submitted_delivery_date"] == requested
    assert body["cutoff_applied"] is shifted
    assert body["order"]["requested_delivery_date"] == accepted
    assert client.get(response.headers["location"], headers=headers).json()[
        "requested_delivery_date"
    ] == accepted


def test_submission_clock_cannot_use_server_local_naive_time() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        accepted_delivery_date(date(2026, 10, 4), datetime(2026, 10, 3, 12))


@pytest.mark.parametrize("changes", [
    {"requested_delivery_date": "2026-10-03"}, {"requested_delivery_date": "2026-10-02"},
    {"requested_delivery_date": "2026-02-30"}, {"requested_delivery_date": "20261004"},
    {"requested_delivery_date": 1791072000}, {"requested_delivery_date": "2026-10-04T00:00:00"},
    {"requested_delivery_date": "1791072000"},
    {"temperature_requirement": "reefer"}, {"temperature_requirement": "CHILLED"},
    {"order_weight_kg": "0"}, {"order_weight_kg": "-1"},
    {"order_weight_kg": "1000000000"}, {"order_weight_kg": "1.2345"},
    {"order_weight_kg": "NaN"}, {"order_volume_m3": "Infinity"},
    {"order_volume_m3": "-Infinity"}, {"order_volume_m3": "0.0001"},
    {"status": "DELIVERED"}, {"id": str(uuid4())}, {"created_at": "2026-10-03T00:00:00Z"},
    {"depot_id": str(uuid4())},
])
def test_invalid_or_server_owned_fields_never_create_orders(
    client, engine, outlets, headers, changes,
) -> None:
    response = client.post(BASE, headers=headers, json=payload(outlets[0], **changes))
    assert response.status_code == 422
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Order)) == 0


def test_numeric_json_inputs_return_exact_decimal_strings(client, outlets, headers) -> None:
    response = client.post(BASE, headers=headers, json=payload(
        outlets[0], order_weight_kg=1, order_volume_m3=0.001,
    ))
    assert response.status_code == 201
    assert response.json()["order"]["order_weight_kg"] == "1.000"
    assert response.json()["order"]["order_volume_m3"] == "0.001"


@pytest.mark.parametrize("method", ["create", "list", "detail"])
def test_every_route_requires_authentication(client, method) -> None:
    response = (client.post(BASE, json=payload(uuid4())) if method == "create"
                else client.get(BASE if method == "list" else f"{BASE}/{uuid4()}"))
    assert response.status_code == 401


@pytest.mark.parametrize("role", ["DISPATCHER", "DRIVER", "LOADER", "roleless"])
@pytest.mark.parametrize("method", ["create", "list", "detail"])
def test_non_store_roles_cannot_use_store_endpoints(
    client, users, settings, outlets, role, method,
) -> None:
    headers = bearer(users[role], settings)
    response = (client.post(BASE, headers=headers, json=payload(outlets[0])) if method == "create"
                else client.get(BASE if method == "list" else f"{BASE}/{uuid4()}", headers=headers))
    assert response.status_code == 403


def test_foreign_and_unknown_outlets_cannot_receive_orders(
    client, engine, outlets, headers,
) -> None:
    for outlet_id in (outlets[1], uuid4()):
        assert client.post(BASE, headers=headers, json=payload(outlet_id)).status_code == 403
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Order)) == 0


def test_list_count_and_detail_hide_other_outlets(client, engine, outlets, headers) -> None:
    with Session(engine) as db:
        own = make_order(outlet_id=outlets[0])
        foreign = make_order(outlet_id=outlets[1])
        db.add_all([own, foreign])
        db.commit()
        own_id, foreign_id = own.id, foreign.id
    listing = client.get(BASE, headers=headers).json()
    assert listing["total"] == 1
    assert [order["id"] for order in listing["items"]] == [str(own_id)]
    for order_id in (foreign_id, uuid4()):
        response = client.get(f"{BASE}/{order_id}", headers=headers)
        assert response.status_code == 404
        assert response.json() == {"detail": "Order not found"}
    filtered = client.get(BASE, headers=headers, params={"outlet_id": str(outlets[1])})
    assert filtered.status_code == 403


def test_filters_pagination_and_timestamp_ties_are_deterministic(client, engine, outlets, headers):
    with Session(engine) as db:
        orders = [make_order(outlet_id=outlets[0], created_at=NOW,
                             status=OrderStatus.CONFIRMED if index < 2 else OrderStatus.DELIVERED)
                  for index in range(3)]
        db.add_all(orders)
        db.add(make_order(outlet_id=outlets[1], status=OrderStatus.CONFIRMED))
        db.commit()
        expected = sorted((str(order.id) for order in orders[:2]), reverse=True)
    params = {"status": "CONFIRMED", "requested_delivery_date": "2026-10-05",
              "outlet_id": str(outlets[0]), "limit": 1, "offset": 0}
    first = client.get(BASE, headers=headers, params=params).json()
    params["offset"] = 1
    second = client.get(BASE, headers=headers, params=params).json()
    assert first["total"] == second["total"] == 2
    assert [first["items"][0]["id"], second["items"][0]["id"]] == expected
    params["offset"] = 2
    assert client.get(BASE, headers=headers, params=params).json()["items"] == []


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "offset=-1", "status=WRONG",
                                    "requested_delivery_date=invalid", "outlet_id=invalid"])
def test_bad_list_filters_are_rejected(client, headers, query) -> None:
    assert client.get(f"{BASE}?{query}", headers=headers).status_code == 422


def test_revoking_outlet_access_hides_existing_orders_and_blocks_new_ones(
    client, engine, users, outlets, headers,
) -> None:
    created = client.post(BASE, headers=headers, json=payload(outlets[0]))
    assert created.status_code == 201
    with Session(engine) as db:
        db.execute(delete(UserOutlet).where(UserOutlet.user_id == users["STORE_MANAGER"]))
        db.commit()
    assert client.get(BASE, headers=headers).json() == {
        "items": [], "total": 0, "limit": 20, "offset": 0,
    }
    assert client.get(created.headers["location"], headers=headers).status_code == 404
    assert client.post(BASE, headers=headers, json=payload(outlets[0])).status_code == 403


@pytest.mark.parametrize("error,status", [(IntegrityError, 409), (OperationalError, 503)])
def test_failed_insert_rolls_back_and_hides_database_details(
    client, engine, outlets, headers, error, status,
) -> None:
    def fail_insert(connection, cursor, statement, parameters, context, executemany):
        if statement.startswith("INSERT INTO orders"):
            raise error("private-database-url", {}, Exception("private-detail"))

    event.listen(engine, "before_cursor_execute", fail_insert)
    try:
        response = client.post(BASE, headers=headers, json=payload(outlets[0]))
    finally:
        event.remove(engine, "before_cursor_execute", fail_insert)
    assert response.status_code == status
    assert "private" not in response.text
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Order)) == 0


@pytest.mark.parametrize("method,target", [
    ("list", "list_store_orders"), ("detail", "get_store_order"),
])
def test_read_failures_return_generic_503(client, headers, method, target) -> None:
    error = OperationalError("private-url", {}, Exception())
    with patch(f"app.orders.router.{target}", side_effect=error):
        response = client.get(BASE if method == "list" else f"{BASE}/{uuid4()}", headers=headers)
    assert response.status_code == 503
    assert response.json() == {"detail": "Orders unavailable"}


def test_commit_failure_does_not_report_success_or_persist_an_order(
    client, engine, outlets, headers,
) -> None:
    def fail_commit(session):
        raise OperationalError("private-commit-detail", {}, Exception())

    event.listen(Session, "before_commit", fail_commit)
    try:
        response = client.post(BASE, headers=headers, json=payload(outlets[0]))
    finally:
        event.remove(Session, "before_commit", fail_commit)
    assert response.status_code == 503
    assert "private" not in response.text
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Order)) == 0


def test_openapi_exposes_store_routes_as_authenticated(client) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    for path, method in ((BASE, "post"), (BASE, "get"), (f"{BASE}/{{order_id}}", "get")):
        assert paths[path][method]["security"] == [{"HTTPBearer": []}]
