import secrets
from functools import lru_cache
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth.models import User, UserRole
from app.auth.security import hash_password, verify_password


@lru_cache(maxsize=1)
def _dummy_password_hash() -> str:
    return hash_password(secrets.token_urlsafe(32))


def authenticate_user(session: Session, email: str, password: str) -> User | None:
    # Prepare this for every login so the first request has the same work whether
    # the account exists or not. Missing accounts still perform Argon2 verification.
    dummy_hash = _dummy_password_hash()
    user = session.scalars(
        select(User).where(User.email == email).options(
            selectinload(User.role_assignments).selectinload(UserRole.role),
            selectinload(User.outlet_assignments), selectinload(User.depot_assignments),
        )
    ).one_or_none()
    valid = verify_password(password, user.password_hash if user is not None else dummy_hash)
    if user is None or not valid or not user.is_active:
        return None
    return user


def find_user(session: Session, user_id: UUID) -> User | None:
    return session.scalars(
        select(User).where(User.id == user_id).options(
            selectinload(User.role_assignments).selectinload(UserRole.role),
            selectinload(User.outlet_assignments), selectinload(User.depot_assignments),
        )
    ).one_or_none()
