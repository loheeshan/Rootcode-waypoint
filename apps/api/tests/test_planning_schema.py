"""Run the planning migration and verify storage integrity and safe rollback."""

import re
from datetime import UTC, date, datetime, timedelta, timezone
from io import StringIO
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from sqlalchemy import delete, inspect, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from test_fleet_schema import make_outlet, make_vehicle
from test_identity_schema import database as database
from test_identity_schema import migration_config
from test_order_schema import make_order

from app.db.models import (
    Depot,
    Order,
    Outlet,
    Plan,
    PlanRevision,
    Role,
    Trip,
    TripStop,
    User,
    UserDepot,
    UserOutlet,
    UserRole,
    Vehicle,
)
from app.planning.models import PlanStatus, StopStatus, TripStatus

PREVIOUS = "0004_user_scopes"
REVISION = "0005_planning_foundation"
MODELS = (Plan, PlanRevision, Trip, TripStop)
NOW = datetime(2026, 10, 3, 10, tzinfo=UTC)


def make_plan(**overrides):
    values = {"depot": Depot(name="Planning Depot"), "delivery_date": date(2026, 10, 5),
              "creator": User(email=f"planner-{uuid4()}@example.test", password_hash="test-hash")}
    values.update(overrides)
    return Plan(**values)


def make_graph():
    plan = make_plan()
    revision = PlanRevision(plan=plan, revision_number=1)
    trip = Trip(revision=revision, vehicle=make_vehicle(plan.depot), trip_number=1,
                driver=User(email=f"driver-{uuid4()}@example.test", password_hash="test-hash"))
    TripStop(trip=trip, outlet=make_outlet(plan.depot), sequence_number=1)
    return plan


@pytest.fixture
def graph(database):
    with Session(database) as db:
        plan = make_graph()
        db.add(plan)
        db.commit()
        revision = plan.revisions[0]
        trip = revision.trips[0]
        stop = trip.stops[0]
        return {Plan: plan.id, PlanRevision: revision.id, Trip: trip.id, TripStop: stop.id,
                Depot: plan.depot_id, User: plan.created_by, Vehicle: trip.vehicle_id,
                Outlet: stop.outlet_id, "driver": trip.driver_id}


def old_data_snapshot(connection):
    return {
        model.__tablename__: [tuple(row) for row in connection.execute(
            select(model.__table__).order_by(*model.__table__.primary_key.columns)
        )]
        for model in (User, Role, UserRole, Depot, Outlet, Vehicle, Order, UserDepot, UserOutlet)
    }


def test_migration_preserves_all_nine_existing_tables_and_rolls_back_only_planning(database):
    config = migration_config(database)
    command.downgrade(config, PREVIOUS)
    with Session(database) as db:
        user = User(email="existing@example.test", password_hash="existing-hash")
        user.role_assignments = [UserRole(role=db.scalars(select(Role)).first())]
        depot = Depot(name="Existing Depot")
        outlet = make_outlet(depot)
        user.depot_assignments = [UserDepot(depot=depot)]
        user.outlet_assignments = [UserOutlet(outlet=outlet)]
        db.add_all([user, make_vehicle(depot), make_order(outlet)])
        db.commit()
        user_id, depot_id, outlet_id = user.id, depot.id, outlet.id
    original = old_data_snapshot(database)
    database.commit()
    command.upgrade(config, REVISION)
    for model in MODELS:
        assert database.execute(select(model)).all() == []
    assert old_data_snapshot(database) == original
    database.commit()
    with Session(database) as db:
        plan = Plan(depot_id=depot_id, created_by=user_id, delivery_date=date(2026, 10, 5))
        revision = PlanRevision(plan=plan, revision_number=1)
        trip = Trip(revision=revision, vehicle=db.scalars(select(Vehicle)).one(), trip_number=1)
        db.add(TripStop(trip=trip, outlet_id=outlet_id, sequence_number=1))
        db.commit()
    database.commit()
    command.upgrade(config, REVISION)
    assert len(database.execute(select(TripStop)).all()) == 1
    database.commit()
    command.downgrade(config, PREVIOUS)
    assert set(inspect(database).get_table_names()) == {*original, "alembic_version"}
    assert old_data_snapshot(database) == original
    database.commit()
    command.upgrade(config, REVISION)
    assert old_data_snapshot(database) == original
    for model in MODELS:
        assert database.execute(select(model)).all() == []


