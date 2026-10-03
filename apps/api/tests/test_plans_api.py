"""Plan workspace creation, depot isolation, history counts and atomic writes."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta, timezone
from threading import Barrier
from unittest.mock import patch
from uuid import UUID, uuid4

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
from test_order_schema import make_order

from app.auth.models import Role, User, UserDepot, UserOutlet, UserRole
from app.db.models import Depot, Plan, PlanRevision, Trip, TripStop
from app.planning.assignment_models import DeferralDecision, PlanAssignment
from app.planning.schemas import PlanCreateRequest
from app.planning.service import create_plan, find_existing_plan_id, get_planning_time

BASE = "/api/v1/plans"
NOW = datetime(2026, 10, 3, 10, 30, tzinfo=UTC)


@pytest.fixture(autouse=True)
def clock(app):
    app.dependency_overrides[get_planning_time] = lambda: NOW


@pytest.fixture
def depots(engine, users):
    with Session(engine) as db:
        own, foreign, empty = (Depot(name=name) for name in ("Own", "Foreign", "Empty"))
        db.add_all([own, foreign, empty])
        db.flush()
        db.add_all(
            [
                UserDepot(user_id=users["DISPATCHER"], depot=own),
                UserDepot(user_id=users["DISPATCHER"], depot=empty),
                UserOutlet(user_id=users["DISPATCHER"], outlet=make_outlet(foreign)),
            ]
        )
        db.commit()
        return own.id, foreign.id, empty.id


@pytest.fixture
def headers(users, settings):
    return bearer(users["DISPATCHER"], settings)


def payload(assigned_depot_id, **changes):
    return {"depot_id": str(assigned_depot_id), "delivery_date": "2026-10-05", **changes}


def test_create_list_detail_and_initial_revision_persist_together(
    client,
    engine,
    users,
    depots,
    headers,
):
    response = client.post(
        BASE, headers={**headers, "Origin": "http://localhost:3000"}, json=payload(depots[0])
    )
    assert response.status_code == 201
    body = response.json()
    assert set(body) == {
        "id",
        "depot_id",
        "delivery_date",
        "status",
        "created_by",
        "created_at",
        "revisions",
    }
    assert body["depot_id"] == str(depots[0])
    assert body["delivery_date"] == "2026-10-05"
    assert body["status"] == "DRAFT"
    assert body["created_by"] == str(users["DISPATCHER"])
    assert body["created_at"].endswith("Z")
    (revision,) = body["revisions"]
    assert revision == {
        "id": revision["id"],
        "revision_number": 1,
        "status": "DRAFT",
        "published_at": None,
        "trip_count": 0,
        "served_order_count": 0,
        "deferred_order_count": 0,
        "unexplained_deferred_count": 0,
    }
    assert response.headers["location"] == f"{BASE}/{body['id']}"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["access-control-expose-headers"] == "Location"
    detail = client.get(response.headers["location"], headers=headers)
    assert detail.status_code == 200 and detail.json() == body
    assert detail.headers["cache-control"] == "no-store"
    listing = client.get(BASE, headers=headers)
    summary = {key: value for key, value in body.items() if key != "revisions"}
    assert listing.json() == {"items": [summary], "total": 1, "limit": 20, "offset": 0}
    assert listing.headers["cache-control"] == "no-store"
    with Session(engine) as db:
        assert db.get(PlanRevision, UUID(revision["id"])).plan_id == UUID(body["id"])
        assert db.scalar(select(func.count()).select_from(Plan)) == 1
        assert db.scalar(select(func.count()).select_from(Trip)) == 0
        assert db.scalar(select(func.count()).select_from(PlanAssignment)) == 0


@pytest.mark.parametrize(
    "value,status", [("2026-10-02", 422), ("2026-10-03", 201), ("2026-10-04", 201)]
)
def test_creation_accepts_today_and_future_without_store_cutoff(
    client, depots, headers, value, status
):
    response = client.post(BASE, headers=headers, json=payload(depots[0], delivery_date=value))
    assert response.status_code == status
    if status == 201:
        assert response.json()["delivery_date"] == value


@pytest.mark.parametrize(
    "instant,status", [("2026-10-03T18:29:59+00:00", 201), ("2026-10-03T18:30:00+00:00", 422)]
)
def test_past_day_validation_changes_at_colombo_midnight(
    client, app, depots, headers, instant, status
):
    app.dependency_overrides[get_planning_time] = lambda: datetime.fromisoformat(instant)
    response = client.post(
        BASE, headers=headers, json=payload(depots[0], delivery_date="2026-10-03")
    )
    assert response.status_code == status
    if status == 422:
        assert response.json() == {"detail": "Delivery date cannot be before today in Asia/Colombo"}


@pytest.mark.parametrize(
    "changes",
    [
        {"delivery_date": "2026-02-30"},
        {"delivery_date": "20261005"},
        {"delivery_date": "2026-10-05T00:00:00Z"},
        {"delivery_date": 1791072000},
        {"delivery_date": "1791072000"},
        {"delivery_date": None},
        {"depot_id": "invalid"},
        {"status": "PUBLISHED"},
        {"created_by": str(uuid4())},
        {"id": str(uuid4())},
        {"created_at": "2026-10-03T00:00:00Z"},
        {"revision_number": 9},
        {"revisions": []},
        {"order_ids": []},
    ],
)
def test_invalid_and_server_owned_fields_never_create_plans(
    client, engine, depots, headers, changes
):
    assert client.post(BASE, headers=headers, json=payload(depots[0], **changes)).status_code == 422
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Plan)) == 0
        assert db.scalar(select(func.count()).select_from(PlanRevision)) == 0


@pytest.mark.parametrize("operation", ["create", "list", "detail"])
def test_every_route_requires_authentication(client, users, settings, operation):
    for auth in ({}, bearer(users["inactive"], settings)):
        response = (
            client.post(BASE, headers=auth, json=payload(uuid4()))
            if operation == "create"
            else client.get(BASE if operation == "list" else f"{BASE}/{uuid4()}", headers=auth)
        )
        assert response.status_code == 401


@pytest.mark.parametrize("role", ["STORE_MANAGER", "DRIVER", "LOADER", "roleless"])
@pytest.mark.parametrize("operation", ["create", "list", "detail"])
def test_depot_grants_do_not_bypass_dispatcher_role(
    client,
    engine,
    users,
    settings,
    depots,
    role,
    operation,
):
    with Session(engine) as db:
        db.add(UserDepot(user_id=users[role], depot_id=depots[0]))
        db.commit()
    auth = bearer(users[role], settings)
    response = (
        client.post(BASE, headers=auth, json=payload(depots[0]))
        if operation == "create"
        else client.get(BASE if operation == "list" else f"{BASE}/{uuid4()}", headers=auth)
    )
    assert response.status_code == 403


def test_unknown_and_foreign_depot_create_and_filters_are_forbidden(client, depots, headers):
    for identifier in (depots[1], uuid4()):
        assert client.post(BASE, headers=headers, json=payload(identifier)).status_code == 403
        response = client.get(BASE, headers=headers, params={"depot_id": str(identifier)})
        assert response.status_code == 403
        assert response.json() == {"detail": "Insufficient permissions"}


def test_scope_filters_totals_and_unknown_foreign_detail_have_identical_404(
    client,
    engine,
    users,
    depots,
    headers,
):
    own = client.post(BASE, headers=headers, json=payload(depots[0])).json()
    with Session(engine) as db:
        foreign = Plan(
            depot_id=depots[1], delivery_date=date(2026, 10, 5), created_by=users["DISPATCHER"]
        )
        foreign.revisions = [PlanRevision(revision_number=1)]
        db.add(foreign)
        db.commit()
        foreign_id = foreign.id
    listing = client.get(BASE, headers=headers).json()
    assert listing["total"] == 1
    assert [row["id"] for row in listing["items"]] == [own["id"]]
    for identifier in (foreign_id, uuid4()):
        response = client.get(f"{BASE}/{identifier}", headers=headers)
        assert response.status_code == 404
        assert response.json() == {"detail": "Plan not found"}
        assert response.headers["cache-control"] == "no-store"


def test_filters_and_pagination_are_deterministic_with_date_ties(
    client, engine, users, depots, headers
):
    with Session(engine) as db:
        plans = [
            Plan(
                id=UUID(int=10),
                depot_id=depots[0],
                delivery_date=date(2026, 10, 5),
                created_by=users["DISPATCHER"],
            ),
            Plan(
                id=UUID(int=20),
                depot_id=depots[2],
                delivery_date=date(2026, 10, 5),
                created_by=users["DISPATCHER"],
            ),
            Plan(
                id=UUID(int=30),
                depot_id=depots[0],
                delivery_date=date(2026, 10, 6),
                created_by=users["DISPATCHER"],
                status="PUBLISHED",
            ),
        ]
        db.add_all(plans)
        db.commit()
    for offset, expected in enumerate([20, 10, None]):
        body = client.get(
            BASE,
            headers=headers,
            params={
                "status": "DRAFT",
                "delivery_date": "2026-10-05",
                "limit": 1,
                "offset": offset,
            },
        ).json()
        assert body["total"] == 2 and body["limit"] == 1 and body["offset"] == offset
        assert [item["id"] for item in body["items"]] == (
            [] if expected is None else [str(UUID(int=expected))]
        )
    all_plans = client.get(BASE, headers=headers).json()
    assert [item["id"] for item in all_plans["items"]] == [str(UUID(int=n)) for n in (30, 20, 10)]
    filtered = client.get(
        BASE,
        headers=headers,
        params={
            "depot_id": str(depots[0]),
            "status": "PUBLISHED",
            "delivery_date": "2026-10-06",
        },
    ).json()
    assert filtered["total"] == 1 and filtered["items"][0]["id"] == str(UUID(int=30))
    empty = client.get(BASE, headers=headers, params={"delivery_date": "2026-10-07"}).json()
    assert empty["items"] == [] and empty["total"] == 0


def test_duplicate_create_returns_existing_location_without_new_revision(
    client, engine, depots, headers
):
    created = client.post(BASE, headers=headers, json=payload(depots[0]))
    with Session(engine) as db:
        plan = db.get(Plan, UUID(created.json()["id"]))
        plan.status = "PUBLISHED"
        plan.revisions[0].status = "PUBLISHED"
        plan.revisions[0].published_at = NOW
        db.commit()
    before = client.get(created.headers["location"], headers=headers).json()
    duplicate = client.post(
        BASE, headers={**headers, "Origin": "http://localhost:3000"}, json=payload(depots[0])
    )
    assert duplicate.status_code == 409
    assert duplicate.json() == {"detail": "A plan already exists for this depot and delivery date"}
    assert duplicate.headers["location"] == created.headers["location"]
    assert duplicate.headers["access-control-expose-headers"] == "Location"
    assert client.get(duplicate.headers["location"], headers=headers).json() == before
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Plan)) == 1
        assert db.scalar(select(func.count()).select_from(PlanRevision)) == 1


def test_concurrent_creation_uses_one_plan_and_one_initial_revision(
    client, engine, depots, headers
):
    barrier = Barrier(2)

    def submit():
        barrier.wait(timeout=10)
        return client.post(BASE, headers=headers, json=payload(depots[0]))

    with ThreadPoolExecutor(max_workers=2) as pool:
        pending = [pool.submit(submit) for _ in range(2)]
        responses = [future.result(timeout=30) for future in pending]
    assert sorted(response.status_code for response in responses) == [201, 409]
    assert responses[0].headers["location"] == responses[1].headers["location"]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Plan)) == 1
        assert db.scalar(select(func.count()).select_from(PlanRevision)) == 1


def test_shared_depot_access_is_not_restricted_to_original_creator(
    client,
    engine,
    users,
    settings,
    depots,
    headers,
):
    created = client.post(BASE, headers=headers, json=payload(depots[0]))
    with Session(engine) as db:
        colleague = User(email="colleague@example.test", password_hash="test-hash")
        colleague.role_assignments = [
            UserRole(role=db.scalar(select(Role).where(Role.code == "DISPATCHER")))
        ]
        colleague.depot_assignments = [UserDepot(depot_id=depots[0])]
        db.add(colleague)
        db.commit()
        identifier = colleague.id
    response = client.get(created.headers["location"], headers=bearer(identifier, settings))
    assert response.status_code == 200
    assert response.json()["created_by"] == str(users["DISPATCHER"])


def test_revoked_scope_hides_existing_plans_and_conflict_recovery(
    client, engine, users, depots, headers
):
    created = client.post(BASE, headers=headers, json=payload(depots[0]))
    with Session(engine) as db:
        db.execute(delete(UserDepot).where(UserDepot.user_id == users["DISPATCHER"]))
        db.commit()
        assert (
            find_existing_plan_id(
                db, db.get(User, users["DISPATCHER"]), PlanCreateRequest(**payload(depots[0]))
            )
            is None
        )
    assert client.get(BASE, headers=headers).json() == {
        "items": [],
        "total": 0,
        "limit": 20,
        "offset": 0,
    }
    assert client.get(created.headers["location"], headers=headers).status_code == 404
    denied = client.post(BASE, headers=headers, json=payload(depots[0]))
    assert denied.status_code == 403 and "location" not in denied.headers


@pytest.mark.parametrize("active,status", [(False, 401), (True, 403)])
def test_account_and_role_revocation_take_effect_for_existing_token(
    client,
    engine,
    users,
    depots,
    headers,
    active,
    status,
):
    created = client.post(BASE, headers=headers, json=payload(depots[0]))
    with Session(engine) as db:
        if active:
            db.execute(delete(UserRole).where(UserRole.user_id == users["DISPATCHER"]))
        else:
            db.execute(update(User).where(User.id == users["DISPATCHER"]).values(is_active=False))
        db.commit()
    assert client.get(BASE, headers=headers).status_code == status
    assert client.get(created.headers["location"], headers=headers).status_code == status
    assert client.post(BASE, headers=headers, json=payload(depots[0])).status_code == status


def test_revision_counts_do_not_multiply_or_mix_histories(client, engine, users, depots, headers):
    created = client.post(BASE, headers=headers, json=payload(depots[0])).json()
    revision_id = UUID(created["revisions"][0]["id"])
    with Session(engine) as db:
        plan = db.get(Plan, UUID(created["id"]))
        revision = db.get(PlanRevision, revision_id)
        revision.status = "PUBLISHED"
        revision.published_at = datetime(
            2026,
            10,
            3,
            16,
            tzinfo=timezone(timedelta(hours=5, minutes=30)),
        ).astimezone(UTC)
        vehicle = make_vehicle(plan.depot)
        outlet = make_outlet(plan.depot)
        trips = [Trip(revision=revision, vehicle=vehicle, trip_number=n) for n in (1, 2)]
        stop = TripStop(trip=trips[0], outlet=outlet, sequence_number=1)
        orders = [make_order(outlet) for _ in range(5)]
        next_revision = PlanRevision(plan=plan, revision_number=2)
        db.add_all([*trips, *orders, next_revision])
        db.flush()
        for index, order in enumerate(orders):
            outcome = PlanAssignment(
                plan_revision_id=revision_id,
                order_id=order.id,
                outlet_id=outlet.id,
                outcome="SERVED" if index < 3 else "DEFERRED",
                trip_id=trips[0].id if index < 3 else None,
                trip_stop_id=stop.id if index < 3 else None,
            )
            if index == 3:
                outcome.deferral = DeferralDecision(
                    reason_code="TRIP_LIMIT", reason_text="Two trips used."
                )
            db.add(outcome)
        # A different revision and inaccessible plan must not contribute to revision 1.
        db.add(
            PlanAssignment(
                plan_revision_id=next_revision.id,
                order_id=orders[0].id,
                outlet_id=outlet.id,
                outcome="DEFERRED",
            )
        )
        foreign_plan = Plan(
            depot_id=depots[1], delivery_date=date(2026, 10, 5), created_by=users["DISPATCHER"]
        )
        foreign_revision = PlanRevision(plan=foreign_plan, revision_number=1)
        db.add(foreign_revision)
        db.flush()
        foreign_id = foreign_revision.id
        db.add(
            PlanAssignment(
                plan_revision_id=foreign_id,
                order_id=orders[0].id,
                outlet_id=outlet.id,
                outcome="DEFERRED",
            )
        )
        db.commit()
    response = client.get(f"{BASE}/{created['id']}", headers=headers)
    assert response.status_code == 200
    first, second = response.json()["revisions"]
    assert first == {
        "id": str(revision_id),
        "revision_number": 1,
        "status": "PUBLISHED",
        "published_at": "2026-10-03T10:30:00Z",
        "trip_count": 2,
        "served_order_count": 3,
        "deferred_order_count": 2,
        "unexplained_deferred_count": 1,
    }
    assert second["revision_number"] == 2
    assert (
        second["trip_count"],
        second["served_order_count"],
        second["deferred_order_count"],
        second["unexplained_deferred_count"],
    ) == (0, 0, 1, 1)
    assert str(foreign_id) not in response.text


def test_preexisting_plan_without_revisions_returns_empty_history(
    client, engine, users, depots, headers
):
    with Session(engine) as db:
        plan = Plan(
            depot_id=depots[0], delivery_date=date(2026, 10, 1), created_by=users["DISPATCHER"]
        )
        db.add(plan)
        db.commit()
        identifier = plan.id
    response = client.get(f"{BASE}/{identifier}", headers=headers)
    assert response.status_code == 200 and response.json()["revisions"] == []


@pytest.mark.parametrize(
    "query",
    [
        "limit=0",
        "limit=101",
        "offset=-1",
        "status=UNKNOWN",
        "delivery_date=invalid",
        "depot_id=invalid",
    ],
)
def test_invalid_list_filters_are_rejected(client, headers, query):
    assert client.get(f"{BASE}?{query}", headers=headers).status_code == 422


def test_invalid_plan_id_is_rejected(client, headers):
    assert client.get(f"{BASE}/invalid", headers=headers).status_code == 422


@pytest.mark.parametrize(
    "table,error,status",
    [
        ("plans", IntegrityError, 409),
        ("plan_revisions", OperationalError, 503),
        ("plan_revisions", IntegrityError, 409),
    ],
)
def test_failed_insert_rolls_back_plan_and_revision_without_leaking_details(
    client,
    engine,
    depots,
    headers,
    table,
    error,
    status,
):
    def fail_insert(connection, cursor, statement, parameters, context, executemany):
        if statement.startswith(f"INSERT INTO {table} "):
            raise error("private-database-url", {}, Exception("private-detail"))

    event.listen(engine, "before_cursor_execute", fail_insert)
    try:
        response = client.post(BASE, headers=headers, json=payload(depots[0]))
    finally:
        event.remove(engine, "before_cursor_execute", fail_insert)
    assert response.status_code == status
    assert "private" not in response.text and "location" not in response.headers
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Plan)) == 0
        assert db.scalar(select(func.count()).select_from(PlanRevision)) == 0


def test_failed_commit_never_reports_success_or_leaves_partial_data(
    client, engine, depots, headers
):
    def fail_commit(session):
        raise OperationalError("private-commit", {}, Exception())

    event.listen(Session, "before_commit", fail_commit)
    try:
        response = client.post(BASE, headers=headers, json=payload(depots[0]))
    finally:
        event.remove(Session, "before_commit", fail_commit)
    assert response.status_code == 503 and response.json() == {"detail": "Plans unavailable"}
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Plan)) == 0
        assert db.scalar(select(func.count()).select_from(PlanRevision)) == 0


@pytest.mark.parametrize("target,path", [("list_plans", BASE), ("get_plan", f"{BASE}/{uuid4()}")])
def test_failed_reads_are_sanitized(client, headers, target, path):
    with patch(
        f"app.planning.router.{target}",
        side_effect=OperationalError("private-url", {}, Exception()),
    ):
        response = client.get(path, headers=headers)
    assert response.status_code == 503 and response.json() == {"detail": "Plans unavailable"}
    assert response.headers["cache-control"] == "no-store"


def test_conflict_recovery_database_failure_returns_503(client, depots, headers):
    with (
        patch(
            "app.planning.router.create_plan",
            side_effect=IntegrityError("private", {}, Exception()),
        ),
        patch(
            "app.planning.router.find_existing_plan_id",
            side_effect=OperationalError("private", {}, Exception()),
        ),
    ):
        response = client.post(BASE, headers=headers, json=payload(depots[0]))
    assert response.status_code == 503 and response.json() == {"detail": "Plans unavailable"}


def test_planning_clock_requires_timezone_metadata(engine, depots, users):
    with Session(engine) as db, pytest.raises(ValueError, match="timezone-aware"):
        create_plan(
            db,
            db.get(User, users["DISPATCHER"]),
            PlanCreateRequest(**payload(depots[0])),
            NOW.replace(tzinfo=None),
        )


def test_openapi_declares_auth_and_does_not_expose_optimizer_or_publisher(client):
    paths = client.get("/openapi.json").json()["paths"]
    for path, method in ((BASE, "post"), (BASE, "get"), (f"{BASE}/{{plan_id}}", "get")):
        assert paths[path][method]["security"] == [{"HTTPBearer": []}]
    assert f"{BASE}/{{plan_id}}/optimize" not in paths
    assert f"{BASE}/{{plan_id}}/publish" not in paths
