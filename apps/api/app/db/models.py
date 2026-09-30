"""Import each domain's models here so Alembic sees the complete schema."""

from app.auth.models import Role, User, UserRole
from app.db.base import Base

__all__ = ["Base", "Role", "User", "UserRole"]
