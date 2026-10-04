"""Actual migrations, daily input constraints and preservation of earlier data."""

from datetime import date, timedelta
from decimal import Decimal
from io import StringIO
from uuid import uuid4

import pytest
from alembic import command
from sqlalchemy import delete, inspect, select, text, update
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session
from test_fleet_schema import make_vehicle
from test_identity_schema import database as database
from test_identity_schema import migration_config
from test_order_schema import make_order
from test_plan_outcomes_schema import snapshot as foundation_snapshot
from test_planning_schema import make_graph

from app.db.models import (
    DeferralDecision,
    Depot,
    PlanAssignment,
    Role,
    UserDepot,
    UserOutlet,
    UserRole,
    Vehicle,
    VehicleAvailability,
    VehicleFuelUsage,
)

PREVIOUS = "0006_plan_outcomes"
REVISION = "0007_fleet_operations"
DAY = date(2026, 10, 5)
DAILY_MODELS = [VehicleAvailability, VehicleFuelUsage]


def daily_record(model, vehicle_id, **changes):
    values = {"vehicle_id": vehicle_id}
    if model is VehicleAvailability:
        values.update(availability_date=DAY, is_available=True)
    else:
        values.update(usage_date=DAY, fuel_used_l=Decimal("12.345"))
    values.update(changes)
    return model(**values)


@pytest.fixture
def vehicle_id(database):
    with Session(database) as db:
        vehicle = make_vehicle(Depot(name="Operational Depot"))
        db.add(vehicle)
        db.commit()
        return vehicle.id


def snapshot(connection):
    result = foundation_snapshot(connection)
    for model in (PlanAssignment, DeferralDecision):
        result[model.__tablename__] = [
            tuple(row)
            for row in connection.execute(
                select(model.__table__).order_by(*model.__table__.primary_key.columns)
            )
        ]
    return result


def test_upgrade_rollback_and_reapply_preserve_all_fifteen_previous_tables(database):
    config = migration_config(database)
    command.downgrade(config, PREVIOUS)
    with Session(database) as db:
        plan = make_graph()
        user = plan.creator
        user.role_assignments = [UserRole(role=db.scalars(select(Role)).first())]
        stop = plan.revisions[0].trips[0].stops[0]
        user.depot_assignments = [UserDepot(depot=plan.depot)]
        user.outlet_assignments = [UserOutlet(outlet=stop.outlet)]
        order = make_order(stop.outlet)
        db.add_all([plan, order])
        db.flush()
        db.add(
            PlanAssignment(
                plan_revision_id=plan.revisions[0].id,
                order_id=order.id,
                outlet_id=order.outlet_id,
                outcome="DEFERRED",
                deferral=DeferralDecision(
                    reason_code="VEHICLE_UNAVAILABLE", reason_text="Existing result is preserved."
                ),
            )
        )
        db.commit()
        existing_vehicle_id = plan.revisions[0].trips[0].vehicle_id
    original = snapshot(database)
    assert len(original) == 15 and all(original.values())
    original_indexes = {table: inspect(database).get_indexes(table) for table in original}
    database.commit()

    command.upgrade(config, REVISION)
    assert snapshot(database) == original
    for model in DAILY_MODELS:
        assert database.execute(select(model)).all() == []
    database.commit()
    with Session(database) as db:
        db.add_all([daily_record(model, existing_vehicle_id) for model in DAILY_MODELS])
        db.commit()
    database.commit()
    command.upgrade(config, REVISION)
    for model in DAILY_MODELS:
        assert len(database.execute(select(model)).all()) == 1
    database.commit()

    command.downgrade(config, PREVIOUS)
    assert set(inspect(database).get_table_names()) == {*original, "alembic_version"}
    assert snapshot(database) == original
    for table, indexes in original_indexes.items():
        assert inspect(database).get_indexes(table) == indexes
    database.commit()
    command.upgrade(config, REVISION)
    assert snapshot(database) == original
    for model in DAILY_MODELS:
        assert database.execute(select(model)).all() == []


