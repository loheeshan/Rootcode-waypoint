from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.models import RoleCode, User, UserOutlet
from app.auth.scopes import require_outlet_access
from app.orders.models import Order, OrderStatus
from app.orders.schemas import (
    OrderCreateRequest,
    OrderCreateResponse,
    OrderListResponse,
    OrderResponse,
)

COLOMBO = ZoneInfo("Asia/Colombo")
CUTOFF = time(16)


def get_order_time() -> datetime:
    return datetime.now(UTC)


def accepted_delivery_date(requested: date, now: datetime) -> date:
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Order submission clock must be timezone-aware")
    local = now.astimezone(COLOMBO)
    tomorrow = local.date() + timedelta(days=1)
    if requested < tomorrow:
        raise HTTPException(status_code=422,
                            detail="Delivery date must be after today in Asia/Colombo")
    if requested == tomorrow and local.time() >= CUTOFF:
        return tomorrow + timedelta(days=1)
    return requested


def create_store_order(
    session: Session, user: User, payload: OrderCreateRequest, now: datetime,
) -> OrderCreateResponse:
    require_outlet_access(user, payload.outlet_id, role=RoleCode.STORE_MANAGER)
    accepted = accepted_delivery_date(payload.requested_delivery_date, now)
    order = Order(
        outlet_id=payload.outlet_id, requested_delivery_date=accepted,
        temperature_requirement=payload.temperature_requirement,
        order_weight_kg=payload.order_weight_kg, order_volume_m3=payload.order_volume_m3,
        status=OrderStatus.CONFIRMED,
    )
    session.add(order)
    session.flush()
    result = OrderCreateResponse(
        order=OrderResponse.from_order(order),
        submitted_delivery_date=payload.requested_delivery_date,
        cutoff_applied=accepted != payload.requested_delivery_date,
    )
    session.commit()
    return result


def list_store_orders(
    session: Session, user: User, *, outlet_id: UUID | None, status: OrderStatus | None,
    delivery_date: date | None, limit: int, offset: int,
) -> OrderListResponse:
    if outlet_id is not None:
        require_outlet_access(user, outlet_id, role=RoleCode.STORE_MANAGER)
    # Apply access in SQL before counting or paginating, including after grant revocation.
    allowed = select(UserOutlet.outlet_id).where(UserOutlet.user_id == user.id)
    query = select(Order).where(Order.outlet_id.in_(allowed))
    if outlet_id is not None:
        query = query.where(Order.outlet_id == outlet_id)
    if status is not None:
        query = query.where(Order.status == status)
    if delivery_date is not None:
        query = query.where(Order.requested_delivery_date == delivery_date)
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    orders = session.scalars(query.order_by(Order.created_at.desc(), Order.id.desc())
                             .offset(offset).limit(limit)).all()
    return OrderListResponse(items=[OrderResponse.from_order(order) for order in orders],
                             total=total, limit=limit, offset=offset)


def get_store_order(session: Session, user: User, order_id: UUID) -> OrderResponse:
    allowed = select(UserOutlet.outlet_id).where(UserOutlet.user_id == user.id)
    order = session.scalars(select(Order).where(
        Order.id == order_id, Order.outlet_id.in_(allowed),
    )).one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found",
                            headers={"Cache-Control": "no-store"})
    return OrderResponse.from_order(order)
