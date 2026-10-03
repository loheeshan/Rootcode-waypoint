"""Import each domain's models here so Alembic sees the complete schema."""

from app.auth.models import Role, User, UserRole
from app.db.base import Base
from app.fleet.models import Depot, Outlet, Vehicle

__all__ = ["Base", "Depot", "Outlet", "Role", "User", "UserRole", "Vehicle"]