@pytest.mark.parametrize(
    "model,date_column",
    [
        (VehicleAvailability, "availability_date"),
        (VehicleFuelUsage, "usage_date"),
    ],
)
def test_daily_keys_support_vehicle_and_date_lookups(database, model, date_column):
    inspector = inspect(database)
    (unique,) = inspector.get_unique_constraints(model.__tablename__)
    assert unique["column_names"] == ["vehicle_id", date_column]
    (foreign_key,) = inspector.get_foreign_keys(model.__tablename__)
    assert foreign_key["constrained_columns"] == ["vehicle_id"]
    assert foreign_key["referred_table"] == "vehicles"
    assert foreign_key["options"]["ondelete"] == "RESTRICT"
    columns = {column["name"]: column for column in inspector.get_columns(model.__tablename__)}
    assert all(not column["nullable"] for column in columns.values())
    for field in (
        "vehicle_id",
        date_column,
        "is_available" if model is VehicleAvailability else "fuel_used_l",
    ):
        assert columns[field]["default"] is None


@pytest.mark.parametrize("available", [True, False])
def test_explicit_availability_zero_fuel_and_creation_defaults(database, vehicle_id, available):
    with Session(database) as db:
        assert db.scalars(select(VehicleAvailability)).all() == []
        assert db.scalars(select(VehicleFuelUsage)).all() == []
        availability = daily_record(VehicleAvailability, vehicle_id, is_available=available)
        usage = daily_record(VehicleFuelUsage, vehicle_id, fuel_used_l=Decimal("0"))
        db.add_all([availability, usage])
        db.commit()
        assert availability.id != usage.id
        assert availability.vehicle.id == usage.vehicle.id == vehicle_id
        assert availability.availability_date == usage.usage_date == DAY
        assert availability.is_available is available
        assert usage.fuel_used_l == Decimal("0.000")
        for record in (availability, usage):
            assert record.created_at is not None
            if database.dialect.name == "postgresql":
                assert record.created_at.utcoffset() is not None


@pytest.mark.parametrize("model", DAILY_MODELS)
def test_duplicate_vehicle_and_day_are_rejected(database, vehicle_id, model):
    with Session(database) as db:
        db.add(daily_record(model, vehicle_id))
        db.commit()
        db.add(daily_record(model, vehicle_id))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        assert len(db.scalars(select(model)).all()) == 1


@pytest.mark.parametrize(
    "model,date_column",
    [
        (VehicleAvailability, "availability_date"),
        (VehicleFuelUsage, "usage_date"),
    ],
)
def test_other_days_and_vehicles_are_independent(database, vehicle_id, model, date_column):
    with Session(database) as db:
        second = make_vehicle(Depot(name="Other depot"))
        db.add(second)
        db.flush()
        db.add_all(
            [
                daily_record(model, vehicle_id),
                daily_record(model, vehicle_id, **{date_column: DAY + timedelta(days=1)}),
                daily_record(model, second.id),
            ]
        )
        db.commit()
        assert len(db.scalars(select(model)).all()) == 3


@pytest.mark.parametrize(
    "model,field",
    [
        (VehicleAvailability, "vehicle_id"),
        (VehicleAvailability, "availability_date"),
        (VehicleAvailability, "is_available"),
        (VehicleFuelUsage, "vehicle_id"),
        (VehicleFuelUsage, "usage_date"),
        (VehicleFuelUsage, "fuel_used_l"),
    ],
)
@pytest.mark.parametrize("omit", [False, True])
def test_required_inputs_have_no_implicit_defaults(database, vehicle_id, model, field, omit):
    values = {"id": uuid4(), "vehicle_id": vehicle_id}
    if model is VehicleAvailability:
        values.update(availability_date=DAY, is_available=True)
    else:
        values.update(usage_date=DAY, fuel_used_l=Decimal("1.234"))
    if omit:
        del values[field]
    else:
        values[field] = None
    with Session(database) as db, pytest.raises(IntegrityError):
        db.execute(model.__table__.insert().values(**values))
        db.commit()


def test_database_rejects_invalid_boolean_without_orm_coercion(database, vehicle_id):
    with Session(database) as db, pytest.raises((IntegrityError, DataError)):
        db.execute(
            text(
                "INSERT INTO vehicle_availability "
                "(id, vehicle_id, availability_date, is_available) "
                "VALUES (:id, :vehicle_id, '2026-10-05', 'not-a-boolean')"
            ),
            {"id": uuid4().hex, "vehicle_id": vehicle_id.hex},
        )
        db.commit()


@pytest.mark.parametrize(
    "amount",
    [
        Decimal("-0.001"),
        Decimal("1000000000"),
        Decimal("NaN"),
        Decimal("Infinity"),
        Decimal("-Infinity"),
    ],
)
def test_invalid_fuel_amounts_are_rejected(database, vehicle_id, amount):
    with Session(database) as db:
        db.add(daily_record(VehicleFuelUsage, vehicle_id, fuel_used_l=amount))
        with pytest.raises((IntegrityError, DataError)):
            db.commit()


