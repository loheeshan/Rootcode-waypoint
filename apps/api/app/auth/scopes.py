"""Check database-loaded assignments and route roles before accessing a resource."""

from uuid import UUID

from fastapi import HTTPException

from app.auth.models import RoleCode, User


def _forbidden() -> HTTPException:
    return HTTPException(status_code=403, detail="Insufficient permissions",
                         headers={"Cache-Control": "no-store"})


def _require_role(user: User, role: RoleCode) -> None:
    if not user.is_active or not any(
        assignment.role.code == role for assignment in user.role_assignments
    ):
        raise _forbidden()


def require_outlet_access(user: User, outlet_id: UUID, *, role: RoleCode) -> None:
    """The caller supplies the route's required role, never a role from client input."""
    _require_role(user, role)
    if not any(assignment.outlet_id == outlet_id for assignment in user.outlet_assignments):
        raise _forbidden()


def require_depot_access(user: User, depot_id: UUID, *, role: RoleCode) -> None:
    """Depot access does not imply access to a store endpoint or an assigned trip."""
    _require_role(user, role)
    if not any(assignment.depot_id == depot_id for assignment in user.depot_assignments):
        raise _forbidden()
