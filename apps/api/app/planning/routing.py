"""Sequence fixed capacity groups using explicit travel, window and fuel inputs."""

from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from decimal import Decimal, localcontext
from enum import StrEnum
from math import isfinite
from typing import Literal
from uuid import UUID

from ortools.sat.python import cp_model

from app.planning.allocation import CapacityAllocation, CapacityTrip
from app.planning.route_inputs import LOCAL_ZONE, RouteInputs, TravelLeg, VehicleRouteInput

MAX_ROUTE_ARCS = 20_000
MAX_STOPS_PER_TRIP = 25
MICROSECONDS = 1_000_000


class RouteStatus(StrEnum):
    OPTIMAL = "OPTIMAL"
    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"


class RouteInputError(ValueError):
    """The supplied snapshot cannot support checking the candidate groups."""


class RouteSearchUnavailable(RuntimeError):
    """No usable solver verdict; UNKNOWN is not proof of infeasibility."""


@dataclass(frozen=True)
class ScheduledStop:
    outlet_id: UUID
    sequence_number: int
    order_ids: tuple[UUID, ...]
    arrival_at: datetime
    service_start_at: datetime
    departure_at: datetime


@dataclass(frozen=True)
class ScheduledTrip:
    vehicle_id: UUID
    trip_number: int
    departure_at: datetime
    return_at: datetime
    stops: tuple[ScheduledStop, ...]
    distance_km: Decimal
    fuel_l: Decimal


@dataclass(frozen=True)
class RouteSchedule:
    status: RouteStatus
    trips: tuple[ScheduledTrip, ...]
    unallocated_order_ids: tuple[UUID, ...]
    unscheduled_order_ids: tuple[UUID, ...]
    source: str
    is_synthetic: bool
    is_complete_plan_validation: Literal[False] = field(default=False, init=False)


@dataclass
class _TripModel:
    group: CapacityTrip
    nodes: tuple[UUID | None, ...]
    start: cp_model.IntVar
    end: cp_model.IntVar
    arcs: dict[tuple[int, int], cp_model.IntVar]
    fuel: cp_model.IntVar


def _scaled(value: Decimal) -> int:
    with localcontext() as context:
        context.prec = 28
        return int(value * 1000)


def _decimal(value: int) -> Decimal:
    with localcontext() as context:
        context.prec = 28
        return (Decimal(value) / 1000).quantize(Decimal("0.001"))


def _validate_groups(allocation: CapacityAllocation, inputs: RouteInputs) -> None:
    slots: dict[UUID, set[int]] = {}
    ids = list(allocation.unallocated_order_ids)
    for trip in allocation.trips:
        if (
            not trip.order_ids
            or type(trip.trip_number) is not int
            or trip.trip_number not in (1, 2)
        ):
            raise RouteInputError("Groups require nonempty orders and trip slots 1 or 2")
        vehicle_slots = slots.setdefault(trip.vehicle_id, set())
        if trip.trip_number in vehicle_slots:
            raise RouteInputError("Duplicate vehicle trip slot")
        vehicle_slots.add(trip.trip_number)
        ids.extend(trip.order_ids)
    if any(numbers not in ({1}, {1, 2}) for numbers in slots.values()):
        raise RouteInputError("Trip slots must start at 1")
    if len(ids) != len(set(ids)) or set(ids) != {item.order_id for item in inputs.orders}:
        raise RouteInputError("Every snapshot order must be allocated or unallocated exactly once")
    vehicles = {vehicle.vehicle_id: vehicle for vehicle in inputs.vehicles}
    for vehicle_id in slots:
        if vehicle_id not in vehicles:
            raise RouteInputError("Missing route input for an allocated vehicle")
        vehicle = vehicles[vehicle_id]
        if inputs.delivery_date not in vehicle.available_dates:
            raise RouteInputError("Allocated vehicle needs explicit availability on the plan date")
        if vehicle.fuel_used_l is None or vehicle.fuel_reserved_l is None:
            raise RouteInputError("Consumed and reserved weekly fuel must both be known")


