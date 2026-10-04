from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.orders.models import OrderStatus


class ReceiptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    request_id: UUID


class ReceiptResponse(BaseModel):
    request_id: UUID
    order_id: UUID
    outlet_id: UUID
    order_status: OrderStatus
    delivery_event_id: UUID
    delivered_at: datetime
    confirmed_by: UUID
    confirmed_at: datetime