def test_defaults_relationships_and_optional_assignment_arrival(database):
    with Session(database) as db:
        plan = make_graph()
        trip = plan.revisions[0].trips[0]
        trip.driver = None
        db.add(plan)
        db.commit()
        assert plan.status == PlanStatus.DRAFT
        assert plan.created_at is not None
        assert plan.revisions[0].status == PlanStatus.DRAFT
        assert plan.revisions[0].published_at is None
        assert trip.status == TripStatus.PLANNED
        assert trip.driver_id is None
        assert trip.stops[0].status == StopStatus.PLANNED
        assert trip.stops[0].planned_arrival_time is None
        assert trip.stops[0].outlet.depot_id == plan.depot_id
        assert trip.vehicle.depot_id == plan.depot_id
        assert all(isinstance(entity.id, type(uuid4())) for entity in
                   (plan, plan.revisions[0], trip, trip.stops[0]))


def test_one_plan_per_depot_date_but_other_days_and_depots_allowed(database, graph):
    with Session(database) as db:
        plan = db.get(Plan, graph[Plan])
        db.add_all([
            Plan(depot=plan.depot, creator=plan.creator, delivery_date=date(2026, 10, 6)),
            make_plan(creator=plan.creator, delivery_date=plan.delivery_date),
        ])
        db.commit()
        db.add(Plan(depot=plan.depot, creator=plan.creator, delivery_date=plan.delivery_date))
        with pytest.raises(IntegrityError):
            db.commit()


def test_revisions_allow_alternatives_without_duplicate_numbers(database, graph):
    with Session(database) as db:
        second = PlanRevision(plan_id=graph[Plan], revision_number=2)
        db.add(Trip(revision=second, vehicle_id=graph[Vehicle], trip_number=1))
        db.commit()
        db.add(PlanRevision(plan_id=graph[Plan], revision_number=2))
        with pytest.raises(IntegrityError):
            db.commit()


def test_two_trip_slots_per_vehicle_revision_and_other_vehicles_allowed(database, graph):
    with Session(database) as db:
        db.add_all([
            Trip(plan_revision_id=graph[PlanRevision], vehicle_id=graph[Vehicle], trip_number=2),
            Trip(plan_revision_id=graph[PlanRevision], trip_number=1,
                 vehicle=make_vehicle(db.get(Depot, graph[Depot]))),
        ])
        db.commit()
        db.add(Trip(plan_revision_id=graph[PlanRevision], vehicle_id=graph[Vehicle], trip_number=2))
        with pytest.raises(IntegrityError):
            db.commit()


@pytest.mark.parametrize("duplicate", ["sequence", "outlet"])
def test_trip_stops_require_distinct_sequence_and_outlet(database, graph, duplicate):
    with Session(database) as db:
        outlet = (db.get(Outlet, graph[Outlet]) if duplicate == "outlet"
                  else make_outlet(db.get(Depot, graph[Depot])))
        db.add(TripStop(trip_id=graph[Trip], outlet=outlet,
                        sequence_number=1 if duplicate == "sequence" else 2))
        with pytest.raises(IntegrityError):
            db.commit()


def test_same_outlet_can_appear_in_another_trip(database, graph):
    with Session(database) as db:
        trip = Trip(plan_revision_id=graph[PlanRevision], vehicle_id=graph[Vehicle], trip_number=2)
        db.add(TripStop(trip=trip, outlet_id=graph[Outlet], sequence_number=1))
        db.commit()