def test_daily_fuel_replaces_total_and_can_record_historical_quota_overrun(database, vehicle_id):
    with Session(database) as db:
        usage = daily_record(VehicleFuelUsage, vehicle_id)
        db.add(usage)
        db.commit()
        assert usage.fuel_used_l == Decimal("12.345")
        # Storage must not hide real consumption just because the quota was exceeded.
        usage.fuel_used_l = Decimal("999999999.999")
        db.commit()
        db.expire_all()
        assert usage.fuel_used_l == Decimal("999999999.999")
        assert usage.fuel_used_l > usage.vehicle.weekly_fuel_quota_l
        assert len(db.scalars(select(VehicleFuelUsage)).all()) == 1


@pytest.mark.parametrize("model", DAILY_MODELS)
def test_unknown_vehicle_is_rejected(database, model):
    with Session(database) as db:
        db.add(daily_record(model, uuid4()))
        with pytest.raises(IntegrityError):
            db.commit()


@pytest.mark.parametrize("model", DAILY_MODELS)
@pytest.mark.parametrize("operation", ["orm_delete", "sql_delete", "parent_id_update"])
def test_referenced_vehicle_is_protected_even_with_loaded_relationship(
    database,
    vehicle_id,
    model,
    operation,
):
    with Session(database) as db:
        record = daily_record(model, vehicle_id)
        db.add(record)
        db.commit()
        vehicle = record.vehicle
        with pytest.raises(IntegrityError):
            if operation == "orm_delete":
                db.delete(vehicle)
            elif operation == "sql_delete":
                db.execute(delete(Vehicle).where(Vehicle.id == vehicle_id))
            else:
                db.execute(update(Vehicle).where(Vehicle.id == vehicle_id).values(id=uuid4()))
            db.commit()
        db.rollback()
        assert db.get(Vehicle, vehicle_id) is not None
        assert len(db.scalars(select(model)).all()) == 1


@pytest.mark.parametrize("model", DAILY_MODELS)
def test_deleting_input_does_not_delete_vehicle(database, vehicle_id, model):
    with Session(database) as db:
        record = daily_record(model, vehicle_id)
        db.add(record)
        db.commit()
        db.delete(record)
        db.commit()
        assert db.get(Vehicle, vehicle_id) is not None
        assert db.scalars(select(model)).all() == []


def test_failed_combined_write_rolls_back_both_inputs(database, vehicle_id):
    with Session(database) as db:
        db.add(daily_record(VehicleAvailability, vehicle_id))
        db.flush()
        db.add(daily_record(VehicleFuelUsage, vehicle_id, fuel_used_l=Decimal("-1")))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        assert db.scalars(select(VehicleAvailability)).all() == []
        assert db.scalars(select(VehicleFuelUsage)).all() == []
        assert db.get(Vehicle, vehicle_id) is not None


def test_offline_migration_has_frozen_names_and_changes_only_new_tables():
    config = migration_config()
    config.output_buffer = StringIO()
    command.upgrade(config, f"{PREVIOUS}:{REVISION}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert ddl.count("CREATE TABLE") == 2
    assert "CREATE TABLE vehicle_availability" in ddl
    assert "CREATE TABLE vehicle_fuel_usage" in ddl
    assert "availability_date DATE NOT NULL" in ddl
    assert "is_available BOOLEAN NOT NULL" in ddl
    assert "fuel_used_l NUMERIC(12, 3) NOT NULL" in ddl
    assert ddl.count("TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL") == 2
    assert ddl.count("ON DELETE RESTRICT") == 2
    assert "uq_vehicle_availability_vehicle_date UNIQUE (vehicle_id, availability_date)" in ddl
    assert "uq_vehicle_fuel_usage_vehicle_date UNIQUE (vehicle_id, usage_date)" in ddl
    assert "ck_vehicle_fuel_usage_fuel_used_l_range CHECK" in ddl
    assert "ck_vehicle_fuel_usage_ck_" not in ddl
    assert "ALTER TABLE" not in ddl

    config.output_buffer = StringIO()
    command.downgrade(config, f"{REVISION}:{PREVIOUS}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert ddl.count("DROP TABLE") == 2
    assert "DROP TABLE vehicle_fuel_usage" in ddl
    assert "DROP TABLE vehicle_availability" in ddl
    assert "ALTER TABLE" not in ddl
