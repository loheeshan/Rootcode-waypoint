"""Exercise the real fleet migration in SQLite and compile PostgreSQL DDL.

SQLite checks do not replace the PostgreSQL migration smoke check.
"""

from collections.abc import Callable, Iterator
from datetime import time
from decimal import Decimal
from io import StringIO
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, create_engine, inspect, select
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Depot, Outlet, Role, User, UserRole, Vehicle
from app.fleet.models import ParkingConstraint, TemperatureType, VehicleType

API_ROOT = Path(__file__).resolve().parents[1]
IDENTITY_REVISION = "0001_user_roles"
FLEET_REVISION = "0002_fleet_foundation"


def migration_config(connection: Connection | None = None) -> Config:
    config = Config(str(API_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(API_ROOT / "migrations"))
    if connection is not None:
        config.attributes["connection"] = connection
    return config


@pytest.fixture
def database() -> Iterator[Connection]:
    engine = create_engine("sqlite://")
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.commit()
        command.upgrade(migration_config(connection), FLEET_REVISION)
        yield connection
    engine.dispose()


@pytest.fixture
def session(database: Connection) -> Iterator[Session]:
    with Session(database) as db:
        yield db


def make_vehicle(depot: Depot | None, **overrides: object) -> Vehicle:
    values: dict[str, object] = dict(
        type=VehicleType.VAN,
        temperature_type=TemperatureType.REEFER,
        weight_cap_kg=Decimal("1200.125"),
        volume_cap_m3=Decimal("8.500"),
        km_per_l=Decimal("7.125"),
        weekly_fuel_quota_l=Decimal("100.000"),
    )
    if depot is not None:
        values["depot"] = depot
    values.update(overrides)
    return Vehicle(**values)


def make_outlet(depot: Depot | None, **overrides: object) -> Outlet:
    values: dict[str, object] = dict(
        brand="Example Store",
        district="Colombo",
        dock_type="ground",
        parking_constraint=ParkingConstraint.VAN_ONLY,
        window_open_time=time(8),
        window_close_time=time(10),
    )
    if depot is not None:
        values["depot"] = depot
    values.update(overrides)
    return Outlet(**values)


def identity_snapshot(connection: Connection) -> dict[str, list[tuple[object, ...]]]:
    return {
        model.__tablename__: [tuple(row) for row in connection.execute(
            select(model.__table__).order_by(*model.__table__.primary_key.columns)
        )]
        for model in (User, Role, UserRole)
    }


def test_fleet_upgrade_and_rollback_preserve_existing_identity(database: Connection) -> None:
    config = migration_config(database)
    command.downgrade(config, IDENTITY_REVISION)
    with Session(database) as db:
        driver_role = db.scalars(select(Role).where(Role.code == "DRIVER")).one()
        user = User(email="existing@example.test", password_hash="test-hash")
        user.role_assignments = [UserRole(role=driver_role)]
        db.add(user)
        db.commit()
    original = identity_snapshot(database)
    database.commit()

    command.upgrade(config, FLEET_REVISION)
    command.upgrade(config, FLEET_REVISION)
    assert identity_snapshot(database) == original
    database.commit()
    with Session(database) as db:
        depot = Depot(name="Test Depot")
        db.add_all([make_vehicle(depot), make_outlet(depot)])
        db.commit()

    command.downgrade(config, IDENTITY_REVISION)
    assert set(inspect(database).get_table_names()) == {
        "alembic_version", "users", "roles", "user_roles"
    }
    assert identity_snapshot(database) == original
    database.commit()
    command.upgrade(config, FLEET_REVISION)
    assert identity_snapshot(database) == original
    for model in (Depot, Outlet, Vehicle):
        assert database.execute(select(model)).all() == []


def test_fleet_tables_start_empty_and_depot_foreign_keys_are_indexed(database: Connection) -> None:
    for model in (Depot, Outlet, Vehicle):
        assert database.execute(select(model)).all() == []
    inspector = inspect(database)
    for table in ("outlets", "vehicles"):
        assert any(index["column_names"] == ["depot_id"]
                   and not index["unique"] for index in inspector.get_indexes(table))
        foreign_key, = inspector.get_foreign_keys(table)
        assert foreign_key["referred_table"] == "depots"
        assert foreign_key["options"]["ondelete"] == "RESTRICT"


@pytest.mark.parametrize("vehicle_type", list(VehicleType))
@pytest.mark.parametrize("temperature_type", list(TemperatureType))
def test_valid_fleet_values_and_defaults(
    session: Session, vehicle_type: VehicleType, temperature_type: TemperatureType,
) -> None:
    depot = Depot(name="Colombo Depot")
    vehicle = make_vehicle(depot, type=vehicle_type, temperature_type=temperature_type)
    outlet = make_outlet(depot)
    session.add_all([depot, vehicle, outlet])
    session.commit()
    assert len({depot.id, vehicle.id, outlet.id}) == 3
    assert vehicle.depot_id == outlet.depot_id == depot.id
    assert vehicle.type == vehicle_type
    assert vehicle.temperature_type == temperature_type
    assert vehicle.weight_cap_kg == Decimal("1200.125")
    assert vehicle.volume_cap_m3 == Decimal("8.500")
    assert vehicle.km_per_l == Decimal("7.125")
    assert vehicle.weekly_fuel_quota_l == Decimal("100.000")
    assert outlet.mall_window is False
    assert depot.outlets == [outlet]
    assert depot.vehicles == [vehicle]


@pytest.mark.parametrize(
    "field,value",
    [
        ("weight_cap_kg", Decimal("0")),
        ("weight_cap_kg", Decimal("-1")),
        ("weight_cap_kg", Decimal("1000000000")),
        ("volume_cap_m3", Decimal("0")),
        ("volume_cap_m3", Decimal("-1")),
        ("volume_cap_m3", Decimal("1000000000")),
        ("km_per_l", Decimal("0")),
        ("km_per_l", Decimal("-1")),
        ("km_per_l", Decimal("100000")),
        ("weekly_fuel_quota_l", Decimal("-1")),
        ("weekly_fuel_quota_l", Decimal("1000000000")),
        ("type", "bus"),
        ("temperature_type", "unknown"),
    ],
)
def test_invalid_vehicle_values_are_rejected(session: Session, field: str, value: object) -> None:
    session.add(make_vehicle(Depot(name="Test Depot"), **{field: value}))
    # PostgreSQL can reject numeric overflow before evaluating the CHECK constraint.
    with pytest.raises((IntegrityError, DataError)):
        session.commit()


@pytest.mark.parametrize(
    "field", ["weight_cap_kg", "volume_cap_m3", "km_per_l", "weekly_fuel_quota_l"]
)
@pytest.mark.parametrize("value", [Decimal("NaN"), Decimal("Infinity"), Decimal("-Infinity")])
def test_nonfinite_vehicle_numbers_are_rejected(
    session: Session, field: str, value: Decimal,
) -> None:
    session.add(make_vehicle(Depot(name="Test Depot"), **{field: value}))
    with pytest.raises((IntegrityError, DataError)):
        session.commit()


def test_zero_weekly_quota_is_valid(session: Session) -> None:
    vehicle = make_vehicle(Depot(name="Test Depot"), weekly_fuel_quota_l=Decimal("0"))
    session.add(vehicle)
    session.commit()
    assert vehicle.weekly_fuel_quota_l == Decimal("0.000")


@pytest.mark.parametrize("field", ["brand", "district", "dock_type"])
def test_blank_outlet_labels_are_rejected(session: Session, field: str) -> None:
    session.add(make_outlet(Depot(name="Test Depot"), **{field: "  "}))
    with pytest.raises(IntegrityError):
        session.commit()


def test_blank_depot_name_is_rejected(session: Session) -> None:
    session.add(Depot(name="  "))
    with pytest.raises(IntegrityError):
        session.commit()


def test_unknown_parking_constraint_is_rejected(session: Session) -> None:
    session.add(make_outlet(Depot(name="Test Depot"), parking_constraint="unknown"))
    with pytest.raises(IntegrityError):
        session.commit()


def test_empty_window_is_rejected(session: Session) -> None:
    session.add(make_outlet(Depot(name="Test Depot"), window_close_time=time(8)))
    with pytest.raises(IntegrityError):
        session.commit()


def test_overnight_mall_window_is_preserved(session: Session) -> None:
    outlet = make_outlet(
        Depot(name="Test Depot"), window_open_time=time(22),
        window_close_time=time(2), mall_window=True, parking_constraint=ParkingConstraint.NONE,
    )
    session.add(outlet)
    session.commit()
    assert outlet.window_open_time == time(22)
    assert outlet.window_close_time == time(2)
    assert outlet.mall_window is True
    assert outlet.parking_constraint == ParkingConstraint.NONE


@pytest.mark.parametrize("factory", [make_outlet, make_vehicle])
def test_missing_depot_is_rejected(
    session: Session, factory: Callable[..., Outlet | Vehicle],
) -> None:
    session.add(factory(None, depot_id=uuid4()))
    with pytest.raises(IntegrityError):
        session.commit()


@pytest.mark.parametrize("factory", [make_outlet, make_vehicle])
def test_cannot_delete_referenced_depot_even_when_children_loaded(
    session: Session, factory: Callable[..., Outlet | Vehicle],
) -> None:
    depot = Depot(name="Test Depot")
    session.add(factory(depot))
    session.commit()
    list(depot.outlets)
    list(depot.vehicles)
    session.delete(depot)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
    assert session.get(Depot, depot.id) is not None


def test_delete_empty_depot(session: Session) -> None:
    depot = Depot(name="Test Depot")
    session.add(depot)
    session.commit()
    session.delete(depot)
    session.commit()
    assert session.scalars(select(Depot)).all() == []


def test_offline_fleet_upgrade_and_downgrade_generate_postgresql_ddl() -> None:
    config = migration_config()
    config.output_buffer = StringIO()
    command.upgrade(config, f"{IDENTITY_REVISION}:{FLEET_REVISION}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert "CREATE TABLE depots" in ddl
    assert "CREATE TABLE outlets" in ddl
    assert "CREATE TABLE vehicles" in ddl
    assert "UUID NOT NULL" in ddl
    assert "TIME WITHOUT TIME ZONE NOT NULL" in ddl
    assert "NUMERIC(12, 3) NOT NULL" in ddl
    assert "NUMERIC(8, 3) NOT NULL" in ddl
    assert "mall_window BOOLEAN DEFAULT false NOT NULL" in ddl
    assert ddl.count("ON DELETE RESTRICT") == 2
    assert "CREATE INDEX ix_outlets_depot_id" in ddl
    assert "CREATE INDEX ix_vehicles_depot_id" in ddl
    assert "CREATE TABLE users" not in ddl

    config.output_buffer = StringIO()
    command.downgrade(config, f"{FLEET_REVISION}:{IDENTITY_REVISION}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert ddl.index("DROP TABLE vehicles") < ddl.index("DROP TABLE depots")
    assert ddl.index("DROP TABLE outlets") < ddl.index("DROP TABLE depots")
    assert "DROP TABLE users" not in ddl
    assert "DROP TABLE roles" not in ddl
    assert "DROP TABLE user_roles" not in ddl
