"""Verify repeatable account creation, rollback and login using the seeded users."""

import subprocess
import sys
import warnings
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from sqlalchemy import Engine, delete, event, func, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session
from test_auth_api import app as app
from test_auth_api import client as client
from test_auth_api import engine as engine
from test_auth_api import settings as settings

from app.auth import seed
from app.auth.models import Role, RoleCode, User, UserRole
from app.auth.security import hash_password, verify_password

PASSWORD = "Only for isolated seed tests 🔐 "


@pytest.fixture
def seeded(engine: Engine) -> seed.SeedResult:
    with Session(engine) as db:
        return seed.seed_demo_users(db, PASSWORD, app_env="test")


def test_creates_only_four_users_with_correct_roles_and_salted_passwords(engine, seeded) -> None:
    assert seeded.created == tuple(email for email, _ in seed.DEMO_ACCOUNTS)
    assert seeded.existing == ()
    with Session(engine) as db:
        users = {user.email: user for user in db.scalars(select(User))}
        assert len(users) == 4
        assert db.scalar(select(func.count()).select_from(UserRole)) == 4
        assert len({user.password_hash for user in users.values()}) == 4
        for email, code in seed.DEMO_ACCOUNTS:
            user = users[email]
            assert user.id is not None and user.is_active
            assert user.password_hash != PASSWORD
            assert verify_password(PASSWORD, user.password_hash)
            assert [assignment.role.code for assignment in user.role_assignments] == [code]


@pytest.mark.parametrize("email,code", seed.DEMO_ACCOUNTS)
def test_each_seeded_account_can_log_in_and_pass_only_its_role(client, seeded, email, code) -> None:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["roles"] == [code]
    headers = {"Authorization": f"Bearer {payload['access_token']}"}
    me = client.get("/api/v1/me", headers=headers)
    assert me.status_code == 200
    assert me.json() == payload["user"]
    for other in RoleCode:
        guarded = client.get(f"/test/{other.value}", headers=headers)
        assert guarded.status_code == (200 if other == code else 403)


def test_rerun_preserves_ids_passwords_disabled_state_and_changed_roles(engine, seeded) -> None:
    with Session(engine) as db:
        driver = db.scalars(select(User).where(User.email == "driver@waypoint.demo")).one()
        driver.is_active = False
        driver.role_assignments.clear()
        db.add(User(email="unrelated@example.com", password_hash=hash_password(PASSWORD)))
        db.commit()
        before = {user.email: (user.id, user.password_hash, user.is_active)
                  for user in db.scalars(select(User))}
    with Session(engine) as db:
        result = seed.seed_demo_users(db, "A different password on rerun", app_env="test")
    assert result.created == ()
    assert result.existing == seeded.created
    with Session(engine) as db:
        after = {user.email: (user.id, user.password_hash, user.is_active)
                 for user in db.scalars(select(User))}
        assert after == before
        driver = db.scalars(select(User).where(User.email == "driver@waypoint.demo")).one()
        assert driver.role_assignments == []
        assert db.scalar(select(func.count()).select_from(UserRole)) == 3


def test_existing_email_does_not_gain_a_role_or_have_its_password_replaced(engine) -> None:
    with Session(engine) as db:
        user = User(
            email="dispatcher@waypoint.demo", password_hash=hash_password("Original password"),
        )
        db.add(user)
        db.commit()
        original_id, original_hash = user.id, user.password_hash
    with Session(engine) as db:
        result = seed.seed_demo_users(db, PASSWORD, app_env="test")
    assert len(result.created) == 3
    assert result.existing == ("dispatcher@waypoint.demo",)
    with Session(engine) as db:
        user = db.get(User, original_id)
        assert user.password_hash == original_hash
        assert user.role_assignments == []


def test_missing_roles_abort_without_creating_users(engine) -> None:
    with Session(engine) as db:
        db.execute(delete(Role).where(Role.code == RoleCode.LOADER))
        db.commit()
    with Session(engine) as db:
        with pytest.raises(seed.DemoSeedError, match="alembic upgrade head"):
            seed.seed_demo_users(db, PASSWORD, app_env="test")
        assert db.scalar(select(func.count()).select_from(User)) == 0


