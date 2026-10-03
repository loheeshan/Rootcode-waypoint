from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.models import RoleCode, User, UserDepot
from app.auth.scopes import require_depot_access
from app.fleet.models import Depot, TemperatureType, Vehicle, VehicleType
from app.fleet.schemas import DepotResponse, FleetListResponse, VehicleResponse


def list_fleet(
    session: Session, user: User, *, depot_id: UUID | None, vehicle_type: VehicleType | None,
    temperature_type: TemperatureType | None, limit: int, offset: int,
) -> FleetListResponse:
    if depot_id is not None:
        require_depot_access(user, depot_id, role=RoleCode.DISPATCHER)
    allowed = select(UserDepot.depot_id).where(UserDepot.user_id == user.id)
    depots_query = select(Depot).where(Depot.id.in_(allowed))
    query = select(Vehicle).where(Vehicle.depot_id.in_(allowed))
    if depot_id is not None:
        depots_query = depots_query.where(Depot.id == depot_id)
        query = query.where(Vehicle.depot_id == depot_id)
    if vehicle_type is not None:
        query = query.where(Vehicle.type == vehicle_type)
    if temperature_type is not None:
        query = query.where(Vehicle.temperature_type == temperature_type)
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    vehicles = session.scalars(query.order_by(Vehicle.id).offset(offset).limit(limit)).all()
    # Depot choices include empty depots and do not depend on vehicle filters/pages.
    depots = session.scalars(depots_query.order_by(Depot.name, Depot.id)).all()
    return FleetListResponse(
        items=[VehicleResponse.model_validate(vehicle) for vehicle in vehicles],
        total=total, limit=limit, offset=offset,
        depots=[DepotResponse.model_validate(depot) for depot in depots],
    )
