"""Depot-scoped daily input reads, conditional writes and PostgreSQL concurrency."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from threading import Barrier
from time import sleep
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import delete, event, func, select, update
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session
from test_auth_api import app as app
from test_auth_api import bearer
from test_auth_api import client as client
from test_auth_api import engine as engine
from test_auth_api import settings as settings
from test_auth_api import stored_password as stored_password
from test_auth_api import users as users
from test_fleet_schema import make_outlet, make_vehicle

from app.auth.models import Role, User, UserDepot, UserOutlet, UserRole
from app.db.models import Depot, Vehicle, VehicleAvailability, VehicleFuelUsage
from app.fleet.operations_service import WriteCondition, get_fleet_time

KINDS = ["availability", "fuel-usage"]
NOW = datetime(2026, 10, 3, 10, 30, tzinfo=UTC)


@pytest.fixture(autouse=True)
def clock(app):
    app.dependency_overrides[get_fleet_time] = lambda: NOW


@pytest.fixture
def fleet(engine, users):
    with Session(engine) as db:
        own, foreign = Depot(name="Own"), Depot(name="Foreign")
        first, second, outside = make_vehicle(own), make_vehicle(own), make_vehicle(foreign)
        db.add_all([first, second, outside])
        db.flush()
        db.add_all(
            [
                UserDepot(user_id=users["DISPATCHER"], depot=own),
                UserOutlet(user_id=users["DISPATCHER"], outlet=make_outlet(foreign)),
            ]
        )
        db.commit()
        return {
            "own": own.id,
            "foreign": foreign.id,
            "first": first.id,
            "second": second.id,
            "outside": outside.id,
        }


@pytest.fixture
def headers(users, settings):
    return bearer(users["DISPATCHER"], settings)


def path(vehicle, kind, day="2026-10-03"):
    return f"/api/v1/fleet/{vehicle}/{kind}/{day}"


def payload(kind, changed=False):
    return (
        {"is_available": not changed}
        if kind == "availability"
        else {"fuel_used_l": "12.345" if changed else "0"}
    )


def model(kind):
    return VehicleAvailability if kind == "availability" else VehicleFuelUsage


def create(client, headers, vehicle, kind, day="2026-10-03"):
    return client.put(
        path(vehicle, kind, day), headers={**headers, "If-None-Match": "*"}, json=payload(kind)
    )


@pytest.mark.parametrize("kind", KINDS)
def test_read_create_replace_noop_and_stale_update(client, engine, fleet, headers, kind):
    url = path(fleet["first"], kind)
    missing = client.get(url, headers=headers)
    assert missing.status_code == 404
    assert missing.json() == {
        "detail": "Daily availability not recorded"
        if kind == "availability"
        else "Daily fuel usage not recorded"
    }
    assert "etag" not in missing.headers
    created = create(client, headers, fleet["first"], kind)
    assert created.status_code == 201
    assert created.headers["location"] == url
    assert created.headers["cache-control"] == "no-store"
    assert "etag" not in created.headers and "last-modified" not in created.headers
    body = created.json()
    field = "is_available" if kind == "availability" else "fuel_used_l"
    date_field = "availability_date" if kind == "availability" else "usage_date"
    assert set(body) == {"id", "vehicle_id", "created_at", date_field, field}
    assert body["vehicle_id"] == str(fleet["first"])
    assert body[date_field] == "2026-10-03" and body["created_at"].endswith("Z")
    assert body[field] == (True if kind == "availability" else "0.000")
    read = client.get(url, headers=headers)
    assert read.json() == body and read.status_code == 200
    tag = read.headers["etag"]
    assert len(tag) == 66 and tag.startswith('"') and tag.endswith('"')
    assert client.get(url, headers=headers).headers["etag"] == tag
    changed = client.put(url, headers={**headers, "If-Match": tag}, json=payload(kind, True))
    assert changed.status_code == 200 and "etag" not in changed.headers
    assert changed.json()[field] == (False if kind == "availability" else "12.345")
    assert changed.json()["id"] == body["id"]
    assert changed.json()["created_at"] == body["created_at"]
    current = client.get(url, headers=headers)
    next_tag = current.headers["etag"]
    assert next_tag != tag
    stale = client.put(url, headers={**headers, "If-Match": tag}, json=payload(kind))
    assert stale.status_code == 412 and stale.headers["cache-control"] == "no-store"
    assert client.get(url, headers=headers).json() == current.json()
    assert (
        client.put(
            url, headers={**headers, "If-Match": next_tag}, json=payload(kind, True)
        ).status_code
        == 200
    )
    assert client.get(url, headers=headers).headers["etag"] == next_tag
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(model(kind))) == 1


@pytest.mark.parametrize("kind", KINDS)
def test_create_only_and_replace_only_preconditions(client, fleet, headers, kind):
    url = path(fleet["first"], kind)
    assert (
        client.put(
            url, headers={**headers, "If-Match": '"' + "0" * 64 + '"'}, json=payload(kind)
        ).status_code
        == 412
    )
    assert create(client, headers, fleet["first"], kind).status_code == 201
    assert create(client, headers, fleet["first"], kind).status_code == 412


@pytest.mark.parametrize(
    "condition,status",
    [
        ({}, 428),
        ({"If-Match": "*"}, 400),
        ({"If-None-Match": '"tag"'}, 400),
        ({"If-Match": 'W/"' + "0" * 64 + '"'}, 400),
        ({"If-Match": "bad"}, 400),
        ({"If-Match": '"' + "0" * 64 + '", "' + "1" * 64 + '"'}, 400),
        ({"If-Match": '"' + "0" * 64 + '"', "If-None-Match": "*"}, 400),
    ],
)
def test_missing_or_unsupported_preconditions_never_write(
    client,
    engine,
    fleet,
    headers,
    condition,
    status,
):
    response = client.put(
        path(fleet["first"], "availability"),
        headers={**headers, **condition},
        json=payload("availability"),
    )
    assert response.status_code == status
    assert response.headers["cache-control"] == "no-store"
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(VehicleAvailability)) == 0


def test_duplicate_header_lines_are_rejected(client, fleet, headers):
    response = client.put(
        path(fleet["first"], "availability"),
        headers=[*headers.items(), ("If-None-Match", "*"), ("If-None-Match", "*")],
        json=payload("availability"),
    )
    assert response.status_code == 400


@pytest.mark.parametrize("kind", KINDS)
def test_tag_cannot_be_reused_for_another_vehicle_or_day(client, fleet, headers, kind):
    for vehicle, day in [
        (fleet["first"], "2026-10-03"),
        (fleet["second"], "2026-10-03"),
        (fleet["first"], "2026-10-02"),
    ]:
        assert create(client, headers, vehicle, kind, day).status_code == 201
    tag = client.get(path(fleet["first"], kind), headers=headers).headers["etag"]
    for vehicle, day in [(fleet["second"], "2026-10-03"), (fleet["first"], "2026-10-02")]:
        assert (
            client.put(
                path(vehicle, kind, day),
                headers={**headers, "If-Match": tag},
                json=payload(kind, True),
            ).status_code
            == 412
        )


@pytest.mark.parametrize("kind", KINDS)
@pytest.mark.parametrize("method", ["get", "put"])
def test_all_routes_require_active_authentication(client, users, settings, kind, method):
    for auth in ({}, bearer(users["inactive"], settings)):
        url = path(uuid4(), kind)
        response = (
            client.get(url, headers=auth)
            if method == "get"
            else client.put(url, headers={**auth, "If-None-Match": "*"}, json=payload(kind))
        )
        assert response.status_code == 401


@pytest.mark.parametrize("role", ["STORE_MANAGER", "DRIVER", "LOADER", "roleless"])
@pytest.mark.parametrize("kind", KINDS)
def test_depot_grant_does_not_replace_dispatcher_role(
    client,
    engine,
    users,
    settings,
    fleet,
    role,
    kind,
):
    with Session(engine) as db:
        db.add(UserDepot(user_id=users[role], depot_id=fleet["own"]))
        db.commit()
    auth = bearer(users[role], settings)
    assert client.get(path(fleet["first"], kind), headers=auth).status_code == 403
    assert create(client, auth, fleet["first"], kind).status_code == 403


@pytest.mark.parametrize("kind", KINDS)
def test_foreign_unknown_vehicles_and_outlet_only_grants_are_hidden(client, fleet, headers, kind):
    for identifier in (fleet["outside"], uuid4()):
        for response in (
            client.get(path(identifier, kind), headers=headers),
            create(client, headers, identifier, kind),
        ):
            assert response.status_code == 404 and response.json() == {
                "detail": "Vehicle not found"
            }


@pytest.mark.parametrize("kind", KINDS)
@pytest.mark.parametrize(
    "revocation,status", [("depot", 404), ("role", 403), ("active", 401), ("vehicle_depot", 404)]
)
def test_revocations_apply_to_existing_tokens_and_rows(
    client,
    engine,
    fleet,
    users,
    headers,
    kind,
    revocation,
    status,
):
    assert create(client, headers, fleet["first"], kind).status_code == 201
    url = path(fleet["first"], kind)
    tag = client.get(url, headers=headers).headers["etag"]
    with Session(engine) as db:
        if revocation == "depot":
            db.execute(delete(UserDepot).where(UserDepot.user_id == users["DISPATCHER"]))
        elif revocation == "role":
            db.execute(delete(UserRole).where(UserRole.user_id == users["DISPATCHER"]))
        elif revocation == "active":
            db.execute(update(User).where(User.id == users["DISPATCHER"]).values(is_active=False))
        else:
            db.execute(
                update(Vehicle)
                .where(Vehicle.id == fleet["first"])
                .values(depot_id=fleet["foreign"])
            )
        db.commit()
    assert client.get(url, headers=headers).status_code == status
    assert (
        client.put(url, headers={**headers, "If-Match": tag}, json=payload(kind, True)).status_code
        == status
    )


def test_second_dispatcher_can_edit_shared_depot_with_current_tag(
    client,
    engine,
    fleet,
    headers,
    settings,
):
    assert create(client, headers, fleet["first"], "availability").status_code == 201
    with Session(engine) as db:
        colleague = User(email="colleague@example.test", password_hash="test-hash")
        colleague.role_assignments = [
            UserRole(role=db.scalar(select(Role).where(Role.code == "DISPATCHER")))
        ]
        colleague.depot_assignments = [UserDepot(depot_id=fleet["own"])]
        db.add(colleague)
        db.commit()
        colleague_id = colleague.id
    auth = bearer(colleague_id, settings)
    url = path(fleet["first"], "availability")
    tag = client.get(url, headers=auth).headers["etag"]
    assert (
        client.put(url, headers={**auth, "If-Match": tag}, json={"is_available": False}).status_code
        == 200
    )


@pytest.mark.parametrize("value", [None, 0, 1, "true", "false", [], {}])
def test_availability_requires_json_boolean(client, fleet, headers, value):
    response = client.put(
        path(fleet["first"], "availability"),
        headers={**headers, "If-None-Match": "*"},
        json={"is_available": value},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "value",
    [
        None,
        0,
        1.23,
        True,
        "-1",
        "1000000000",
        "0.0001",
        "1.0000",
        "NaN",
        "Infinity",
        "-Infinity",
        "1e2",
        " 1.2 ",
        ".5",
        "",
    ],
)
def test_fuel_requires_bounded_decimal_string(client, fleet, headers, value):
    response = client.put(
        path(fleet["first"], "fuel-usage"),
        headers={**headers, "If-None-Match": "*"},
        json={"fuel_used_l": value},
    )
    assert response.status_code == 422


@pytest.mark.parametrize("kind", KINDS)
def test_server_owned_fields_and_missing_value_are_rejected(client, fleet, headers, kind):
    for data in (
        {},
        {**payload(kind), "vehicle_id": str(fleet["outside"])},
        {**payload(kind), "id": str(uuid4())},
        {**payload(kind), "created_at": NOW.isoformat()},
        {**payload(kind), "usage_date": "2026-10-02"},
    ):
        response = client.put(
            path(fleet["first"], kind), headers={**headers, "If-None-Match": "*"}, json=data
        )
        assert response.status_code == 422


@pytest.mark.parametrize("day", ["20261003", "2026-02-30", "1791072000", "2026-10-03T00:00:00Z"])
def test_paths_require_iso_dates(client, fleet, headers, day):
    for kind in KINDS:
        assert client.get(path(fleet["first"], kind, day), headers=headers).status_code == 422
        assert create(client, headers, fleet["first"], kind, day).status_code == 422


def test_availability_allows_historical_and_future_days(client, fleet, headers):
    for day in ("2026-09-01", "2026-12-31"):
        assert create(client, headers, fleet["first"], "availability", day).status_code == 201


@pytest.mark.parametrize(
    "instant,status", [("2026-10-03T18:29:59+00:00", 422), ("2026-10-03T18:30:00+00:00", 201)]
)
def test_future_fuel_validation_uses_colombo_midnight(client, app, fleet, headers, instant, status):
    app.dependency_overrides[get_fleet_time] = lambda: datetime.fromisoformat(instant)
    response = create(client, headers, fleet["first"], "fuel-usage", "2026-10-04")
    assert response.status_code == status
    if status == 422:
        assert response.json() == {
            "detail": "Fuel usage date cannot be after today in Asia/Colombo"
        }


def test_actual_fuel_above_quota_is_preserved(client, fleet, headers):
    response = client.put(
        path(fleet["first"], "fuel-usage"),
        headers={**headers, "If-None-Match": "*"},
        json={"fuel_used_l": "999999999.999"},
    )
    assert response.status_code == 201 and response.json()["fuel_used_l"] == "999999999.999"


@pytest.mark.parametrize("kind", KINDS)
@pytest.mark.parametrize("existing", [False, True])
def test_commit_failure_rolls_back_create_or_replacement(
    client, engine, fleet, headers, kind, existing
):
    url = path(fleet["first"], kind)
    before = None
    condition = {"If-None-Match": "*"}
    if existing:
        assert create(client, headers, fleet["first"], kind).status_code == 201
        before = client.get(url, headers=headers)
        condition = {"If-Match": before.headers["etag"]}

    def fail_commit(session):
        raise OperationalError("private database details", {}, Exception())

    event.listen(Session, "before_commit", fail_commit)
    try:
        response = client.put(url, headers={**headers, **condition}, json=payload(kind, True))
    finally:
        event.remove(Session, "before_commit", fail_commit)
    assert response.status_code == 503 and response.json() == {"detail": "Fleet inputs unavailable"}
    assert response.headers["cache-control"] == "no-store" and "etag" not in response.headers
    after = client.get(url, headers=headers)
    if before is None:
        assert after.status_code == 404
    else:
        assert after.json() == before.json() and after.headers["etag"] == before.headers["etag"]


@pytest.mark.parametrize("kind", KINDS)
def test_integrity_failure_is_sanitized_and_leaves_no_row(client, fleet, headers, kind):
    target = model(kind)

    def fail_insert(mapper, connection, record):
        raise IntegrityError("private SQL", {}, Exception())

    event.listen(target, "before_insert", fail_insert)
    try:
        response = create(client, headers, fleet["first"], kind)
    finally:
        event.remove(target, "before_insert", fail_insert)
    assert response.status_code == 409
    assert response.json() == {"detail": "Fleet input conflict; reload the record"}
    assert client.get(path(fleet["first"], kind), headers=headers).status_code == 404


@pytest.mark.parametrize(
    "kind,function", [("availability", "read_availability"), ("fuel-usage", "read_fuel_usage")]
)
def test_read_failures_are_sanitized(client, fleet, headers, kind, function):
    with patch(
        f"app.fleet.operations_router.{function}",
        side_effect=OperationalError("private-url", {}, Exception()),
    ):
        response = client.get(path(fleet["first"], kind), headers=headers)
    assert response.status_code == 503 and response.json() == {"detail": "Fleet inputs unavailable"}


@pytest.mark.parametrize("kind", KINDS)
@pytest.mark.parametrize("existing", [False, True])
def test_postgres_concurrent_writers_do_not_overwrite_each_other(
    client,
    engine,
    fleet,
    headers,
    kind,
    existing,
):
    if engine.dialect.name != "postgresql":
        pytest.skip("Row-lock concurrency guarantee uses the production PostgreSQL database")
    url = path(fleet["first"], kind)
    condition = {"If-None-Match": "*"}
    if existing:
        assert create(client, headers, fleet["first"], kind).status_code == 201
        condition = {"If-Match": client.get(url, headers=headers).headers["etag"]}
    barrier = Barrier(2)
    original_check = WriteCondition.check

    def slow_check(self, current):
        original_check(self, current)
        # Make a missing lock visible: two writers could otherwise both pass the check.
        sleep(0.05)

    def submit():
        barrier.wait(timeout=10)
        return client.put(url, headers={**headers, **condition}, json=payload(kind, True))

    with (
        patch.object(WriteCondition, "check", slow_check),
        ThreadPoolExecutor(max_workers=2) as pool,
    ):
        pending = [pool.submit(submit) for _ in range(2)]
        responses = [future.result(timeout=30) for future in pending]
    assert sorted(response.status_code for response in responses) == [200 if existing else 201, 412]
    winner = next(response for response in responses if response.status_code < 300)
    assert client.get(url, headers=headers).json() == winner.json()
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(model(kind))) == 1


def test_cors_allows_conditional_headers_and_exposes_get_tag(client, fleet, headers):
    url = path(fleet["first"], "availability")
    assert create(client, headers, fleet["first"], "availability").status_code == 201
    response = client.get(url, headers={**headers, "Origin": "http://localhost:3000"})
    assert set(response.headers["access-control-expose-headers"].split(", ")) == {
        "Location",
        "ETag",
    }
    preflight = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "authorization,content-type,if-match,if-none-match",
    }
    assert client.options(url, headers=preflight).status_code == 200
    preflight["Origin"] = "https://untrusted.example"
    assert client.options(url, headers=preflight).status_code == 400


def test_openapi_requires_auth_and_declares_input_types(client):
    schema = client.get("/openapi.json").json()
    for route, response_type in (
        (
            "/api/v1/fleet/{vehicle_id}/availability/{availability_date}",
            "VehicleAvailabilityResponse",
        ),
        ("/api/v1/fleet/{vehicle_id}/fuel-usage/{usage_date}", "VehicleFuelUsageResponse"),
    ):
        for method in ("get", "put"):
            assert schema["paths"][route][method]["security"] == [{"HTTPBearer": []}]
        names = {param["name"] for param in schema["paths"][route]["put"]["parameters"]}
        assert {"if-match", "if-none-match"} <= names
        for code in ("200", "201"):
            response = schema["paths"][route]["put"]["responses"][code]
            assert response["content"]["application/json"]["schema"] == {
                "$ref": f"#/components/schemas/{response_type}"
            }
    inputs = schema["components"]["schemas"]
    assert inputs["FuelUsageWriteRequest"]["properties"]["fuel_used_l"]["type"] == "string"
    assert inputs["AvailabilityWriteRequest"]["properties"]["is_available"]["type"] == "boolean"
