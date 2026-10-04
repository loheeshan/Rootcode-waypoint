"""Dispatcher reads use current depot grants, including all counts and metadata."""

from datetime import UTC, datetime, time
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, event, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from test_auth_api import app as app
from test_auth_api import bearer
from test_auth_api import client as client
from test_auth_api import engine as engine
from test_auth_api import settings as settings
from test_auth_api import stored_password as stored_password
from test_auth_api import users as users
from test_fleet_schema import make_outlet, make_vehicle
from test_order_schema import make_order

from app.auth.models import User, UserDepot, UserOutlet, UserRole
from app.db.models import Depot, Outlet
from app.orders.service import get_order_time

ORDERS = "/api/v1/dispatcher/orders"
FLEET = "/api/v1/fleet"
NOW = datetime(2026, 10, 3, 10, tzinfo=UTC)


@pytest.fixture
def resources(engine, users):
    with Session(engine) as db:
        own = Depot(name="Assigned Depot")
        foreign = Depot(name="Private Depot")
        empty = Depot(name="Empty Depot")
        outlet = make_outlet(own, brand="Assigned Mall", mall_window=True,
                             window_open_time=time(22), window_close_time=time(2))
        other_outlet = make_outlet(foreign, brand="Private Store")
        second_outlet = make_outlet(own, brand="Second Store")
        orders = [make_order(outlet, id=UUID(int=10), created_at=NOW),
                  make_order(second_outlet, id=UUID(int=20), created_at=NOW, status="DELIVERED"),
                  make_order(other_outlet, id=UUID(int=30), created_at=NOW)]
        vehicles = [make_vehicle(own, id=UUID(int=40), weekly_fuel_quota_l=Decimal("0")),
                    make_vehicle(own, id=UUID(int=50), type="truck", temperature_type="ambient"),
                    make_vehicle(foreign, id=UUID(int=60))]
        db.add_all([empty, *orders, *vehicles])
        db.flush()
        db.add_all([UserDepot(user_id=users["DISPATCHER"], depot=own),
                    UserDepot(user_id=users["DISPATCHER"], depot=empty),
                    UserOutlet(user_id=users["DISPATCHER"], outlet=other_outlet),
                    UserOutlet(user_id=users["STORE_MANAGER"], outlet=outlet)])
        db.commit()
        return {"depot": own.id, "foreign_depot": foreign.id, "empty_depot": empty.id,
                "outlet": outlet.id, "foreign_outlet": other_outlet.id,
                "second_outlet": second_outlet.id}


@pytest.fixture
def headers(users, settings):
    return bearer(users["DISPATCHER"], settings)


def test_order_queue_scopes_totals_and_nested_data(client, resources, headers) -> None:
    response = client.get(ORDERS, headers=headers)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert set(body) == {"items", "total", "limit", "offset"}
    assert (body["total"], body["limit"], body["offset"]) == (2, 20, 0)
    assert [order["id"] for order in body["items"]] == [str(UUID(int=20)), str(UUID(int=10))]
    order = body["items"][1]
    assert set(order) == {"id", "outlet_id", "requested_delivery_date", "temperature_requirement",
                          "order_weight_kg", "order_volume_m3", "status", "created_at",
                          "outlet", "depot"}
    assert order["order_weight_kg"] == "123.125"
    assert order["order_volume_m3"] == "0.875"
    assert order["created_at"] == "2026-10-03T10:00:00Z"
    assert order["outlet"] == {
        "id": str(resources["outlet"]), "brand": "Assigned Mall", "district": "Colombo",
        "depot_id": str(resources["depot"]), "dock_type": "ground",
        "parking_constraint": "van_only", "window_open_time": "22:00:00",
        "window_close_time": "02:00:00", "mall_window": True,
    }
    assert order["outlet_id"] == order["outlet"]["id"]
    assert order["depot"] == {"id": str(resources["depot"]), "name": "Assigned Depot"}
    assert "Private" not in response.text
    assert str(resources["foreign_outlet"]) not in response.text


def test_fleet_returns_exact_quantities_and_only_assigned_depot_choices(
    client, resources, headers,
) -> None:
    response = client.get(FLEET, headers=headers)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert set(body) == {"items", "total", "limit", "offset", "depots"}
    assert (body["total"], body["limit"], body["offset"]) == (2, 20, 0)
    assert [vehicle["id"] for vehicle in body["items"]] == [str(UUID(int=40)), str(UUID(int=50))]
    assert body["items"][0] == {
        "id": str(UUID(int=40)), "type": "van", "temperature_type": "reefer",
        "weight_cap_kg": "1200.125", "volume_cap_m3": "8.500", "km_per_l": "7.125",
        "weekly_fuel_quota_l": "0.000", "depot_id": str(resources["depot"]),
    }
    assert body["depots"] == [
        {"id": str(resources["depot"]), "name": "Assigned Depot"},
        {"id": str(resources["empty_depot"]), "name": "Empty Depot"},
    ]
    assert "Private" not in response.text


