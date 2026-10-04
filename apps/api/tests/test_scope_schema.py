"""Verify scope migration, referential integrity and preservation of existing data."""

from io import StringIO
from uuid import uuid4

import pytest
from alembic import command
from sqlalchemy import delete, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from test_fleet_schema import make_outlet, make_vehicle
from test_identity_schema import database as database
from test_identity_schema import migration_config
from test_order_schema import make_order

from app.db.models import Depot, Order, Outlet, Role, User, UserDepot, UserOutlet, UserRole, Vehicle

PREVIOUS = "0003_orders"
REVISION = "0004_user_scopes"


def snapshot(connection):
    return {
        model.__tablename__: [tuple(row) for row in connection.execute(
            select(model.__table__).order_by(*model.__table__.primary_key.columns)
        )]
        for model in (User, Role, UserRole, Depot, Outlet, Vehicle, Order)
    }


def test_migration_preserves_all_existing_data_and_starts_with_no_grants(database) -> None:
    config = migration_config(database)
    command.downgrade(config, PREVIOUS)
    with Session(database) as db:
        user = User(email="existing@example.com", password_hash="existing-hash")
        user.role_assignments = [UserRole(role=db.scalars(select(Role)).first())]
        depot = Depot(name="Existing Depot")
        outlet = make_outlet(depot)
        db.add_all([user, make_order(outlet), make_vehicle(depot)])
        db.commit()
        user_id, depot_id, outlet_id = user.id, depot.id, outlet.id
    original = snapshot(database)
    database.commit()
    command.upgrade(config, REVISION)
    assert snapshot(database) == original
    assert database.execute(select(UserOutlet)).all() == []
    assert database.execute(select(UserDepot)).all() == []
    database.commit()
    with Session(database) as db:
        db.add_all([UserOutlet(user_id=user_id, outlet_id=outlet_id),
                    UserDepot(user_id=user_id, depot_id=depot_id)])
        db.commit()
    database.commit()
    command.upgrade(config, REVISION)
    assert len(database.execute(select(UserOutlet)).all()) == 1
    assert len(database.execute(select(UserDepot)).all()) == 1
    database.commit()
    command.downgrade(config, PREVIOUS)
    assert "user_outlets" not in inspect(database).get_table_names()
    assert "user_depots" not in inspect(database).get_table_names()
    assert snapshot(database) == original
    database.commit()
    command.upgrade(config, REVISION)
    assert snapshot(database) == original
    assert database.execute(select(UserOutlet)).all() == []
    assert database.execute(select(UserDepot)).all() == []


@pytest.fixture
def assigned(database):
    with Session(database) as db:
        user = User(email="scoped@example.com", password_hash="test-hash")
        depot = Depot(name="Assigned Depot")
        outlet = make_outlet(depot)
        user.outlet_assignments = [UserOutlet(outlet=outlet)]
        user.depot_assignments = [UserDepot(depot=depot)]
        db.add(user)
        db.commit()
        return user.id, outlet.id, depot.id


def test_users_can_have_multiple_assignments_and_share_a_resource(database, assigned) -> None:
    user_id, outlet_id, depot_id = assigned
    with Session(database) as db:
        first = db.get(User, user_id)
        second = User(email="second@example.com", password_hash="test-hash")
        second.outlet_assignments = [UserOutlet(outlet_id=outlet_id)]
        second.depot_assignments = [UserDepot(depot_id=depot_id)]
        another_depot = Depot(name="Another Depot")
        first.outlet_assignments.append(UserOutlet(outlet=make_outlet(another_depot)))
        first.depot_assignments.append(UserDepot(depot=another_depot))
        db.add(second)
        db.commit()
        assert len(first.outlet_assignments) == 2
        assert len(first.depot_assignments) == 2
        assert len(second.outlet_assignments) == 1
        assert len(second.depot_assignments) == 1


@pytest.mark.parametrize("kind", ["outlet", "depot"])
def test_duplicate_assignments_are_rejected(database, assigned, kind) -> None:
    user_id, outlet_id, depot_id = assigned
    with Session(database) as db:
        db.add(UserOutlet(user_id=user_id, outlet_id=outlet_id) if kind == "outlet"
               else UserDepot(user_id=user_id, depot_id=depot_id))
        with pytest.raises(IntegrityError):
            db.commit()


