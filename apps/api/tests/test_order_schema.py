"""Run order migrations in SQLite and compile PostgreSQL migration SQL."""

import re
from collections.abc import Iterator
from datetime import UTC, date, datetime
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
from test_fleet_schema import make_outlet, make_vehicle

from app.db.models import Depot, Order, Outlet, Role, User, UserRole, Vehicle
from app.orders.models import OrderStatus, TemperatureRequirement

API_ROOT = Path(__file__).resolve().parents[1]
FLEET_REVISION = "0002_fleet_foundation"
ORDER_REVISION = "0003_orders"


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
        command.upgrade(migration_config(connection), ORDER_REVISION)
        yield connection
    engine.dispose()


@pytest.fixture
def session(database: Connection) -> Iterator[Session]:
    with Session(database) as db:
        yield db


def make_order(outlet: Outlet | None = None, **overrides: object) -> Order:
    values: dict[str, object] = dict(
        requested_delivery_date=date(2026, 10, 5),
        temperature_requirement=TemperatureRequirement.AMBIENT,
        order_weight_kg=Decimal("123.125"),
        order_volume_m3=Decimal("0.875"),
    )
    if outlet is not None:
        values["outlet"] = outlet
    values.update(overrides)
    return Order(**values)


def existing_snapshot(connection: Connection) -> dict[str, list[tuple[object, ...]]]:
    return {
        model.__tablename__: [tuple(row) for row in connection.execute(
            select(model.__table__).order_by(*model.__table__.primary_key.columns)
        )]
        for model in (User, Role, UserRole, Depot, Outlet, Vehicle)
    }


def test_upgrade_and_rollback_preserve_identity_and_fleet(database: Connection) -> None:
    config = migration_config(database)
    command.downgrade(config, FLEET_REVISION)
    with Session(database) as db:
        user = User(email="existing@example.test", password_hash="test-hash")
        role = db.scalars(select(Role).where(Role.code == "DRIVER")).one()
        user.role_assignments = [UserRole(role=role)]
        depot = Depot(name="Existing Depot")
        outlet = make_outlet(depot)
        db.add_all([user, outlet, make_vehicle(depot)])
        db.commit()
        outlet_id = outlet.id
    original = existing_snapshot(database)
    database.commit()

    command.upgrade(config, ORDER_REVISION)
    assert database.execute(select(Order)).all() == []
    assert existing_snapshot(database) == original
    database.commit()
    with Session(database) as db:
        order = make_order(outlet_id=outlet_id)
        db.add(order)
        db.commit()
        order_id = order.id
    database.commit()
    command.upgrade(config, ORDER_REVISION)
    with Session(database) as db:
        assert db.get(Order, order_id) is not None
    database.commit()

    command.downgrade(config, FLEET_REVISION)
    assert set(inspect(database).get_table_names()) == {
        "alembic_version", "users", "roles", "user_roles", "depots", "outlets", "vehicles"
    }
    assert existing_snapshot(database) == original
    database.commit()
    command.upgrade(config, ORDER_REVISION)
    assert existing_snapshot(database) == original
    assert database.execute(select(Order)).all() == []


def test_defaults_and_multiple_orders_for_same_outlet_date(session: Session) -> None:
    outlet = make_outlet(Depot(name="Test Depot"))
    orders = [make_order(outlet) for _ in range(2)]
    session.add_all(orders)
    session.commit()
    assert orders[0].id != orders[1].id
    for order in orders:
        assert order.outlet == outlet
        assert order.outlet_id == outlet.id
        assert order.requested_delivery_date == date(2026, 10, 5)
        assert order.order_weight_kg == Decimal("123.125")
        assert order.order_volume_m3 == Decimal("0.875")
        assert order.status == OrderStatus.CONFIRMED
        assert order.created_at is not None


@pytest.mark.parametrize("status", list(OrderStatus))
@pytest.mark.parametrize("temperature", list(TemperatureRequirement))
def test_all_contract_statuses_and_temperatures_are_storable(
    session: Session, status: OrderStatus, temperature: TemperatureRequirement,
) -> None:
    order = make_order(make_outlet(Depot(name="Test Depot")), status=status,
                       temperature_requirement=temperature)
    session.add(order)
    session.commit()
    assert order.status == status
    assert order.temperature_requirement == temperature


@pytest.mark.parametrize("field", ["order_weight_kg", "order_volume_m3"])
@pytest.mark.parametrize("value", [Decimal("0"), Decimal("-1"), Decimal("1000000000"),
                                   Decimal("NaN"), Decimal("Infinity"), Decimal("-Infinity")])
