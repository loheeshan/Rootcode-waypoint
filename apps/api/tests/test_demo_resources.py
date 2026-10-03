"""Verify synthetic master data, controlled grants and atomic repeatable setup."""

from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import delete, event, select, update
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session
from test_auth_api import app as app
from test_auth_api import client as client
from test_auth_api import engine as engine
from test_auth_api import settings as settings
from test_demo_seed import PASSWORD
from test_demo_seed import seeded as seeded
from test_fleet_schema import make_outlet

from app.auth.models import Role, RoleCode, User, UserDepot, UserOutlet, UserRole
from app.auth.seed import DEMO_ACCOUNTS, DemoSeedError
from app.db.models import Depot, Order, Outlet, Vehicle
from app.fleet import seed


def snapshot(engine):
    models = (User, Role, UserRole, Depot, Outlet, Vehicle, Order, UserOutlet, UserDepot)
    with engine.connect() as connection:
        return {model.__tablename__: [tuple(row) for row in connection.execute(
            select(model.__table__).order_by(*model.__table__.primary_key.columns)
        )] for model in models}


@pytest.fixture
def resources(engine, seeded):
    with Session(engine) as db:
        return seed.seed_demo_resources(db, app_env="test")


def test_creates_exact_demo_data_and_assignments_without_orders(engine, resources) -> None:
    assert len(resources.created) == 5
    assert resources.existing == ()
    assert resources.assignments_created == 4
    assert resources.assignments_existing == 0
    with Session(engine) as db:
        assert [row.id for row in db.scalars(select(Depot))] == [seed.DEMO_DEPOT_ID]
        assert {row.id for row in db.scalars(select(Outlet))} == {
            seed.DEMO_STORE_ID, seed.DEMO_MALL_ID,
        }
        mall = db.get(Outlet, seed.DEMO_MALL_ID)
        assert mall.mall_window and mall.parking_constraint == "van_only"
        assert (mall.window_open_time.hour, mall.window_close_time.hour) == (9, 11)
        van = db.get(Vehicle, seed.DEMO_REEFER_ID)
        assert (van.type, van.temperature_type) == ("van", "reefer")
        assert van.weight_cap_kg == Decimal("1200.000")
        truck = db.get(Vehicle, seed.DEMO_TRUCK_ID)
        assert (truck.type, truck.temperature_type) == ("truck", "ambient")
        assert truck.volume_cap_m3 == Decimal("30.000")
        assert van.depot_id == truck.depot_id == seed.DEMO_DEPOT_ID
        assert db.scalars(select(Order)).all() == []
        users = {user.email: user for user in db.scalars(select(User))}
        for email, role in DEMO_ACCOUNTS:
            user = users[email]
            assert [assignment.role.code for assignment in user.role_assignments] == [role]
            assert [assignment.outlet_id for assignment in user.outlet_assignments] == (
                [seed.DEMO_STORE_ID] if role == RoleCode.STORE_MANAGER else []
            )
            assert [assignment.depot_id for assignment in user.depot_assignments] == (
                [] if role == RoleCode.STORE_MANAGER else [seed.DEMO_DEPOT_ID]
            )


def test_second_run_preserves_every_record_and_password(engine, resources) -> None:
    before = snapshot(engine)
    with Session(engine) as db:
        result = seed.seed_demo_resources(db, app_env="test")
    assert result.created == ()
    assert result.existing == resources.created
    assert result.assignments_created == 0
    assert result.assignments_existing == 4
    assert snapshot(engine) == before


@pytest.mark.parametrize("email,role", DEMO_ACCOUNTS)
def test_seeded_login_and_me_report_the_expected_assignments(
    client, resources, email, role,
) -> None:
    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200
    user = login.json()["user"]
    is_store = role == RoleCode.STORE_MANAGER
    assert user["outlet_ids"] == ([str(seed.DEMO_STORE_ID)] if is_store else [])
    assert user["depot_ids"] == ([] if is_store else [str(seed.DEMO_DEPOT_ID)])
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/v1/me", headers=headers).json() == user


def test_missing_accounts_abort_before_creating_any_resources(engine) -> None:
    before = snapshot(engine)
    with Session(engine) as db, pytest.raises(DemoSeedError, match="app.auth.seed"):
        seed.seed_demo_resources(db, app_env="test")
    assert snapshot(engine) == before


@pytest.mark.parametrize("change", ["missing", "inactive", "wrong_role"])
def test_changed_demo_account_is_not_reactivated_or_granted_access(engine, seeded, change) -> None:
    with Session(engine) as db:
        user = db.scalars(select(User).where(User.email == "driver@waypoint.demo")).one()
        if change == "missing":
            db.delete(user)
        elif change == "inactive":
            user.is_active = False
        else:
            user.role_assignments.clear()
        db.commit()
    before = snapshot(engine)
    with Session(engine) as db, pytest.raises(DemoSeedError):
        seed.seed_demo_resources(db, app_env="test")
    assert snapshot(engine) == before


