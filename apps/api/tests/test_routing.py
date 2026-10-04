from dataclasses import replace
from datetime import date, datetime, time, timedelta
from decimal import ROUND_CEILING, Decimal, localcontext
from itertools import permutations
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

import pytest
from ortools.sat.python import cp_model
from pydantic import ValidationError

from app.planning.allocation import AllocationStatus, CapacityAllocation, CapacityTrip
from app.planning.route_inputs import LOCAL_ZONE, RouteInputs, load_route_inputs
from app.planning.routing import (
    RouteInputError,
    RouteSearchUnavailable,
    RouteStatus,
    schedule_capacity,
)

DAY = date(2026, 10, 5)
A, B, C, VEHICLE = (UUID(int=i) for i in (10, 20, 30, 100))


def payload(count=2):
    points = [None, *[UUID(int=10 * (i + 1)) for i in range(count)]]
    return {
        "depot_id": str(UUID(int=1)),
        "delivery_date": DAY.isoformat(),
        "source": "Invented routing test inputs",
        "is_synthetic": True,
        "outlets": [
            {
                "outlet_id": str(point),
                "window_open": "08:00:00",
                "window_close": "18:00:00",
                "service_seconds": 600,
            }
            for point in points[1:]
        ],
        "orders": [
            {"order_id": str(UUID(int=i + 1)), "outlet_id": str(point)}
            for i, point in enumerate(points[1:])
        ],
        "vehicles": [
            {
                "vehicle_id": str(VEHICLE),
                "earliest_departure": "2026-10-05T07:30:00+05:30",
                "latest_return": "2026-10-05T20:00:00+05:30",
                "turnaround_seconds": 900,
                "available_dates": [DAY.isoformat()],
                "km_per_l": "5.000",
                "fuel_week_start": "2026-10-05",
                "weekly_fuel_quota_l": "20.000",
                "fuel_used_l": "2.000",
                "fuel_reserved_l": "1.000",
            }
        ],
        "legs": [
            {
                "from_outlet_id": str(a) if a else None,
                "to_outlet_id": str(b) if b else None,
                "distance_km": "5.000",
                "travel_seconds": 900,
            }
            for a in points
            for b in points
            if a != b
        ],
    }


def allocation(*groups, unallocated=()):
    return CapacityAllocation(
        AllocationStatus.OPTIMAL,
        tuple(
            CapacityTrip(
                VEHICLE, number, tuple(UUID(int=i) for i in ids), Decimal("100"), Decimal("1")
            )
            for number, ids in enumerate(groups, start=1)
        ),
        tuple(UUID(int=i) for i in unallocated),
    )


