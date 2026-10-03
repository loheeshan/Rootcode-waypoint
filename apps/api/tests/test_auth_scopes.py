"""Exercise role-plus-resource checks across requests and immediate grant revocation."""

from typing import Annotated
from uuid import UUID, uuid4

import jwt
import pytest
from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from test_auth_api import PASSWORD, bearer
from test_auth_api import app as app
from test_auth_api import client as client
from test_auth_api import engine as engine
from test_auth_api import settings as settings
from test_auth_api import stored_password as stored_password
from test_auth_api import users as users
from test_fleet_schema import make_outlet

from app.auth.dependencies import get_current_user
from app.auth.models import RoleCode, User, UserDepot, UserOutlet
from app.auth.scopes import require_depot_access, require_outlet_access
from app.db.models import Depot


@pytest.fixture(autouse=True)
def scope_routes(app: FastAPI) -> None:
    @app.get("/test/outlets/{outlet_id}")
    def outlet(outlet_id: UUID, user: Annotated[User, Depends(get_current_user)]):
        require_outlet_access(user, outlet_id, role=RoleCode.STORE_MANAGER)
        return {"ok": True}

    @app.get("/test/depots/{depot_id}")
    def depot(depot_id: UUID, user: Annotated[User, Depends(get_current_user)]):
        require_depot_access(user, depot_id, role=RoleCode.DISPATCHER)
        return {"ok": True}


@pytest.fixture
def resources(engine, users):
    with Session(engine) as db:
        depots = [Depot(name=f"Depot {index}") for index in range(2)]
        outlets = [make_outlet(depot) for depot in depots]
        db.add_all(outlets)
        db.flush()
        # Assign both resource kinds to all roles so tests require role AND resource.
        for user_id in users.values():
            db.add_all([UserOutlet(user_id=user_id, outlet=outlets[0]),
                        UserDepot(user_id=user_id, depot=depots[0])])
        db.commit()
        return {"outlets": [outlet.id for outlet in outlets],
                "depots": [depot.id for depot in depots]}


@pytest.mark.parametrize("kind,role", [("outlets", "STORE_MANAGER"), ("depots", "DISPATCHER")])
def test_scope_requires_assignment_even_with_the_correct_role(
    client, users, settings, resources, kind, role,
) -> None:
    headers = bearer(users[role], settings)
    assert client.get(f"/test/{kind}/{resources[kind][0]}", headers=headers).status_code == 200
    for resource_id in (resources[kind][1], uuid4()):
        response = client.get(f"/test/{kind}/{resource_id}", headers=headers)
        assert response.status_code == 403
        assert response.json() == {"detail": "Insufficient permissions"}


@pytest.mark.parametrize("kind,required", [("outlets", "STORE_MANAGER"), ("depots", "DISPATCHER")])
@pytest.mark.parametrize("role", list(RoleCode))
def test_resource_assignment_does_not_bypass_required_role(
    client, users, settings, resources, kind, required, role,
) -> None:
    response = client.get(f"/test/{kind}/{resources[kind][0]}",
                          headers=bearer(users[role.value], settings))
    assert response.status_code == (200 if role.value == required else 403)


def test_login_and_me_return_current_sorted_scope_ids(client, engine, users, resources) -> None:
    with Session(engine) as db:
        db.add_all([UserOutlet(user_id=users["STORE_MANAGER"], outlet_id=resources["outlets"][1]),
                    UserDepot(user_id=users["STORE_MANAGER"], depot_id=resources["depots"][1])])
        db.commit()
    login = client.post("/api/v1/auth/login", json={
        "email": "store_manager@example.com", "password": PASSWORD,
    })
    assert login.status_code == 200
    user = login.json()["user"]
    assert user["outlet_ids"] == sorted(str(item) for item in resources["outlets"])
    assert user["depot_ids"] == sorted(str(item) for item in resources["depots"])
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    me = client.get("/api/v1/me", headers=headers)
    assert me.json() == user


@pytest.mark.parametrize("kind,role,model", [
    ("outlets", "STORE_MANAGER", UserOutlet), ("depots", "DISPATCHER", UserDepot),
])
def test_revoked_assignment_loses_access_without_issuing_new_token(
    client, engine, users, settings, resources, kind, role, model,
) -> None:
    headers = bearer(users[role], settings)
    path = f"/test/{kind}/{resources[kind][0]}"
    assert client.get(path, headers=headers).status_code == 200
    with Session(engine) as db:
        db.execute(delete(model).where(model.user_id == users[role]))
        db.commit()
    assert client.get(path, headers=headers).status_code == 403
    assert client.get("/api/v1/me", headers=headers).json()[f"{kind[:-1]}_ids"] == []


def test_scope_claims_in_token_do_not_grant_access(client, users, settings, resources) -> None:
    token = bearer(users["STORE_MANAGER"], settings)["Authorization"].removeprefix("Bearer ")
    key = settings.jwt_secret_key.get_secret_value()
    claims = jwt.decode(token, key, algorithms=["HS256"], audience=settings.jwt_audience)
    claims["outlet_ids"] = [str(resources["outlets"][1])]
    claims["depot_ids"] = [str(resources["depots"][1])]
    headers = {"Authorization": f"Bearer {jwt.encode(claims, key, algorithm='HS256')}"}
    path = f"/test/outlets/{resources['outlets'][1]}"
    assert client.get(path, headers=headers).status_code == 403
    me = client.get("/api/v1/me", headers=headers).json()
    assert me["outlet_ids"] == [str(resources["outlets"][0])]
    assert me["depot_ids"] == [str(resources["depots"][0])]


def test_depot_grant_does_not_imply_store_outlet_access(
    client, engine, users, settings, resources,
) -> None:
    with Session(engine) as db:
        db.execute(delete(UserOutlet).where(UserOutlet.user_id == users["STORE_MANAGER"]))
        db.commit()
    headers = bearer(users["STORE_MANAGER"], settings)
    path = f"/test/outlets/{resources['outlets'][0]}"
    assert client.get(path, headers=headers).status_code == 403


def test_unassigned_account_has_empty_scopes_and_no_resource_access(
    client, users, settings,
) -> None:
    headers = bearer(users["STORE_MANAGER"], settings)
    me = client.get("/api/v1/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["outlet_ids"] == me.json()["depot_ids"] == []
    assert client.get(f"/test/outlets/{uuid4()}", headers=headers).status_code == 403


def test_login_cannot_assign_its_own_outlet_or_depot(client) -> None:
    response = client.post("/api/v1/auth/login", json={
        "email": "store_manager@example.com", "password": PASSWORD,
        "outlet_ids": [str(uuid4())], "depot_ids": [str(uuid4())],
    })
    assert response.status_code == 422


def test_inactive_user_cannot_pass_scope_helpers(engine, users, resources) -> None:
    with Session(engine) as db:
        user = db.scalars(select(User).where(User.id == users["STORE_MANAGER"])).one()
        user.is_active = False
        with pytest.raises(HTTPException) as error:
            require_outlet_access(user, resources["outlets"][0], role=RoleCode.STORE_MANAGER)
        assert error.value.status_code == 403