@pytest.mark.parametrize("kind", ["outlet", "depot"])
@pytest.mark.parametrize("missing", ["user", "resource"])
def test_orphan_assignments_are_rejected(database, assigned, kind, missing) -> None:
    user_id, outlet_id, depot_id = assigned
    if missing == "user":
        user_id = uuid4()
    else:
        outlet_id = depot_id = uuid4()
    with Session(database) as db:
        db.add(UserOutlet(user_id=user_id, outlet_id=outlet_id) if kind == "outlet"
               else UserDepot(user_id=user_id, depot_id=depot_id))
        with pytest.raises(IntegrityError):
            db.commit()


@pytest.mark.parametrize("mode", ["sql", "orm", "orm_loaded"])
def test_deleting_user_removes_grants_and_preserves_resources(database, assigned, mode) -> None:
    user_id, outlet_id, depot_id = assigned
    with Session(database) as db:
        if mode == "sql":
            db.execute(delete(User).where(User.id == user_id))
        else:
            user = db.get(User, user_id)
            if mode == "orm_loaded":
                assert user.outlet_assignments and user.depot_assignments
            db.delete(user)
        db.commit()
        assert db.scalars(select(UserOutlet)).all() == []
        assert db.scalars(select(UserDepot)).all() == []
        assert db.get(Outlet, outlet_id) is not None
        assert db.get(Depot, depot_id) is not None


def test_deleting_outlet_revokes_its_grants_but_preserves_users(database, assigned) -> None:
    user_id, outlet_id, depot_id = assigned
    with Session(database) as db:
        db.execute(delete(Outlet).where(Outlet.id == outlet_id))
        db.commit()
        assert db.scalars(select(UserOutlet)).all() == []
        assert db.get(User, user_id) is not None
        assert db.get(UserDepot, (user_id, depot_id)) is not None


def test_deleting_unused_depot_revokes_only_its_grants(database, assigned) -> None:
    user_id, outlet_id, _ = assigned
    with Session(database) as db:
        empty = Depot(name="Unused Depot")
        db.add(UserDepot(user_id=user_id, depot=empty))
        db.commit()
        empty_id = empty.id
        db.execute(delete(Depot).where(Depot.id == empty_id))
        db.commit()
        assert db.get(UserDepot, (user_id, empty_id)) is None
        assert db.get(UserOutlet, (user_id, outlet_id)) is not None
        assert db.get(User, user_id) is not None


@pytest.mark.parametrize("table,column", [
    ("user_outlets", "outlet_id"), ("user_depots", "depot_id"),
])
def test_scope_indexes_exist(database, table, column) -> None:
    assert {tuple(index["column_names"]) for index in inspect(database).get_indexes(table)} == {
        (column,),
    }


def test_scope_migration_generates_postgresql_upgrade_and_downgrade_sql() -> None:
    config = migration_config()
    config.output_buffer = StringIO()
    command.upgrade(config, f"{PREVIOUS}:{REVISION}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert "CREATE TABLE user_outlets" in ddl
    assert "CREATE TABLE user_depots" in ddl
    assert ddl.count("ON DELETE CASCADE") == 4
    assert "PRIMARY KEY (user_id, outlet_id)" in ddl
    assert "PRIMARY KEY (user_id, depot_id)" in ddl
    assert "CREATE INDEX ix_user_outlets_outlet_id" in ddl
    assert "CREATE INDEX ix_user_depots_depot_id" in ddl
    assert "ALTER TABLE users" not in ddl
    config.output_buffer = StringIO()
    command.downgrade(config, f"{REVISION}:{PREVIOUS}", sql=True)
    ddl = config.output_buffer.getvalue()
    assert "DROP TABLE user_outlets" in ddl
    assert "DROP TABLE user_depots" in ddl
    assert "DROP TABLE users" not in ddl
    assert "DROP TABLE orders" not in ddl
