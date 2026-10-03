"""Password hashing and access-token primitives used by HTTP authentication."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import Settings, get_settings

MAX_PASSWORD_BYTES = 1024
MAX_TOKEN_LENGTH = 4096
_password_hasher = PasswordHasher()


class AuthConfigurationError(RuntimeError):
    """Token operations require an explicitly configured signing key."""


class InvalidAccessToken(ValueError):
    """A token is malformed, invalid or expired."""


def _valid_password_input(password: str) -> bool:
    try:
        return 0 < len(password.encode("utf-8")) <= MAX_PASSWORD_BYTES
    except UnicodeEncodeError:
        return False


def hash_password(password: str) -> str:
    """Hash exact input without stripping whitespace or changing Unicode."""
    if not _valid_password_input(password):
        raise ValueError("Password must contain between 1 and 1024 UTF-8 bytes")
    return _password_hasher.hash(password)


def verify_password(password: str, encoded_hash: str) -> bool:
    if not _valid_password_input(password) or not encoded_hash.startswith("$argon2id$"):
        return False
    try:
        return _password_hasher.verify(encoded_hash, password)
    except (InvalidHashError, VerificationError, UnicodeEncodeError):
        return False


def _signing_key(settings: Settings) -> str:
    key = settings.jwt_secret_key.get_secret_value() if settings.jwt_secret_key else ""
    if len(key.encode("utf-8")) < 32 or not key.strip():
        raise AuthConfigurationError("Set JWT_SECRET_KEY to a random secret of at least 32 bytes")
    return key


def create_access_token(user_id: UUID, *, settings: Settings | None = None) -> str:
    config = settings if settings is not None else get_settings()
    key = _signing_key(config)
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "nbf": now,
            "exp": now + timedelta(minutes=config.access_token_expire_minutes),
            "iss": config.jwt_issuer,
            "aud": config.jwt_audience,
            "jti": str(uuid4()),
            "token_type": "access",
        },
        key,
        algorithm="HS256",
    )


def decode_access_token(token: str, *, settings: Settings | None = None) -> UUID:
    """Validate a token and return its user ID; load roles and active state from DB."""
    config = settings if settings is not None else get_settings()
    key = _signing_key(config)
    if not token or len(token) > MAX_TOKEN_LENGTH:
        raise InvalidAccessToken("Invalid access token")
    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=["HS256"],
            audience=config.jwt_audience,
            issuer=config.jwt_issuer,
            options={
                "require": ["sub", "iat", "nbf", "exp", "iss", "aud", "jti", "token_type"],
                "strict_aud": True,
            },
        )
        if payload["token_type"] != "access":
            raise InvalidAccessToken("Invalid access token")
        if any(type(payload[claim]) is not int for claim in ("iat", "nbf", "exp")):
            raise InvalidAccessToken("Invalid access token")
        if not payload["iat"] <= payload["nbf"] < payload["exp"]:
            raise InvalidAccessToken("Invalid access token")
        UUID(payload["jti"])
        return UUID(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, TypeError, AttributeError, OverflowError) as exc:
        raise InvalidAccessToken("Invalid access token") from exc