@pytest.mark.parametrize("model,identity,changes", [
    (Depot, seed.DEMO_DEPOT_ID, {"name": "Edited depot"}),
    (Outlet, seed.DEMO_STORE_ID, {"district": "Edited district"}),
    (Vehicle, seed.DEMO_REEFER_ID, {"weight_cap_kg": Decimal("1500.000")}),
])
def test_modified_demo_data_is_never_overwritten(
    engine, resources, model, identity, changes,
) -> None:
    with Session(engine) as db:
        db.execute(update(model).where(model.id == identity).values(**changes))
        db.commit()
    before = snapshot(engine)
    with Session(engine) as db, pytest.raises(DemoSeedError, match="Conflicting demo record"):
        seed.seed_demo_resources(db, app_env="test")
    assert snapshot(engine) == before


def test_late_record_conflict_rolls_back_earlier_resource_inserts(engine, seeded) -> None:
    with Session(engine) as db:
        other = Depot(name="Unrelated Depot")
        db.add(make_outlet(other, id=seed.DEMO_MALL_ID))
        db.commit()
    before = snapshot(engine)
    with Session(engine) as db, pytest.raises(DemoSeedError, match="Conflicting demo record"):
        seed.seed_demo_resources(db, app_env="test")
    assert snapshot(engine) == before


def test_assignment_failure_rolls_back_all_resources_and_grants(engine, seeded) -> None:
    before = snapshot(engine)

    def fail_assignment(connection, cursor, statement, parameters, context, executemany):
        if statement.startswith("INSERT INTO user_depots"):
            raise IntegrityError(statement, parameters, Exception("simulated failure"))

    event.listen(engine, "before_cursor_execute", fail_assignment)
    try:
        with Session(engine) as db, pytest.raises(IntegrityError):
            seed.seed_demo_resources(db, app_env="test")
    finally:
        event.remove(engine, "before_cursor_execute", fail_assignment)
    assert snapshot(engine) == before


def test_names_do_not_match_unrelated_data_or_change_existing_grants(engine, seeded) -> None:
    with Session(engine) as db:
        other = Depot(id=uuid4(), name="Waypoint Demo Depot")
        outlet = make_outlet(other, brand="Waypoint Demo Store")
        store = db.scalars(select(User).where(User.email == "store@waypoint.demo")).one()
        db.add(UserOutlet(user=store, outlet=outlet))
        db.commit()
        store_id, outlet_id, depot_id = store.id, outlet.id, other.id
    with Session(engine) as db:
        seed.seed_demo_resources(db, app_env="test")
    with Session(engine) as db:
        assert db.get(Depot, depot_id).name == "Waypoint Demo Depot"
        assert db.get(UserOutlet, (store_id, outlet_id)) is not None
        assert db.get(UserOutlet, (store_id, seed.DEMO_STORE_ID)) is not None
        assert db.get(UserDepot, (store_id, depot_id)) is None
        assert len(db.scalars(select(Depot)).all()) == 2


def test_explicit_resource_seed_restores_a_missing_demo_assignment(engine, resources) -> None:
    with Session(engine) as db:
        store = db.scalars(select(User).where(User.email == "store@waypoint.demo")).one()
        db.execute(delete(UserOutlet).where(UserOutlet.user_id == store.id))
        db.commit()
    with Session(engine) as db:
        result = seed.seed_demo_resources(db, app_env="test")
    assert result.created == ()
    assert result.assignments_created == 1
    assert result.assignments_existing == 3


@pytest.mark.parametrize("app_env", ["production", "staging", "", "Development"])
def test_seed_refuses_non_demo_environments_before_database_access(app_env) -> None:
    db = MagicMock(spec=Session)
    with pytest.raises(DemoSeedError, match="APP_ENV"):
        seed.seed_demo_resources(db, app_env=app_env)
    db.begin.assert_not_called()


@pytest.fixture
def cli(monkeypatch, engine, settings):
    monkeypatch.setattr(seed, "get_engine", lambda: engine)
    monkeypatch.setattr(seed, "get_settings", lambda: settings)


def test_cli_requires_explicit_demo_flag() -> None:
    with pytest.raises(SystemExit) as error:
        seed.main([])
    assert error.value.code == 2


def test_cli_reports_resource_ids_and_counts(cli, seeded, capsys) -> None:
    assert seed.main(["--demo"]) == 0
    assert seed.main(["--demo"]) == 0
    output = capsys.readouterr().out
    assert "Created 5 resources; preserved 0 existing." in output
    assert "Created 0 assignments; preserved 4 existing." in output
    assert f"Store outlet: {seed.DEMO_STORE_ID}" in output
    assert PASSWORD not in output
    assert "$argon2" not in output


def test_cli_rejects_production_before_database_access(cli, settings, monkeypatch) -> None:
    monkeypatch.setattr(seed, "get_settings", lambda: settings.model_copy(
        update={"app_env": "production"},
    ))
    database = MagicMock()
    monkeypatch.setattr(seed, "get_engine", database)
    assert seed.main(["--demo"]) == 1
    database.assert_not_called()


def test_cli_does_not_expose_database_connection_details(cli, monkeypatch, capsys) -> None:
    monkeypatch.setattr(seed, "get_engine", MagicMock(side_effect=OperationalError(
        "private-database-url", {}, Exception("private-detail"),
    )))
    assert seed.main(["--demo"]) == 1
    output = capsys.readouterr().err
    assert "Resource seed failed" in output
    assert "private" not in output
