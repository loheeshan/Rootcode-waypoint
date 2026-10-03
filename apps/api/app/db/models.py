"""Import each domain's models here so Alembic sees the complete schema."""

from app.auth.models import Role, User, UserDepot, UserOutlet, UserRole
from app.db.base import Base
from app.fleet.models import Depot, Outlet, Vehicle
from app.orders.models import Order

__all__ = [
    "Base", "Depot", "Order", "Outlet", "Role", "User",
    "UserDepot", "UserOutlet", "UserRole", "Vehicle",
]
