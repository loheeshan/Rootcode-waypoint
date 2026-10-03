from datetime import time
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_serializer

from app.fleet.models import ParkingConstraint, TemperatureType, VehicleType


class DepotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class OutletResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    brand: str
    district: str
    depot_id: UUID
    dock_type: str
    parking_constraint: ParkingConstraint
    window_open_time: time
    window_close_time: time
    mall_window: bool


class VehicleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: VehicleType
    temperature_type: TemperatureType
    weight_cap_kg: Decimal
    volume_cap_m3: Decimal
    km_per_l: Decimal
    weekly_fuel_quota_l: Decimal
    depot_id: UUID

    @field_serializer("weight_cap_kg", "volume_cap_m3", "km_per_l", "weekly_fuel_quota_l")
    def serialize_quantity(self, value: Decimal) -> str:
        return format(value, ".3f")


class FleetListResponse(BaseModel):
    items: list[VehicleResponse]
    total: int
    limit: int
    offset: int
    depots: list[DepotResponse]
