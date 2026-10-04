"""Demo scenarios run through the real services on a disposable database."""

from datetime import UTC, date, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_auth_api import app as app
from test_auth_api import client as client
from test_auth_api import engine as engine
from test_auth_api import settings as settings
from test_demo_resources import resources as resources
from test_demo_seed import PASSWORD
from test_demo_seed import seeded as seeded
from test_fleet_schema import make_vehicle

from app.db.models import (
    AuditEvent,
    Order,
    Plan,
    Trip,
    TripStop,
    Vehicle,
    VehicleAvailability,
    VehicleFuelUsage,
)
from app.demo import check_logins
from app.demo.scenario import DemoScenarioError, run_scenario
from app.fleet.models import Depot
from app.fleet.seed import DEMO_DEPOT_ID
from app.planning.optimization_schemas import OptimizeRequest

# 07:00 on Monday 5 October 2026 in Asia/Colombo.
MORNING = datetime(2026, 10, 5, 1, 30, tzinfo=UTC)


def run(engine, stage, when=MORNING, day=None, fuel=True):
    with Session(engine) as db:
        return run_scenario(db, stage=stage, requested_date=day, now=when, record_missing_fuel=fuel)


def written(engine):
    with Session(engine) as db:
        return tuple(
            db.scalar(select(func.count()).select_from(model))
            for model in (Order, Plan, VehicleAvailability, VehicleFuelUsage)
        )


def test_plan_stage_uses_store_service_and_complete_synthetic_inputs(engine, resources):
    result = run(engine, "plan")
    assert result.delivery_date == date(2026, 10, 6) and not result.orders_inserted_directly
    request = OptimizeRequest.model_validate(result.optimize_request)
    assert request.is_synthetic and "Synthetic" in request.source
    assert len(request.shifts) == 2 and len(request.services) == 1 and len(request.legs) == 2
    van, truck = request.shifts
    assert van.latest_return < truck.earliest_departure
    with Session(engine) as db:
        statuses = db.scalars(select(Order.status).where(Order.id.in_(result.order_ids))).all()
        assert statuses == ["CONFIRMED"] * 4
        assert db.get(Plan, result.plan_id).status == "DRAFT"


def test_reruns_pick_a_free_date_and_never_reuse_a_plan(engine, resources):
    first = run(engine, "plan")
    second = run(engine, "plan")
    assert second.delivery_date == date(2026, 10, 7)
    with pytest.raises(DemoScenarioError, match="already exists"):
        run(engine, "plan", day=first.delivery_date)
    with pytest.raises(DemoScenarioError, match="past"):
        run(engine, "plan", day=date(2026, 10, 1))


def test_published_and_ready_stages_follow_domain_rules(engine, resources):
    published = run(engine, "published")
    assert published.revision_id and published.trip_ids
    assert any("Deferred orders: 1" == note for note in published.notes)
    ready = run(engine, "ready")
    with Session(engine) as db:
        statuses = set(db.scalars(select(Trip.status).where(Trip.id.in_(ready.trip_ids))))
        assert statuses == {"READY"}
        drivers = set(db.scalars(select(Trip.driver_id).where(Trip.id.in_(ready.trip_ids))))
        assert len(drivers) == 1 and None not in drivers


def test_operations_stage_creates_delivered_failed_and_shortfall_records(engine, resources):
    result = run(engine, "operations")
    assert result.delivery_date == date(2026, 10, 5) and result.orders_inserted_directly
    with Session(engine) as db:
        trips = db.scalars(select(Trip).where(Trip.id.in_(result.trip_ids))).all()
        assert {trip.status for trip in trips} == {"COMPLETED"}
        orders = dict(
            db.execute(select(Order.id, Order.status).where(Order.id.in_(result.order_ids))).all()
        )
        assert "DELIVERED" in orders.values() and "DEFERRED" in orders.values()
        stops = set(
            db.scalars(select(TripStop.status).where(TripStop.trip_id.in_(result.trip_ids)))
        )
        # Van trip delivered with POD, truck trip failed, one shortfall recorded.
        assert len(trips) == 2 and {"DELIVERED", "FAILED"} <= stops
        assert "OUT_FOR_DELIVERY" in orders.values() and "LOADING" in orders.values()
        assert any("MISSING" in note for note in result.notes)
        audited = db.scalar(select(func.count()).select_from(AuditEvent))
        assert audited > 0
    with pytest.raises(DemoScenarioError, match="already exists"):
        run(engine, "operations")


def test_failed_checks_write_nothing(engine, resources):
    before = written(engine)
    afternoon = datetime(2026, 10, 5, 9, 30, tzinfo=UTC)  # 15:00: truck cannot arrive by 18:00
    with pytest.raises(DemoScenarioError, match="Too late"):
        run(engine, "operations", when=afternoon)
    late = datetime(2026, 10, 5, 16, 0, tzinfo=UTC)  # 21:30 in Colombo
    with pytest.raises(DemoScenarioError, match="Too late"):
        run(engine, "operations", when=late)
    with pytest.raises(DemoScenarioError, match="cutoff"):
        run(engine, "plan", when=datetime(2026, 10, 5, 11, 0, tzinfo=UTC), day=date(2026, 10, 6))
    with pytest.raises(DemoScenarioError, match="fuel totals"):
        run(engine, "plan", fuel=False)
    with Session(engine) as db:
        db.add(make_vehicle(db.get(Depot, DEMO_DEPOT_ID)))
        db.commit()
    with pytest.raises(DemoScenarioError, match="exactly the two"):
        run(engine, "plan")
    assert written(engine) == before
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Vehicle)) == 3


def test_failure_after_writes_reports_partial_data(engine, resources, monkeypatch):
    from app.demo import scenario

    def broken(*args, **kwargs):
        raise ValueError("solver offline")

    monkeypatch.setattr(scenario, "create_optimization", broken)
    with pytest.raises(DemoScenarioError, match="Earlier steps stay committed"):
        run(engine, "published")


def test_same_day_stage_rules(engine, resources):
    with pytest.raises(DemoScenarioError, match="today"):
        run(engine, "operations", day=date(2026, 10, 9))


def test_missing_seed_data_is_reported(engine, seeded):
    with pytest.raises(DemoScenarioError, match="fleet.seed"):
        run(engine, "plan")


def test_check_logins_reports_each_role_without_secrets(client, resources, monkeypatch):
    def call(url, body=None, token=None):
        path = url.removeprefix("http://test/api/v1")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = (
            client.post(f"/api/v1{path}", json=body)
            if body is not None
            else client.get(f"/api/v1{path}", headers=headers)
        )
        if response.status_code >= 400:
            raise check_logins.urllib.error.HTTPError(url, response.status_code, "", {}, None)
        return response.json()

    monkeypatch.setattr(check_logins, "_call", call)
    lines = check_logins.check("http://test/api/v1", PASSWORD)
    assert [line.split()[0] for line in lines] == ["PASS"] * 4
    assert PASSWORD not in "\n".join(lines)
    wrong = check_logins.check("http://test/api/v1", "wrong-password-value")
    assert all(line.startswith("FAIL") and "HTTP 401" in line for line in wrong)
