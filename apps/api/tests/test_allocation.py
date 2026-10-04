"""Check capacity allocation independently of the solver's model construction."""

from dataclasses import FrozenInstanceError, replace
from decimal import Decimal, localcontext
from itertools import permutations, product
from random import Random
from unittest.mock import patch
from uuid import UUID

import pytest
from ortools.sat.python import cp_model
from test_compatibility import order, vehicle

from app.fleet.models import ParkingConstraint, TemperatureType, VehicleType
from app.orders.models import TemperatureRequirement
from app.planning.allocation import (
    AllocationStatus,
    AllocationUnavailable,
    allocate_capacity,
)


def allowed(item, truck):
    return (
        item.depot_id == truck.depot_id
        and truck.is_available is True
        and (
            item.temperature_requirement != TemperatureRequirement.CHILLED
            or truck.temperature_type == TemperatureType.REEFER
        )
        and (item.parking_constraint != ParkingConstraint.VAN_ONLY or truck.type == VehicleType.VAN)
    )


def check_result(result, orders, vehicles):
    """Recompute coverage and constraints from raw inputs, without engine helpers."""
    by_order = {item.id: item for item in orders}
    by_vehicle = {item.id: item for item in vehicles}
    allocated = []
    slots = set()
    for trip in result.trips:
        truck = by_vehicle[trip.vehicle_id]
        assert trip.trip_number in (1, 2)
        assert (trip.vehicle_id, trip.trip_number) not in slots
        slots.add((trip.vehicle_id, trip.trip_number))
        assert trip.order_ids and trip.order_ids == tuple(sorted(trip.order_ids))
        items = [by_order[identifier] for identifier in trip.order_ids]
        assert all(allowed(item, truck) for item in items)
        assert trip.weight_kg == sum(item.weight_kg for item in items) <= truck.weight_cap_kg
        assert trip.volume_m3 == sum(item.volume_m3 for item in items) <= truck.volume_cap_m3
        allocated.extend(trip.order_ids)
    assert len(allocated) == len(set(allocated))
    assert set(allocated).isdisjoint(result.unallocated_order_ids)
    assert set(allocated) | set(result.unallocated_order_ids) == set(by_order)
    assert len(result.unallocated_order_ids) == len(set(result.unallocated_order_ids))
    assert result.unallocated_order_ids == tuple(sorted(result.unallocated_order_ids))
    assert result.is_complete_plan_validation is False
    return len(allocated), len(result.trips)


def brute_force_score(orders, vehicles):
    """Independent enumeration of all whole-order placements for tiny test days."""
    slots = [(truck, number) for truck in vehicles for number in (1, 2)]
    best = (0, 0)
    for choices in product(range(-1, len(slots)), repeat=len(orders)):
        loads = {}
        for item, index in zip(orders, choices):
            if index >= 0:
                loads.setdefault(index, []).append(item)
        if any(
            not all(allowed(item, slots[index][0]) for item in items)
            or sum(item.weight_kg for item in items) > slots[index][0].weight_cap_kg
            or sum(item.volume_m3 for item in items) > slots[index][0].volume_cap_m3
            for index, items in loads.items()
        ):
            continue
        best = max(best, (sum(choice >= 0 for choice in choices), -len(loads)))
    return best


@pytest.mark.parametrize("dimension", ["weight", "volume"])
def test_combined_load_and_third_trip_are_rejected(dimension):
    quantities = (
        {"weight_kg": Decimal("6"), "volume_m3": Decimal("0.1")}
        if dimension == "weight"
        else {"weight_kg": Decimal("1"), "volume_m3": Decimal("0.6")}
    )
    orders = [order(id=UUID(int=i), **quantities) for i in range(10, 13)]
    vehicles = [vehicle()]
    result = allocate_capacity(orders, vehicles)
    assert result.status == AllocationStatus.OPTIMAL
    assert check_result(result, orders, vehicles) == (2, 2)
    assert len(result.unallocated_order_ids) == 1


def test_exact_decimal_boundary_and_minimum_trip_objective():
    orders = [
        order(id=UUID(int=10), weight_kg=Decimal("0.100"), volume_m3=Decimal("0.100")),
        order(id=UUID(int=11), weight_kg=Decimal("0.200"), volume_m3=Decimal("0.200")),
    ]
    vehicles = [vehicle(weight_cap_kg=Decimal("0.300"), volume_cap_m3=Decimal("0.300"))]
    result = allocate_capacity(orders, vehicles)
    assert check_result(result, orders, vehicles) == (2, 1)
    assert result.trips[0].trip_number == 1
    assert result.trips[0].weight_kg == Decimal("0.300")


