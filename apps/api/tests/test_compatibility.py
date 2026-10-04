"""Planning rule checks independent of HTTP, database state and allocation."""

from dataclasses import replace
from decimal import Decimal
from itertools import permutations
from uuid import UUID

import pytest

from app.fleet.models import ParkingConstraint, TemperatureType, VehicleType
from app.orders.models import TemperatureRequirement
from app.planning.compatibility import (
    CompatibilityIssue as Issue,
)
from app.planning.compatibility import (
    CompatibilityOrder,
    CompatibilityVehicle,
    build_compatibility_matrix,
    exclusion_reasons,
)

DEPOT = UUID(int=1)


def order(**changes):
    values = dict(
        id=UUID(int=10),
        depot_id=DEPOT,
        temperature_requirement=TemperatureRequirement.AMBIENT,
        parking_constraint=ParkingConstraint.NONE,
        weight_kg=Decimal("6.000"),
        volume_m3=Decimal("0.500"),
    )
    return CompatibilityOrder(**(values | changes))


def vehicle(**changes):
    values = dict(
        id=UUID(int=20),
        depot_id=DEPOT,
        type=VehicleType.VAN,
        temperature_type=TemperatureType.REEFER,
        weight_cap_kg=Decimal("10.000"),
        volume_cap_m3=Decimal("1.000"),
        is_available=True,
    )
    return CompatibilityVehicle(**(values | changes))


@pytest.mark.parametrize(
    "requirement,temperature,excluded",
    [
        (TemperatureRequirement.AMBIENT, TemperatureType.AMBIENT, False),
        (TemperatureRequirement.AMBIENT, TemperatureType.REEFER, False),
        (TemperatureRequirement.CHILLED, TemperatureType.AMBIENT, True),
        (TemperatureRequirement.CHILLED, TemperatureType.REEFER, False),
    ],
)
def test_temperature_compatibility(requirement, temperature, excluded):
    reasons = exclusion_reasons(
        order(temperature_requirement=requirement), vehicle(temperature_type=temperature)
    )
    assert reasons == ((Issue.TEMPERATURE_MISMATCH,) if excluded else ())


@pytest.mark.parametrize(
    "parking,kind,excluded",
    [
        (ParkingConstraint.NONE, VehicleType.VAN, False),
        (ParkingConstraint.NONE, VehicleType.TRUCK, False),
        (ParkingConstraint.VAN_ONLY, VehicleType.VAN, False),
        (ParkingConstraint.VAN_ONLY, VehicleType.TRUCK, True),
    ],
)
def test_access_compatibility(parking, kind, excluded):
    assert exclusion_reasons(order(parking_constraint=parking), vehicle(type=kind)) == (
        (Issue.VAN_REQUIRED,) if excluded else ()
    )


@pytest.mark.parametrize(
    "available,expected",
    [
        (True, ()),
        (False, (Issue.VEHICLE_UNAVAILABLE,)),
        (None, (Issue.AVAILABILITY_UNKNOWN,)),
    ],
)
def test_only_explicit_availability_can_be_a_candidate(available, expected):
    assert exclusion_reasons(order(), vehicle(is_available=available)) == expected


@pytest.mark.parametrize(
    "field,capacity,reason",
    [
        ("weight_kg", "10.000", Issue.WEIGHT_CAPACITY),
        ("volume_m3", "1.000", Issue.VOLUME_CAPACITY),
    ],
)
@pytest.mark.parametrize("delta", [Decimal("-0.001"), Decimal("0"), Decimal("0.001")])
def test_exact_decimal_capacity_boundaries(field, capacity, reason, delta):
    request = order(**{field: Decimal(capacity) + delta})
    assert exclusion_reasons(request, vehicle()) == ((reason,) if delta > 0 else ())


def test_home_depot_mismatch_excludes_an_otherwise_suitable_vehicle():
    assert exclusion_reasons(order(), vehicle(depot_id=UUID(int=2))) == (Issue.DEPOT_MISMATCH,)


