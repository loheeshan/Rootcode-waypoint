"""The one-command demo bootstrap: idempotent, demo-mode only, real services."""

from collections import Counter
from datetime import UTC, date, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_auth_api import engine as engine

from app.auth.models import User
from app.auth.security import hash_password
from app.db.models import AuditEvent, Order, Plan, Trip
from app.demo.bootstrap import DEMO_EXPRESS_ID, BootstrapError, run
from app.fleet.models import Outlet

PASSWORD = "Demo bootstrap password 2026"
# 07:00 and 21:30 on Monday 5 October 2026 in Asia/Colombo.
MORNING = datetime(2026, 10, 5, 1, 30, tzinfo=UTC)
EVENING = datetime(2026, 10, 5, 16, 0, tzinfo=UTC)


def bootstrap(engine, when=MORNING, app_env="demo"):
    with Session(engine) as db:
        return run(db, PASSWORD, when, app_env)


def counts(engine):
    with Session(engine) as db:
        models = (User, Order, Plan, Trip)
        return tuple(db.scalar(select(func.count()).select_from(m)) for m in models)


def test_same_day_fixture_gives_every_role_something_to_see(engine):
    lines = bootstrap(engine)
    assert lines[0] == "Demo accounts: 4 created, 0 existing"
    assert not any("not seeded" in line for line in lines), lines
    with Session(engine) as db:
        plan = db.scalar(select(Plan).where(Plan.delivery_date == date(2026, 10, 5)))
        assert plan is not None and plan.status == "PUBLISHED"
        trips = Counter(db.scalars(select(Trip.status)))
        assert trips == {"COMPLETED": 2, "READY": 1, "PLANNED": 1}
        statuses = Counter(db.scalars(select(Order.status)))
        for status in ("CONFIRMED", "PLANNED", "LOADING", "OUT_FOR_DELIVERY", "DELIVERED",
                       "RECEIPT_CONFIRMED", "DEFERRED"):
            assert statuses[status] >= 1, (status, statuses)
        express = db.get(Outlet, DEMO_EXPRESS_ID)
        assert express is not None and "24h demo outlet" in express.brand
        actions = set(db.scalars(select(AuditEvent.action)))
        assert {"PLAN_PUBLISHED", "STOP_DELIVERED", "STOP_FAILED", "RECEIPT_CONFIRMED"} <= actions


def test_restart_adds_nothing(engine):
    bootstrap(engine)
    before = counts(engine)
    lines = bootstrap(engine, when=MORNING.replace(hour=5))
    assert counts(engine) == before
    assert lines[0] == "Demo accounts: 0 created, 4 existing"
    assert "already exist" in lines[-1]


def test_too_late_today_plans_the_next_date_without_starting_trips(engine):
    lines = bootstrap(engine, when=EVENING)
    assert "Too late for a same-day route" in lines[-1]
    with Session(engine) as db:
        # After the 16:00 Store cutoff the next accepted date is the day after tomorrow.
        assert db.scalar(select(Plan.delivery_date)) == date(2026, 10, 7)
        assert Counter(db.scalars(select(Trip.status)))["READY"] == 1
        assert "COMPLETED" not in set(db.scalars(select(Trip.status)))


def test_only_demo_mode_and_only_demo_databases(engine):
    with pytest.raises(BootstrapError, match="APP_ENV=demo"):
        bootstrap(engine, app_env="development")
    with Session(engine) as db:
        db.add(User(email="real.person@example.com", password_hash=hash_password(PASSWORD),
                    is_active=True))
        db.commit()
    with pytest.raises(BootstrapError, match="non-demo accounts"):
        bootstrap(engine)
    assert counts(engine)[1:] == (0, 0, 0)
