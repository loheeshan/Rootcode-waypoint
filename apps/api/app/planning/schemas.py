from datetime import UTC, date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.planning.models import Plan, PlanStatus


def utc_timestamp(value: datetime) -> datetime:
    # SQLite's database-time default is naive UTC; PostgreSQL retains timezone metadata.
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class PlanCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    depot_id: UUID
    delivery_date: date

    @field_validator("delivery_date", mode="before")
    @classmethod
    def require_iso_date(cls, value: object) -> object:
        if not isinstance(value, str) or len(value) != 10:
            raise ValueError("Use a delivery date in YYYY-MM-DD format")
        try:
            parsed = date.fromisoformat(value)
        except ValueError:
            raise ValueError("Use a delivery date in YYYY-MM-DD format") from None
        if parsed.isoformat() != value:
            raise ValueError("Use a delivery date in YYYY-MM-DD format")
        return parsed


class PlanResponse(BaseModel):
    id: UUID
    depot_id: UUID
    delivery_date: date
    status: PlanStatus
    created_by: UUID
    created_at: datetime

    @classmethod
    def from_plan(cls, plan: Plan) -> "PlanResponse":
        return cls(
            id=plan.id,
            depot_id=plan.depot_id,
            delivery_date=plan.delivery_date,
            status=PlanStatus(plan.status),
            created_by=plan.created_by,
            created_at=utc_timestamp(plan.created_at),
        )


class PlanRevisionResponse(BaseModel):
    id: UUID
    revision_number: int
    status: PlanStatus
    published_at: datetime | None
    trip_count: int
    served_order_count: int
    deferred_order_count: int
    unexplained_deferred_count: int


class PlanDetailResponse(PlanResponse):
    revisions: list[PlanRevisionResponse]


class PlanListResponse(BaseModel):
    items: list[PlanResponse]
    total: int
    limit: int
    offset: int
