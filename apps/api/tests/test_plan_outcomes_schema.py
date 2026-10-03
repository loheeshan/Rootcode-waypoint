"""Order outcome exclusivity, route consistency, reasons and migration preservation."""

import re
from io import StringIO
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from sqlalchemy import delete, inspect, select, update
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session
from test_fleet_schema import make_outlet
from test_identity_schema import database as database
from test_identity_schema import migration_config
from test_order_schema import make_order
from test_planning_schema import make_graph

from app.db.models import (
    DeferralDecision,
    Depot,
    Order,
    Outlet,
    Plan,
    PlanAssignment,
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
from app.planning.assignment_models import AssignmentOutcome, DeferralReason

PREVIOUS = "0005_planning_foundation"
REVISION = "0006_plan_outcomes"
PARENT_INDEXES = {"orders": "uq_orders_id_outlet", "trips": "uq_trips_id_revision",
                  "trip_stops": "uq_trip_stops_id_trip_outlet"}


@pytest.fixture
def resources(database):
    with Session(database) as db:
        plan = make_graph()
        first_revision = plan.revisions[0]
        trip = first_revision.trips[0]
        stop = trip.stops[0]
        order = make_order(stop.outlet)
        other_outlet = make_outlet(plan.depot)
        other_order = make_order(other_outlet)
        other_trip = Trip(revision=first_revision, vehicle=trip.vehicle, trip_number=2)
        other_stop = TripStop(trip=other_trip, outlet=other_outlet, sequence_number=1)
        next_revision = PlanRevision(plan=plan, revision_number=2)
        next_trip = Trip(revision=next_revision, vehicle=trip.vehicle, trip_number=1)
        next_stop = TripStop(trip=next_trip, outlet=stop.outlet, sequence_number=1)
        db.add_all([plan, order, other_order])
        db.commit()
        return {"revision": first_revision.id, "trip": trip.id, "stop": stop.id,
                "order": order.id, "outlet": stop.outlet_id,
                "other_trip": other_trip.id, "other_stop": other_stop.id,
                "other_order": other_order.id, "other_outlet": other_outlet.id,
                "next_revision": next_revision.id, "next_trip": next_trip.id,
                "next_stop": next_stop.id}


def served(resources, **changes):
    values = {"plan_revision_id": resources["revision"], "order_id": resources["order"],
              "outlet_id": resources["outlet"], "outcome": "SERVED",
              "trip_id": resources["trip"], "trip_stop_id": resources["stop"]}
    values.update(changes)
    return PlanAssignment(**values)


def deferred(resources, **changes):
    return served(resources, **{"outcome": "DEFERRED", "trip_id": None, "trip_stop_id": None,
                                **changes})


def reason(**changes):
    values = {"reason_code": "WEIGHT_CAPACITY",
              "reason_text": "The vehicle weight limit is reached."}
    values.update(changes)
    return DeferralDecision(**values)


def snapshot(connection):
    return {
        model.__tablename__: [tuple(row) for row in connection.execute(
            select(model.__table__).order_by(*model.__table__.primary_key.columns)
        )]
        for model in (User, Role, UserRole, Depot, Outlet, Vehicle, Order, UserDepot,
                      UserOutlet, Plan, PlanRevision, Trip, TripStop)
    }


def test_migration_preserves_all_thirteen_tables_and_downgrade_removes_only_new_storage(database):
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
        db.commit()
        identifiers = {"revision": plan.revisions[0].id, "order": order.id,
                       "outlet": order.outlet_id}
    original = snapshot(database)
    original_indexes = {table: inspect(database).get_indexes(table) for table in PARENT_INDEXES}
    database.commit()
    command.upgrade(config, REVISION)
    assert snapshot(database) == original
    assert database.execute(select(PlanAssignment)).all() == []
    assert database.execute(select(DeferralDecision)).all() == []
    database.commit()
    with Session(database) as db:
        assignment = PlanAssignment(plan_revision_id=identifiers["revision"],
                                    order_id=identifiers["order"], outlet_id=identifiers["outlet"],
                                    outcome="DEFERRED", deferral=reason())
        db.add(assignment)
        db.commit()
    database.commit()
    command.upgrade(config, REVISION)
    assert len(database.execute(select(DeferralDecision)).all()) == 1
    database.commit()
    command.downgrade(config, PREVIOUS)
    assert set(inspect(database).get_table_names()) == {*original, "alembic_version"}
    assert snapshot(database) == original
    for table, indexes in original_indexes.items():
        assert inspect(database).get_indexes(table) == indexes
    database.commit()
    command.upgrade(config, REVISION)
    assert snapshot(database) == original
    assert database.execute(select(PlanAssignment)).all() == []
    assert database.execute(select(DeferralDecision)).all() == []


def test_served_orders_share_a_stop_and_deferral_reason_does_not_change_order_status(
    database, resources,
):
    with Session(database) as db:
        another_order = make_order(outlet_id=resources["outlet"])
        db.add(another_order)
        db.flush()
        first = served(resources)
        second = served(resources, order_id=another_order.id)
        waiting = deferred(resources, order_id=resources["other_order"],
                           outlet_id=resources["other_outlet"], deferral=reason())
        db.add_all([first, second, waiting])
        db.commit()
        db.expire_all()
        assert first.stop.id == second.stop.id == resources["stop"]
        assert first.trip.id == resources["trip"]
        assert first.order.id == resources["order"]
        assert first.revision.id == resources["revision"]
        assert first.deferral is None
        assert waiting.trip is None and waiting.stop is None
        assert waiting.deferral.assignment is waiting
        assert waiting.deferral.assignment_outcome == "DEFERRED"
        assert waiting.deferral.plan_revision_id == waiting.plan_revision_id
        assert waiting.deferral.order_id == waiting.order_id
        assert first.created_at is not None and waiting.deferral.created_at is not None
        if database.dialect.name == "postgresql":
            assert first.created_at.utcoffset() is not None
            assert waiting.deferral.created_at.utcoffset() is not None
        assert {order.status for order in db.scalars(select(Order))} == {"CONFIRMED"}


@pytest.mark.parametrize("second_outcome", ["SERVED", "DEFERRED"])
def test_an_order_has_only_one_result_per_revision(database, resources, second_outcome):
    with Session(database) as db:
        db.add(served(resources))
        db.commit()
        db.add(served(resources) if second_outcome == "SERVED" else deferred(resources))
        with pytest.raises(IntegrityError):
            db.commit()


def test_alternative_revision_can_give_the_same_order_a_different_outcome(database, resources):
    with Session(database) as db:
        db.add_all([served(resources), deferred(resources,
                    plan_revision_id=resources["next_revision"], deferral=reason())])
        db.commit()
        assert len(db.scalars(select(PlanAssignment)).all()) == 2


@pytest.mark.parametrize("outcome,has_trip,has_stop", [
    ("SERVED", False, False), ("SERVED", True, False), ("SERVED", False, True),
    ("DEFERRED", True, True), ("DEFERRED", True, False), ("DEFERRED", False, True),
    ("UNKNOWN", True, True),
])
def test_incomplete_or_conflicting_route_links_are_rejected(
    database, resources, outcome, has_trip, has_stop,
):
    with Session(database) as db:
        db.add(served(resources, outcome=outcome, trip_id=resources["trip"] if has_trip else None,
                      trip_stop_id=resources["stop"] if has_stop else None))
        with pytest.raises(IntegrityError):
            db.commit()


@pytest.mark.parametrize("changes", [
    {"plan_revision_id": "next_revision"}, {"trip_id": "other_trip"},
    {"trip_stop_id": "next_stop"}, {"trip_stop_id": "other_stop"},
    {"outlet_id": "other_outlet"}, {"order_id": "other_order"},
    {"outlet_id": "other_outlet", "order_id": "other_order"},
    {"trip_id": "next_trip", "trip_stop_id": "next_stop"},
])
def test_valid_ids_cannot_be_combined_across_revision_trip_or_outlet(database, resources, changes):
    with Session(database) as db:
        db.add(served(resources, **{field: resources[key] for field, key in changes.items()}))
        with pytest.raises(IntegrityError):
            db.commit()


@pytest.mark.parametrize("field", ["plan_revision_id", "order_id", "outlet_id",
                                   "trip_id", "trip_stop_id"])
def test_unknown_route_and_order_references_are_rejected(database, resources, field):
    with Session(database) as db:
        db.add(served(resources, **{field: uuid4()}))
        with pytest.raises(IntegrityError):
            db.commit()


@pytest.mark.parametrize("field", ["plan_revision_id", "order_id", "outlet_id", "outcome",
                                   "created_at"])
def test_assignment_required_fields_cannot_be_null(database, resources, field):
    with Session(database) as db:
        assignment = served(resources)
        db.add(assignment)
        db.commit()
        with pytest.raises(IntegrityError):
            db.execute(update(PlanAssignment).where(PlanAssignment.id == assignment.id)
                       .values(**{field: None}))
            db.commit()


@pytest.mark.parametrize("reason_code", list(DeferralReason))
def test_all_documented_deferral_codes_are_stored(database, resources, reason_code):
    with Session(database) as db:
        assignment = deferred(resources, deferral=reason(reason_code=reason_code))
        db.add(assignment)
        db.commit()
        assert assignment.deferral.reason_code == reason_code


@pytest.mark.parametrize("changes", [{"reason_code": "OTHER"}, {"reason_text": ""},
                                     {"reason_text": "   "}, {"reason_text": "\t\n\r "},
                                     {"reason_text": "x" * 1001}])
def test_invalid_reason_codes_and_blank_or_oversize_text_are_rejected(database, resources, changes):
    with Session(database) as db:
        db.add(deferred(resources, deferral=reason(**changes)))
        with pytest.raises((IntegrityError, DataError)):
            db.commit()


def test_reason_text_accepts_the_documented_length_limit(database, resources):
    with Session(database) as db:
        assignment = deferred(resources, deferral=reason(reason_text="x" * 1000))
        db.add(assignment)
        db.commit()
        assert len(assignment.deferral.reason_text) == 1000


@pytest.mark.parametrize("field", ["plan_revision_id", "order_id", "assignment_outcome",
                                   "reason_code", "reason_text", "created_at"])
def test_deferral_required_fields_cannot_be_null(database, resources, field):
    with Session(database) as db:
        assignment = deferred(resources, deferral=reason())
        db.add(assignment)
        db.commit()
        with pytest.raises(IntegrityError):
            db.execute(update(DeferralDecision).where(DeferralDecision.id == assignment.deferral.id)
                       .values(**{field: None}))
            db.commit()


@pytest.mark.parametrize("outcome", ["DEFERRED", "SERVED"])
def test_a_reason_cannot_attach_to_a_served_order_even_with_a_forged_discriminator(
    database, resources, outcome,
):
    with Session(database) as db:
        db.add(served(resources))
        db.commit()
        db.add(reason(plan_revision_id=resources["revision"], order_id=resources["order"],
                      assignment_outcome=outcome))
        with pytest.raises(IntegrityError):
            db.commit()


def test_a_reason_requires_a_matching_deferred_assignment(database, resources):
    with Session(database) as db:
        db.add(reason(plan_revision_id=resources["revision"], order_id=resources["order"]))
        with pytest.raises(IntegrityError):
            db.commit()


def test_reasons_cannot_cross_order_or_revision_boundaries(database, resources):
    with Session(database) as db:
        db.add(deferred(resources))
        db.commit()
        for key in ("order_id", "plan_revision_id"):
            values = {"order_id": resources["order"], "plan_revision_id": resources["revision"]}
            values[key] = resources["other_order" if key == "order_id" else "next_revision"]
            db.add(reason(**values))
            with pytest.raises(IntegrityError):
                db.commit()
            db.rollback()


def test_only_one_primary_reason_is_allowed(database, resources):
    with Session(database) as db:
        db.add(deferred(resources, deferral=reason()))
        db.commit()
        db.add(reason(plan_revision_id=resources["revision"], order_id=resources["order"],
                      reason_code="TRIP_LIMIT"))
        with pytest.raises(IntegrityError):
            db.commit()


def test_deferred_draft_can_temporarily_wait_for_a_reason(database, resources):
    with Session(database) as db:
        assignment = deferred(resources)
        db.add(assignment)
        db.commit()
        assert assignment.deferral is None


@pytest.mark.parametrize("mode", ["sql", "orm", "orm_loaded"])
def test_deferral_prevents_assignment_deletion_including_loaded_orm(database, resources, mode):
    with Session(database) as db:
        assignment = deferred(resources, deferral=reason())
        db.add(assignment)
        db.commit()
        assignment_id = assignment.id
        db.expunge_all()
        with pytest.raises(IntegrityError):
            if mode == "sql":
                db.execute(delete(PlanAssignment).where(PlanAssignment.id == assignment_id))
            else:
                target = db.get(PlanAssignment, assignment_id)
                if mode == "orm_loaded":
                    assert target.deferral
                db.delete(target)
            db.commit()
        db.rollback()
        assert db.get(PlanAssignment, assignment_id).deferral is not None


def test_reason_blocks_switch_to_served_until_explicitly_removed(database, resources):
    with Session(database) as db:
        assignment = deferred(resources, deferral=reason())
        db.add(assignment)
        db.commit()
        with pytest.raises(IntegrityError):
            db.execute(update(PlanAssignment).where(PlanAssignment.id == assignment.id).values(
                outcome="SERVED", trip_id=resources["trip"], trip_stop_id=resources["stop"],
            ))
            db.commit()
        db.rollback()
        db.delete(assignment.deferral)
        db.flush()
        assignment.outcome = "SERVED"
        assignment.trip_id = resources["trip"]
        assignment.trip_stop_id = resources["stop"]
        db.commit()
        assert assignment.deferral is None


@pytest.mark.parametrize("model,key", [(Order, "order"), (TripStop, "stop"), (Trip, "trip"),
                                       (PlanRevision, "revision")])
def test_assigned_parents_cannot_be_deleted(database, resources, model, key):
    with Session(database) as db:
        db.add(served(resources))
        db.commit()
        with pytest.raises(IntegrityError):
            db.execute(delete(model).where(model.id == resources[key]))
            db.commit()


@pytest.mark.parametrize("model,key,field,replacement", [
    (Order, "order", "outlet_id", "other_outlet"),
    (Trip, "trip", "plan_revision_id", "next_revision"),
    (TripStop, "stop", "outlet_id", "other_outlet"),
])
def test_parent_updates_cannot_invalidate_an_existing_assignment(
    database, resources, model, key, field, replacement,
):
    with Session(database) as db:
        db.add(served(resources))
        db.commit()
        with pytest.raises(IntegrityError):
            db.execute(update(model).where(model.id == resources[key])
                       .values(**{field: resources[replacement]}))
            db.commit()


def test_deleting_outcome_preserves_order_trip_and_stop(database, resources):
    with Session(database) as db:
        assignment = served(resources)
        db.add(assignment)
        db.commit()
        db.delete(assignment)
        db.commit()
        for model, key in ((Order, "order"), (Trip, "trip"), (TripStop, "stop")):
            assert db.get(model, resources[key]) is not None


def test_new_foreign_keys_are_indexed_and_restrict_deletion(database):
    inspector = inspect(database)
    for model in (PlanAssignment, DeferralDecision):
        table = model.__tablename__
        indexes = [index["column_names"] for index in inspector.get_indexes(table)]
        indexes += [unique["column_names"] for unique in inspector.get_unique_constraints(table)]
        for key in inspector.get_foreign_keys(table):
            assert key["options"]["ondelete"] == "RESTRICT"
            assert any(columns[0] == key["constrained_columns"][0] for columns in indexes)


def test_outcome_and_reason_codes_match_shared_types_and_supplied_reason_list():
    root = Path(__file__).resolve().parents[3]
    contract = (root / "packages/shared-types/src/index.ts").read_text()
    for name, enum in (("assignmentOutcomes", AssignmentOutcome),
                       ("deferralReasons", DeferralReason)):
        match = re.search(rf"{name} = \[([^\]]+)\]", contract)
        assert match is not None
        assert re.findall(r"'([^']+)'", match.group(1)) == [value.value for value in enum]
    original = (root / "Main/architecture (1).md").read_text(encoding="utf-8")
    reason_block = original.split("Reason codes:", 1)[1].split("```", 2)[1]
    assert reason_block.strip().splitlines()[1:] == [reason.value for reason in DeferralReason]


def test_offline_migration_uses_indexes_and_drops_references_before_parent_indexes():
    config = migration_config()
    config.output_buffer = StringIO()
    command.upgrade(config, f"{PREVIOUS}:{REVISION}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert ddl.count("CREATE TABLE ") == 2
    assert ddl.count("CREATE UNIQUE INDEX ") == 3
    assert ddl.count("ON DELETE RESTRICT") == 5
    assert "FOREIGN KEY(trip_id, plan_revision_id) REFERENCES trips (id, plan_revision_id)" in ddl
    assert "ALTER TABLE orders" not in ddl
    config.output_buffer = StringIO()
    command.downgrade(config, f"{REVISION}:{PREVIOUS}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert ddl.count("DROP TABLE ") == 2
    assert ddl.index("DROP TABLE deferral_decisions") < ddl.index("DROP TABLE plan_assignments")
    assert ddl.index("DROP TABLE plan_assignments") < ddl.index("DROP INDEX uq_orders_id_outlet")
    assert "DROP TABLE orders" not in ddl
    assert "DROP TABLE trips" not in ddl
