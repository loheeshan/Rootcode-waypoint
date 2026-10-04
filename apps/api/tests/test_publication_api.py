from datetime import UTC, datetime, time, timedelta
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
from test_fleet_schema import make_vehicle
from test_optimization_api import DAY, NOW, url
from test_optimization_api import body as body
from test_optimization_api import clock as clock
from test_optimization_api import headers as headers
from test_optimization_api import resources as resources
from test_order_schema import make_order

from app.auth.models import UserDepot
from app.db.models import (
    Depot,
    FuelReservation,
    Order,
    Outlet,
    Plan,
    PlanOptimization,
    PlanPublication,
    PlanRevision,
    Trip,
    Vehicle,
    VehicleAvailability,
    VehicleFuelUsage,
)
from app.planning.optimization_schemas import OptimizationResponse, SavedTripResponse
from app.planning.service import get_planning_time

LOCAL = timedelta(hours=5, minutes=30)


@pytest.fixture
def driver(engine, users, resources):
    with Session(engine) as db:
        db.add(UserDepot(user_id=users["DRIVER"], depot_id=resources["depot"]))
        db.commit()
    return users["DRIVER"]


@pytest.fixture
def optimized(client, resources, headers, body):
    response = client.post(url(resources), headers=headers, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def publish_url(resources, optimized):
    return f"/api/v1/plans/{resources['plan']}/revisions/{optimized['revision_id']}/publish"


def publish_body(optimized, driver_id):
    return {
        "request_id": str(uuid4()),
        "driver_assignments": [
            {"trip_id": trip["id"], "driver_id": str(driver_id)} for trip in optimized["trips"]
        ],
    }


def state(engine):
    with Session(engine) as db:
        return (
            tuple(db.scalars(select(Plan.status).order_by(Plan.id))),
            db.scalar(select(func.count()).where(PlanRevision.status == "PUBLISHED")),
            db.scalar(select(func.count()).select_from(FuelReservation)),
            db.scalar(select(func.count()).select_from(PlanPublication)),
            db.scalar(select(func.count()).where(Trip.driver_id.is_not(None))),
            tuple(db.scalars(select(Order.status).order_by(Order.id))),
        )


def published_elsewhere(
    engine, users, start, end, *, vehicle_id=None, driver_id=None, snapshot=True
):
    """Effective published work in another depot's plan, e.g. after a vehicle reassignment."""
    with Session(engine) as db:
        depot = Depot(name="Other")
        plan = Plan(depot=depot, delivery_date=DAY, created_by=users["DISPATCHER"])
        plan.status = "PUBLISHED"
        revision = PlanRevision(revision_number=1, status="PUBLISHED", published_at=NOW)
        plan.revisions = [revision]
        db.add(plan)
        if vehicle_id is None:
            vehicle = make_vehicle(depot)
            db.add(vehicle)
            db.flush()
            vehicle_id = vehicle.id
        db.flush()
        trip = Trip(
            plan_revision_id=revision.id, vehicle_id=vehicle_id, driver_id=driver_id, trip_number=1
        )
        db.add(trip)
        db.flush()
        db.add(
            FuelReservation(
                trip_id=trip.id, vehicle_id=vehicle_id, service_date=DAY, fuel_l=Decimal("1.000")
            )
        )
        if snapshot:
            result = OptimizationResponse(
                request_id=uuid4(),
                plan_id=plan.id,
                revision_id=revision.id,
                revision_number=1,
                created_at=NOW,
                source="Synthetic other plan",
                is_synthetic=True,
                eligible_order_count=0,
                trips=[
                    SavedTripResponse(
                        id=trip.id,
                        vehicle_id=vehicle_id,
                        trip_number=1,
                        departure_at=start,
                        return_at=end,
                        distance_km="0.000",
                        fuel_l="1.000",
                        stops=[],
                    )
                ],
                deferrals=[],
            )
            db.add(
                PlanOptimization(
                    request_id=result.request_id,
                    plan_revision_id=revision.id,
                    request_hash="0" * 64,
                    input_snapshot={},
                    result_snapshot=result.model_dump(mode="json"),
                )
            )
        db.commit()


def at(hour, minute=0):
    return datetime.combine(DAY, time(hour, minute), UTC) - LOCAL


def test_publish_revalidates_and_commits_one_effective_revision(
    client, engine, resources, headers, driver, optimized
):
    payload = publish_body(optimized, driver)
    response = client.post(publish_url(resources, optimized), headers=headers, json=payload)
    assert response.status_code == 201, response.text
    result = response.json()
    assert result["validation"] == "REVALIDATED_AT_PUBLISH"
    assert result["revision_id"] == optimized["revision_id"]
    assert (result["served_order_count"], result["deferred_order_count"]) == (2, 1)
    assert [trip["driver_id"] for trip in result["trips"]] == [str(driver)] * 2
    assert result["fuel_balances"] == [
        {
            "vehicle_id": str(resources["vehicle"]),
            "week_start": "2026-10-05",
            "weekly_quota_l": "100.000",
            "consumed_l": "0.000",
            "reserved_l": "2.808",
            "remaining_l": "97.192",
        }
    ]
    assert response.headers["cache-control"] == "no-store"
    assert client.get(response.headers["location"], headers=headers).json() == result
    assert state(engine)[1:] == (1, 2, 1, 2, ("PLANNED", "PLANNED", "DEFERRED"))
    with Session(engine) as db:
        plan = db.get(Plan, resources["plan"])
        revision = db.get(PlanRevision, UUID(optimized["revision_id"]))
        assert plan.status == revision.status == "PUBLISHED" and revision.published_at
        fuel = sorted(db.scalars(select(FuelReservation.fuel_l)))
        assert fuel == [Decimal("1.404")] * 2
        assert set(db.scalars(select(FuelReservation.service_date))) == {DAY}
    detail = client.get(f"/api/v1/plans/{resources['plan']}", headers=headers).json()
    assert detail["status"] == "PUBLISHED"
    assert [item["status"] for item in detail["revisions"]] == ["DRAFT", "PUBLISHED"]
    # The saved optimization snapshot itself is unchanged by publication.
    saved = client.get(
        f"/api/v1/plans/{resources['plan']}/revisions/{optimized['revision_id']}/results",
        headers=headers,
    ).json()
    assert saved == optimized


def test_replay_and_conflicting_reuse(client, engine, resources, headers, driver, optimized, body):
    payload = publish_body(optimized, driver)
    first = client.post(publish_url(resources, optimized), headers=headers, json=payload)
    assert first.status_code == 201
    before = state(engine)
    again = client.post(publish_url(resources, optimized), headers=headers, json=payload)
    assert again.status_code == 200 and again.json() == first.json()
    changed = {**payload, "driver_assignments": payload["driver_assignments"][:1]}
    assert (
        client.post(publish_url(resources, optimized), headers=headers, json=changed).status_code
        == 409
    )
    fresh = {**payload, "request_id": str(uuid4())}
    response = client.post(publish_url(resources, optimized), headers=headers, json=fresh)
    assert response.status_code == 409 and "already has a published" in response.text
    rerun = client.post(url(resources), headers=headers, json={**body, "request_id": str(uuid4())})
    assert rerun.status_code == 409
    assert state(engine) == before


@pytest.mark.parametrize(
    "role,status",
    [(None, 401), ("inactive", 401), ("DRIVER", 403), ("LOADER", 403), ("STORE_MANAGER", 403)],
)
def test_role_guards(client, resources, users, settings, driver, optimized, role, status):
    auth = {} if role is None else bearer(users[role], settings)
    response = client.post(
        publish_url(resources, optimized), headers=auth, json=publish_body(optimized, driver)
    )
    assert response.status_code == status
    publication = f"/api/v1/plans/{resources['plan']}/publication"
    assert client.get(publication, headers=auth).status_code == status


def test_scope_and_missing_results_are_hidden(
    client, engine, resources, users, headers, driver, optimized
):
    payload = publish_body(optimized, driver)
    for path in (
        f"/api/v1/plans/{resources['foreign']}/revisions/{optimized['revision_id']}/publish",
        f"/api/v1/plans/{resources['plan']}/revisions/{uuid4()}/publish",
    ):
        assert client.post(path, headers=headers, json=payload).status_code == 404
    with Session(engine) as db:
        initial = db.scalar(select(PlanRevision.id).where(PlanRevision.revision_number == 1))
    path = f"/api/v1/plans/{resources['plan']}/revisions/{initial}/publish"
    assert client.post(path, headers=headers, json=payload).status_code == 404
    publication = f"/api/v1/plans/{resources['plan']}/publication"
    assert client.get(publication, headers=headers).status_code == 404
    with Session(engine) as db:
        db.execute(delete(UserDepot).where(UserDepot.user_id == users["DISPATCHER"]))
        db.commit()
    response = client.post(publish_url(resources, optimized), headers=headers, json=payload)
    assert response.status_code == 404


@pytest.mark.parametrize("case", ["missing", "unknown", "loader", "inactive", "unassigned"])
def test_driver_assignments_must_be_complete_active_scoped_drivers(
    client, engine, resources, users, headers, driver, optimized, case
):
    payload = publish_body(optimized, driver)
    assignments = payload["driver_assignments"]
    if case == "missing":
        assignments.pop()
    elif case == "unknown":
        assignments[0]["trip_id"] = str(uuid4())
    elif case in ("loader", "inactive"):
        other = users["LOADER" if case == "loader" else "inactive"]
        with Session(engine) as db:
            db.add(UserDepot(user_id=other, depot_id=resources["depot"]))
            db.commit()
        assignments[0]["driver_id"] = str(other)
    else:
        with Session(engine) as db:
            db.execute(delete(UserDepot).where(UserDepot.user_id == driver))
            db.commit()
    before = state(engine)
    response = client.post(publish_url(resources, optimized), headers=headers, json=payload)
    assert response.status_code == 422, response.text
    assert state(engine) == before


def test_driver_cannot_hold_overlapping_published_trips(
    client, engine, resources, users, headers, driver, optimized
):
    first = optimized["trips"][0]
    published_elsewhere(
        engine,
        users,
        datetime.fromisoformat(first["departure_at"]),
        datetime.fromisoformat(first["return_at"]),
        driver_id=driver,
    )
    before = state(engine)
    response = client.post(
        publish_url(resources, optimized), headers=headers, json=publish_body(optimized, driver)
    )
    assert response.status_code == 409 and "published work" in response.text
    assert state(engine) == before


@pytest.mark.parametrize("snapshot", [True, False])
def test_vehicle_day_limit_and_unscheduled_published_work_block(
    client, engine, resources, users, headers, driver, optimized, snapshot
):
    published_elsewhere(
        engine, users, at(19), at(20), vehicle_id=resources["vehicle"], snapshot=snapshot
    )
    before = state(engine)
    response = client.post(
        publish_url(resources, optimized), headers=headers, json=publish_body(optimized, driver)
    )
    assert response.status_code == 409
    message = "two published trips" if snapshot else "saved schedule"
    assert message in response.text
    assert state(engine) == before


def add_order(db, resources):
    db.add(make_order(db.get(Outlet, resources["outlet"]), order_weight_kg=Decimal("1")))


def move_vehicle(db, resources):
    foreign = db.get(Plan, resources["foreign"]).depot_id
    db.execute(update(Vehicle).values(depot_id=foreign))


@pytest.mark.parametrize(
    "change",
    [
        add_order,
        lambda db, r: db.execute(
            update(Order).where(Order.id == UUID(int=1)).values(status="DELIVERED")
        ),
        lambda db, r: db.execute(update(VehicleAvailability).values(is_available=False)),
        lambda db, r: db.execute(update(Vehicle).values(weight_cap_kg=Decimal("5"))),
        lambda db, r: db.execute(update(Vehicle).values(weekly_fuel_quota_l=Decimal("1"))),
        lambda db, r: db.execute(update(Outlet).values(window_close_time=time(8, 5))),
        move_vehicle,
    ],
)
def test_changed_live_inputs_reject_stale_revision(
    client, engine, resources, headers, driver, optimized, change
):
    with Session(engine) as db:
        change(db, resources)
        db.commit()
    before = state(engine)
    response = client.post(
        publish_url(resources, optimized), headers=headers, json=publish_body(optimized, driver)
    )
    assert response.status_code == 409, response.text
    assert "run a new optimization" in response.text
    assert state(engine) == before


def test_passed_departure_and_missing_current_fuel_rows_are_rejected(
    client, app, engine, resources, headers, driver, optimized
):
    payload = publish_body(optimized, driver)
    app.dependency_overrides[get_planning_time] = lambda: at(7, 0)
    response = client.post(publish_url(resources, optimized), headers=headers, json=payload)
    assert response.status_code == 422 and "daily fuel" in response.text
    with Session(engine) as db:
        db.add(
            VehicleFuelUsage(
                vehicle_id=resources["vehicle"], usage_date=DAY, fuel_used_l=Decimal("0")
            )
        )
        db.commit()
    app.dependency_overrides[get_planning_time] = lambda: at(8)
    response = client.post(publish_url(resources, optimized), headers=headers, json=payload)
    assert response.status_code == 409 and "departure has passed" in response.text
    app.dependency_overrides[get_planning_time] = lambda: at(7, 0)
    response = client.post(publish_url(resources, optimized), headers=headers, json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["fuel_balances"][0]["consumed_l"] == "0.000"


def test_optimizer_counts_reservations_for_today_and_later_only(
    client, app, engine, resources, users, headers, driver, optimized, body
):
    payload = publish_body(optimized, driver)
    assert (
        client.post(publish_url(resources, optimized), headers=headers, json=payload).status_code
        == 201
    )
    tuesday = DAY + timedelta(days=1)
    with Session(engine) as db:
        plan = Plan(
            depot_id=resources["depot"], delivery_date=tuesday, created_by=users["DISPATCHER"]
        )
        plan.revisions = [PlanRevision(revision_number=1)]
        db.add_all(
            [
                plan,
                make_order(
                    db.get(Outlet, resources["outlet"]),
                    requested_delivery_date=tuesday,
                    order_weight_kg=Decimal("1"),
                ),
                VehicleAvailability(
                    vehicle_id=resources["vehicle"], availability_date=tuesday, is_available=True
                ),
            ]
        )
        db.commit()
        plan_id = plan.id

    def run(day_body):
        response = client.post(f"/api/v1/plans/{plan_id}/optimize", headers=headers, json=day_body)
        assert response.status_code == 201, response.text
        with Session(engine) as db:
            saved = db.get(PlanOptimization, UUID(day_body["request_id"]))
            return saved.input_snapshot["routes"]["vehicles"][0]["fuel_reserved_l"]

    shift = {
        **body["shifts"][0],
        "earliest_departure": "2026-10-06T07:30:00+05:30",
        "latest_return": "2026-10-06T18:00:00+05:30",
    }
    tuesday_body = {**body, "request_id": str(uuid4()), "shifts": [shift]}
    assert Decimal(run(tuesday_body)) == Decimal("2.808")
    # On Tuesday, Monday's consumed total replaces Monday's reservations.
    app.dependency_overrides[get_planning_time] = lambda: at(1) + timedelta(days=1)
    with Session(engine) as db:
        db.add_all(
            VehicleFuelUsage(
                vehicle_id=resources["vehicle"], usage_date=day, fuel_used_l=Decimal("3")
            )
            for day in (DAY, tuesday)
        )
        db.commit()
    assert Decimal(run({**tuesday_body, "request_id": str(uuid4())})) == 0


@pytest.mark.parametrize("target", ["commit", "flush"])
def test_failures_roll_back_publication(
    client, engine, resources, headers, driver, optimized, target
):
    before = state(engine)
    with patch(
        f"sqlalchemy.orm.Session.{target}", side_effect=OperationalError("secret", {}, Exception())
    ):
        response = client.post(
            publish_url(resources, optimized),
            headers=headers,
            json=publish_body(optimized, driver),
        )
    assert response.status_code == 503 and "secret" not in response.text
    assert state(engine) == before


def test_openapi_lists_authenticated_publication_contracts(client):
    schema = client.get("/openapi.json").json()
    for path, method in [
        ("/api/v1/plans/{plan_id}/revisions/{revision_id}/publish", "post"),
        ("/api/v1/plans/{plan_id}/publication", "get"),
    ]:
        assert schema["paths"][path][method]["security"] == [{"HTTPBearer": []}]
    responses = schema["paths"]["/api/v1/plans/{plan_id}/revisions/{revision_id}/publish"]["post"][
        "responses"
    ]
    for status in ("200", "201"):
        assert responses[status]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/PublicationResponse"
        }


def test_database_allows_one_published_revision_per_plan(engine, resources):
    from sqlalchemy.exc import IntegrityError

    with Session(engine) as db:
        db.add_all(
            PlanRevision(
                plan_id=resources["plan"], revision_number=n, status="PUBLISHED", published_at=NOW
            )
            for n in (2, 3)
        )
        with pytest.raises(IntegrityError):
            db.commit()


@pytest.mark.parametrize("same_key", [True, False])
def test_postgres_concurrent_publications_serialize(
    engine, resources, users, driver, optimized, same_key
):
    if engine.dialect.name != "postgresql":
        pytest.skip("Requires real PostgreSQL row locks")
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from fastapi import HTTPException

    from app.auth.models import User
    from app.planning.publication_schemas import PublishRequest
    from app.planning.publication_service import create_publication

    barrier = Barrier(2)
    payload = publish_body(optimized, driver)

    def run(identifier):
        with Session(engine) as db:
            user = db.get(User, users["DISPATCHER"])
            request = PublishRequest.model_validate({**payload, "request_id": str(identifier)})
            barrier.wait(timeout=10)
            try:
                return create_publication(
                    db, user, resources["plan"], UUID(optimized["revision_id"]), request, NOW
                )[1]
            except HTTPException as error:
                db.rollback()
                return error.status_code

    first = UUID(payload["request_id"])
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, [first, first if same_key else uuid4()]))
    assert sorted(results, key=str) == sorted([True, False if same_key else 409], key=str)
    assert state(engine)[1:5] == (1, 2, 1, 2)


def test_migration_roundtrip_keeps_published_rows(
    client, engine, resources, headers, driver, optimized
):
    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from test_identity_schema import migration_config

    from app.db.models import Base

    response = client.post(
        publish_url(resources, optimized), headers=headers, json=publish_body(optimized, driver)
    )
    assert response.status_code == 201
    with engine.connect() as connection:
        command.downgrade(migration_config(connection), "0008_plan_optimizations")
        connection.commit()
        command.upgrade(migration_config(connection), "head")
        assert (
            compare_metadata(
                MigrationContext.configure(connection, opts={"compare_server_default": True}),
                Base.metadata,
            )
            == []
        )
    after = state(engine)
    assert after[1:5] == (1, 0, 0, 2)