def test_order_filters_combine_and_use_accepted_delivery_date(client, resources, headers) -> None:
    params = {"depot_id": str(resources["depot"]), "outlet_id": str(resources["outlet"]),
              "status": "CONFIRMED", "requested_delivery_date": "2026-10-05"}
    body = client.get(ORDERS, headers=headers, params=params).json()
    assert body["total"] == 1
    assert [order["id"] for order in body["items"]] == [str(UUID(int=10))]
    for key, value in [("status", "DEFERRED"), ("requested_delivery_date", "2026-10-06"),
                       ("depot_id", str(resources["empty_depot"]))]:
        body = client.get(ORDERS, headers=headers, params={**params, key: value}).json()
        assert body["items"] == []
        assert body["total"] == 0


@pytest.mark.parametrize("params,expected", [
    ({"type": "van"}, [40]), ({"temperature_type": "ambient"}, [50]),
    ({"type": "truck", "temperature_type": "reefer"}, []),
])
def test_vehicle_filters_do_not_remove_depot_choices(client, resources, headers, params, expected):
    response = client.get(FLEET, headers=headers, params=params)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == len(expected)
    assert [item["id"] for item in body["items"]] == [str(UUID(int=n)) for n in expected]
    assert len(body["depots"]) == 2


def test_empty_assigned_depot_is_selectable(client, resources, headers) -> None:
    response = client.get(FLEET, headers=headers, params={
        "depot_id": str(resources["empty_depot"]),
    })
    assert response.json() == {
        "items": [], "total": 0, "limit": 20, "offset": 0,
        "depots": [{"id": str(resources["empty_depot"]), "name": "Empty Depot"}],
    }


@pytest.mark.parametrize("path,expected", [(ORDERS, [20, 10]), (FLEET, [40, 50])])
def test_pagination_has_stable_order_and_scoped_total(client, resources, headers, path, expected):
    for offset in range(3):
        response = client.get(path, headers=headers, params={"limit": 1, "offset": offset})
        assert response.status_code == 200
        body = response.json()
        assert (body["total"], body["limit"], body["offset"]) == (2, 1, offset)
        assert [item["id"] for item in body["items"]] == [
            str(UUID(int=n)) for n in expected[offset:offset + 1]
        ]
        if path == FLEET:
            assert len(body["depots"]) == 2


@pytest.mark.parametrize("path", [ORDERS, FLEET])
def test_missing_or_inactive_authentication_is_rejected(client, users, settings, path):
    for request_headers in ({}, bearer(users["inactive"], settings)):
        response = client.get(path, headers=request_headers)
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("path", [ORDERS, FLEET])
@pytest.mark.parametrize("role", ["STORE_MANAGER", "DRIVER", "LOADER", "roleless"])
def test_depot_grants_do_not_bypass_dispatcher_role(
    client, engine, resources, users, settings, path, role,
) -> None:
    with Session(engine) as db:
        db.add(UserDepot(user_id=users[role], depot_id=resources["depot"]))
        db.commit()
    assert client.get(path, headers=bearer(users[role], settings)).status_code == 403


@pytest.mark.parametrize("path", [ORDERS, FLEET])
def test_foreign_and_unknown_explicit_depot_filters_are_forbidden(client, resources, headers, path):
    for depot_id in (resources["foreign_depot"], uuid4()):
        response = client.get(path, headers=headers, params={"depot_id": str(depot_id)})
        assert response.status_code == 403
        assert response.json() == {"detail": "Insufficient permissions"}
        assert response.headers["cache-control"] == "no-store"


def test_foreign_and_unknown_outlets_are_forbidden_even_with_store_grant(
    client, resources, headers,
) -> None:
    for outlet_id in (resources["foreign_outlet"], uuid4()):
        response = client.get(ORDERS, headers=headers, params={"outlet_id": str(outlet_id)})
        assert response.status_code == 403
        assert response.json() == {"detail": "Insufficient permissions"}


def test_revoking_depot_access_hides_every_collection_and_metadata(
    client, engine, users, resources, headers,
) -> None:
    assert client.get(FLEET, headers=headers).json()["total"] == 2
    with Session(engine) as db:
        db.execute(delete(UserDepot).where(UserDepot.user_id == users["DISPATCHER"]))
        db.commit()
    for path in (ORDERS, FLEET):
        response = client.get(path, headers=headers)
        expected = {"items": [], "total": 0, "limit": 20, "offset": 0}
        if path == FLEET:
            expected["depots"] = []
        assert response.status_code == 200
        assert response.json() == expected
        assert client.get(path, headers=headers, params={
            "depot_id": str(resources["depot"]),
        }).status_code == 403
    assert client.get(ORDERS, headers=headers, params={
        "outlet_id": str(resources["outlet"]),
    }).status_code == 403


