from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.fleet.schemas import VehicleResponse
from app.orders.dispatcher_schemas import DispatcherOrderResponse
from app.planning.compatibility import CompatibilityIssue


class VehicleExclusionResponse(BaseModel):
    vehicle_id: UUID
    reasons: list[CompatibilityIssue]


class OrderCompatibilityResponse(BaseModel):
    order: DispatcherOrderResponse
    candidate_vehicle_ids: list[UUID]
    excluded_vehicles: list[VehicleExclusionResponse]


class CompatibilityVehicleResponse(BaseModel):
    vehicle: VehicleResponse
    is_available: bool | None


class PlanCompatibilityResponse(BaseModel):
    plan_id: UUID
    depot_id: UUID
    delivery_date: date
    is_complete_plan_validation: Literal[False] = False
    items: list[OrderCompatibilityResponse]
    vehicles: list[CompatibilityVehicleResponse]
    total: int
    limit: int
    offset: int
