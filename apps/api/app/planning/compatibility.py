"""Deterministic individual-order checks. Candidates are not allocated or route-validated."""

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from app.fleet.models import ParkingConstraint, TemperatureType, VehicleType
from app.orders.models import TemperatureRequirement


class CompatibilityIssue(StrEnum):
    DEPOT_MISMATCH = "DEPOT_MISMATCH"
    TEMPERATURE_MISMATCH = "TEMPERATURE_MISMATCH"
    VAN_REQUIRED = "VAN_REQUIRED"
    WEIGHT_CAPACITY = "WEIGHT_CAPACITY"
    VOLUME_CAPACITY = "VOLUME_CAPACITY"
    VEHICLE_UNAVAILABLE = "VEHICLE_UNAVAILABLE"
    AVAILABILITY_UNKNOWN = "AVAILABILITY_UNKNOWN"


def positive_quantity(value: Decimal) -> None:
    if not isinstance(value, Decimal) or not value.is_finite() or value <= 0:
        raise ValueError("Compatibility quantities must be finite positive Decimals")


def identifiers(identifier: UUID, depot_id: UUID) -> None:
    if not isinstance(identifier, UUID) or not isinstance(depot_id, UUID):
        raise ValueError("Compatibility identifiers must be UUIDs")


@dataclass(frozen=True)
class CompatibilityOrder:
    id: UUID
    depot_id: UUID
    temperature_requirement: TemperatureRequirement
    parking_constraint: ParkingConstraint
    weight_kg: Decimal
    volume_m3: Decimal

    def __post_init__(self) -> None:
        identifiers(self.id, self.depot_id)
        positive_quantity(self.weight_kg)
        positive_quantity(self.volume_m3)
        if not isinstance(self.temperature_requirement, TemperatureRequirement):
            raise ValueError("Unsupported order temperature requirement")
        if not isinstance(self.parking_constraint, ParkingConstraint):
            raise ValueError("Unsupported outlet parking constraint")


@dataclass(frozen=True)
class CompatibilityVehicle:
    id: UUID
    depot_id: UUID
    type: VehicleType
    temperature_type: TemperatureType
    weight_cap_kg: Decimal
    volume_cap_m3: Decimal
    is_available: bool | None

    def __post_init__(self) -> None:
        identifiers(self.id, self.depot_id)
        positive_quantity(self.weight_cap_kg)
        positive_quantity(self.volume_cap_m3)
        if not isinstance(self.type, VehicleType) or not isinstance(
            self.temperature_type, TemperatureType
        ):
            raise ValueError("Unsupported vehicle type or temperature type")
        if self.is_available is not None and type(self.is_available) is not bool:
            raise ValueError("Availability must be True, False or None")


@dataclass(frozen=True)
class VehicleExclusion:
    vehicle_id: UUID
    reasons: tuple[CompatibilityIssue, ...]


@dataclass(frozen=True)
class OrderCompatibility:
    order_id: UUID
    candidate_vehicle_ids: tuple[UUID, ...]
    excluded_vehicles: tuple[VehicleExclusion, ...]


def exclusion_reasons(
    order: CompatibilityOrder,
    vehicle: CompatibilityVehicle,
) -> tuple[CompatibilityIssue, ...]:
    """Return every failed pair check, in the documented stable rule order."""
    reasons: list[CompatibilityIssue] = []
    if order.depot_id != vehicle.depot_id:
        reasons.append(CompatibilityIssue.DEPOT_MISMATCH)
    if (
        order.temperature_requirement == TemperatureRequirement.CHILLED
        and vehicle.temperature_type != TemperatureType.REEFER
    ):
        reasons.append(CompatibilityIssue.TEMPERATURE_MISMATCH)
    if order.parking_constraint == ParkingConstraint.VAN_ONLY and vehicle.type != VehicleType.VAN:
        reasons.append(CompatibilityIssue.VAN_REQUIRED)
    if order.weight_kg > vehicle.weight_cap_kg:
        reasons.append(CompatibilityIssue.WEIGHT_CAPACITY)
    if order.volume_m3 > vehicle.volume_cap_m3:
        reasons.append(CompatibilityIssue.VOLUME_CAPACITY)
    if vehicle.is_available is None:
        reasons.append(CompatibilityIssue.AVAILABILITY_UNKNOWN)
    elif not vehicle.is_available:
        reasons.append(CompatibilityIssue.VEHICLE_UNAVAILABLE)
    return tuple(reasons)


def build_compatibility_matrix(
    orders: Sequence[CompatibilityOrder],
    vehicles: Sequence[CompatibilityVehicle],
) -> tuple[OrderCompatibility, ...]:
    """Evaluate each whole order independently; no shared capacity is consumed here."""
    if len({order.id for order in orders}) != len(orders):
        raise ValueError("Duplicate order IDs in compatibility input")
    if len({vehicle.id for vehicle in vehicles}) != len(vehicles):
        raise ValueError("Duplicate vehicle IDs in compatibility input")
    ordered_vehicles = sorted(vehicles, key=lambda vehicle: vehicle.id)
    results = []
    for order in sorted(orders, key=lambda item: item.id):
        candidates = []
        excluded = []
        for vehicle in ordered_vehicles:
            reasons = exclusion_reasons(order, vehicle)
            if reasons:
                excluded.append(VehicleExclusion(vehicle.id, reasons))
            else:
                candidates.append(vehicle.id)
        results.append(OrderCompatibility(order.id, tuple(candidates), tuple(excluded)))
    return tuple(results)
