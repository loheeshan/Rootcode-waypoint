from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
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
from test_fleet_schema import make_outlet, make_vehicle
from test_order_schema import make_order

from app.auth.models import UserDepot
from app.db.models import (
    Depot,
    Order,
    Plan,
    PlanAssignment,
    PlanOptimization,
    PlanRevision,
    Trip,
    VehicleAvailability,
    VehicleFuelUsage,
)
from app.planning.routing import RouteSearchUnavailable
from app.planning.service import get_planning_time
from app.planning.validation import PlanningValidationError

DAY = date(2026, 10, 5)
NOW = datetime(2026, 10, 4, 10, tzinfo=UTC)


@pytest.fixture(autouse=True)
def clock(app):
    app.dependency_overrides[get_planning_time] = lambda: NOW


@pytest.fixture
def resources(engine, users):
    with Session(engine) as db:
        depot, foreign = Depot(name="Own"), Depot(name="Foreign")
        outlet = make_outlet(depot)
        vehicle = make_vehicle(depot, weight_cap_kg=Decimal("10"), volume_cap_m3=Decimal("1"))
        own_plan = Plan(depot=depot, delivery_date=DAY, created_by=users["DISPATCHER"])
        own_plan.revisions = [PlanRevision(revision_number=1)]
        private_plan = Plan(depot=foreign, delivery_date=DAY, created_by=users["DISPATCHER"])
        orders = [
            make_order(
                outlet,
                id=UUID(int=i),
                order_weight_kg=Decimal(weight),
                order_volume_m3=Decimal("0.5"),
            )
            for i, weight in [(1, "6"), (2, "6"), (3, "50")]
        ]
        db.add_all([own_plan, private_plan, vehicle, *orders])
        db.flush()
        db.add_all(
            [
                UserDepot(user_id=users["DISPATCHER"], depot=depot),
                VehicleAvailability(
                    vehicle_id=vehicle.id, availability_date=DAY, is_available=True
                ),
            ]
        )
        db.commit()
        return {
            "plan": own_plan.id,
            "foreign": private_plan.id,
            "depot": depot.id,
            "outlet": outlet.id,
            "vehicle": vehicle.id,
        }


@pytest.fixture
def headers(users, settings):
    return bearer(users["DISPATCHER"], settings)


@pytest.fixture
def body(resources):
    return {
        "request_id": str(uuid4()),
        "source": "Synthetic HTTP test",
        "is_synthetic": True,
        "services": [{"outlet_id": str(resources["outlet"]), "service_seconds": 600}],
        "shifts": [
            {
                "vehicle_id": str(resources["vehicle"]),
                "earliest_departure": "2026-10-05T07:30:00+05:30",
                "latest_return": "2026-10-05T18:00:00+05:30",
                "turnaround_seconds": 900,
            }
        ],
        "legs": [
            {"from_outlet_id": a, "to_outlet_id": b, "distance_km": "5.000", "travel_seconds": 900}
            for a, b in [(None, str(resources["outlet"])), (str(resources["outlet"]), None)]
        ],
    }


def url(resources):
    return f"/api/v1/plans/{resources['plan']}/optimize"


def counts(engine):
    with Session(engine) as db:
        return tuple(
            db.scalar(select(func.count()).select_from(model))
            for model in (PlanRevision, Trip, PlanAssignment, PlanOptimization)
        )


def test_optimize_saves_complete_atomic_draft_and_scoped_result(
    client, engine, resources, headers, body
):
    response = client.post(url(resources), headers=headers, json=body)
    assert response.status_code == 201, response.text
    result = response.json()
    assert result["revision_number"] == 2 and result["eligible_order_count"] == 3
    assert result["validation"] == "VALIDATED_SNAPSHOT" and result["publishable"] is False
    assert result["is_synthetic"] and len(result["trips"]) == 2
    assert result["deferrals"][0]["order_id"] == str(UUID(int=3))
    assert result["deferrals"][0]["reason_code"] == "NO_COMPATIBLE_VEHICLE"
    assert response.headers["cache-control"] == "no-store"
    assert client.get(response.headers["location"], headers=headers).json() == result
    assert counts(engine) == (2, 2, 3, 1)
    with Session(engine) as db:
        assert set(db.scalars(select(Order.status))) == {"CONFIRMED"}
        saved = db.get(PlanOptimization, UUID(body["request_id"]))
        assert saved.input_snapshot["routes"]["vehicles"][0]["fuel_used_l"] == "0"
    detail = client.get(f"/api/v1/plans/{resources['plan']}", headers=headers).json()
    assert detail["revisions"][-1]["unexplained_deferred_count"] == 0


