from dataclasses import replace
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from uuid import UUID

import pytest
from test_compatibility import order, vehicle
from test_routing import VEHICLE, allocation, payload

from app.planning.assignment_models import DeferralReason
from app.planning.optimizer import optimize_draft
from app.planning.route_inputs import RouteInputs
from app.planning.routing import RouteSearchUnavailable, schedule_capacity
from app.planning.validation import PlanningValidationError, validate_draft


def masters():
    return ([order(id=UUID(int=i), weight_kg=Decimal("5")) for i in (1, 2)], [vehicle(id=VEHICLE)])


def test_repair_splits_capacity_group_when_inter_outlet_travel_breaks_windows():
    raw = payload()
    for item in raw["outlets"]:
        item.update(window_open="08:00:00", window_close="09:00:00")
    for leg in raw["legs"]:
        leg["travel_seconds"] = 7200 if leg["from_outlet_id"] and leg["to_outlet_id"] else 300
    inputs = RouteInputs.model_validate(raw)
    orders, vehicles = masters()
    result = optimize_draft(orders, vehicles, inputs)
    validate_draft(result, orders, vehicles, inputs)
    assert len(result.schedule.trips) == 2 and not result.deferrals


def test_repair_tries_alternative_vehicle():
    raw = payload()
    raw["vehicles"][0]["latest_return"] = "2026-10-05T07:59:00+05:30"
    second = UUID(int=101)
    raw["vehicles"].append(
        dict(raw["vehicles"][0], vehicle_id=str(second), latest_return="2026-10-05T18:00:00+05:30")
    )
    inputs = RouteInputs.model_validate(raw)
    orders, vehicles = masters()
    vehicles.append(vehicle(id=second))
    with patch("app.planning.optimizer.allocate_capacity", return_value=allocation([1, 2])):
        result = optimize_draft(orders, vehicles, inputs)
    validate_draft(result, orders, vehicles, inputs)
    assert all(trip.vehicle_id == second for trip in result.schedule.trips)


def test_fuel_deferral_is_explained_and_relaxed_diagnostic_is_never_returned():
    raw = payload()
    raw["vehicles"][0]["weekly_fuel_quota_l"] = "5"
    inputs = RouteInputs.model_validate(raw)
    orders, vehicles = masters()
    result = optimize_draft(orders, vehicles, inputs)
    validate_draft(result, orders, vehicles, inputs)
    assert (
        len(result.deferrals) == 1 and result.deferrals[0].reason_code == DeferralReason.FUEL_QUOTA
    )
    assert result.schedule.trips[0].fuel_l == Decimal("2")
    assert "Alternative allocations may differ" in result.deferrals[0].reason_text


def test_impossible_window_deferral():
    raw = payload()
    raw["outlets"][1]["window_close"] = "08:00:01"
    inputs = RouteInputs.model_validate(raw)
    orders, vehicles = masters()
    result = optimize_draft(orders, vehicles, inputs)
    validate_draft(result, orders, vehicles, inputs)
    assert [item.reason_code for item in result.deferrals] == [DeferralReason.TIME_WINDOW]


def test_search_timeout_aborts_instead_of_deferring_unexplored_orders():
    orders, vehicles = masters()
    with (
        patch("app.planning.optimizer.monotonic", side_effect=[0, 21]),
        pytest.raises(RouteSearchUnavailable, match="budget exhausted"),
    ):
        optimize_draft(orders, vehicles, RouteInputs.model_validate(payload()))


@pytest.mark.parametrize(
    "fault",
    [
        "weight",
        "volume",
        "reefer",
        "van",
        "depot",
        "availability",
        "fuel",
        "distance",
        "return",
        "service",
        "order",
        "coverage",
        "duplicate",
        "trip_limit",
        "provenance",
    ],
)
def test_independent_validator_rejects_corrupted_results_or_master_inputs(fault):
    inputs = RouteInputs.model_validate(payload())
    orders, vehicles = masters()
    draft = optimize_draft(orders, vehicles, inputs)
    validate_draft(draft, orders, vehicles, inputs)
    trip = draft.schedule.trips[0]
    if fault == "weight":
        vehicles = [replace(vehicles[0], weight_cap_kg=Decimal("1"))]
    elif fault == "volume":
        vehicles = [replace(vehicles[0], volume_cap_m3=Decimal("0.1"))]
    elif fault == "reefer":
        from app.fleet.models import TemperatureType
        from app.orders.models import TemperatureRequirement

        orders = [
            replace(item, temperature_requirement=TemperatureRequirement.CHILLED) for item in orders
        ]
        vehicles = [replace(vehicles[0], temperature_type=TemperatureType.AMBIENT)]
    elif fault == "van":
        from app.fleet.models import ParkingConstraint, VehicleType

        orders = [replace(item, parking_constraint=ParkingConstraint.VAN_ONLY) for item in orders]
        vehicles = [replace(vehicles[0], type=VehicleType.TRUCK)]
    elif fault == "depot":
        vehicles = [replace(vehicles[0], depot_id=UUID(int=999))]
    elif fault == "availability":
        vehicles = [replace(vehicles[0], is_available=False)]
    elif fault == "fuel":
        trip = replace(trip, fuel_l=Decimal("0"))
    elif fault == "distance":
        trip = replace(trip, distance_km=Decimal("0"))
    elif fault == "return":
        trip = replace(trip, return_at=trip.return_at - timedelta(seconds=1))
    elif fault == "service":
        first = trip.stops[0]
        trip = replace(
            trip,
            stops=(
                replace(first, departure_at=first.departure_at - timedelta(seconds=1)),
                *trip.stops[1:],
            ),
        )
    elif fault == "order":
        trip = replace(
            trip, stops=(replace(trip.stops[0], order_ids=(UUID(int=999),)), *trip.stops[1:])
        )
    elif fault == "coverage":
        trip = replace(trip, stops=trip.stops[:-1])
    elif fault == "trip_limit":
        trip = replace(trip, trip_number=3)
    if fault == "duplicate":
        schedule = replace(draft.schedule, trips=(trip, trip))
    elif fault == "provenance":
        schedule = replace(draft.schedule, source="changed")
    else:
        schedule = replace(draft.schedule, trips=(trip,))
    with pytest.raises(PlanningValidationError):
        validate_draft(replace(draft, schedule=schedule), orders, vehicles, inputs)


def test_validator_rejects_missing_deferral_reason():
    raw = payload()
    inputs = RouteInputs.model_validate(raw)
    orders, vehicles = masters()
    orders[1] = replace(orders[1], weight_kg=Decimal("100"))
    draft = optimize_draft(orders, vehicles, inputs)
    assert draft.deferrals
    with pytest.raises(PlanningValidationError):
        validate_draft(
            replace(draft, deferrals=(replace(draft.deferrals[0], reason_text=" "),)),
            orders,
            vehicles,
            inputs,
        )


def test_validator_rechecks_shared_fuel_budget_independently():
    raw = payload()
    inputs = RouteInputs.model_validate(raw)
    orders, vehicles = masters()
    schedule = schedule_capacity(allocation([1], [2]), inputs)
    from app.planning.optimizer import OptimizedDraft

    bad_inputs = inputs.model_copy(
        update={
            "vehicles": (
                inputs.vehicles[0].model_copy(update={"weekly_fuel_quota_l": Decimal("6.999")}),
            )
        }
    )
    with pytest.raises(PlanningValidationError):
        validate_draft(OptimizedDraft(schedule, ()), orders, vehicles, bad_inputs)