def check_schedule(result, inputs, candidate):
    """Recompute travel/wait/service/fuel constraints without routing helpers."""
    assert result.status in (RouteStatus.OPTIMAL, RouteStatus.FEASIBLE)
    assert result.is_complete_plan_validation is False
    assert result.source == inputs.source and result.is_synthetic == inputs.is_synthetic
    vehicles = {vehicle.vehicle_id: vehicle for vehicle in inputs.vehicles}
    outlets = {outlet.outlet_id: outlet for outlet in inputs.outlets}
    legs = {(leg.from_outlet_id, leg.to_outlet_id): leg for leg in inputs.legs}
    order_outlets = {order.order_id: order.outlet_id for order in inputs.orders}
    assigned, total_fuel, previous = [], {}, {}
    for trip in result.trips:
        vehicle = vehicles[trip.vehicle_id]
        assert trip.departure_at.date() == inputs.delivery_date
        assert (
            vehicle.earliest_departure
            <= trip.departure_at
            < trip.return_at
            <= vehicle.latest_return
        )
        if vehicle.vehicle_id in previous:
            earlier = previous[vehicle.vehicle_id]
            assert trip.trip_number == earlier.trip_number + 1 == 2
            assert trip.departure_at >= earlier.return_at + timedelta(
                seconds=vehicle.turnaround_seconds
            )
        else:
            assert trip.trip_number == 1
        previous[vehicle.vehicle_id] = trip
        distance, now, point = Decimal(0), trip.departure_at, None
        for number, stop in enumerate(trip.stops, start=1):
            assert stop.sequence_number == number
            leg = legs[point, stop.outlet_id]
            distance += leg.distance_km
            assert stop.arrival_at == now + timedelta(seconds=leg.travel_seconds)
            outlet = outlets[stop.outlet_id]
            window_open = datetime.combine(DAY, outlet.window_open, LOCAL_ZONE)
            window_close = datetime.combine(DAY, outlet.window_close, LOCAL_ZONE)
            if window_close < window_open:
                window_close += timedelta(days=1)
            assert stop.service_start_at == max(stop.arrival_at, window_open)
            assert stop.departure_at == stop.service_start_at + timedelta(
                seconds=outlet.service_seconds
            )
            assert window_open <= stop.service_start_at <= stop.departure_at <= window_close
            assert stop.order_ids and all(
                order_outlets[i] == stop.outlet_id for i in stop.order_ids
            )
            assigned.extend(stop.order_ids)
            now, point = stop.departure_at, stop.outlet_id
        leg = legs[point, None]
        assert trip.return_at == now + timedelta(seconds=leg.travel_seconds)
        distance += leg.distance_km
        assert trip.distance_km == distance
        assert trip.fuel_l == (distance / vehicle.km_per_l).quantize(
            Decimal("0.001"), rounding=ROUND_CEILING
        )
        total_fuel[vehicle.vehicle_id] = (
            total_fuel.get(vehicle.vehicle_id, Decimal(0)) + trip.fuel_l
        )
        day = trip.departure_at.date()
        while datetime.combine(day, time.min, LOCAL_ZONE) < trip.return_at:
            assert day in vehicle.available_dates
            day += timedelta(days=1)
    for identifier, fuel in total_fuel.items():
        vehicle = vehicles[identifier]
        assert fuel + vehicle.fuel_used_l + vehicle.fuel_reserved_l <= vehicle.weekly_fuel_quota_l
    assert len(assigned) == len(set(assigned))
    assert set(assigned) == {i for group in candidate.trips for i in group.order_ids}
    assert set(result.unallocated_order_ids) == set(candidate.unallocated_order_ids)
    assert not result.unscheduled_order_ids


def test_stops_wait_for_opening_and_return_to_depot():
    inputs = RouteInputs.model_validate(payload())
    candidate = allocation([1, 2])
    result = schedule_capacity(candidate, inputs)
    check_schedule(result, inputs, candidate)
    assert result.trips[0].distance_km == Decimal("15.000")
    assert result.trips[0].stops[0].arrival_at.hour == 7
    assert result.trips[0].stops[0].service_start_at.hour == 8


def test_directed_distance_minimum_matches_exhaustive_routes():
    raw = payload(3)
    for index, leg in enumerate(raw["legs"]):
        leg["distance_km"] = str((index * 7) % 11 + 1)
    raw["vehicles"][0]["weekly_fuel_quota_l"] = "100"
    inputs = RouteInputs.model_validate(raw)
    candidate = allocation([1, 2, 3])
    result = schedule_capacity(candidate, inputs)
    check_schedule(result, inputs, candidate)
    matrix = {(leg.from_outlet_id, leg.to_outlet_id): leg.distance_km for leg in inputs.legs}
    optimum = min(
        sum(matrix[a, b] for a, b in zip((None, *route), (*route, None)))
        for route in permutations((A, B, C))
    )
    assert result.status == RouteStatus.OPTIMAL
    assert result.trips[0].distance_km == optimum


def test_window_constraints_override_shorter_distance_order():
    raw = payload()
    raw["outlets"][0].update(window_open="10:00:00", window_close="11:00:00")
    raw["outlets"][1].update(window_open="08:00:00", window_close="08:20:00")
    inputs = RouteInputs.model_validate(raw)
    candidate = allocation([1, 2])
    result = schedule_capacity(candidate, inputs)
    check_schedule(result, inputs, candidate)
    assert [stop.outlet_id for stop in result.trips[0].stops] == [B, A]


