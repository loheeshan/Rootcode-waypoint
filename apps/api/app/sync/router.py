from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.auth.models import RoleCode, User
from app.db.session import get_session
from app.sync.schemas import SyncBatchRequest, SyncBatchResponse
from app.sync.service import get_sync_time, sync_events

router = APIRouter(prefix="/sync", tags=["sync"])
FieldUser = Annotated[User, Depends(require_roles(RoleCode.DRIVER, RoleCode.LOADER))]
Database = Annotated[Session, Depends(get_session)]


@router.post("/events", response_model=SyncBatchResponse)
def post_sync_events(
    payload: SyncBatchRequest,
    response: Response,
    user: FieldUser,
    session: Database,
    now: Annotated[datetime, Depends(get_sync_time)],
) -> SyncBatchResponse:
    try:
        result = sync_events(session, user, payload, now)
    except SQLAlchemyError:
        session.rollback()
        raise HTTPException(
            503, "Sync unavailable; retry the batch unchanged", {"Cache-Control": "no-store"}
        ) from None
    response.headers["Cache-Control"] = "no-store"
    return result
