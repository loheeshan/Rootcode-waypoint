from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.auth.models import RoleCode, User
from app.db.session import get_session
from app.fleet.models import TemperatureType, VehicleType
from app.fleet.schemas import FleetListResponse
from app.fleet.service import list_fleet

router = APIRouter(prefix="/fleet", tags=["fleet"])
DispatcherUser = Annotated[User, Depends(require_roles(RoleCode.DISPATCHER))]
Database = Annotated[Session, Depends(get_session)]


@router.get("", response_model=FleetListResponse)
def get_fleet(
    response: Response, user: DispatcherUser, session: Database,
    depot_id: UUID | None = None,
    vehicle_type: Annotated[VehicleType | None, Query(alias="type")] = None,
    temperature_type: TemperatureType | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> FleetListResponse:
    try:
        result = list_fleet(
            session, user, depot_id=depot_id, vehicle_type=vehicle_type,
            temperature_type=temperature_type, limit=limit, offset=offset,
        )
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Fleet unavailable",
                            headers={"Cache-Control": "no-store"}) from None
    response.headers["Cache-Control"] = "no-store"
    return result
