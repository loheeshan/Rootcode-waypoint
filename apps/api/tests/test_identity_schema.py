"""Run the actual migration in SQLite; compile PostgreSQL DDL separately.

These are fast schema tests, not a substitute for the PostgreSQL migration smoke check.
"""

from collections.abc import Iterator
from io import StringIO
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import Connection, create_engine, delete, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import RoleCode
from app.db.models import Base, Role, User, UserRole

API_ROOT = Path(__file__).resolve().parents[1]


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
        command.upgrade(migration_config(connection), "head")
        yield connection
    engine.dispose()


def test_migration_matches_models_and_creates_only_roles(database: Connection) -> None:
    with Session(database) as session:
        assert set(session.scalars(select(Role.code))) == {role.value for role in RoleCode}
        assert session.scalars(select(User)).all() == []
    context = MigrationContext.configure(database, opts={"compare_server_default": True})
    assert compare_metadata(context, Base.metadata) == []


def test_upgrade_is_repeatable_and_downgrade_can_be_reapplied(database: Connection) -> None:
    config = migration_config(database)
    command.upgrade(config, "head")
    with Session(database) as session:
        assert len(session.scalars(select(Role)).all()) == 4
    command.downgrade(config, "base")
    assert set(inspect(database).get_table_names()) == {"alembic_version"}
    command.upgrade(config, "head")
    with Session(database) as session:
        assert len(session.scalars(select(Role)).all()) == 4


def test_user_defaults_and_multiple_roles(database: Connection) -> None:
    with Session(database) as session:
        roles = session.scalars(select(Role).where(Role.code.in_(["DRIVER", "LOADER"]))).all()
        user = User(email="operator@example.test", password_hash="not-a-real-password-hash")
        user.role_assignments = [UserRole(role=role) for role in roles]
        session.add(user)
        session.commit()
        assert user.id is not None
        assert user.is_active is True
        assert user.created_at is not None
        assert {assignment.role.code for assignment in user.role_assignments} == {
            "DRIVER", "LOADER"
        }


@pytest.mark.parametrize(
    "email", ["Mixed@example.test", " user@example.test", "user@example.test ", ""]
)
def test_email_must_be_normalized_and_nonempty(database: Connection, email: str) -> None:
    with Session(database) as session:
        session.add(User(email=email, password_hash="test-hash"))
        with pytest.raises(IntegrityError):
            session.commit()


def test_duplicate_email_is_rejected(database: Connection) -> None:
    with Session(database) as session:
        session.add_all(
            [User(email="same@example.test", password_hash="test-hash") for _ in range(2)]
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_empty_password_hash_is_rejected(database: Connection) -> None:
    with Session(database) as session:
        session.add(User(email="operator@example.test", password_hash=""))
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize("code", ["ADMIN", "DRIVER"])
def test_unknown_and_duplicate_roles_are_rejected(database: Connection, code: str) -> None:
    with Session(database) as session:
        session.add(Role(code=code))
        with pytest.raises(IntegrityError):
            session.commit()


def test_duplicate_assignment_is_rejected(database: Connection) -> None:
    with Session(database) as session:
        role = session.scalars(select(Role).where(Role.code == "DRIVER")).one()
        user = User(email="driver@example.test", password_hash="test-hash")
        user.role_assignments = [UserRole(role=role), UserRole(role=role)]
        session.add(user)
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize("missing", ["user", "role"])
def test_orphan_assignments_are_rejected(database: Connection, missing: str) -> None:
    with Session(database) as session:
        role = session.scalars(select(Role).where(Role.code == "DRIVER")).one()
        user = User(email="driver@example.test", password_hash="test-hash")
        session.add(user)
        session.flush()
        session.add(
            UserRole(
                user_id=uuid4() if missing == "user" else user.id,
                role_id=uuid4() if missing == "role" else role.id,
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_user_deletion_removes_assignments_but_keeps_roles(database: Connection) -> None:
    with Session(database) as session:
        role = session.scalars(select(Role).where(Role.code == "DRIVER")).one()
        user = User(email="driver@example.test", password_hash="test-hash")
        user.role_assignments = [UserRole(role=role)]
        session.add(user)
        session.commit()
        session.execute(delete(User).where(User.id == user.id))
        session.commit()
        assert session.scalars(select(UserRole)).all() == []
        assert len(session.scalars(select(Role)).all()) == 4


def test_offline_migration_generates_postgresql_ddl() -> None:
    config = migration_config()
    config.output_buffer = StringIO()
    command.upgrade(config, "head", sql=True)
    ddl = config.output_buffer.getvalue()
    assert "CREATE TABLE users" in ddl
    assert "UUID NOT NULL" in ddl
    assert "TIMESTAMP WITH TIME ZONE" in ddl
    assert "ON DELETE CASCADE" in ddl
    assert "'STORE_MANAGER'" in ddl
