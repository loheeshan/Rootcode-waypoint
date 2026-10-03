from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.models import RoleCode, User
from app.auth.security import AuthConfigurationError, InvalidAccessToken, decode_access_token
from app.auth.service import find_user
from app.core.config import Settings, get_settings
from app.db.session import get_session

_bearer = HTTPBearer(auto_error=False)


def authentication_required() -> HTTPException:
    return HTTPException(
        status_code=401, detail="Invalid or missing credentials",
        headers={"WWW-Authenticate": "Bearer", "Cache-Control": "no-store"},
    )


def authentication_unavailable() -> HTTPException:
    return HTTPException(
        status_code=503, detail="Authentication unavailable",
        headers={"Cache-Control": "no-store"},
    )


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    if credentials is None:
        raise authentication_required()
    try:
        user_id = decode_access_token(credentials.credentials, settings=settings)
        user = find_user(session, user_id)
    except InvalidAccessToken:
        raise authentication_required() from None
    except (AuthConfigurationError, SQLAlchemyError):
        raise authentication_unavailable() from None
    if user is None or not user.is_active:
        raise authentication_required()
    return user


def require_roles(*roles: RoleCode) -> Callable[[User], User]:
    """Allow any listed role. Resource ownership checks must be added per domain."""
    if not roles:
        raise ValueError("At least one allowed role is required")
    allowed = frozenset(roles)

    def guard(user: Annotated[User, Depends(get_current_user)]) -> User:
        if not any(assignment.role.code in allowed for assignment in user.role_assignments):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return guard
