"""Exercise HTTP authentication against the real migrated database schema."""

import secrets
from collections.abc import Iterator
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import jwt
import pytest
from alembic import command
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Engine, create_engine, delete, event, select, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from test_identity_schema import migration_config

from app.auth.dependencies import require_roles
from app.auth.models import Role, RoleCode, User, UserRole
from app.auth.security import create_access_token, hash_password
from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.main import create_app

PASSWORD = "Valid test password 🔐 "


@pytest.fixture(scope="module")
def stored_password() -> str:
    return hash_password(PASSWORD)


@pytest.fixture
def engine(tmp_path: Path) -> Iterator[Engine]:
    db = create_engine(f"sqlite:///{(tmp_path / 'auth.sqlite').as_posix()}",
                       connect_args={"check_same_thread": False})

    @event.listens_for(db, "connect")
    def foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")

    with db.connect() as connection:
        command.upgrade(migration_config(connection), "head")
    yield db
    db.dispose()


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, jwt_secret_key=SecretStr(secrets.token_urlsafe(48)),
                    jwt_issuer="waypoint-api", jwt_audience="waypoint-clients",
                    access_token_expire_minutes=30)


@pytest.fixture
def users(engine: Engine, stored_password: str) -> dict[str, UUID]:
    result = {}
    with Session(engine) as db:
        for code in RoleCode:
            role = db.scalars(select(Role).where(Role.code == code)).one()
            user = User(email=f"{code.value.lower()}@example.com", password_hash=stored_password)
            user.role_assignments = [UserRole(role=role)]
            db.add(user)
            db.flush()
            result[code.value] = user.id
        for label, active in [("inactive", False), ("roleless", True)]:
            user = User(
                email=f"{label}@example.com", password_hash=stored_password, is_active=active,
            )
            db.add(user)
            db.flush()
            result[label] = user.id
        db.commit()
    return result


@pytest.fixture
def app(engine: Engine, settings: Settings) -> FastAPI:
    application = create_app()

    def session_override() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    application.dependency_overrides[get_session] = session_override
    application.dependency_overrides[get_settings] = lambda: settings
    for code in RoleCode:
        application.add_api_route(f"/test/{code.value}", lambda: {"ok": True},
                                  dependencies=[Depends(require_roles(code))])
    application.add_api_route(
        "/test/either", lambda: {"ok": True},
        dependencies=[Depends(require_roles(RoleCode.DRIVER, RoleCode.LOADER))],
    )
    return application


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as http:
        yield http


def bearer(user_id: UUID, settings: Settings) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id, settings=settings)}"}


def test_login_and_me_return_safe_user_and_token_fields(client: TestClient, users) -> None:
    response = client.post("/api/v1/auth/login", json={
        "email": "  DRIVER@EXAMPLE.COM ", "password": PASSWORD,
    })
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    payload = response.json()
    assert set(payload) == {"access_token", "token_type", "expires_in", "user"}
    assert payload["token_type"] == "bearer"
    assert payload["expires_in"] == 1800
    assert payload["user"] == {
        "id": str(users["DRIVER"]), "email": "driver@example.com",
        "is_active": True, "roles": ["DRIVER"],
        "outlet_ids": [], "depot_ids": [],
    }
    me = client.get("/api/v1/me", headers={"Authorization": f"Bearer {payload['access_token']}"})
    assert me.status_code == 200
    assert me.json() == payload["user"]
    assert me.headers["cache-control"] == "no-store"
    assert PASSWORD not in response.text
    assert "password_hash" not in response.text


@pytest.mark.parametrize("email,password", [
    ("driver@example.com", "wrong"), ("unknown@example.com", PASSWORD),
    ("inactive@example.com", PASSWORD), ("driver@example.com", PASSWORD.strip()),
])
def test_bad_logins_share_the_same_401(
    client: TestClient, users, email: str, password: str,
) -> None:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or missing credentials"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_unknown_user_still_checks_an_argon2_hash(client: TestClient) -> None:
    with patch("app.auth.service.verify_password", return_value=False) as verify:
        response = client.post("/api/v1/auth/login", json={
            "email": "unknown@example.com", "password": PASSWORD,
        })
    assert response.status_code == 401
    assert verify.call_args.args[0] == PASSWORD
    assert verify.call_args.args[1].startswith("$argon2id$")


@pytest.mark.parametrize("payload", [
    {}, {"email": "invalid", "password": "sensitive-value"},
    {"email": "driver@example.com", "password": "sensitive-value" * 100},
    {"email": "driver@example.com", "password": ""},
    {"email": "driver@example.com", "password": PASSWORD, "roles": ["DISPATCHER"]},
    {"email": "driver@example.com", "password": {"secret": "sensitive-value"}},
])
def test_bad_inputs_return_422_without_echoing_passwords(client: TestClient, payload: dict) -> None:
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 422
    assert "sensitive-value" not in response.text
    assert PASSWORD not in response.text
    assert all(set(error) == {"loc", "msg", "type"} for error in response.json()["detail"])


