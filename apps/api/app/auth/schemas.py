from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, field_validator

from app.auth.models import RoleCode, User
from app.auth.security import MAX_PASSWORD_BYTES


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    email: EmailStr = Field(max_length=320)
    password: SecretStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def validate_password_size(cls, value: SecretStr) -> SecretStr:
        try:
            size = len(value.get_secret_value().encode("utf-8"))
        except UnicodeEncodeError as exc:
            raise ValueError("Password must contain valid UTF-8") from exc
        if not 0 < size <= MAX_PASSWORD_BYTES:
            raise ValueError("Password must contain between 1 and 1024 UTF-8 bytes")
        return value


class UserResponse(BaseModel):
    id: UUID
    email: str
    is_active: bool
    roles: list[RoleCode]
    outlet_ids: list[UUID]
    depot_ids: list[UUID]

    @classmethod
    def from_user(cls, user: User) -> "UserResponse":
        return cls(
            id=user.id, email=user.email, is_active=user.is_active,
            roles=sorted(RoleCode(assignment.role.code) for assignment in user.role_assignments),
            outlet_ids=sorted(assignment.outlet_id for assignment in user.outlet_assignments),
            depot_ids=sorted(assignment.depot_id for assignment in user.depot_assignments),
        )


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserResponse
