"""Password storage and bearer-token validation before HTTP auth is introduced."""

import secrets
from datetime import UTC, datetime
from uuid import uuid4

import jwt
import pytest
from pydantic import SecretStr, ValidationError

from app.auth.security import (
    AuthConfigurationError,
    InvalidAccessToken,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.core.config import Settings


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        jwt_secret_key=SecretStr(secrets.token_urlsafe(48)),
        jwt_issuer="waypoint-api",
        jwt_audience="waypoint-clients",
        access_token_expire_minutes=30,
    )


def signing_key(settings: Settings) -> str:
    assert settings.jwt_secret_key is not None
    return settings.jwt_secret_key.get_secret_value()


def claims(settings: Settings) -> dict[str, object]:
    now = int(datetime.now(UTC).timestamp())
    return {
        "sub": str(uuid4()), "iat": now, "nbf": now, "exp": now + 1800,
        "iss": settings.jwt_issuer, "aud": settings.jwt_audience,
        "jti": str(uuid4()), "token_type": "access",
    }


def test_passwords_are_salted_argon2id_hashes_that_fit_storage() -> None:
    password = "Exact Unicode password 🔐 "
    first = hash_password(password)
    second = hash_password(password)
    assert first != second
    assert first.startswith("$argon2id$")
    assert len(first) <= 255
    assert password not in first
    assert verify_password(password, first)
    assert not verify_password(password.strip(), first)
    assert not verify_password("wrong password", first)


@pytest.mark.parametrize("password", ["", "x" * 1025, "🔐" * 257, "\ud800"])
def test_invalid_password_inputs_are_rejected(password: str) -> None:
    with pytest.raises(ValueError, match="UTF-8 bytes"):
        hash_password(password)
    assert not verify_password(password, "$argon2id$invalid")


def test_password_byte_limit_accepts_the_boundary() -> None:
    password = "🔐" * 256
    assert verify_password(password, hash_password(password))


@pytest.mark.parametrize(
    "stored_hash", ["", "plaintext", "$argon2id$invalid", "$2b$invalid", "$argon2id$é"]
)
def test_malformed_or_unsupported_hashes_fail_verification(stored_hash: str) -> None:
    assert not verify_password("password", stored_hash)


def test_access_token_round_trip_and_claims(settings: Settings) -> None:
    user_id = uuid4()
    token = create_access_token(user_id, settings=settings)
    assert decode_access_token(token, settings=settings) == user_id
    payload = jwt.decode(token, signing_key(settings), algorithms=["HS256"],
                         audience=settings.jwt_audience, issuer=settings.jwt_issuer)
    assert payload["exp"] - payload["iat"] == 1800
    assert payload["nbf"] == payload["iat"]
    assert payload["token_type"] == "access"
    assert "roles" not in payload
    assert "password" not in payload
    assert create_access_token(user_id, settings=settings) != token


def test_configured_token_lifetime_is_used(settings: Settings) -> None:
    config = settings.model_copy(update={"access_token_expire_minutes": 5})
    token = create_access_token(uuid4(), settings=config)
    payload = jwt.decode(token, signing_key(config), algorithms=["HS256"],
                         audience=config.jwt_audience)
    assert payload["exp"] - payload["iat"] == 300


@pytest.mark.parametrize("field,value", [
    ("iss", "another-service"), ("iss", "waypoint"),
    ("aud", "another-client"), ("aud", ["waypoint-clients"]),
    ("sub", "not-a-uuid"), ("sub", 123), ("jti", "not-a-uuid"),
    ("token_type", "refresh"), ("iat", "1"), ("iat", True), ("nbf", 0.5),
    ("iat", float("inf")), ("nbf", float("inf")), ("exp", float("inf")),
    ("exp", float("nan")),
])
def test_invalid_claims_are_rejected(settings: Settings, field: str, value: object) -> None:
    payload = claims(settings)
    payload[field] = value
    token = jwt.encode(payload, signing_key(settings), algorithm="HS256")
    with pytest.raises(InvalidAccessToken):
        decode_access_token(token, settings=settings)


@pytest.mark.parametrize("missing", ["sub", "iat", "nbf", "exp", "iss", "aud", "jti", "token_type"])
def test_required_claims_cannot_be_omitted(settings: Settings, missing: str) -> None:
    payload = claims(settings)
    del payload[missing]
    token = jwt.encode(payload, signing_key(settings), algorithm="HS256")
    with pytest.raises(InvalidAccessToken):
        decode_access_token(token, settings=settings)


@pytest.mark.parametrize("field,offset", [("exp", -60), ("iat", 60), ("nbf", 60)])
def test_expired_and_not_yet_valid_tokens_are_rejected(
    settings: Settings, field: str, offset: int,
) -> None:
    payload = claims(settings)
    payload[field] = int(datetime.now(UTC).timestamp()) + offset
    token = jwt.encode(payload, signing_key(settings), algorithm="HS256")
    with pytest.raises(InvalidAccessToken):
        decode_access_token(token, settings=settings)


def test_wrong_key_and_modified_payload_are_rejected(settings: Settings) -> None:
    token = jwt.encode(claims(settings), secrets.token_urlsafe(48), algorithm="HS256")
    with pytest.raises(InvalidAccessToken):
        decode_access_token(token, settings=settings)
    token = create_access_token(uuid4(), settings=settings)
    header, _, signature = token.split(".")
    with pytest.raises(InvalidAccessToken):
        decode_access_token(f"{header}.e30.{signature}", settings=settings)


@pytest.mark.parametrize("algorithm", ["none", "HS384"])
def test_unapproved_algorithms_are_rejected(settings: Settings, algorithm: str) -> None:
    key = "" if algorithm == "none" else signing_key(settings)
    token = jwt.encode(claims(settings), key, algorithm=algorithm)
    with pytest.raises(InvalidAccessToken):
        decode_access_token(token, settings=settings)


@pytest.mark.parametrize("token", ["", "not-a-token", "a.b.c", "x" * 4097])
def test_malformed_and_oversized_tokens_are_rejected(settings: Settings, token: str) -> None:
    with pytest.raises(InvalidAccessToken):
        decode_access_token(token, settings=settings)


@pytest.mark.parametrize("key", [None, "", "short-key", " " * 32])
def test_token_operations_require_a_configured_key(settings: Settings, key: str | None) -> None:
    config = settings.model_copy(
        update={"jwt_secret_key": SecretStr(key) if key is not None else None}
    )
    with pytest.raises(AuthConfigurationError):
        create_access_token(uuid4(), settings=config)
    with pytest.raises(AuthConfigurationError):
        decode_access_token("invalid", settings=config)


@pytest.mark.parametrize("minutes", [0, -1, 1441])
def test_invalid_token_lifetimes_are_rejected(minutes: int) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, access_token_expire_minutes=minutes)


def test_signing_key_is_hidden_from_settings_repr_and_json(settings: Settings) -> None:
    assert signing_key(settings) not in repr(settings)
    assert signing_key(settings) not in settings.model_dump_json()


def test_missing_signing_key_does_not_block_non_auth_settings() -> None:
    config = Settings(_env_file=None, jwt_secret_key=None)
    assert config.jwt_secret_key is None
