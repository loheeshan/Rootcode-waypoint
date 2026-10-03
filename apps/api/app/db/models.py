"""Import each domain's models here so Alembic sees the complete schema."""

from app.auth.models import Role, User, UserDepot, UserOutlet, UserRole
from app.db.base import Base
from app.fleet.models import Depot, Outlet, Vehicle
from app.orders.models import Order
from app.planning.assignment_models import DeferralDecision, PlanAssignment
from app.planning.models import Plan, PlanRevision, Trip, TripStop

__all__ = [
    "Base", "DeferralDecision", "Depot", "Order", "Outlet", "Plan", "PlanAssignment",
    "PlanRevision", "Role", "Trip", "TripStop", "User",
    "UserDepot", "UserOutlet", "UserRole", "Vehicle",
]
