"""Live plan compatibility eligibility, depot isolation, bounded payloads and no writes."""

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, select, update
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
from app.db.models import Base, Depot, Order, Outlet, Plan, Vehicle, VehicleAvailability
from app.orders.models import OrderStatus

DAY = date(2026, 10, 5)


def url(plan_id):
    return f"/api/v1/plans/{plan_id}/compatibility"


@pytest.fixture
def headers(users, settings):
    return bearer(users["DISPATCHER"], settings)


@pytest.fixture
def resources(engine, users):
    with Session(engine) as db:
        own, foreign, second = (
            Depot(name=value) for value in ("Own", "Private", "Second assigned")
        )
        outlet = make_outlet(own, brand="Own Mall")
        normal_outlet = make_outlet(own, brand="Own Store", parking_constraint="none")
        private_outlet, second_outlet = make_outlet(foreign), make_outlet(second)
        plans = [
            Plan(depot=depot, delivery_date=DAY, created_by=users["DISPATCHER"])
            for depot in (own, foreign, second)
        ]
        orders = [
            make_order(outlet, id=UUID(int=10), temperature_requirement="chilled"),
            make_order(normal_outlet, id=UUID(int=20), order_weight_kg=Decimal("1500")),
            make_order(outlet, id=UUID(int=30), order_weight_kg=Decimal("6000")),
            make_order(outlet, id=UUID(int=400), requested_delivery_date=DAY + timedelta(days=1)),
            make_order(private_outlet, id=UUID(int=500)),
            make_order(second_outlet, id=UUID(int=600)),
        ]
        orders.extend(
            make_order(outlet, status=status, id=UUID(int=200 + index))
            for index, status in enumerate(OrderStatus)
            if status != OrderStatus.CONFIRMED
        )
        vehicles = [
            make_vehicle(own, id=UUID(int=40), weekly_fuel_quota_l=Decimal("0")),
            make_vehicle(
                own,
                id=UUID(int=50),
                type="truck",
                temperature_type="ambient",
                weight_cap_kg=Decimal("5000"),
                volume_cap_m3=Decimal("30"),
            ),
            make_vehicle(own, id=UUID(int=60)),
            make_vehicle(own, id=UUID(int=70)),
            make_vehicle(second, id=UUID(int=80)),
            make_vehicle(foreign, id=UUID(int=90)),
        ]
        db.add_all([*plans, *orders, *vehicles])
        db.flush()
        db.add_all(
            [
                UserDepot(user_id=users["DISPATCHER"], depot=own),
                UserDepot(user_id=users["DISPATCHER"], depot=second),
                UserOutlet(user_id=users["DISPATCHER"], outlet=private_outlet),
                *[
                    VehicleAvailability(
                        vehicle_id=UUID(int=i), availability_date=DAY, is_available=value
                    )
                    for i, value in ((40, True), (50, True), (60, False), (80, True), (90, True))
                ],
                VehicleAvailability(
                    vehicle_id=UUID(int=70),
                    availability_date=DAY - timedelta(days=1),
                    is_available=True,
                ),
                VehicleAvailability(
                    vehicle_id=UUID(int=40),
                    availability_date=DAY + timedelta(days=1),
                    is_available=False,
                ),
            ]
        )
        db.commit()
        return {
            "plan": plans[0].id,
            "foreign_plan": plans[1].id,
            "second_plan": plans[2].id,
            "depot": own.id,
            "foreign_depot": foreign.id,
            "outlet": outlet.id,
        }