def test_whole_service_must_fit_window_and_exact_closing_boundary_is_allowed():
    raw = payload(1)
    raw["outlets"][0].update(window_close="08:10:00")
    inputs = RouteInputs.model_validate(raw)
    assert schedule_capacity(allocation([1]), inputs).status == RouteStatus.OPTIMAL
    raw["outlets"][0].update(window_close="08:09:59.999999")
    result = schedule_capacity(allocation([1]), RouteInputs.model_validate(raw))
    assert result.status == RouteStatus.INFEASIBLE and not result.trips
    assert result.unscheduled_order_ids == (UUID(int=1),)


def test_two_trip_groups_can_swap_to_meet_windows():
    raw = payload()
    raw["outlets"][0].update(window_open="12:00:00", window_close="14:00:00")
    raw["outlets"][1].update(window_open="08:00:00", window_close="09:00:00")
    inputs = RouteInputs.model_validate(raw)
    candidate = allocation([1], [2])
    result = schedule_capacity(candidate, inputs)
    check_schedule(result, inputs, candidate)
    assert result.trips[0].stops[0].outlet_id == B
    assert result.trips[1].stops[0].outlet_id == A


def test_depot_return_and_turnaround_can_make_two_trips_impossible():
    raw = payload()
    for outlet in raw["outlets"]:
        outlet.update(window_open="08:00:00", window_close="08:40:00")
    result = schedule_capacity(allocation([1], [2]), RouteInputs.model_validate(raw))
    assert result.status == RouteStatus.INFEASIBLE
    assert result.unscheduled_order_ids == (UUID(int=1), UUID(int=2))


@pytest.mark.parametrize(
    "quota,expected", [("7.000", RouteStatus.OPTIMAL), ("6.999", RouteStatus.INFEASIBLE)]
)
def test_weekly_budget_includes_both_trips_usage_and_existing_reservations(quota, expected):
    raw = payload()
    raw["vehicles"][0]["weekly_fuel_quota_l"] = quota
    inputs = RouteInputs.model_validate(raw)
    result = schedule_capacity(allocation([1], [2]), inputs)
    assert result.status == expected
    if expected == RouteStatus.OPTIMAL:
        check_schedule(result, inputs, allocation([1], [2]))
        assert sum(trip.fuel_l for trip in result.trips) == Decimal("4")


@pytest.mark.parametrize(
    "quota,expected", [("0.668", RouteStatus.OPTIMAL), ("0.667", RouteStatus.INFEASIBLE)]
)
def test_fuel_rounds_up_per_trip_before_shared_quota_check(quota, expected):
    raw = payload()
    for leg in raw["legs"]:
        leg["distance_km"] = "0.500"
    raw["vehicles"][0].update(
        km_per_l="3", weekly_fuel_quota_l=quota, fuel_used_l="0", fuel_reserved_l="0"
    )
    result = schedule_capacity(allocation([1], [2]), RouteInputs.model_validate(raw))
    assert result.status == expected
    if result.trips:
        assert all(trip.fuel_l == Decimal("0.334") for trip in result.trips)


@pytest.mark.parametrize("field", ["fuel_used_l", "fuel_reserved_l"])
def test_unknown_fuel_is_a_missing_input_not_zero(field):
    raw = payload()
    raw["vehicles"][0][field] = None
    with pytest.raises(RouteInputError, match="both be known"):
        schedule_capacity(allocation([1, 2]), RouteInputs.model_validate(raw))


def test_overdrawn_fuel_budget_is_infeasible():
    raw = payload(1)
    raw["vehicles"][0]["fuel_used_l"] = "30"
    assert (
        schedule_capacity(allocation([1]), RouteInputs.model_validate(raw)).status
        == RouteStatus.INFEASIBLE
    )