def test_nonpositive_out_of_range_and_nonfinite_values_are_rejected(
    session: Session, field: str, value: Decimal,
) -> None:
    session.add(make_order(make_outlet(Depot(name="Test Depot")), **{field: value}))
    # PostgreSQL can reject numeric overflow before evaluating the CHECK constraint.
    with pytest.raises((IntegrityError, DataError)):
        session.commit()


@pytest.mark.parametrize("field,value", [("status", "DRAFT"), ("status", "confirmed"),
                                         ("temperature_requirement", "reefer"),
                                         ("temperature_requirement", "CHILLED")])
def test_unknown_status_and_temperature_are_rejected(
    session: Session, field: str, value: str,
) -> None:
    session.add(make_order(make_outlet(Depot(name="Test Depot")), **{field: value}))
    with pytest.raises(IntegrityError):
        session.commit()


@pytest.mark.parametrize("field", ["requested_delivery_date", "temperature_requirement",
                                   "order_weight_kg", "order_volume_m3", "status", "created_at"])
def test_required_order_data_cannot_be_null(session: Session, field: str) -> None:
    outlet = make_outlet(Depot(name="Test Depot"))
    session.add(outlet)
    session.commit()
    values: dict[str, object] = dict(
        id=uuid4(), outlet_id=outlet.id, requested_delivery_date=date(2026, 10, 5),
        temperature_requirement="ambient", order_weight_kg=Decimal("1"),
        order_volume_m3=Decimal("1"), status="CONFIRMED", created_at=datetime.now(UTC),
    )
    values[field] = None
    # Core inserts preserve explicit NULL even on columns with server defaults.
    with pytest.raises(IntegrityError):
        session.execute(Order.__table__.insert().values(**values))
        session.commit()


@pytest.mark.parametrize("outlet_id", [None, uuid4()])
def test_missing_outlet_is_rejected(session: Session, outlet_id: object) -> None:
    session.add(make_order(outlet_id=outlet_id))
    with pytest.raises(IntegrityError):
        session.commit()


def test_referenced_outlet_cannot_be_deleted(session: Session) -> None:
    outlet = make_outlet(Depot(name="Test Depot"))
    order = make_order(outlet)
    session.add(order)
    session.commit()
    order_id = order.id
    assert order.outlet == outlet
    session.delete(outlet)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
    assert session.get(Order, order_id) is not None


def test_deleting_order_preserves_outlet(session: Session) -> None:
    outlet = make_outlet(Depot(name="Test Depot"))
    order = make_order(outlet)
    session.add(order)
    session.commit()
    outlet_id = outlet.id
    session.delete(order)
    session.commit()
    assert session.scalars(select(Order)).all() == []
    assert session.get(Outlet, outlet_id) is not None


def test_outlet_and_delivery_date_indexes_exist(database: Connection) -> None:
    indexes = inspect(database).get_indexes("orders")
    assert {tuple(index["column_names"]) for index in indexes} == {
        ("outlet_id",), ("requested_delivery_date",)
    }


def test_status_codes_match_shared_contract() -> None:
    contract = (API_ROOT.parents[1] / "packages/shared-types/src/index.ts").read_text()
    status_list = re.search(r"orderStatuses = \[([^\]]+)\]", contract)
    assert status_list is not None
    assert re.findall(r"'([^']+)'", status_list.group(1)) == [
        status.value for status in OrderStatus
    ]


def test_offline_order_upgrade_and_downgrade_generate_postgresql_sql() -> None:
    config = migration_config()
    config.output_buffer = StringIO()
    command.upgrade(config, f"{FLEET_REVISION}:{ORDER_REVISION}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert "CREATE TABLE orders" in ddl
    assert "id UUID NOT NULL" in ddl
    assert "requested_delivery_date DATE NOT NULL" in ddl
    assert ddl.count("NUMERIC(12, 3) NOT NULL") == 2
    assert "created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL" in ddl
    assert "status VARCHAR(32) DEFAULT 'CONFIRMED' NOT NULL" in ddl
    assert "ON DELETE RESTRICT" in ddl
    assert "CREATE INDEX ix_orders_outlet_id" in ddl
    assert "CREATE INDEX ix_orders_requested_delivery_date" in ddl
    assert "CREATE TABLE outlets" not in ddl
    config.output_buffer = StringIO()
    command.downgrade(config, f"{ORDER_REVISION}:{FLEET_REVISION}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert "DROP TABLE orders" in ddl
    assert "DROP TABLE outlets" not in ddl
    assert "DROP TABLE users" not in ddl