def test_preview_selects_confirmed_plan_day_orders_and_exact_day_availability(
    client,
    resources,
    headers,
):
    response = client.get(url(resources["plan"]), headers=headers)
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    body = response.json()
    assert set(body) == {
        "plan_id",
        "depot_id",
        "delivery_date",
        "is_complete_plan_validation",
        "items",
        "vehicles",
        "total",
        "limit",
        "offset",
    }
    assert body["plan_id"] == str(resources["plan"]) and body["depot_id"] == str(resources["depot"])
    assert body["delivery_date"] == DAY.isoformat()
    assert body["is_complete_plan_validation"] is False
    assert (body["total"], body["limit"], body["offset"]) == (3, 20, 0)
    assert [item["order"]["id"] for item in body["items"]] == [
        str(UUID(int=i)) for i in (10, 20, 30)
    ]
    assert [item["vehicle"]["id"] for item in body["vehicles"]] == [
        str(UUID(int=i)) for i in (40, 50, 60, 70)
    ]
    assert [item["is_available"] for item in body["vehicles"]] == [True, True, False, None]
    first, second, heavy = body["items"]
    assert first["candidate_vehicle_ids"] == [str(UUID(int=40))]
    # Fuel feasibility is explicitly pending, even for an otherwise matching vehicle.
    assert body["vehicles"][0]["vehicle"]["weekly_fuel_quota_l"] == "0.000"
    assert first["excluded_vehicles"] == [
        {"vehicle_id": str(UUID(int=50)), "reasons": ["TEMPERATURE_MISMATCH", "VAN_REQUIRED"]},
        {"vehicle_id": str(UUID(int=60)), "reasons": ["VEHICLE_UNAVAILABLE"]},
        {"vehicle_id": str(UUID(int=70)), "reasons": ["AVAILABILITY_UNKNOWN"]},
    ]
    assert second["candidate_vehicle_ids"] == [str(UUID(int=50))]
    assert heavy["candidate_vehicle_ids"] == []
    assert first["order"]["order_weight_kg"] == "123.125"
    assert first["order"]["outlet"]["depot_id"] == str(resources["depot"])
    assert body["vehicles"][0]["vehicle"]["weight_cap_kg"] == "1200.125"
    assert "Private" not in response.text and "Second assigned" not in response.text
    assert str(UUID(int=90)) not in response.text


def test_pagination_changes_only_order_page_not_vehicle_set(client, resources, headers):
    for offset, expected in ((0, [10]), (1, [20]), (2, [30]), (3, [])):
        body = client.get(
            url(resources["plan"]), headers=headers, params={"limit": 1, "offset": offset}
        ).json()
        assert (body["total"], body["limit"], body["offset"]) == (3, 1, offset)
        assert [item["order"]["id"] for item in body["items"]] == [
            str(UUID(int=i)) for i in expected
        ]
        assert len(body["vehicles"]) == 4


@pytest.mark.parametrize(
    "params", [{"limit": 0}, {"limit": 101}, {"offset": -1}, {"offset": "bad"}]
)
def test_invalid_pagination_is_rejected(client, resources, headers, params):
    assert client.get(url(resources["plan"]), headers=headers, params=params).status_code == 422


def test_missing_and_inactive_authentication_are_rejected(client, users, settings):
    for auth in ({}, bearer(users["inactive"], settings)):
        assert client.get(url(uuid4()), headers=auth).status_code == 401


@pytest.mark.parametrize("role", ["STORE_MANAGER", "DRIVER", "LOADER", "roleless"])
def test_depot_grants_do_not_bypass_dispatcher_role(
    client, engine, resources, users, settings, role
):
    with Session(engine) as db:
        db.add(UserDepot(user_id=users[role], depot_id=resources["depot"]))
        db.commit()
    assert (
        client.get(url(resources["plan"]), headers=bearer(users[role], settings)).status_code == 403
    )


def test_foreign_and_unknown_plans_are_hidden_even_with_outlet_grant(client, resources, headers):
    for identifier in (resources["foreign_plan"], uuid4()):
        response = client.get(url(identifier), headers=headers)
        assert response.status_code == 404 and response.json() == {"detail": "Plan not found"}
        assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("revocation,status", [("depot", 404), ("role", 403), ("active", 401)])
def test_revocation_takes_effect_for_existing_token(
    client, engine, resources, users, headers, revocation, status
):
    assert client.get(url(resources["plan"]), headers=headers).status_code == 200
    with Session(engine) as db:
        if revocation == "depot":
            db.execute(delete(UserDepot).where(UserDepot.user_id == users["DISPATCHER"]))
        elif revocation == "role":
            db.execute(delete(UserRole).where(UserRole.user_id == users["DISPATCHER"]))
        else:
            db.execute(update(User).where(User.id == users["DISPATCHER"]).values(is_active=False))
        db.commit()
    assert client.get(url(resources["plan"]), headers=headers).status_code == status