def test_serving_more_orders_has_priority_over_fewer_trips():
    orders = [order(id=UUID(int=i), weight_kg=Decimal("5")) for i in range(10, 14)]
    vehicles = [vehicle()]
    result = allocate_capacity(orders, vehicles)
    assert check_result(result, orders, vehicles) == (4, 2)


def test_solver_preserves_scarce_reefer_for_chilled_orders():
    orders = [
        order(id=UUID(int=i), weight_kg=Decimal("10"), temperature_requirement=requirement)
        for i, requirement in (
            (10, TemperatureRequirement.AMBIENT),
            (11, TemperatureRequirement.CHILLED),
            (12, TemperatureRequirement.CHILLED),
        )
    ]
    vehicles = [vehicle(), vehicle(id=UUID(int=21), temperature_type=TemperatureType.AMBIENT)]
    result = allocate_capacity(orders, vehicles)
    assert check_result(result, orders, vehicles) == (3, 3)
    ambient_trip = next(trip for trip in result.trips if UUID(int=10) in trip.order_ids)
    assert ambient_trip.vehicle_id == UUID(int=21)


@pytest.mark.parametrize(
    "changes",
    [
        {"is_available": None},
        {"is_available": False},
        {"type": VehicleType.TRUCK},
        {"temperature_type": TemperatureType.AMBIENT},
        {"weight_cap_kg": Decimal("5")},
        {"volume_cap_m3": Decimal("0.499")},
    ],
)
def test_all_individual_restrictions_survive_allocation(changes):
    orders = [
        order(
            temperature_requirement=TemperatureRequirement.CHILLED,
            parking_constraint=ParkingConstraint.VAN_ONLY,
        )
    ]
    vehicles = [vehicle(**changes)]
    result = allocate_capacity(orders, vehicles)
    assert check_result(result, orders, vehicles) == (0, 0)
    assert result.unallocated_order_ids == (orders[0].id,)


@pytest.mark.parametrize("orders,vehicles", [([], []), ([], [vehicle()]), ([order()], [])])
def test_empty_inputs_have_complete_accounting(orders, vehicles):
    result = allocate_capacity(orders, vehicles)
    assert result.status == AllocationStatus.OPTIMAL
    assert check_result(result, orders, vehicles) == (0, 0)


def test_permutations_do_not_change_unlimited_small_solution_and_inputs_are_immutable():
    orders = [order(id=UUID(int=i), weight_kg=Decimal("5")) for i in range(10, 13)]
    vehicles = [vehicle(), vehicle(id=UUID(int=21))]
    before = (tuple(orders), tuple(vehicles))
    result = allocate_capacity(orders, vehicles)
    for order_sequence in permutations(orders):
        for vehicle_sequence in permutations(vehicles):
            assert allocate_capacity(order_sequence, vehicle_sequence) == result
    assert (tuple(orders), tuple(vehicles)) == before
    with pytest.raises(FrozenInstanceError):
        result.status = AllocationStatus.FEASIBLE
    with pytest.raises(FrozenInstanceError):
        result.trips[0].trip_number = 3


@pytest.mark.parametrize("seed", range(12))
def test_mixed_days_match_independent_exhaustive_optimum(seed):
    random = Random(seed)
    orders = [
        order(
            id=UUID(int=i),
            weight_kg=Decimal(random.randint(1, 9)),
            volume_m3=Decimal(random.randint(1, 9)) / 10,
            temperature_requirement=random.choice(list(TemperatureRequirement)),
            parking_constraint=random.choice(list(ParkingConstraint)),
        )
        for i in range(10, 15)
    ]
    vehicles = [
        vehicle(
            id=UUID(int=i),
            weight_cap_kg=Decimal(random.randint(4, 14)),
            volume_cap_m3=Decimal(random.randint(5, 15)) / 10,
            type=random.choice(list(VehicleType)),
            temperature_type=random.choice(list(TemperatureType)),
            is_available=random.choice([True, True, None, False]),
        )
        for i in range(20, 22)
    ]
    result = allocate_capacity(orders, vehicles)
    allocated, trips = check_result(result, orders, vehicles)
    assert result.status == AllocationStatus.OPTIMAL
    assert (allocated, -trips) == brute_force_score(orders, vehicles)


