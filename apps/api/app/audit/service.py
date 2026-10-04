"""Add audit rows inside the caller's transaction; the caller commits with the change."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.audit.models import AuditAction, AuditEntity, AuditEvent


def record_audit(
    session: Session,
    *,
    actor_id: UUID,
    action: AuditAction,
    entity_type: AuditEntity,
    entity_id: UUID,
    depot_id: UUID,
    trip_id: UUID | None,
    source_id: UUID,
    occurred_at: datetime,
    details: dict[str, Any],
    dedupe_suffix: str = "",
) -> None:
    """Never pass credentials, tokens, POD bytes or receiver names in `details`."""
    session.add(
        AuditEvent(
            occurred_at=occurred_at,
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            depot_id=depot_id,
            trip_id=trip_id,
            source_id=source_id,
            dedupe_key=f"{action}:{source_id}{dedupe_suffix}",
            details=details,
        )
    )
