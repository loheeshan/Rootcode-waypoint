"""Identity storage; auth.security provides hashing and token helpers."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Uuid, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.fleet.models import Depot, Outlet


class RoleCode(StrEnum):
    DISPATCHER = "DISPATCHER"
    STORE_MANAGER = "STORE_MANAGER"
    DRIVER = "DRIVER"
    LOADER = "LOADER"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("email = lower(trim(email))", name="email_normalized"),
        CheckConstraint("length(email) > 0", name="email_not_empty"),
        CheckConstraint("length(password_hash) > 0", name="password_hash_not_empty"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=true())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    role_assignments: Mapped[list[UserRole]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    outlet_assignments: Mapped[list[UserOutlet]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    depot_assignments: Mapped[list[UserDepot]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = (
        CheckConstraint(
            "code IN ('DISPATCHER', 'STORE_MANAGER', 'DRIVER', 'LOADER')",
            name="code_allowed",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )

    user: Mapped[User] = relationship(back_populates="role_assignments")
    role: Mapped[Role] = relationship()


class UserOutlet(Base):
    """Explicit outlet assignment; a matching route role is also required for access."""

    __tablename__ = "user_outlets"

    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True,
    )
    outlet_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("outlets.id", ondelete="CASCADE"), primary_key=True, index=True,
    )
    user: Mapped[User] = relationship(back_populates="outlet_assignments")
    outlet: Mapped[Outlet] = relationship()


class UserDepot(Base):
    """Explicit depot assignment; it never grants outlet or trip access implicitly."""

    __tablename__ = "user_depots"

    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True,
    )
    depot_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("depots.id", ondelete="CASCADE"), primary_key=True, index=True,
    )
    user: Mapped[User] = relationship(back_populates="depot_assignments")
    depot: Mapped[Depot] = relationship()