def test_same_key_replays_saved_snapshot_even_after_live_inputs_change(
    client, engine, resources, headers, body
):
    response = client.post(url(resources), headers=headers, json=body)
    assert response.status_code == 201, response.text
    with Session(engine) as db:
        db.execute(update(Order).values(status="PLANNED"))
        db.execute(update(VehicleAvailability).values(is_available=False))
        db.commit()
    again = client.post(url(resources), headers=headers, json=body)
    assert again.status_code == 200 and again.json() == response.json()
    assert counts(engine) == (2, 2, 3, 1)
    changed = {**body, "source": "different"}
    assert client.post(url(resources), headers=headers, json=changed).status_code == 409


def test_new_key_appends_revision_preserving_previous_results(
    client, engine, resources, headers, body
):
    first = client.post(url(resources), headers=headers, json=body)
    second = client.post(url(resources), headers=headers, json={**body, "request_id": str(uuid4())})
    assert first.status_code == second.status_code == 201
    assert second.json()["revision_number"] == 3
    assert client.get(first.headers["location"], headers=headers).json() == first.json()
    assert counts(engine) == (3, 4, 6, 2)


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
def test_role_guards(client, resources, users, settings, body, role, status):
    auth = {} if role is None else bearer(users[role], settings)
    assert client.post(url(resources), headers=auth, json=body).status_code == status
    assert (
        client.get(
            f"/api/v1/plans/{resources['plan']}/revisions/{uuid4()}/results", headers=auth
        ).status_code
        == status
    )


def test_foreign_ids_and_revoked_depot_are_hidden(client, engine, resources, users, headers, body):
    response = client.post(url(resources), headers=headers, json=body)
    for identifier in (resources["foreign"], uuid4()):
        assert (
            client.post(
                f"/api/v1/plans/{identifier}/optimize", headers=headers, json=body
            ).status_code
            == 404
        )
        assert (
            client.get(
                f"/api/v1/plans/{identifier}/revisions/{response.json()['revision_id']}/results",
                headers=headers,
            ).status_code
            == 404
        )
    with Session(engine) as db:
        db.execute(delete(UserDepot).where(UserDepot.user_id == users["DISPATCHER"]))
        db.commit()
    assert client.post(url(resources), headers=headers, json=body).status_code == 404
    assert client.get(response.headers["location"], headers=headers).status_code == 404


@pytest.mark.parametrize(
    "change",
    [
        lambda body: body.update(orders=[]),
        lambda body: body["shifts"][0].update(weekly_fuel_quota_l="999"),
        lambda body: body["shifts"][0].update(available_dates=["2026-10-05"]),
        lambda body: body["services"].clear(),
        lambda body: body["legs"].pop(),
        lambda body: body["shifts"][0].update(vehicle_id=str(uuid4())),
        lambda body: body["services"][0].update(outlet_id=str(uuid4())),
        lambda body: body["shifts"][0].update(earliest_departure="2026-10-06T08:00:00+05:30"),
    ],
)
def test_input_spoofing_and_incomplete_inputs_save_nothing(
    client, engine, resources, headers, body, change
):
    before = counts(engine)
    change(body)
    assert client.post(url(resources), headers=headers, json=body).status_code == 422
    assert counts(engine) == before


def test_unknown_availability_requires_data_instead_of_deferral(
    client, engine, resources, headers, body
):
    with Session(engine) as db:
        db.execute(delete(VehicleAvailability))
        db.commit()
    response = client.post(url(resources), headers=headers, json=body)
    assert response.status_code == 422 and "availability" in response.text
    assert counts(engine) == (1, 0, 0, 0)


def test_current_week_fuel_requires_daily_rows_and_changes_result(
    client, app, engine, resources, headers, body
):
    app.dependency_overrides[get_planning_time] = lambda: datetime(2026, 10, 5, 0, tzinfo=UTC)
    response = client.post(url(resources), headers=headers, json=body)
    assert response.status_code == 422 and "daily fuel" in response.text
    with Session(engine) as db:
        db.add(
            VehicleFuelUsage(
                vehicle_id=resources["vehicle"], usage_date=DAY, fuel_used_l=Decimal("100.000")
            )
        )
        db.commit()
    response = client.post(url(resources), headers=headers, json=body)
    assert response.status_code == 201, response.text
    assert response.json()["trips"] == []
    reasons = {item["reason_code"] for item in response.json()["deferrals"]}
    assert reasons == {"FUEL_QUOTA", "NO_COMPATIBLE_VEHICLE"}


@pytest.mark.parametrize("failure", ["validation", "solver", "flush", "commit"])
def test_failures_roll_back_every_row_and_hide_internal_details(
    client, engine, resources, headers, body, failure
):
    before = counts(engine)
    targets = {
        "validation": (
            "app.planning.optimization_service.validate_draft",
            PlanningValidationError("secret"),
        ),
        "solver": (
            "app.planning.optimization_service.optimize_draft",
            RouteSearchUnavailable("secret"),
        ),
        "flush": ("sqlalchemy.orm.Session.flush", OperationalError("secret", {}, Exception())),
        "commit": ("sqlalchemy.orm.Session.commit", OperationalError("secret", {}, Exception())),
    }
    target, exception = targets[failure]
    with patch(target, side_effect=exception):
        response = client.post(url(resources), headers=headers, json=body)
    assert response.status_code == 503 and "secret" not in response.text
    if failure != "flush":
        assert response.json() == {
            "detail": "Optimization unavailable; retry with the same request ID"
        }
    assert counts(engine) == before


def test_published_plan_and_published_vehicle_work_are_rejected(
    client, engine, resources, headers, body
):
    with Session(engine) as db:
        db.execute(update(Plan).where(Plan.id == resources["plan"]).values(status="PUBLISHED"))
        db.commit()
    assert client.post(url(resources), headers=headers, json=body).status_code == 409
    with Session(engine) as db:
        db.execute(update(Plan).where(Plan.id == resources["plan"]).values(status="DRAFT"))
        revision = PlanRevision(
            plan_id=resources["plan"], revision_number=2, status="PUBLISHED", published_at=NOW
        )
        db.add(revision)
        db.flush()
        db.add(Trip(plan_revision_id=revision.id, vehicle_id=resources["vehicle"], trip_number=1))
        db.commit()
    assert client.post(url(resources), headers=headers, json=body).status_code == 409


def test_empty_eligible_orders_save_empty_validated_revision(
    client, engine, resources, headers, body
):
    with Session(engine) as db:
        db.execute(update(Order).values(requested_delivery_date=DAY + timedelta(days=1)))
        db.commit()
    body.update(services=[], shifts=[], legs=[])
    response = client.post(url(resources), headers=headers, json=body)
    assert response.status_code == 201, response.text
    assert response.json()["trips"] == response.json()["deferrals"] == []


def test_openapi_lists_authenticated_optimization_and_result_contracts(client):
    schema = client.get("/openapi.json").json()
    for path, method in [
        ("/api/v1/plans/{plan_id}/optimize", "post"),
        ("/api/v1/plans/{plan_id}/revisions/{revision_id}/results", "get"),
    ]:
        assert schema["paths"][path][method]["security"] == [{"HTTPBearer": []}]
    responses = schema["paths"]["/api/v1/plans/{plan_id}/optimize"]["post"]["responses"]
    for status in ("200", "201"):
        assert responses[status]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/OptimizationResponse"
        }


def test_request_key_collision_on_another_accessible_plan_rolls_back(
    client, engine, resources, users, headers, body
):
    first = client.post(url(resources), headers=headers, json=body)
    assert first.status_code == 201
    with Session(engine) as db:
        foreign = db.get(Plan, resources["foreign"])
        db.add(UserDepot(user_id=users["DISPATCHER"], depot_id=foreign.depot_id))
        db.commit()
    before = counts(engine)
    response = client.post(
        f"/api/v1/plans/{resources['foreign']}/optimize",
        headers=headers,
        json={**body, "services": [], "shifts": [], "legs": []},
    )
    assert response.status_code == 409
    assert counts(engine) == before


@pytest.mark.parametrize("same_key", [True, False])
def test_postgres_concurrent_requests_serialize_revisions(engine, resources, users, body, same_key):
    if engine.dialect.name != "postgresql":
        pytest.skip("Requires real PostgreSQL row locks")
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from app.auth.models import User
    from app.planning.optimization_schemas import OptimizeRequest
    from app.planning.optimization_service import create_optimization

    barrier = Barrier(2)

    def run(identifier):
        with Session(engine) as db:
            user = db.get(User, users["DISPATCHER"])
            request = OptimizeRequest.model_validate({**body, "request_id": str(identifier)})
            barrier.wait(timeout=10)
            return create_optimization(db, user, resources["plan"], request, NOW)

    first_id = UUID(body["request_id"])
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, [first_id, first_id if same_key else uuid4()]))
    if same_key:
        assert sorted(created for _, created in results) == [False, True]
        assert results[0][0] == results[1][0]
        assert counts(engine) == (2, 2, 3, 1)
    else:
        assert all(created for _, created in results)
        assert sorted(result.revision_number for result, _ in results) == [2, 3]
        assert counts(engine) == (3, 4, 6, 2)


def test_migration_roundtrip_preserves_preexisting_planning_rows(
    client, engine, resources, headers, body
):
    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from test_identity_schema import migration_config

    from app.db.models import Base

    assert client.post(url(resources), headers=headers, json=body).status_code == 201
    before = counts(engine)
    with engine.connect() as connection:
        command.downgrade(migration_config(connection), "0007_fleet_operations")
        assert connection.scalar(select(func.count()).select_from(PlanRevision)) == before[0]
        connection.commit()
        command.upgrade(migration_config(connection), "head")
        assert (
            compare_metadata(
                MigrationContext.configure(connection, opts={"compare_server_default": True}),
                Base.metadata,
            )
            == []
        )
    assert counts(engine) == (*before[:3], 0)