@pytest.mark.parametrize("model,field,value", [
    (PlanRevision, "revision_number", 0), (PlanRevision, "revision_number", -1),
    (Trip, "trip_number", 0), (Trip, "trip_number", 3),
    (TripStop, "sequence_number", 0), (TripStop, "sequence_number", -1),
    (Plan, "status", "UNKNOWN"), (PlanRevision, "status", "UNKNOWN"),
    (Trip, "status", "DELIVERED"), (TripStop, "status", "COMPLETED"),
])
def test_invalid_numbers_and_statuses_are_rejected(database, graph, model, field, value):
    with Session(database) as db, pytest.raises(IntegrityError):
        db.execute(update(model).where(model.id == graph[model]).values(**{field: value}))
        db.commit()


@pytest.mark.parametrize("model,field", [
    (Plan, "depot_id"), (Plan, "created_by"), (PlanRevision, "plan_id"),
    (Trip, "plan_revision_id"), (Trip, "vehicle_id"), (Trip, "driver_id"),
    (TripStop, "trip_id"), (TripStop, "outlet_id"),
])
def test_missing_parent_references_are_rejected(database, graph, model, field):
    with Session(database) as db, pytest.raises(IntegrityError):
        db.execute(update(model).where(model.id == graph[model]).values(**{field: uuid4()}))
        db.commit()


@pytest.mark.parametrize("model,field", [
    (Plan, "depot_id"), (Plan, "delivery_date"), (Plan, "created_by"),
    (Plan, "created_at"), (Plan, "status"),
    (PlanRevision, "plan_id"), (PlanRevision, "revision_number"), (PlanRevision, "status"),
    (Trip, "plan_revision_id"), (Trip, "vehicle_id"), (Trip, "trip_number"), (Trip, "status"),
    (TripStop, "trip_id"), (TripStop, "outlet_id"),
    (TripStop, "sequence_number"), (TripStop, "status"),
])
def test_required_fields_reject_explicit_null(database, graph, model, field):
    with Session(database) as db, pytest.raises(IntegrityError):
        db.execute(update(model).where(model.id == graph[model]).values(**{field: None}))
        db.commit()


@pytest.mark.parametrize("status,published_at", [("DRAFT", NOW), ("PUBLISHED", None)])
def test_publication_status_and_timestamp_must_agree(database, graph, status, published_at):
    with Session(database) as db, pytest.raises(IntegrityError):
        db.execute(update(PlanRevision).where(PlanRevision.id == graph[PlanRevision])
                   .values(status=status, published_at=published_at))
        db.commit()


def test_supported_statuses_and_aware_timestamps_round_trip(database, graph):
    with Session(database) as db:
        plan = db.get(Plan, graph[Plan])
        revision = db.get(PlanRevision, graph[PlanRevision])
        trip = db.get(Trip, graph[Trip])
        stop = db.get(TripStop, graph[TripStop])
        for status in PlanStatus:
            plan.status = revision.status = status
            revision.published_at = NOW if status == PlanStatus.PUBLISHED else None
            db.commit()
        for status in TripStatus:
            trip.status = status
            db.commit()
        for status in StopStatus:
            stop.status = status
            db.commit()
        colombo = timezone(timedelta(hours=5, minutes=30))
        stop.planned_arrival_time = datetime(2026, 10, 5, 9, tzinfo=colombo)
        db.commit()
        db.expire_all()
        if database.dialect.name == "postgresql":
            assert plan.created_at.utcoffset() is not None
            assert revision.published_at == NOW
            assert stop.planned_arrival_time == datetime(2026, 10, 5, 3, 30, tzinfo=UTC)
        else:
            # SQLite loses timezone metadata; production uses PostgreSQL timestamptz.
            assert stop.planned_arrival_time.hour == 9


@pytest.mark.parametrize("model,children", [(Plan, "revisions"), (PlanRevision, "trips"),
                                            (Trip, "stops")])
