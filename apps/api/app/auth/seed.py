"""Explicit, repeatable demo-account seeding; never invoked by API startup."""

import argparse
import sys
import warnings
from collections.abc import Sequence
from dataclasses import dataclass
from getpass import GetPassWarning, getpass

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.models import Role, RoleCode, User, UserRole
from app.auth.security import MAX_PASSWORD_BYTES, hash_password
from app.core.config import get_settings
from app.db.session import get_engine

DEMO_ACCOUNTS = (
    ("dispatcher@waypoint.demo", RoleCode.DISPATCHER),
    ("store@waypoint.demo", RoleCode.STORE_MANAGER),
    ("loader@waypoint.demo", RoleCode.LOADER),
    ("driver@waypoint.demo", RoleCode.DRIVER),
)


class DemoSeedError(ValueError):
    """An actionable seed precondition failed without exposing credentials."""


@dataclass(frozen=True)
class SeedResult:
    created: tuple[str, ...]
    existing: tuple[str, ...]


def ensure_demo_environment(app_env: str) -> None:
    # "demo" is set only by docker-compose.yml for the one-command reviewer demo.
    if app_env not in {"development", "test", "demo"}:
        raise DemoSeedError("Demo seeding requires APP_ENV=development, test or demo.")


def _check_password(password: str) -> None:
    try:
        size = len(password.encode("utf-8"))
    except UnicodeEncodeError as exc:
        raise DemoSeedError("The demo password must contain valid UTF-8.") from exc
    if not password.strip() or not 12 <= size <= MAX_PASSWORD_BYTES:
        raise DemoSeedError("Use a nonblank demo password between 12 and 1024 UTF-8 bytes.")


def seed_demo_users(session: Session, password: str, *, app_env: str) -> SeedResult:
    """Own one transaction; preserve every existing account and role assignment."""
    ensure_demo_environment(app_env)
    _check_password(password)
    created: list[str] = []
    existing: list[str] = []
    with session.begin():
        roles = {role.code: role for role in session.scalars(select(Role))}
        if any(code not in roles for _, code in DEMO_ACCOUNTS):
            raise DemoSeedError("Required roles are missing. Run alembic upgrade head first.")
        existing_emails = set(session.scalars(
            select(User.email).where(User.email.in_([email for email, _ in DEMO_ACCOUNTS]))
        ))
        for email, code in DEMO_ACCOUNTS:
            if email in existing_emails:
                existing.append(email)
                continue
            user = User(email=email, password_hash=hash_password(password), is_active=True)
            user.role_assignments = [UserRole(role=roles[code])]
            session.add(user)
            created.append(email)
    return SeedResult(created=tuple(created), existing=tuple(existing))


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create the four local demo accounts.")
    parser.add_argument("--demo", action="store_true", required=True,
                        help="explicitly request development/test demo accounts")
    parser.parse_args(argv)
    try:
        settings = get_settings()
        ensure_demo_environment(settings.app_env)
        # Never fall back to echoing a password when no secure terminal is available.
        with warnings.catch_warnings():
            warnings.simplefilter("error", GetPassWarning)
            password = getpass("Password for new demo accounts (12+ UTF-8 bytes): ")
            _check_password(password)
            if password != getpass("Repeat password: "):
                raise DemoSeedError("Passwords do not match. No accounts were changed.")
        with Session(get_engine()) as session:
            result = seed_demo_users(session, password, app_env=settings.app_env)
    except DemoSeedError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except ValidationError:
        print("Invalid API settings. Check your environment configuration.", file=sys.stderr)
        return 1
    except SQLAlchemyError:
        print("Seed failed; no changes were committed. Check the database and migrations.",
              file=sys.stderr)
        return 1
    except (EOFError, KeyboardInterrupt, GetPassWarning):
        print("Seed cancelled. Run from an interactive terminal to enter the password.",
              file=sys.stderr)
        return 1
    print(f"Created {len(result.created)} demo accounts; "
          f"preserved {len(result.existing)} existing.")
    for email in result.created:
        print(f"Created: {email}")
    for email in result.existing:
        print(f"Preserved: {email} (password, active status and roles unchanged)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
