from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.auth.models import RoleCode, User
from app.db.session import get_session
from app.orders.dispatcher_schemas import DispatcherOrderListResponse
from app.orders.dispatcher_service import list_dispatcher_orders
from app.orders.models import OrderStatus

router = APIRouter(prefix="/dispatcher/orders", tags=["dispatcher-orders"])
DispatcherUser = Annotated[User, Depends(require_roles(RoleCode.DISPATCHER))]
Database = Annotated[Session, Depends(get_session)]


@router.get("", response_model=DispatcherOrderListResponse)
def get_orders(
    response: Response, user: DispatcherUser, session: Database,
    depot_id: UUID | None = None, outlet_id: UUID | None = None,
    status: OrderStatus | None = None, requested_delivery_date: date | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> DispatcherOrderListResponse:
    try:
        result = list_dispatcher_orders(
            session, user, depot_id=depot_id, outlet_id=outlet_id, status=status,
            delivery_date=requested_delivery_date, limit=limit, offset=offset,
        )
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Orders unavailable",
                            headers={"Cache-Control": "no-store"}) from None
    response.headers["Cache-Control"] = "no-store"
    return result
