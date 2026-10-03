from datetime import date
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.models import RoleCode, User, UserDepot
from app.auth.scopes import require_depot_access
from app.fleet.models import Depot, Outlet
from app.fleet.schemas import DepotResponse, OutletResponse
from app.orders.dispatcher_schemas import DispatcherOrderListResponse, DispatcherOrderResponse
from app.orders.models import Order, OrderStatus
from app.orders.schemas import OrderResponse


def list_dispatcher_orders(
    session: Session, user: User, *, depot_id: UUID | None, outlet_id: UUID | None,
    status: OrderStatus | None, delivery_date: date | None, limit: int, offset: int,
) -> DispatcherOrderListResponse:
    if depot_id is not None:
        require_depot_access(user, depot_id, role=RoleCode.DISPATCHER)
    allowed = select(UserDepot.depot_id).where(UserDepot.user_id == user.id)
    if outlet_id is not None:
        # Dispatcher outlet access follows its depot, never Store UserOutlet grants.
        accessible = session.scalar(select(Outlet.id).where(
            Outlet.id == outlet_id, Outlet.depot_id.in_(allowed),
        ))
        if accessible is None:
            raise HTTPException(status_code=403, detail="Insufficient permissions",
                                headers={"Cache-Control": "no-store"})
    query = (select(Order, Outlet, Depot)
             .join(Outlet, Order.outlet_id == Outlet.id)
             .join(Depot, Outlet.depot_id == Depot.id)
             .where(Outlet.depot_id.in_(allowed)))
    if depot_id is not None:
        query = query.where(Outlet.depot_id == depot_id)
    if outlet_id is not None:
        query = query.where(Order.outlet_id == outlet_id)
    if status is not None:
        query = query.where(Order.status == status)
    if delivery_date is not None:
        query = query.where(Order.requested_delivery_date == delivery_date)
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = session.execute(query.order_by(Order.created_at.desc(), Order.id.desc())
                           .offset(offset).limit(limit)).all()
    return DispatcherOrderListResponse(
        items=[DispatcherOrderResponse(
            **OrderResponse.from_order(order).model_dump(),
            outlet=OutletResponse.model_validate(outlet), depot=DepotResponse.model_validate(depot),
        ) for order, outlet, depot in rows],
        total=total, limit=limit, offset=offset,
    )
