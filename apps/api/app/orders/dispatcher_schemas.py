from pydantic import BaseModel

from app.fleet.schemas import DepotResponse, OutletResponse
from app.orders.schemas import OrderResponse


class DispatcherOrderResponse(OrderResponse):
    outlet: OutletResponse
    depot: DepotResponse


class DispatcherOrderListResponse(BaseModel):
    items: list[DispatcherOrderResponse]
    total: int
    limit: int
    offset: int