@pytest.mark.parametrize("which", ["orders", "vehicles"])
def test_duplicate_identifiers_are_rejected(which):
    orders = [order(), order()] if which == "orders" else [order()]
    vehicles = [vehicle(), vehicle()] if which == "vehicles" else [vehicle()]
    with pytest.raises(ValueError, match="Duplicate"):
        allocate_capacity(orders, vehicles)


def test_cross_depot_inputs_are_rejected():
    with pytest.raises(ValueError, match="single depot"):
        allocate_capacity([order()], [vehicle(depot_id=UUID(int=99))])


@pytest.mark.parametrize("field", ["weight_kg", "volume_m3", "weight_cap_kg", "volume_cap_m3"])
@pytest.mark.parametrize("value", [Decimal("0.0001"), Decimal("1000000000")])
def test_quantities_are_not_silently_rounded_or_allowed_to_overflow(field, value):
    orders = [order(**{field: value})] if "cap" not in field else [order()]
    vehicles = [vehicle(**{field: value})] if "cap" in field else [vehicle()]
    with pytest.raises(ValueError, match="Allocation quantities"):
        allocate_capacity(orders, vehicles)


def test_maximum_quantity_and_small_decimal_context_preserve_precision():
    maximum = Decimal("999999999.999")
    orders = [order(weight_kg=maximum, volume_m3=maximum)]
    vehicles = [vehicle(weight_cap_kg=maximum, volume_cap_m3=maximum)]
    with localcontext() as context:
        context.prec = 6
        result = allocate_capacity(orders, vehicles)
    assert check_result(result, orders, vehicles) == (1, 1)


@pytest.mark.parametrize("value", [0, -1, 31, 10**400, float("nan"), float("inf"), True, "5"])
def test_invalid_time_limits_are_rejected(value):
    with pytest.raises(ValueError, match="time limit"):
        allocate_capacity([order()], [vehicle()], time_limit_seconds=value)


@pytest.mark.parametrize("which", ["orders", "vehicles"])
def test_input_count_limits_fail_without_truncation(which):
    orders = [order(id=UUID(int=i)) for i in range(501)] if which == "orders" else []
    vehicles = [vehicle(id=UUID(int=i)) for i in range(501)] if which == "vehicles" else []
    with pytest.raises(ValueError, match="500 orders and 500 vehicles"):
        allocate_capacity(orders, vehicles)


def test_assignment_size_limit_fails_without_dropping_candidates():
    orders = [order(id=UUID(int=i)) for i in range(100)]
    vehicles = [vehicle(id=UUID(int=i)) for i in range(251)]
    with pytest.raises(ValueError, match="50000 assignment variables"):
        allocate_capacity(orders, vehicles)


@pytest.mark.parametrize("status", [cp_model.UNKNOWN, cp_model.MODEL_INVALID, cp_model.INFEASIBLE])
def test_no_solution_is_never_reported_as_success_or_business_deferrals(status):
    with (
        patch.object(cp_model.CpSolver, "solve", return_value=status),
        patch.object(
            cp_model.CpSolver,
            "value",
            side_effect=AssertionError("Must not read nonexistent solution"),
        ),
        pytest.raises(AllocationUnavailable, match="usable solution"),
    ):
        allocate_capacity([order()], [vehicle()])


def test_feasible_but_not_proven_optimal_is_labeled_accurately():
    solve = cp_model.CpSolver.solve

    def feasible(self, model):
        assert solve(self, model) == cp_model.OPTIMAL
        return cp_model.FEASIBLE

    with patch.object(cp_model.CpSolver, "solve", feasible):
        result = allocate_capacity([order()], [vehicle()])
    assert result.status == AllocationStatus.FEASIBLE
    assert check_result(result, [order()], [vehicle()]) == (1, 1)


def test_one_thousandth_over_combined_capacity_requires_second_trip():
    orders = [
        order(id=UUID(int=10), weight_kg=Decimal("5.001")),
        replace(order(), id=UUID(int=11), weight_kg=Decimal("5")),
    ]
    result = allocate_capacity(orders, [vehicle()])
    assert check_result(result, orders, [vehicle()]) == (2, 2)
