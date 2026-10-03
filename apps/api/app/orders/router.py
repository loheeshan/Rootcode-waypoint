from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.auth.models import RoleCode, User
from app.db.session import get_session
from app.orders.models import OrderStatus
from app.orders.schemas import (
    OrderCreateRequest,
    OrderCreateResponse,
    OrderListResponse,
    OrderResponse,
)
from app.orders.service import (
    create_store_order,
    get_order_time,
    get_store_order,
    list_store_orders,
)

router = APIRouter(prefix="/store/orders", tags=["store-orders"])
StoreUser = Annotated[User, Depends(require_roles(RoleCode.STORE_MANAGER))]
Database = Annotated[Session, Depends(get_session)]


def unavailable() -> HTTPException:
    return HTTPException(status_code=503, detail="Orders unavailable",
                         headers={"Cache-Control": "no-store"})


@router.post("", response_model=OrderCreateResponse, status_code=201)
def create_order(
    payload: OrderCreateRequest, response: Response, user: StoreUser, session: Database,
    now: Annotated[datetime, Depends(get_order_time)],
) -> OrderCreateResponse:
    try:
        result = create_store_order(session, user, payload, now)
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409, detail="Order could not be created; refresh outlet access",
            headers={"Cache-Control": "no-store"},
        ) from None
    except SQLAlchemyError:
        session.rollback()
        raise unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    response.headers["Location"] = f"/api/v1/store/orders/{result.order.id}"
    return result


@router.get("", response_model=OrderListResponse)
def list_orders(
    response: Response, user: StoreUser, session: Database,
    outlet_id: UUID | None = None, status: OrderStatus | None = None,
    requested_delivery_date: date | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> OrderListResponse:
    try:
        result = list_store_orders(
            session, user, outlet_id=outlet_id, status=status,
            delivery_date=requested_delivery_date, limit=limit, offset=offset,
        )
    except SQLAlchemyError:
        raise unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    return result


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: UUID, response: Response, user: StoreUser, session: Database,
) -> OrderResponse:
    try:
        result = get_store_order(session, user, order_id)
    except SQLAlchemyError:
        raise unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    return result