def test_granting_another_depot_expands_both_collections(client, engine, users, resources, headers):
    with Session(engine) as db:
        db.add(UserDepot(user_id=users["DISPATCHER"], depot_id=resources["foreign_depot"]))
        db.commit()
    for path in (ORDERS, FLEET):
        assert client.get(path, headers=headers).json()["total"] == 3
        response = client.get(path, headers=headers, params={
            "depot_id": str(resources["foreign_depot"]),
        })
        assert response.status_code == 200
        assert response.json()["total"] == 1


@pytest.mark.parametrize("change,status", [("role", 403), ("active", 401)])
def test_existing_token_cannot_keep_revoked_account_access(
    client, engine, users, resources, headers, change, status,
) -> None:
    with Session(engine) as db:
        if change == "role":
            db.execute(delete(UserRole).where(UserRole.user_id == users["DISPATCHER"]))
        else:
            db.execute(update(User).where(User.id == users["DISPATCHER"]).values(is_active=False))
        db.commit()
    for path in (ORDERS, FLEET):
        assert client.get(path, headers=headers).status_code == status


def test_order_access_follows_outlets_current_depot(client, engine, resources, headers) -> None:
    with Session(engine) as db:
        db.execute(update(Outlet).where(Outlet.id == resources["outlet"])
                   .values(depot_id=resources["foreign_depot"]))
        db.commit()
    body = client.get(ORDERS, headers=headers).json()
    assert body["total"] == 1
    assert [order["id"] for order in body["items"]] == [str(UUID(int=20))]


@pytest.mark.parametrize("path,query", [
    (ORDERS, "limit=0"), (ORDERS, "limit=101"), (ORDERS, "offset=-1"),
    (ORDERS, "status=WRONG"), (ORDERS, "requested_delivery_date=invalid"),
    (ORDERS, "depot_id=invalid"), (ORDERS, "outlet_id=invalid"),
    (FLEET, "limit=0"), (FLEET, "limit=101"), (FLEET, "offset=-1"),
    (FLEET, "type=car"), (FLEET, "temperature_type=chilled"), (FLEET, "depot_id=invalid"),
])
def test_invalid_query_parameters_are_rejected(client, headers, path, query) -> None:
    assert client.get(f"{path}?{query}", headers=headers).status_code == 422


@pytest.mark.parametrize("path,table,message", [
    (ORDERS, "orders", "Orders unavailable"), (FLEET, "vehicles", "Fleet unavailable"),
    (FLEET, "depots", "Fleet unavailable"),
])
def test_database_read_failure_is_sanitized(
    client, engine, resources, headers, path, table, message,
) -> None:
    def fail_read(connection, cursor, statement, parameters, context, executemany):
        if f"FROM {table}" in statement:
            raise OperationalError("private-database-url", {}, Exception("private-detail"))

    event.listen(engine, "before_cursor_execute", fail_read)
    try:
        response = client.get(path, headers=headers)
    finally:
        event.remove(engine, "before_cursor_execute", fail_read)
    assert response.status_code == 503
    assert response.json() == {"detail": message}
    assert response.headers["cache-control"] == "no-store"


def test_store_submission_flows_into_dispatcher_queue_with_accepted_date(
    client, app, resources, users, settings, headers,
) -> None:
    # At cutoff tomorrow's request becomes October 5, the planning date.
    app.dependency_overrides[get_order_time] = lambda: NOW.replace(minute=30)
    created = client.post("/api/v1/store/orders", headers=bearer(users["STORE_MANAGER"], settings),
                          json={"outlet_id": str(resources["outlet"]),
                                "requested_delivery_date": "2026-10-04",
                                "temperature_requirement": "chilled",
                                "order_weight_kg": "10.125", "order_volume_m3": "0.001"})
    assert created.status_code == 201
    assert created.json()["cutoff_applied"] is True
    order = created.json()["order"]
    response = client.get(ORDERS, headers=headers, params={
        "requested_delivery_date": "2026-10-05", "status": "CONFIRMED",
    })
    queued = next(item for item in response.json()["items"] if item["id"] == order["id"])
    assert {key: queued[key] for key in order} == order
    assert queued["depot"]["id"] == str(resources["depot"])
    assert client.get(ORDERS, headers=headers, params={
        "requested_delivery_date": "2026-10-04",
    }).json()["items"] == []


def test_new_routes_are_read_only_and_advertise_bearer_security(client, headers) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    for path in (ORDERS, FLEET):
        assert set(paths[path]) == {"get"}
        assert paths[path]["get"]["security"] == [{"HTTPBearer": []}]
        assert client.post(path, headers=headers, json={}).status_code == 405
