"""Synthetic demo master data and explicit demo-user resource assignments."""

import argparse
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import time
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.auth.models import User, UserDepot, UserOutlet, UserRole
from app.auth.seed import DEMO_ACCOUNTS, DemoSeedError, ensure_demo_environment
from app.core.config import get_settings
from app.db.session import get_engine
from app.fleet.models import Depot, Outlet, Vehicle

# Stable IDs identify these synthetic records; never match real data by name.
DEMO_DEPOT_ID = uuid5(NAMESPACE_URL, "https://waypoint.demo/seed/v1/depot")
DEMO_STORE_ID = uuid5(NAMESPACE_URL, "https://waypoint.demo/seed/v1/store")
DEMO_MALL_ID = uuid5(NAMESPACE_URL, "https://waypoint.demo/seed/v1/mall")
DEMO_REEFER_ID = uuid5(NAMESPACE_URL, "https://waypoint.demo/seed/v1/reefer-van")
DEMO_TRUCK_ID = uuid5(NAMESPACE_URL, "https://waypoint.demo/seed/v1/ambient-truck")

type DemoModel = Depot | Outlet | Vehicle

_ROWS: tuple[tuple[type[DemoModel], dict[str, object]], ...] = (
    (Depot, {"id": DEMO_DEPOT_ID, "name": "Waypoint Demo Depot"}),
    (Outlet, {
        "id": DEMO_STORE_ID, "brand": "Waypoint Demo Store", "district": "Colombo",
        "depot_id": DEMO_DEPOT_ID, "dock_type": "ground", "parking_constraint": "none",
        "window_open_time": time(8), "window_close_time": time(18), "mall_window": False,
    }),
    (Outlet, {
        "id": DEMO_MALL_ID, "brand": "Waypoint Demo Mall", "district": "Colombo",
        "depot_id": DEMO_DEPOT_ID, "dock_type": "loading_bay", "parking_constraint": "van_only",
        "window_open_time": time(9), "window_close_time": time(11), "mall_window": True,
    }),
    (Vehicle, {
        "id": DEMO_REEFER_ID, "depot_id": DEMO_DEPOT_ID,
        "type": "van", "temperature_type": "reefer", "weight_cap_kg": Decimal("1200.000"),
        "volume_cap_m3": Decimal("8.000"), "km_per_l": Decimal("8.000"),
        "weekly_fuel_quota_l": Decimal("120.000"),
    }),
    (Vehicle, {
        "id": DEMO_TRUCK_ID, "depot_id": DEMO_DEPOT_ID,
        "type": "truck", "temperature_type": "ambient", "weight_cap_kg": Decimal("5000.000"),
        "volume_cap_m3": Decimal("30.000"), "km_per_l": Decimal("5.000"),
        "weekly_fuel_quota_l": Decimal("250.000"),
    }),
)


@dataclass(frozen=True)
class ResourceSeedResult:
    created: tuple[str, ...]
    existing: tuple[str, ...]
    assignments_created: int
    assignments_existing: int


def seed_demo_resources(session: Session, *, app_env: str) -> ResourceSeedResult:
    """Own a single transaction; never overwrite accounts, roles or master data."""
    ensure_demo_environment(app_env)
    created: list[str] = []
    existing: list[str] = []
    assignments_created = 0
    assignments_existing = 0
    with session.begin():
        users = {user.email: user for user in session.scalars(
            select(User).where(User.email.in_([email for email, _ in DEMO_ACCOUNTS])).options(
                selectinload(User.role_assignments).selectinload(UserRole.role),
            )
        )}
        for email, role in DEMO_ACCOUNTS:
            user = users.get(email)
            if user is None:
                raise DemoSeedError(
                    "Create all four demo accounts with app.auth.seed --demo first.",
                )
            if not user.is_active or not any(a.role.code == role for a in user.role_assignments):
                raise DemoSeedError(f"Demo account {email} must be active with its expected role.")

        for model, values in _ROWS:
            record = session.get(model, values["id"])
            label = f"{model.__tablename__}:{values['id']}"
            if record is not None:
                if any(getattr(record, field) != value for field, value in values.items()):
                    raise DemoSeedError(f"Conflicting demo record {label}; no changes committed.")
                existing.append(label)
            else:
                session.add(model(**values))
                session.flush()
                created.append(label)

        store_id = users["store@waypoint.demo"].id
        if session.get(UserOutlet, (store_id, DEMO_STORE_ID)) is None:
            session.add(UserOutlet(user_id=store_id, outlet_id=DEMO_STORE_ID))
            assignments_created += 1
        else:
            assignments_existing += 1
        for email in ("dispatcher@waypoint.demo", "loader@waypoint.demo", "driver@waypoint.demo"):
            user_id = users[email].id
            if session.get(UserDepot, (user_id, DEMO_DEPOT_ID)) is None:
                session.add(UserDepot(user_id=user_id, depot_id=DEMO_DEPOT_ID))
                assignments_created += 1
            else:
                assignments_existing += 1
    return ResourceSeedResult(tuple(created), tuple(existing),
                              assignments_created, assignments_existing)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed synthetic fleet data and demo assignments.")
    parser.add_argument("--demo", action="store_true", required=True,
                        help="explicitly create demo resources and grant demo-user assignments")
    parser.parse_args(argv)
    try:
        settings = get_settings()
        ensure_demo_environment(settings.app_env)
        with Session(get_engine()) as session:
            result = seed_demo_resources(session, app_env=settings.app_env)
    except DemoSeedError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except ValidationError:
        print("Invalid API settings. Check your environment configuration.", file=sys.stderr)
        return 1
    except SQLAlchemyError:
        print("Resource seed failed. Check the database and migrations; re-run to verify.",
              file=sys.stderr)
        return 1
    print(f"Created {len(result.created)} resources; preserved {len(result.existing)} existing.")
    print(f"Created {result.assignments_created} assignments; "
          f"preserved {result.assignments_existing} existing.")
    for label in result.created:
        print(f"Created: {label}")
    print(f"Store outlet: {DEMO_STORE_ID}")
    print(f"Dispatcher/Loader/Driver depot: {DEMO_DEPOT_ID}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
