"""Outlet-scoped Store confirmation that a delivered order was received."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User, UserOutlet
from app.delivery.models import DeliveryEvent, DeliveryEventType
from app.loading.service import as_utc
from app.orders.models import Order, OrderStatus
from app.planning.assignment_models import AssignmentOutcome, PlanAssignment
from app.planning.publication_models import PlanPublication
from app.receipts.models import ReceiptConfirmation
from app.receipts.schemas import ReceiptRequest, ReceiptResponse


def get_receipt_time() -> datetime:
    return datetime.now(UTC)


def fail(status: int, detail: str) -> HTTPException:
    return HTTPException(status_code=status, detail=detail, headers={"Cache-Control": "no-store"})


def _scoped_order(session: Session, user: User, order_id: UUID, *, lock: bool = False) -> Order:
    allowed = select(UserOutlet.outlet_id).where(UserOutlet.user_id == user.id)
    query = select(Order).where(Order.id == order_id, Order.outlet_id.in_(allowed))
    order = session.scalar(query.with_for_update() if lock else query)
    if order is None:
        raise fail(404, "Order not found")
    return order


def _delivery_event(session: Session, order: Order) -> DeliveryEvent | None:
    """The DELIVERED event of the stop serving this order in its effective published plan."""
    events = session.scalars(
        select(DeliveryEvent)
        .join(PlanAssignment, PlanAssignment.trip_stop_id == DeliveryEvent.trip_stop_id)
        .join(PlanPublication, PlanPublication.plan_revision_id == PlanAssignment.plan_revision_id)
        .where(
            PlanAssignment.order_id == order.id,
            PlanAssignment.outcome == AssignmentOutcome.SERVED,
            DeliveryEvent.event_type == DeliveryEventType.DELIVERED,
        )
        .limit(2)
    ).all()
    # One publication per plan and one outcome per stop make this unique today; fail
    # loudly rather than choosing arbitrarily if re-planning ever breaks that.
    if len(events) > 1:
        raise ValueError("Order has more than one delivery record")
    return events[0] if events else None


def _response(session: Session, receipt: ReceiptConfirmation, order: Order) -> ReceiptResponse:
    event = session.get(DeliveryEvent, receipt.delivery_event_id)
    if event is None:
        raise ValueError("Receipt references a missing delivery event")
    return ReceiptResponse(
        request_id=receipt.id,
        order_id=receipt.order_id,
        outlet_id=receipt.outlet_id,
        order_status=OrderStatus(order.status),
        delivery_event_id=event.id,
        delivered_at=as_utc(event.occurred_at or event.recorded_at),
        confirmed_by=receipt.confirmed_by,
        confirmed_at=as_utc(receipt.confirmed_at),
    )


def confirm_receipt(
    session: Session, user: User, order_id: UUID, payload: ReceiptRequest, now: datetime
) -> tuple[ReceiptResponse, bool]:
    # The order row lock serializes confirmations; the unique order key is the backstop.
    order = _scoped_order(session, user, order_id, lock=True)
    existing = session.get(ReceiptConfirmation, payload.request_id)
    if existing is not None:
        if existing.order_id != order.id:
            raise fail(409, "Request ID was already used for another receipt")
        return _response(session, existing, order), False
    if session.scalar(
        select(ReceiptConfirmation.id).where(ReceiptConfirmation.order_id == order.id)
    ):
        raise fail(409, "Receipt is already confirmed for this order")
    if order.status != OrderStatus.DELIVERED:
        raise fail(409, "Only delivered orders can be confirmed as received")
    event = _delivery_event(session, order)
    if event is None:
        raise fail(409, "No delivery record exists for this order")
    receipt = ReceiptConfirmation(
        id=payload.request_id,
        order_id=order.id,
        outlet_id=order.outlet_id,
        delivery_event_id=event.id,
        confirmed_by=user.id,
        confirmed_at=now,
    )
    order.status = OrderStatus.RECEIPT_CONFIRMED
    session.add(receipt)
    session.flush()
    result = _response(session, receipt, order)
    session.commit()
    return result, True


def get_receipt(session: Session, user: User, order_id: UUID) -> ReceiptResponse:
    order = _scoped_order(session, user, order_id)
    receipt = session.scalar(
        select(ReceiptConfirmation).where(ReceiptConfirmation.order_id == order.id)
    )
    if receipt is None:
        raise fail(404, "Receipt not found")
    return _response(session, receipt, order)
