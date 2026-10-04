from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    authentication_required,
    authentication_unavailable,
    get_current_user,
)
from app.auth.models import User
from app.auth.schemas import LoginRequest, LoginResponse, UserResponse
from app.auth.security import AuthConfigurationError, create_access_token
from app.auth.service import authenticate_user
from app.core.config import Settings, get_settings
from app.db.session import get_session

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> LoginResponse:
    try:
        user = authenticate_user(session, str(payload.email), payload.password.get_secret_value())
        if user is None:
            raise authentication_required()
        token = create_access_token(user.id, settings=settings)
    except (AuthConfigurationError, SQLAlchemyError):
        raise authentication_unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return LoginResponse(
        access_token=token, expires_in=settings.access_token_expire_minutes * 60,
        user=UserResponse.from_user(user),
    )


@router.get("/me", response_model=UserResponse)
def me(response: Response, user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    response.headers["Cache-Control"] = "no-store"
    return UserResponse.from_user(user)