@pytest.mark.parametrize("mode", ["sql", "orm", "orm_loaded"])
def test_parent_deletion_never_cascades_or_nulls_children(database, graph, model, children, mode):
    with Session(database) as db:
        with pytest.raises(IntegrityError):
            if mode == "sql":
                db.execute(delete(model).where(model.id == graph[model]))
            else:
                parent = db.get(model, graph[model])
                if mode == "orm_loaded":
                    assert getattr(parent, children)
                db.delete(parent)
            db.commit()
        db.rollback()
        for existing in MODELS:
            assert db.get(existing, graph[existing]) is not None


@pytest.mark.parametrize("model,key", [(User, User), (User, "driver"),
                                       (Vehicle, Vehicle), (Outlet, Outlet)])
def test_referenced_master_records_cannot_be_deleted(database, graph, model, key):
    with Session(database) as db, pytest.raises(IntegrityError):
        db.execute(delete(model).where(model.id == graph[key]))
        db.commit()


def test_empty_plan_still_protects_its_depot_and_creator(database):
    with Session(database) as db:
        plan = make_plan()
        db.add(plan)
        db.commit()
        for model, identifier in ((Depot, plan.depot_id), (User, plan.created_by)):
            with pytest.raises(IntegrityError):
                db.execute(delete(model).where(model.id == identifier))
                db.commit()
            db.rollback()
        assert db.get(Plan, plan.id) is not None


def test_deleting_children_in_order_preserves_master_data(database, graph):
    with Session(database) as db:
        for model in reversed(MODELS):
            db.execute(delete(model).where(model.id == graph[model]))
        db.commit()
        for model in (Depot, User, Vehicle, Outlet):
            assert db.get(model, graph[model]) is not None
        assert db.get(User, graph["driver"]) is not None


def test_every_foreign_key_has_a_leading_index_and_restrict_delete(database):
    inspector = inspect(database)
    for model in MODELS:
        table = model.__tablename__
        indexes = [index["column_names"] for index in inspector.get_indexes(table)]
        indexes += [unique["column_names"] for unique in inspector.get_unique_constraints(table)]
        for foreign_key in inspector.get_foreign_keys(table):
            assert foreign_key["options"]["ondelete"] == "RESTRICT"
            column = foreign_key["constrained_columns"][0]
            assert any(columns[0] == column for columns in indexes)


def test_planning_statuses_match_shared_types():
    path = Path(__file__).resolve().parents[3] / "packages/shared-types/src/index.ts"
    contract = path.read_text()
    for label, enum in (("planStatuses", PlanStatus), ("tripStatuses", TripStatus),
                        ("stopStatuses", StopStatus)):
        match = re.search(rf"{label} = \[([^\]]+)\]", contract)
        assert match is not None
        assert re.findall(r"'([^']+)'", match.group(1)) == [status.value for status in enum]


def test_offline_migration_generates_frozen_postgresql_upgrade_and_downgrade():
    config = migration_config()
    config.output_buffer = StringIO()
    command.upgrade(config, f"{PREVIOUS}:{REVISION}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert ddl.count("CREATE TABLE ") == 4
    assert ddl.count("ON DELETE RESTRICT") == 8
    assert "published_at TIMESTAMP WITH TIME ZONE" in ddl
    assert "planned_arrival_time TIMESTAMP WITH TIME ZONE" in ddl
    assert "created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL" in ddl
    assert "UNIQUE (plan_revision_id, vehicle_id, trip_number)" in ddl
    assert "UNIQUE (depot_id, delivery_date)" in ddl
    config.output_buffer = StringIO()
    command.downgrade(config, f"{REVISION}:{PREVIOUS}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert ddl.count("DROP TABLE ") == 4
    assert ddl.index("DROP TABLE trip_stops") < ddl.index("DROP TABLE trips")
    assert ddl.index("DROP TABLE trips") < ddl.index("DROP TABLE plan_revisions")
    assert "DROP TABLE users" not in ddl
    assert "DROP TABLE orders" not in ddl