def test_extreme_valid_numeric_inputs_do_not_overflow_solver_domains():
    raw = payload(1)
    raw["vehicles"][0].update(km_per_l="99999.999", weekly_fuel_quota_l="999999999.999")
    for leg in raw["legs"]:
        leg["distance_km"] = "999999.999"
    inputs = RouteInputs.model_validate(raw)
    with localcontext() as context:
        context.prec = 6
        result = schedule_capacity(allocation([1]), inputs)
    check_schedule(result, inputs, allocation([1]))


@pytest.mark.parametrize(
    "available,expected", [(False, RouteStatus.INFEASIBLE), (True, RouteStatus.OPTIMAL)]
)
def test_overnight_window_requires_following_day_availability(available, expected):
    raw = payload(1)
    raw["outlets"][0].update(window_open="23:50:00", window_close="01:00:00", service_seconds=1800)
    raw["vehicles"][0]["latest_return"] = "2026-10-06T02:00:00+05:30"
    if available:
        raw["vehicles"][0]["available_dates"].append("2026-10-06")
    inputs = RouteInputs.model_validate(raw)
    result = schedule_capacity(allocation([1]), inputs)
    assert result.status == expected
    if result.trips:
        check_schedule(result, inputs, allocation([1]))
        assert result.trips[0].return_at.date() == DAY + timedelta(days=1)


def test_return_deadline_is_enforced_including_last_leg():
    raw = payload(1)
    raw["vehicles"][0]["latest_return"] = "2026-10-05T08:24:59+05:30"
    assert (
        schedule_capacity(allocation([1]), RouteInputs.model_validate(raw)).status
        == RouteStatus.INFEASIBLE
    )


def test_multiple_orders_at_one_outlet_have_one_stop_and_one_service_duration():
    raw = payload(1)
    raw["orders"].append({"order_id": str(UUID(int=2)), "outlet_id": str(A)})
    inputs = RouteInputs.model_validate(raw)
    candidate = allocation([1, 2])
    result = schedule_capacity(candidate, inputs)
    check_schedule(result, inputs, candidate)
    assert len(result.trips[0].stops) == 1
    assert result.trips[0].stops[0].order_ids == (UUID(int=1), UUID(int=2))


def test_missing_directed_leg_is_not_assumed_symmetric_or_zero():
    raw = payload()
    raw["legs"].pop()
    with pytest.raises(RouteInputError, match="Missing directed travel leg"):
        schedule_capacity(allocation([1, 2]), RouteInputs.model_validate(raw))


def test_unallocated_orders_are_preserved_and_empty_allocation_needs_no_route_data():
    raw = payload()
    raw["legs"], raw["vehicles"] = [], []
    result = schedule_capacity(allocation(unallocated=(1, 2)), RouteInputs.model_validate(raw))
    assert result.status == RouteStatus.OPTIMAL and not result.trips
    assert result.unallocated_order_ids == (UUID(int=1), UUID(int=2))
    assert not result.unscheduled_order_ids


@pytest.mark.parametrize(
    "candidate",
    [
        allocation([1]),
        allocation([1], [1], unallocated=(2,)),
        allocation([1, 2], unallocated=(2,)),
        allocation([]),
    ],
)
def test_invalid_coverage_and_empty_groups_are_rejected(candidate):
    with pytest.raises(RouteInputError):
        schedule_capacity(candidate, RouteInputs.model_validate(payload()))


def test_bad_trip_slots_and_unknown_vehicles_are_rejected():
    base = allocation([1, 2])
    for group in (
        replace(base.trips[0], trip_number=3),
        replace(base.trips[0], trip_number=2),
        replace(base.trips[0], vehicle_id=UUID(int=999)),
    ):
        with pytest.raises(RouteInputError):
            schedule_capacity(replace(base, trips=(group,)), RouteInputs.model_validate(payload()))


def test_missing_plan_day_availability_is_explicit():
    raw = payload()
    raw["vehicles"][0]["available_dates"] = []
    with pytest.raises(RouteInputError, match="explicit availability"):
        schedule_capacity(allocation([1, 2]), RouteInputs.model_validate(raw))