@pytest.mark.parametrize("header", [None, "Basic abc", "Bearer", "Bearer invalid-token"])
def test_me_requires_valid_bearer_token(client: TestClient, header: str | None) -> None:
    response = client.get("/api/v1/me", headers={"Authorization": header} if header else {})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("role", list(RoleCode))
@pytest.mark.parametrize("allowed", list(RoleCode))
def test_each_role_can_only_enter_its_own_guard(
    client: TestClient, users, settings: Settings, role: RoleCode, allowed: RoleCode,
) -> None:
    response = client.get(f"/test/{allowed.value}", headers=bearer(users[role.value], settings))
    assert response.status_code == (200 if role == allowed else 403)


def test_guard_accepts_any_of_its_allowed_roles(
    client: TestClient, users, settings: Settings,
) -> None:
    for role in ("DRIVER", "LOADER"):
        assert client.get("/test/either", headers=bearer(users[role], settings)).status_code == 200


def test_empty_role_guard_is_a_configuration_error() -> None:
    with pytest.raises(ValueError):
        require_roles()


def test_roleless_user_can_view_self_but_not_protected_data(
    client: TestClient, users, settings: Settings,
) -> None:
    headers = bearer(users["roleless"], settings)
    assert client.get("/api/v1/me", headers=headers).json()["roles"] == []
    assert client.get("/test/DRIVER", headers=headers).status_code == 403


@pytest.mark.parametrize("change", ["deactivate", "delete"])
def test_disabled_or_deleted_user_loses_access_immediately(
    client: TestClient, engine: Engine, users, settings: Settings, change: str,
) -> None:
    headers = bearer(users["DRIVER"], settings)
    assert client.get("/api/v1/me", headers=headers).status_code == 200
    with Session(engine) as db:
        if change == "deactivate":
            db.execute(update(User).where(User.id == users["DRIVER"]).values(is_active=False))
        else:
            db.execute(delete(User).where(User.id == users["DRIVER"]))
        db.commit()
    assert client.get("/api/v1/me", headers=headers).status_code == 401


def test_role_revocation_takes_effect_without_reissuing_token(
    client: TestClient, engine: Engine, users, settings: Settings,
) -> None:
    headers = bearer(users["DRIVER"], settings)
    assert client.get("/test/DRIVER", headers=headers).status_code == 200
    with Session(engine) as db:
        db.execute(delete(UserRole).where(UserRole.user_id == users["DRIVER"]))
        db.commit()
    assert client.get("/test/DRIVER", headers=headers).status_code == 403
    assert client.get("/api/v1/me", headers=headers).json()["roles"] == []


def test_claimed_roles_do_not_override_database_roles(client: TestClient, users, settings) -> None:
    token = create_access_token(users["DRIVER"], settings=settings)
    key = settings.jwt_secret_key.get_secret_value()
    claims = jwt.decode(token, key, algorithms=["HS256"], audience=settings.jwt_audience)
    claims["roles"] = ["DISPATCHER"]
    headers = {"Authorization": f"Bearer {jwt.encode(claims, key, algorithm='HS256')}"}
    assert client.get("/test/DISPATCHER", headers=headers).status_code == 403


def test_unknown_token_subject_is_rejected(client: TestClient, settings: Settings) -> None:
    assert client.get("/api/v1/me", headers=bearer(uuid4(), settings)).status_code == 401


@pytest.mark.parametrize("endpoint", ["login", "me"])
def test_missing_signing_key_returns_generic_503(
    client: TestClient, app: FastAPI, users, settings: Settings, endpoint: str,
) -> None:
    app.dependency_overrides[get_settings] = lambda: settings.model_copy(
        update={"jwt_secret_key": None},
    )
    if endpoint == "login":
        response = client.post("/api/v1/auth/login", json={
            "email": "driver@example.com", "password": PASSWORD,
        })
    else:
        response = client.get("/api/v1/me", headers=bearer(users["DRIVER"], settings))
    assert response.status_code == 503
    assert response.json() == {"detail": "Authentication unavailable"}


@pytest.mark.parametrize("endpoint", ["login", "me"])
def test_database_failures_return_generic_503(
    client: TestClient, app: FastAPI, settings: Settings, endpoint: str,
) -> None:
    broken = MagicMock(spec=Session)
    broken.scalars.side_effect = OperationalError("secret-database-url", {}, Exception())
    app.dependency_overrides[get_session] = lambda: broken
    if endpoint == "login":
        response = client.post("/api/v1/auth/login", json={
            "email": "a@example.com", "password": PASSWORD,
        })
    else:
        response = client.get("/api/v1/me", headers=bearer(uuid4(), settings))
    assert response.status_code == 503
    assert response.json() == {"detail": "Authentication unavailable"}
    assert "secret-database-url" not in response.text


def test_openapi_describes_login_and_bearer_auth(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    assert "/api/v1/auth/login" in schema["paths"]
    assert schema["paths"]["/api/v1/me"]["get"]["security"] == [{"HTTPBearer": []}]
    assert schema["components"]["schemas"]["LoginRequest"]["properties"]["password"]["writeOnly"]