def test_role_insert_failure_rolls_back_all_new_users(engine) -> None:
    def fail_role_insert(connection, cursor, statement, parameters, context, executemany):
        if statement.startswith("INSERT INTO user_roles"):
            raise IntegrityError(statement, parameters, Exception("simulated failure"))

    event.listen(engine, "before_cursor_execute", fail_role_insert)
    try:
        with Session(engine) as db, pytest.raises(IntegrityError):
            seed.seed_demo_users(db, PASSWORD, app_env="test")
    finally:
        event.remove(engine, "before_cursor_execute", fail_role_insert)
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0
        assert db.scalar(select(func.count()).select_from(UserRole)) == 0


@pytest.mark.parametrize("app_env", ["production", "staging", "", "Development"])
def test_non_demo_environments_are_rejected_before_database_access(app_env) -> None:
    db = MagicMock(spec=Session)
    with pytest.raises(seed.DemoSeedError, match="APP_ENV"):
        seed.seed_demo_users(db, PASSWORD, app_env=app_env)
    db.begin.assert_not_called()


@pytest.mark.parametrize("password", ["", " " * 12, "short", "x" * 1025, "\ud800", "🔐" * 257])
def test_invalid_passwords_are_rejected_before_database_access(password) -> None:
    db = MagicMock(spec=Session)
    with pytest.raises(seed.DemoSeedError):
        seed.seed_demo_users(db, password, app_env="test")
    db.begin.assert_not_called()


@pytest.fixture
def cli(monkeypatch, engine, settings) -> None:
    monkeypatch.setattr(seed, "get_engine", lambda: engine)
    monkeypatch.setattr(seed, "get_settings", lambda: settings)
    monkeypatch.setattr(seed, "getpass", lambda prompt: PASSWORD)


def test_cli_requires_explicit_demo_flag() -> None:
    with pytest.raises(SystemExit) as error:
        seed.main([])
    assert error.value.code == 2


def test_cli_reports_created_and_preserved_accounts_without_secrets(cli, capsys) -> None:
    assert seed.main(["--demo"]) == 0
    assert seed.main(["--demo"]) == 0
    output = capsys.readouterr()
    assert "Created 4 demo accounts; preserved 0 existing." in output.out
    assert "Created 0 demo accounts; preserved 4 existing." in output.out
    assert PASSWORD not in output.out + output.err
    assert "$argon2" not in output.out


def test_cli_password_mismatch_does_not_access_database(cli, monkeypatch, capsys) -> None:
    passwords = iter([PASSWORD, "different password"])
    monkeypatch.setattr(seed, "getpass", lambda prompt: next(passwords))
    database = MagicMock()
    monkeypatch.setattr(seed, "get_engine", database)
    assert seed.main(["--demo"]) == 1
    database.assert_not_called()
    assert "Passwords do not match" in capsys.readouterr().err


def test_cli_rejects_production_before_asking_for_password(cli, settings, monkeypatch) -> None:
    monkeypatch.setattr(seed, "get_settings", lambda: settings.model_copy(
        update={"app_env": "production"},
    ))
    prompt = MagicMock()
    monkeypatch.setattr(seed, "getpass", prompt)
    assert seed.main(["--demo"]) == 1
    prompt.assert_not_called()


def test_cli_refuses_insecure_password_prompt(cli, monkeypatch, capsys) -> None:
    def insecure_prompt(prompt):
        warnings.warn("Cannot control echo", seed.GetPassWarning, stacklevel=1)
        return PASSWORD

    monkeypatch.setattr(seed, "getpass", insecure_prompt)
    assert seed.main(["--demo"]) == 1
    assert "interactive terminal" in capsys.readouterr().err


def test_cli_database_error_does_not_print_connection_details(cli, monkeypatch, capsys) -> None:
    monkeypatch.setattr(seed, "get_engine", MagicMock(side_effect=OperationalError(
        "private-database-url", {}, Exception("private-detail"),
    )))
    assert seed.main(["--demo"]) == 1
    output = capsys.readouterr().err
    assert "no changes were committed" in output
    assert "private" not in output


def test_repository_entry_point_works_from_another_directory(tmp_path) -> None:
    script = Path(__file__).resolve().parents[3] / "scripts" / "seed.py"
    result = subprocess.run([sys.executable, str(script), "--help"], cwd=tmp_path,
                            capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    assert "--demo" in result.stdout
