"""Independently recompute hard rules from master inputs and the returned schedule."""

from datetime import datetime, time, timedelta
from decimal import ROUND_CEILING, Decimal, localcontext
from uuid import UUID

from app.planning.assignment_models import DeferralReason
from app.planning.compatibility import CompatibilityOrder, CompatibilityVehicle
from app.planning.optimizer import OptimizedDraft
from app.planning.route_inputs import LOCAL_ZONE, RouteInputs
from app.planning.routing import RouteStatus, ScheduledTrip


class PlanningValidationError(RuntimeError):
    pass


def validate_draft(
    draft: OptimizedDraft,
    orders: list[CompatibilityOrder],
    vehicles: list[CompatibilityVehicle],
    inputs: RouteInputs,
) -> None:
    def require(condition: bool) -> None:
        if not condition:
            raise PlanningValidationError("Independent draft validation failed")

    by_order = {order.id: order for order in orders}
    by_vehicle = {vehicle.id: vehicle for vehicle in vehicles}
    outlets = {outlet.outlet_id: outlet for outlet in inputs.outlets}
    mapping = {order.order_id: order.outlet_id for order in inputs.orders}
    shifts = {vehicle.vehicle_id: vehicle for vehicle in inputs.vehicles}
    legs = {(leg.from_outlet_id, leg.to_outlet_id): leg for leg in inputs.legs}
    schedule = draft.schedule
    require(schedule.status in (RouteStatus.FEASIBLE, RouteStatus.OPTIMAL))
    require(
        not schedule.unscheduled_order_ids
        and schedule.source == inputs.source
        and schedule.is_synthetic == inputs.is_synthetic
    )
    require(
        set(mapping) == set(by_order)
        and len(by_order) == len(orders)
        and len(by_vehicle) == len(vehicles)
    )
    require(
        all(item.depot_id == inputs.depot_id for item in orders)
        and all(item.depot_id == inputs.depot_id for item in vehicles)
    )
    deferred = [item.order_id for item in draft.deferrals]
    require(
        len(deferred) == len(set(deferred)) == len(schedule.unallocated_order_ids)
        and set(deferred) == set(schedule.unallocated_order_ids)
    )
    require(
        all(
            isinstance(item.reason_code, DeferralReason)
            and item.reason_text.strip()
            and len(item.reason_text) <= 1000
            for item in draft.deferrals
        )
    )
    seen = []
    previous: dict[UUID, ScheduledTrip] = {}
    fuel_totals: dict[UUID, Decimal] = {}
    with localcontext() as context:
        context.prec = 28
        for trip in schedule.trips:
            require(trip.vehicle_id in by_vehicle and trip.vehicle_id in shifts)
            vehicle, shift = by_vehicle[trip.vehicle_id], shifts[trip.vehicle_id]
            require(vehicle.is_available is True and bool(trip.stops))
            require(
                all(
                    value.tzinfo is not None and value.utcoffset() is not None
                    for value in (trip.departure_at, trip.return_at)
                )
            )
            require(trip.departure_at.astimezone(LOCAL_ZONE).date() == inputs.delivery_date)
            require(
                shift.earliest_departure
                <= trip.departure_at
                <= trip.return_at
                <= shift.latest_return
            )
            earlier = previous.get(trip.vehicle_id)
            require(
                type(trip.trip_number) is int
                and trip.trip_number == (earlier.trip_number + 1 if earlier else 1)
                and trip.trip_number <= 2
            )
            if earlier:
                require(
                    trip.departure_at
                    >= earlier.return_at + timedelta(seconds=shift.turnaround_seconds)
                )
            previous[trip.vehicle_id] = trip
            day = inputs.delivery_date
            while datetime.combine(day, time.min, LOCAL_ZONE) < trip.return_at:
                require(day in shift.available_dates)
                day += timedelta(days=1)
            point = None
            now = trip.departure_at
            distance = weight = volume = Decimal(0)
            visited = set()
            for number, stop in enumerate(trip.stops, start=1):
                require(stop.outlet_id in outlets and stop.outlet_id not in visited)
                require(stop.sequence_number == number and bool(stop.order_ids))
                visited.add(stop.outlet_id)
                require((point, stop.outlet_id) in legs)
                leg = legs[point, stop.outlet_id]
                distance += leg.distance_km
                arrival = now + timedelta(seconds=leg.travel_seconds)
                outlet = outlets[stop.outlet_id]
                opening = datetime.combine(inputs.delivery_date, outlet.window_open, LOCAL_ZONE)
                closing = datetime.combine(inputs.delivery_date, outlet.window_close, LOCAL_ZONE)
                if closing < opening:
                    closing += timedelta(days=1)
                begin = max(arrival, opening)
                end = begin + timedelta(seconds=outlet.service_seconds)
                require(
                    stop.arrival_at == arrival
                    and stop.service_start_at == begin
                    and stop.departure_at == end
                    and end <= closing
                )
                for identifier in stop.order_ids:
                    require(identifier in by_order and mapping[identifier] == stop.outlet_id)
                    order = by_order[identifier]
                    require(
                        order.temperature_requirement != "chilled"
                        or vehicle.temperature_type == "reefer"
                    )
                    require(order.parking_constraint != "van_only" or vehicle.type == "van")
                    weight += order.weight_kg
                    volume += order.volume_m3
                    seen.append(identifier)
                point, now = stop.outlet_id, end
            require((point, None) in legs)
            leg = legs[point, None]
            distance += leg.distance_km
            require(trip.return_at == now + timedelta(seconds=leg.travel_seconds))
            require(weight <= vehicle.weight_cap_kg and volume <= vehicle.volume_cap_m3)
            fuel = (distance / shift.km_per_l).quantize(Decimal("0.001"), rounding=ROUND_CEILING)
            require(trip.distance_km == distance and trip.fuel_l == fuel)
            fuel_totals[vehicle.id] = fuel_totals.get(vehicle.id, Decimal(0)) + fuel
        for identifier, fuel in fuel_totals.items():
            shift = shifts[identifier]
            require(shift.fuel_used_l is not None and shift.fuel_reserved_l is not None)
            assert shift.fuel_used_l is not None and shift.fuel_reserved_l is not None
            require(fuel + shift.fuel_used_l + shift.fuel_reserved_l <= shift.weekly_fuel_quota_l)
    require(
        len(seen) == len(set(seen))
        and set(seen).isdisjoint(deferred)
        and set(seen) | set(deferred) == set(by_order)
    )
