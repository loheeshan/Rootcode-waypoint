"""Capacity-only CP-SAT allocation. Results are not publishable delivery routes."""

from collections.abc import Sequence
from dataclasses import dataclass, field
from decimal import Decimal, localcontext
from enum import StrEnum
from math import isfinite
from typing import Literal
from uuid import UUID

from ortools.sat.python import cp_model

from app.planning.compatibility import (
    CompatibilityOrder,
    CompatibilityVehicle,
    build_compatibility_matrix,
)

MAX_ORDERS = 500
MAX_VEHICLES = 500
MAX_ASSIGNMENT_VARIABLES = 50_000
TRIPS_PER_VEHICLE = 2


class AllocationStatus(StrEnum):
    OPTIMAL = "OPTIMAL"
    FEASIBLE = "FEASIBLE"


class AllocationUnavailable(RuntimeError):
    """The solver did not produce a usable capacity allocation."""


@dataclass(frozen=True)
class CapacityTrip:
    vehicle_id: UUID
    trip_number: int
    order_ids: tuple[UUID, ...]
    weight_kg: Decimal
    volume_m3: Decimal


@dataclass(frozen=True)
class CapacityAllocation:
    status: AllocationStatus
    trips: tuple[CapacityTrip, ...]
    unallocated_order_ids: tuple[UUID, ...]
    is_complete_plan_validation: Literal[False] = field(default=False, init=False)


def _units(value: Decimal) -> int:
    """Scale exact three-place quantities to integers without rounding input."""
    if not value.is_finite() or not Decimal(0) < value < Decimal("1000000000"):
        raise ValueError("Allocation quantities must be positive and below 1000000000")
    with localcontext() as context:
        context.prec = 24
        if value != value.quantize(Decimal("0.001")):
            raise ValueError("Allocation quantities support at most three fractional digits")
        return int(value * 1000)


def _quantity(units: int) -> Decimal:
    with localcontext() as context:
        context.prec = 24
        return (Decimal(units) / 1000).quantize(Decimal("0.001"))


def allocate_capacity(
    orders: Sequence[CompatibilityOrder],
    vehicles: Sequence[CompatibilityVehicle],
    *,
    time_limit_seconds: float = 5.0,
) -> CapacityAllocation:
    """Maximize whole orders, then minimize trips, within the supplied day's inputs.

    Compatibility, combined weight/volume and two trip slots are hard constraints.
    Time windows, travel, fuel, existing published trips and reservations are NOT
    evaluated. Unallocated IDs are not business deferrals or evidence of individual
    infeasibility. Nothing is persisted. Callers must supply the complete eligible
    order set for one depot/day, not a page from the compatibility HTTP endpoint.
    """
    if (
        isinstance(time_limit_seconds, bool)
        or not isinstance(time_limit_seconds, (int, float))
        or not 0 < time_limit_seconds <= 30
        or not isfinite(time_limit_seconds)
    ):
        raise ValueError("Solver time limit must be greater than zero and at most 30 seconds")
    if len(orders) > MAX_ORDERS or len(vehicles) > MAX_VEHICLES:
        raise ValueError("Capacity allocation supports at most 500 orders and 500 vehicles")
    orders = tuple(sorted(orders, key=lambda item: item.id))
    vehicles = tuple(sorted(vehicles, key=lambda item: item.id))
    if len({item.depot_id for item in orders} | {item.depot_id for item in vehicles}) > 1:
        raise ValueError("Capacity allocation requires a single depot")
    weights = {order.id: _units(order.weight_kg) for order in orders}
    volumes = {order.id: _units(order.volume_m3) for order in orders}
    weight_caps = {vehicle.id: _units(vehicle.weight_cap_kg) for vehicle in vehicles}
    volume_caps = {vehicle.id: _units(vehicle.volume_cap_m3) for vehicle in vehicles}
    matrix = build_compatibility_matrix(orders, vehicles)
    variable_count = TRIPS_PER_VEHICLE * sum(len(row.candidate_vehicle_ids) for row in matrix)
    if variable_count > MAX_ASSIGNMENT_VARIABLES:
        raise ValueError("Capacity allocation supports at most 50000 assignment variables")
    if variable_count == 0:
        return CapacityAllocation(AllocationStatus.OPTIMAL, (), tuple(order.id for order in orders))

    model = cp_model.CpModel()
    assignments: dict[tuple[UUID, UUID, int], cp_model.IntVar] = {}
    slot_orders: dict[tuple[UUID, int], list[UUID]] = {}
    for row in matrix:
        order_vars = []
        for vehicle_id in row.candidate_vehicle_ids:
            for slot in range(1, TRIPS_PER_VEHICLE + 1):
                variable = model.new_bool_var(f"assign_{row.order_id}_{vehicle_id}_{slot}")
                assignments[row.order_id, vehicle_id, slot] = variable
                slot_orders.setdefault((vehicle_id, slot), []).append(row.order_id)
                order_vars.append(variable)
        model.add_at_most_one(order_vars)

    used_slots: dict[tuple[UUID, int], cp_model.IntVar] = {}
    for (vehicle_id, slot), order_ids in slot_orders.items():
        variables = [assignments[order_id, vehicle_id, slot] for order_id in order_ids]
        used = model.new_bool_var(f"used_{vehicle_id}_{slot}")
        used_slots[vehicle_id, slot] = used
        # Both directions matter: an unused slot is empty, and a used slot is nonempty.
        model.add(sum(variables) >= used)
        model.add(sum(variables) <= len(variables) * used)
        model.add(
            sum(weights[order_id] * variable for order_id, variable in zip(order_ids, variables))
            <= weight_caps[vehicle_id]
        )
        model.add(
            sum(volumes[order_id] * variable for order_id, variable in zip(order_ids, variables))
            <= volume_caps[vehicle_id]
        )
    for vehicle in vehicles:
        if (vehicle.id, 1) in used_slots:
            model.add(used_slots[vehicle.id, 1] >= used_slots[vehicle.id, 2])

    # One additional order always outweighs every possible trip-count improvement.
    model.maximize((len(used_slots) + 1) * sum(assignments.values()) - sum(used_slots.values()))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(time_limit_seconds)
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # UNKNOWN is not an empty/infeasible plan. Never extract nonexistent values.
        raise AllocationUnavailable("Capacity solver did not return a usable solution")

    groups: dict[UUID, list[tuple[UUID, ...]]] = {}
    for (vehicle_id, slot), order_ids in slot_orders.items():
        selected = tuple(
            order_id
            for order_id in order_ids
            if solver.value(assignments[order_id, vehicle_id, slot])
        )
        if selected:
            groups.setdefault(vehicle_id, []).append(selected)
    trips = tuple(
        CapacityTrip(
            vehicle_id=vehicle_id,
            trip_number=number,
            order_ids=order_ids,
            weight_kg=_quantity(sum(weights[order_id] for order_id in order_ids)),
            volume_m3=_quantity(sum(volumes[order_id] for order_id in order_ids)),
        )
        for vehicle_id, vehicle_groups in sorted(groups.items())
        for number, order_ids in enumerate(sorted(vehicle_groups), start=1)
    )
    allocated_ids = {order_id for trip in trips for order_id in trip.order_ids}
    return CapacityAllocation(
        status=AllocationStatus.OPTIMAL
        if status == cp_model.OPTIMAL
        else AllocationStatus.FEASIBLE,
        trips=trips,
        unallocated_order_ids=tuple(order.id for order in orders if order.id not in allocated_ids),
    )