@pytest.mark.parametrize(
    "available,last",
    [
        (False, Issue.VEHICLE_UNAVAILABLE),
        (None, Issue.AVAILABILITY_UNKNOWN),
    ],
)
def test_all_failed_checks_are_returned_in_stable_order(available, last):
    request = order(
        temperature_requirement=TemperatureRequirement.CHILLED,
        parking_constraint=ParkingConstraint.VAN_ONLY,
        weight_kg=Decimal("10.001"),
        volume_m3=Decimal("1.001"),
    )
    truck = vehicle(
        depot_id=UUID(int=2),
        type=VehicleType.TRUCK,
        temperature_type=TemperatureType.AMBIENT,
        is_available=available,
    )
    assert exclusion_reasons(request, truck) == (
        Issue.DEPOT_MISMATCH,
        Issue.TEMPERATURE_MISMATCH,
        Issue.VAN_REQUIRED,
        Issue.WEIGHT_CAPACITY,
        Issue.VOLUME_CAPACITY,
        last,
    )


def test_matrix_is_deterministic_and_partitions_each_vehicle_exactly_once():
    orders = [order(), order(id=UUID(int=11), parking_constraint=ParkingConstraint.VAN_ONLY)]
    vehicles = [
        vehicle(),
        vehicle(id=UUID(int=21), type=VehicleType.TRUCK),
        vehicle(id=UUID(int=22), is_available=None),
    ]
    expected = build_compatibility_matrix(orders, vehicles)
    for order_sequence in permutations(orders):
        for vehicle_sequence in permutations(vehicles):
            assert build_compatibility_matrix(order_sequence, vehicle_sequence) == expected
    for result in expected:
        candidates = set(result.candidate_vehicle_ids)
        excluded = {item.vehicle_id for item in result.excluded_vehicles}
        assert not candidates & excluded
        assert candidates | excluded == {item.id for item in vehicles}
    assert expected[0].candidate_vehicle_ids == (UUID(int=20), UUID(int=21))
    assert expected[1].candidate_vehicle_ids == (UUID(int=20),)


def test_individual_checks_do_not_reserve_combined_capacity_or_split_orders():
    first = order()
    second = replace(first, id=UUID(int=11))
    too_heavy = replace(first, id=UUID(int=12), weight_kg=Decimal("10.001"))
    results = build_compatibility_matrix([first, second, too_heavy], [vehicle()])
    # Two 6 kg orders independently fit a 10 kg vehicle; this is NOT a valid joint load.
    assert results[0].candidate_vehicle_ids == results[1].candidate_vehicle_ids == (UUID(int=20),)
    assert results[2].candidate_vehicle_ids == ()
    assert first.weight_kg == second.weight_kg == Decimal("6.000")


def test_empty_inputs_do_not_invent_candidates_or_outcomes():
    assert build_compatibility_matrix([], [vehicle()]) == ()
    (result,) = build_compatibility_matrix([order()], [])
    assert result.candidate_vehicle_ids == result.excluded_vehicles == ()


@pytest.mark.parametrize("duplicate", ["order", "vehicle"])
def test_duplicate_ids_are_rejected(duplicate):
    with pytest.raises(ValueError, match="Duplicate"):
        build_compatibility_matrix(
            [order()] * (2 if duplicate == "order" else 1),
            [vehicle()] * (2 if duplicate == "vehicle" else 1),
        )


@pytest.mark.parametrize(
    "factory,field",
    [
        (order, "weight_kg"),
        (order, "volume_m3"),
        (vehicle, "weight_cap_kg"),
        (vehicle, "volume_cap_m3"),
    ],
)
@pytest.mark.parametrize(
    "value",
    [
        Decimal("0"),
        Decimal("-0.001"),
        Decimal("NaN"),
        Decimal("Infinity"),
        Decimal("-Infinity"),
        1.0,
    ],
)
def test_invalid_quantities_cannot_produce_false_candidates(factory, field, value):
    with pytest.raises(ValueError, match="finite positive Decimals"):
        factory(**{field: value})


@pytest.mark.parametrize(
    "factory,changes",
    [
        (order, {"temperature_requirement": "unknown"}),
        (order, {"parking_constraint": "unknown"}),
        (vehicle, {"type": "bus"}),
        (vehicle, {"temperature_type": "unknown"}),
        (vehicle, {"is_available": 1}),
        (vehicle, {"is_available": "true"}),
        (order, {"id": "bad"}),
        (vehicle, {"depot_id": "bad"}),
    ],
)
def test_invalid_domain_values_are_rejected(factory, changes):
    with pytest.raises(ValueError):
        factory(**changes)