def test_stop_limit_rejects_instead_of_truncating():
    raw = payload(26)
    with pytest.raises(RouteInputError, match="25 outlet stops"):
        schedule_capacity(allocation(list(range(1, 27))), RouteInputs.model_validate(raw))


@pytest.mark.parametrize("status", [cp_model.UNKNOWN, cp_model.MODEL_INVALID])
def test_unknown_status_is_not_reported_as_infeasible(status):
    with (
        patch.object(cp_model.CpSolver, "solve", return_value=status),
        patch.object(cp_model.CpSolver, "value", side_effect=AssertionError("No solution exists")),
        pytest.raises(RouteSearchUnavailable),
    ):
        schedule_capacity(allocation([1, 2]), RouteInputs.model_validate(payload()))


def test_feasible_status_is_not_mislabeled_optimal():
    solve = cp_model.CpSolver.solve

    def feasible(self, model):
        assert solve(self, model) == cp_model.OPTIMAL
        return cp_model.FEASIBLE

    with patch.object(cp_model.CpSolver, "solve", feasible):
        result = schedule_capacity(allocation([1, 2]), RouteInputs.model_validate(payload()))
    assert result.status == RouteStatus.FEASIBLE


@pytest.mark.parametrize("value", [0, -1, 31, 10**400, float("nan"), float("inf"), True, "5"])
def test_bad_time_limit_is_rejected(value):
    with pytest.raises(ValueError, match="time limit"):
        schedule_capacity(
            allocation([1, 2]), RouteInputs.model_validate(payload()), time_limit_seconds=value
        )


def test_json_import_is_bounded_and_rejects_extra_fields(tmp_path):
    path = tmp_path / "route.json"
    inputs = RouteInputs.model_validate(payload())
    path.write_text(inputs.model_dump_json(), encoding="utf-8")
    assert load_route_inputs(str(path)) == inputs
    path.write_text('{"unexpected":true}', encoding="utf-8")
    with pytest.raises(ValidationError):
        load_route_inputs(str(path))
    path.write_bytes(b" " * 10_000_001)
    with pytest.raises(ValueError, match="10 MB"):
        load_route_inputs(str(path))


@pytest.mark.parametrize(
    "change",
    [
        lambda raw: raw["outlets"].append(raw["outlets"][0]),
        lambda raw: raw["orders"].append(raw["orders"][0]),
        lambda raw: raw["vehicles"].append(raw["vehicles"][0]),
        lambda raw: raw["legs"].append(raw["legs"][0]),
        lambda raw: raw["legs"][0].update(from_outlet_id=str(UUID(int=999))),
        lambda raw: raw["orders"][0].update(outlet_id=str(UUID(int=999))),
        lambda raw: raw["outlets"][0].update(window_close="08:00:00"),
        lambda raw: raw["outlets"][0].update(window_open="08:00:00+05:30"),
        lambda raw: raw["vehicles"][0].update(earliest_departure="2026-10-05T08:00:00"),
        lambda raw: raw["vehicles"][0].update(earliest_departure="2026-10-04T08:00:00+05:30"),
        lambda raw: raw["vehicles"][0].update(latest_return="2026-10-07T01:00:00+05:30"),
        lambda raw: raw["vehicles"][0].update(fuel_week_start="2026-10-06"),
        lambda raw: raw["vehicles"][0].update(available_dates=["2026-10-04"]),
        lambda raw: raw["vehicles"][0].update(km_per_l="0"),
        lambda raw: raw["vehicles"][0].update(fuel_used_l="NaN"),
        lambda raw: raw["legs"][0].update(distance_km="0.0001"),
        lambda raw: raw["legs"][0].update(travel_seconds=True),
        lambda raw: raw["legs"][0].update(travel_seconds=-1),
        lambda raw: raw["legs"][0].update(travel_seconds=0),
        lambda raw: raw.update(is_synthetic="true"),
        lambda raw: raw.update(source=" "),
        lambda raw: raw.update(delivery_date="9999-12-31"),
    ],
)
def test_invalid_import_data_is_rejected(change):
    raw = payload()
    change(raw)
    with pytest.raises(ValidationError):
        RouteInputs.model_validate(raw)


