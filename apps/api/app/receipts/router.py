from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.auth.models import RoleCode, User
from app.db.session import get_session
from app.receipts.schemas import ReceiptRequest, ReceiptResponse
from app.receipts.service import confirm_receipt, get_receipt, get_receipt_time

router = APIRouter(prefix="/store/orders", tags=["store-receipts"])
StoreUser = Annotated[User, Depends(require_roles(RoleCode.STORE_MANAGER))]
Database = Annotated[Session, Depends(get_session)]
NO_STORE = {"Cache-Control": "no-store"}


@router.post(
    "/{order_id}/receipt",
    response_model=ReceiptResponse,
    status_code=201,
    responses={200: {"model": ReceiptResponse, "description": "Saved request replay"}},
)
def post_receipt(
    order_id: UUID,
    payload: ReceiptRequest,
    response: Response,
    user: StoreUser,
    session: Database,
    now: Annotated[datetime, Depends(get_receipt_time)],
) -> ReceiptResponse:
    try:
        result, created = confirm_receipt(session, user, order_id, payload, now)
    except HTTPException:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Receipt conflict; reload the order", NO_STORE) from None
    except (SQLAlchemyError, ValueError):
        session.rollback()
        raise HTTPException(
            503, "Receipts unavailable; retry with the same request ID", NO_STORE
        ) from None
    response.status_code = 201 if created else 200
    response.headers["Cache-Control"] = "no-store"
    response.headers["Location"] = f"/api/v1/store/orders/{order_id}/receipt"
    return result


@router.get("/{order_id}/receipt", response_model=ReceiptResponse)
def read_receipt(
    order_id: UUID, response: Response, user: StoreUser, session: Database
) -> ReceiptResponse:
    try:
        result = get_receipt(session, user, order_id)
    except (SQLAlchemyError, ValueError):
        raise HTTPException(503, "Receipts unavailable", NO_STORE) from None
    response.headers["Cache-Control"] = "no-store"
    return result