def schedule_capacity(
    allocation: CapacityAllocation,
    inputs: RouteInputs,
    *,
    time_limit_seconds: float = 5.0,
) -> RouteSchedule:
    """Find minimum-distance routes for fixed groups, or report they cannot fit.

    Group/vehicle assignment is not changed. Trip order on each vehicle may swap.
    This does not independently validate capacities/master data or publish a plan.
    The future optimizer must repair/reallocate infeasible groups before deferring
    orders; INFEASIBLE here is only a verdict about these fixed candidate groups.
    """
    if (
        isinstance(time_limit_seconds, bool)
        or not isinstance(time_limit_seconds, (int, float))
        or not 0 < time_limit_seconds <= 30
        or not isfinite(time_limit_seconds)
    ):
        raise ValueError("Solver time limit must be greater than zero and at most 30 seconds")
    _validate_groups(allocation, inputs)
    order_outlets = {item.order_id: item.outlet_id for item in inputs.orders}
    outlets = {item.outlet_id: item for item in inputs.outlets}
    vehicles = {item.vehicle_id: item for item in inputs.vehicles}
    legs = {(leg.from_outlet_id, leg.to_outlet_id): leg for leg in inputs.legs}
    midnight = datetime.combine(inputs.delivery_date, time.min, LOCAL_ZONE)
    next_midnight = midnight + timedelta(days=1)

    def ticks(value: datetime) -> int:
        return (value - midnight) // timedelta(microseconds=1)

    def result(status: RouteStatus, trips: tuple[ScheduledTrip, ...] = ()) -> RouteSchedule:
        return RouteSchedule(
            status=status,
            trips=trips,
            unallocated_order_ids=tuple(sorted(allocation.unallocated_order_ids)),
            unscheduled_order_ids=tuple(
                sorted(order_id for trip in allocation.trips for order_id in trip.order_ids)
            )
            if status == RouteStatus.INFEASIBLE
            else (),
            source=inputs.source,
            is_synthetic=inputs.is_synthetic,
        )

    if not allocation.trips:
        return result(RouteStatus.OPTIMAL)
    groups = sorted(allocation.trips, key=lambda trip: (trip.vehicle_id, trip.trip_number))
    node_sets: list[tuple[UUID | None, ...]] = []
    arc_count = 0
    for trip in groups:
        nodes: tuple[UUID | None, ...] = (
            None,
            *sorted({order_outlets[order_id] for order_id in trip.order_ids}),
        )
        if len(nodes) - 1 > MAX_STOPS_PER_TRIP:
            raise RouteInputError("Routing supports at most 25 outlet stops per trip")
        arc_count += len(nodes) * (len(nodes) - 1)
        if arc_count > MAX_ROUTE_ARCS:
            raise RouteInputError("Routing supports at most 20000 directed arc variables")
        if any((a, b) not in legs for a in nodes for b in nodes if a != b):
            raise RouteInputError(
                "Missing directed travel leg; reverse/zero values are not inferred"
            )
        node_sets.append(nodes)

    model = cp_model.CpModel()
    vehicle_trips: dict[UUID, list[_TripModel]] = {}
    distances: list[cp_model.LinearExpr] = []
    # Each group is a circuit through its depot and every outlet, without self loops.
    for index, (trip, nodes) in enumerate(zip(groups, node_sets)):
        vehicle = vehicles[trip.vehicle_id]
        horizon = vehicle.latest_return
        if inputs.delivery_date + timedelta(days=1) not in vehicle.available_dates:
            horizon = min(horizon, next_midnight)
        start = model.new_int_var(
            ticks(vehicle.earliest_departure), ticks(next_midnight) - 1, f"start_{index}"
        )
        end = model.new_int_var(0, ticks(horizon), f"end_{index}")
        arrivals: dict[int, cp_model.IntVar] = {}
        services: dict[int, int] = {0: 0}
        for node_index, outlet_id in enumerate(nodes[1:], start=1):
            assert outlet_id is not None
            outlet = outlets[outlet_id]
            window_start = datetime.combine(inputs.delivery_date, outlet.window_open, LOCAL_ZONE)
            window_end = datetime.combine(inputs.delivery_date, outlet.window_close, LOCAL_ZONE)
            if window_end < window_start:
                window_end += timedelta(days=1)
            service = outlet.service_seconds * MICROSECONDS
            services[node_index] = service
            # Use a broad valid domain and explicit bounds: impossible windows produce
            # INFEASIBLE, never a malformed negative-domain solver model.
            arrival = model.new_int_var(0, ticks(horizon), f"service_{index}_{node_index}")
            arrivals[node_index] = arrival
            model.add(arrival >= ticks(window_start))
            model.add(arrival + service <= ticks(window_end))
        arcs: dict[tuple[int, int], cp_model.IntVar] = {}
        distance_terms: list[cp_model.LinearExpr] = []
        for a, from_id in enumerate(nodes):
            for b, to_id in enumerate(nodes):
                if a == b:
                    continue
                leg = legs[from_id, to_id]
                arc = model.new_bool_var(f"arc_{index}_{a}_{b}")
                arcs[a, b] = arc
                distance_terms.append(_scaled(leg.distance_km) * arc)
                origin = start if a == 0 else arrivals[a] + services[a]
                destination = end if b == 0 else arrivals[b]
                model.add(
                    destination >= origin + leg.travel_seconds * MICROSECONDS
                ).only_enforce_if(arc)
        model.add_circuit([(a, b, arc) for (a, b), arc in arcs.items()])
        distance = cp_model.LinearExpr.sum(distance_terms)
        distances.append(distance)
        assert vehicle.fuel_used_l is not None and vehicle.fuel_reserved_l is not None
        budget = (
            _scaled(vehicle.weekly_fuel_quota_l)
            - _scaled(vehicle.fuel_used_l)
            - _scaled(vehicle.fuel_reserved_l)
        )
        efficiency = _scaled(vehicle.km_per_l)
        maximum_distance = len(nodes) * max(
            _scaled(legs[a, b].distance_km) for a in nodes for b in nodes if a != b
        )
        maximum_fuel = (maximum_distance * 1000 + efficiency - 1) // efficiency
        fuel = model.new_int_var(0, min(maximum_fuel, max(0, budget)), f"fuel_{index}")
        # f = ceil(distance / efficiency * 1000), in millilitres, per trip.
        model.add(fuel * efficiency >= distance * 1000)
        model.add(fuel * efficiency <= distance * 1000 + efficiency - 1)
        trip_model = _TripModel(trip, nodes, start, end, arcs, fuel)
        vehicle_trips.setdefault(trip.vehicle_id, []).append(trip_model)

    first_before_second: dict[UUID, cp_model.IntVar] = {}
    for vehicle_id, models in vehicle_trips.items():
        vehicle = vehicles[vehicle_id]
        assert vehicle.fuel_used_l is not None and vehicle.fuel_reserved_l is not None
        budget = (
            _scaled(vehicle.weekly_fuel_quota_l)
            - _scaled(vehicle.fuel_used_l)
            - _scaled(vehicle.fuel_reserved_l)
        )
        model.add(sum(item.fuel for item in models) <= budget)
        if len(models) == 2:
            first, second = models
            before = model.new_bool_var(f"trip_order_{vehicle_id}")
            first_before_second[vehicle_id] = before
            turnaround = vehicle.turnaround_seconds * MICROSECONDS
            model.add(second.start >= first.end + turnaround).only_enforce_if(before)
            model.add(first.start >= second.end + turnaround).only_enforce_if(before.Not())

    model.minimize(cp_model.LinearExpr.sum(distances))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(time_limit_seconds)
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    status = solver.solve(model)
    if status == cp_model.INFEASIBLE:
        return result(RouteStatus.INFEASIBLE)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RouteSearchUnavailable("Route solver did not return a usable verdict")

    scheduled = []
    for vehicle_id, models in sorted(vehicle_trips.items()):
        vehicle = vehicles[vehicle_id]
        if len(models) == 2 and not solver.value(first_before_second[vehicle_id]):
            models = list(reversed(models))
        departure = vehicle.earliest_departure.astimezone(LOCAL_ZONE)
        for number, item in enumerate(models, start=1):
            visit_order = []
            current = 0
            for _ in range(len(item.nodes) - 1):
                current = next(
                    b for (a, b), arc in item.arcs.items() if a == current and solver.value(arc)
                )
                outlet_id = item.nodes[current]
                assert outlet_id is not None
                visit_order.append(outlet_id)
            scheduled_trip = _materialize_trip(
                item.group, number, tuple(visit_order), departure, inputs, vehicle, legs
            )
            scheduled.append(scheduled_trip)
            departure = scheduled_trip.return_at + timedelta(seconds=vehicle.turnaround_seconds)
    return result(
        RouteStatus.OPTIMAL if status == cp_model.OPTIMAL else RouteStatus.FEASIBLE,
        tuple(scheduled),
    )