def test_cross_week_horizon_rejected_until_separate_week_budgets_are_supported():
    raw = payload(1)
    raw["delivery_date"] = "2026-10-11"
    raw["vehicles"][0].update(
        earliest_departure="2026-10-11T08:00:00+05:30",
        latest_return="2026-10-12T01:00:00+05:30",
        available_dates=["2026-10-11", "2026-10-12"],
    )
    with pytest.raises(ValidationError, match="spanning fuel weeks"):
        RouteInputs.model_validate(raw)


def test_repository_synthetic_example_routes_successfully():
    path = Path(__file__).resolve().parents[3] / "data/seed/route-inputs.synthetic.json"
    inputs = load_route_inputs(str(path))
    candidate = allocation([1, 2])
    result = schedule_capacity(candidate, inputs)
    check_schedule(result, inputs, candidate)
    assert result.is_synthetic and "synthetic" in result.source.lower()


def test_second_trip_cannot_depart_next_day_even_with_next_day_availability():
    raw = payload()
    for outlet in raw["outlets"]:
        outlet.update(window_open="23:50:00", window_close="03:00:00", service_seconds=1800)
    raw["vehicles"][0].update(
        latest_return="2026-10-06T04:00:00+05:30", available_dates=["2026-10-05", "2026-10-06"]
    )
    result = schedule_capacity(allocation([1], [2]), RouteInputs.model_validate(raw))
    assert result.status == RouteStatus.INFEASIBLE


def test_vehicle_fuel_balances_cannot_be_borrowed_from_another_vehicle():
    raw = payload()
    second_vehicle = UUID(int=101)
    raw["vehicles"].append(
        dict(raw["vehicles"][0], vehicle_id=str(second_vehicle), weekly_fuel_quota_l="100")
    )
    raw["vehicles"][0]["weekly_fuel_quota_l"] = "4.999"
    candidate = allocation([1], [2])
    candidate = replace(
        candidate,
        trips=(
            candidate.trips[0],
            replace(candidate.trips[1], vehicle_id=second_vehicle, trip_number=1),
        ),
    )
    inputs = RouteInputs.model_validate(raw)
    assert schedule_capacity(candidate, inputs).status == RouteStatus.INFEASIBLE
    raw["vehicles"][0]["weekly_fuel_quota_l"] = "5.000"
    inputs = RouteInputs.model_validate(raw)
    check_schedule(schedule_capacity(candidate, inputs), inputs, candidate)


def test_input_order_does_not_change_small_optimal_result():
    raw = payload(3)
    inputs = RouteInputs.model_validate(raw)
    candidate = allocation([1, 2], [3])
    expected = schedule_capacity(candidate, inputs)
    for key in ("orders", "outlets", "legs", "vehicles"):
        raw[key].reverse()
    shuffled = replace(candidate, trips=tuple(reversed(candidate.trips)))
    assert schedule_capacity(shuffled, RouteInputs.model_validate(raw)) == expected


def test_arc_limit_rejects_instead_of_changing_groups():
    inputs = RouteInputs.model_validate(payload(3))
    with (
        patch("app.planning.routing.MAX_ROUTE_ARCS", 11),
        pytest.raises(RouteInputError, match="directed arc variables"),
    ):
        schedule_capacity(allocation([1, 2, 3]), inputs)


def test_pipeline_from_capacity_engine_to_route_schedule():
    from test_compatibility import order, vehicle

    from app.planning.allocation import allocate_capacity

    raw = payload()
    inputs = RouteInputs.model_validate(raw)
    candidate = allocate_capacity(
        [order(id=UUID(int=i), weight_kg=Decimal("5")) for i in (1, 2)],
        [vehicle(id=VEHICLE)],
    )
    assert len(candidate.trips) == 1
    result = schedule_capacity(candidate, inputs)
    check_schedule(result, inputs, candidate)