def test_live_changes_to_status_outlet_depot_vehicle_depot_and_availability_are_reflected(
    client,
    engine,
    resources,
    headers,
):
    with Session(engine) as db:
        db.execute(update(Order).where(Order.id == UUID(int=20)).values(status="PLANNED"))
        db.execute(
            update(Outlet)
            .where(Outlet.id == resources["outlet"])
            .values(depot_id=resources["foreign_depot"])
        )
        db.execute(
            update(Vehicle)
            .where(Vehicle.id == UUID(int=40))
            .values(depot_id=resources["foreign_depot"])
        )
        db.execute(
            update(VehicleAvailability)
            .where(
                VehicleAvailability.vehicle_id == UUID(int=50),
                VehicleAvailability.availability_date == DAY,
            )
            .values(is_available=False)
        )
        db.commit()
    body = client.get(url(resources["plan"]), headers=headers).json()
    assert body["total"] == 0 and body["items"] == []
    assert [item["vehicle"]["id"] for item in body["vehicles"]] == [
        str(UUID(int=i)) for i in (50, 60, 70)
    ]
    assert body["vehicles"][0]["is_available"] is False


def test_zero_fleet_returns_orders_without_candidates_or_invented_deferrals(
    client, engine, resources, headers
):
    with Session(engine) as db:
        db.execute(delete(VehicleAvailability))
        db.execute(delete(Vehicle))
        db.commit()
    body = client.get(url(resources["plan"]), headers=headers).json()
    assert body["vehicles"] == [] and body["total"] == 3
    assert all(
        item["candidate_vehicle_ids"] == item["excluded_vehicles"] == [] for item in body["items"]
    )
    assert body["is_complete_plan_validation"] is False


@pytest.mark.parametrize("count,status", [(500, 200), (501, 422)])
def test_vehicle_limit_never_silently_truncates_matrix(
    client, engine, resources, headers, count, status
):
    with Session(engine) as db:
        db.add_all([make_vehicle(None, depot_id=resources["depot"]) for _ in range(count - 4)])
        db.commit()
    response = client.get(url(resources["plan"]), headers=headers, params={"limit": 1})
    assert response.status_code == status
    if status == 200:
        body = response.json()
        assert len(body["vehicles"]) == 500
        result = body["items"][0]
        assert len(result["candidate_vehicle_ids"]) + len(result["excluded_vehicles"]) == 500
    else:
        assert response.json() == {
            "detail": "Compatibility preview supports at most 500 vehicles per depot"
        }


def snapshot(engine):
    with engine.connect() as connection:
        return {
            table.name: [
                tuple(row)
                for row in connection.execute(select(table).order_by(*table.primary_key.columns))
            ]
            for table in Base.metadata.sorted_tables
        }


@pytest.mark.parametrize("published", [False, True])
def test_preview_is_read_only_and_not_a_saved_revision_view(
    client, engine, resources, headers, published
):
    if published:
        with Session(engine) as db:
            db.execute(update(Plan).where(Plan.id == resources["plan"]).values(status="PUBLISHED"))
            db.commit()
    before = snapshot(engine)
    with patch.object(Session, "commit", side_effect=AssertionError("Preview must not commit")):
        response = client.get(url(resources["plan"]), headers=headers)
    assert response.status_code == 200 and response.json()["is_complete_plan_validation"] is False
    assert snapshot(engine) == before


def test_historical_plan_preview_uses_its_day_without_today_filter(
    client, engine, resources, headers
):
    past = date(2025, 10, 5)
    with Session(engine) as db:
        db.execute(update(Plan).where(Plan.id == resources["plan"]).values(delivery_date=past))
        db.execute(
            update(Order)
            .where(Order.requested_delivery_date == DAY)
            .values(requested_delivery_date=past)
        )
        db.execute(
            update(VehicleAvailability)
            .where(VehicleAvailability.availability_date == DAY)
            .values(availability_date=past)
        )
        db.commit()
    body = client.get(url(resources["plan"]), headers=headers).json()
    assert body["delivery_date"] == past.isoformat() and body["total"] == 3
    assert body["items"][0]["candidate_vehicle_ids"] == [str(UUID(int=40))]


def test_read_failure_is_sanitized(client, resources, headers):
    with patch(
        "app.planning.router.preview_compatibility",
        side_effect=OperationalError("private credentials", {}, Exception()),
    ):
        response = client.get(url(resources["plan"]), headers=headers)
    assert response.status_code == 503
    assert response.json() == {"detail": "Compatibility preview unavailable"}
    assert response.headers["cache-control"] == "no-store"


def test_openapi_declares_auth_and_preview_contract(client):
    schema = client.get("/openapi.json").json()
    route = schema["paths"]["/api/v1/plans/{plan_id}/compatibility"]["get"]
    assert route["security"] == [{"HTTPBearer": []}]
    assert route["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/PlanCompatibilityResponse"
    }
    properties = schema["components"]["schemas"]["PlanCompatibilityResponse"]["properties"]
    assert properties["is_complete_plan_validation"]["const"] is False