def _materialize_trip(
    group: CapacityTrip,
    number: int,
    visits: tuple[UUID, ...],
    departure: datetime,
    inputs: RouteInputs,
    vehicle: VehicleRouteInput,
    legs: dict[tuple[UUID | None, UUID | None], TravelLeg],
) -> ScheduledTrip:
    """Rebuild earliest actual travel/wait/service times, independent of solver slack."""
    outlets = {item.outlet_id: item for item in inputs.outlets}
    order_outlets = {item.order_id: item.outlet_id for item in inputs.orders}
    current: UUID | None = None
    now = departure
    distance = 0
    stops = []
    for sequence, outlet_id in enumerate(visits, start=1):
        leg = legs[current, outlet_id]
        distance += _scaled(leg.distance_km)
        arrival = now + timedelta(seconds=leg.travel_seconds)
        outlet = outlets[outlet_id]
        window_start = datetime.combine(inputs.delivery_date, outlet.window_open, LOCAL_ZONE)
        service_start = max(arrival, window_start)
        now = service_start + timedelta(seconds=outlet.service_seconds)
        stops.append(
            ScheduledStop(
                outlet_id,
                sequence,
                tuple(
                    sorted(
                        order_id
                        for order_id in group.order_ids
                        if order_outlets[order_id] == outlet_id
                    )
                ),
                arrival,
                service_start,
                now,
            )
        )
        current = outlet_id
    return_leg = legs[current, None]
    distance += _scaled(return_leg.distance_km)
    efficiency = _scaled(vehicle.km_per_l)
    fuel = (distance * 1000 + efficiency - 1) // efficiency
    return ScheduledTrip(
        group.vehicle_id,
        number,
        departure,
        now + timedelta(seconds=return_leg.travel_seconds),
        tuple(stops),
        _decimal(distance),
        _decimal(fuel),
    )
