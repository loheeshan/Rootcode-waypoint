from datetime import date, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.audit.models import AuditAction, AuditEntity
from app.loading.schemas import LoaderTripResponse
from app.orders.models import OrderStatus
from app.planning.models import TripStatus


class ExceptionKind(StrEnum):
    LOAD_MISSING = "LOAD_MISSING"
    LOAD_DAMAGED = "LOAD_DAMAGED"
    DELIVERY_FAILED = "DELIVERY_FAILED"
    RECEIPT_PENDING = "RECEIPT_PENDING"
    SYNC_CONFLICT = "SYNC_CONFLICT"


class ExceptionSeverity(StrEnum):
    FAILURE = "FAILURE"
    PENDING = "PENDING"


class LoadingProgress(BaseModel):
    orders: int
    loaded: int
    missing: int
    damaged: int
    pending: int


class DeliveryProgress(BaseModel):
    stops_requiring_visit: int
    delivered_stops: int
    failed_stops: int
    open_stops: int
    delivered_orders: int
    receipts_confirmed: int


class OperationsTripResponse(BaseModel):
    trip: LoaderTripResponse
    loading: LoadingProgress
    delivery: DeliveryProgress


class OperationsTripListResponse(BaseModel):
    items: list[OperationsTripResponse]
    total: int
    limit: int
    offset: int


class OperationsSummaryResponse(BaseModel):
    delivery_date: date
    depot_ids: list[UUID]
    draft_plans: int
    published_plans: int
    trips_by_status: dict[TripStatus, int]
    orders_by_status: dict[OrderStatus, int]
    loading: LoadingProgress
    delivery: DeliveryProgress
    deferred_orders: int
    receipts_pending: int
    exceptions: dict[ExceptionKind, int]


class OperationsExceptionResponse(BaseModel):
    kind: ExceptionKind
    severity: ExceptionSeverity
    depot_id: UUID
    delivery_date: date
    trip_id: UUID
    stop_id: UUID | None
    outlet_id: UUID | None
    order_ids: list[UUID]
    occurred_at: datetime
    actor_id: UUID | None
    reason_code: str | None
    note: str | None
    source_id: UUID


class OperationsExceptionListResponse(BaseModel):
    items: list[OperationsExceptionResponse]
    total: int
    limit: int
    offset: int


class AuditEventResponse(BaseModel):
    id: UUID
    occurred_at: datetime
    actor_id: UUID
    action: AuditAction
    entity_type: AuditEntity
    entity_id: UUID
    depot_id: UUID
    trip_id: UUID | None
    source_id: UUID
    details: dict[str, Any]


class AuditListResponse(BaseModel):
    items: list[AuditEventResponse]
    total: int
    limit: int
    offset: int
