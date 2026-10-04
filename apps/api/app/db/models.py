"""Import each domain's models here so Alembic sees the complete schema."""

from app.auth.models import Role, User, UserDepot, UserOutlet, UserRole
from app.db.base import Base
from app.fleet.models import Depot, Outlet, Vehicle
from app.fleet.operations_models import VehicleAvailability, VehicleFuelUsage
from app.orders.models import Order
from app.planning.assignment_models import DeferralDecision, PlanAssignment
from app.planning.models import Plan, PlanRevision, Trip, TripStop
from app.planning.optimization_models import PlanOptimization

__all__ = [
    "Base", "DeferralDecision", "Depot", "Order", "Outlet", "Plan", "PlanAssignment",
    "PlanOptimization", "PlanRevision", "Role", "Trip", "TripStop", "User",
    "UserDepot", "UserOutlet", "UserRole", "Vehicle", "VehicleAvailability", "VehicleFuelUsage",
]
