"""Bounded draft construction; local insertion failures are not global impossibility proofs."""

from dataclasses import dataclass
from decimal import Decimal
from time import monotonic
from uuid import UUID

from app.planning.allocation import (
    AllocationStatus,
    CapacityAllocation,
    CapacityTrip,
    allocate_capacity,
)
from app.planning.assignment_models import DeferralReason
from app.planning.compatibility import (
    CompatibilityOrder,
    CompatibilityVehicle,
    build_compatibility_matrix,
)
from app.planning.route_inputs import RouteInputs
from app.planning.routing import (
    RouteInputError,
    RouteSchedule,
    RouteSearchUnavailable,
    RouteStatus,
    schedule_capacity,
)


@dataclass(frozen=True)
class DraftDeferral:
    order_id: UUID
    reason_code: DeferralReason
    reason_text: str


@dataclass(frozen=True)
class OptimizedDraft:
    schedule: RouteSchedule
    deferrals: tuple[DraftDeferral, ...]


def optimize_draft(
    orders: list[CompatibilityOrder], vehicles: list[CompatibilityVehicle], inputs: RouteInputs
) -> OptimizedDraft:
    deadline = monotonic() + 20
    attempts = 0
    order_map = {order.id: order for order in orders}
    vehicle_map = {vehicle.id: vehicle for vehicle in vehicles}
    matrix = {row.order_id: row for row in build_compatibility_matrix(orders, vehicles)}

    def run(candidate: CapacityAllocation, *, diagnose_fuel: bool = False) -> RouteSchedule:
        nonlocal attempts
        remaining = deadline - monotonic()
        attempts += 1
        if remaining < 0.01 or attempts > 128:
            raise RouteSearchUnavailable("Draft search budget exhausted; no result was saved")
        snapshot = inputs
        if diagnose_fuel:
            # Only for explanation: relax fuel enough for every bounded route.
            # These artificial balances never become a returned/saved schedule.
            snapshot = inputs.model_copy(
                update={
                    "vehicles": tuple(
                        vehicle.model_copy(
                            update={
                                "km_per_l": Decimal("99999.999"),
                                "weekly_fuel_quota_l": Decimal("999999999.999"),
                                "fuel_used_l": Decimal(0),
                                "fuel_reserved_l": Decimal(0),
                            }
                        )
                        for vehicle in inputs.vehicles
                    )
                }
            )
        return schedule_capacity(candidate, snapshot, time_limit_seconds=min(2.0, remaining))

    seed = allocate_capacity(orders, vehicles, time_limit_seconds=3)
    if not seed.unallocated_order_ids and all(
        len({item.outlet_id for item in inputs.orders if item.order_id in trip.order_ids}) <= 25
        for trip in seed.trips
    ):
        scheduled = run(seed)
        if scheduled.status != RouteStatus.INFEASIBLE:
            return OptimizedDraft(scheduled, ())

    # Repair by rebuilding with constrained orders first; try every eligible
    # vehicle's existing groups and unused slots before deferring an order.
    groups: list[tuple[UUID, tuple[UUID, ...]]] = []
    deferrals: list[DraftDeferral] = []

    def candidate(proposal: list[tuple[UUID, tuple[UUID, ...]]]) -> CapacityAllocation:
        counts: dict[UUID, int] = {}
        trips = []
        assigned: set[UUID] = set()
        for vehicle_id, ids in proposal:
            counts[vehicle_id] = counts.get(vehicle_id, 0) + 1
            assigned.update(ids)
            trips.append(
                CapacityTrip(
                    vehicle_id,
                    counts[vehicle_id],
                    ids,
                    sum((order_map[i].weight_kg for i in ids), Decimal(0)),
                    sum((order_map[i].volume_m3 for i in ids), Decimal(0)),
                )
            )
        return CapacityAllocation(
            AllocationStatus.FEASIBLE, tuple(trips), tuple(sorted(set(order_map) - assigned))
        )

    scheduled = run(candidate(groups))
    for order in sorted(
        orders, key=lambda item: (len(matrix[item.id].candidate_vehicle_ids), item.id)
    ):
        compatible = matrix[order.id].candidate_vehicle_ids
        if not compatible:
            reason = (
                DeferralReason.VEHICLE_UNAVAILABLE
                if vehicles and all(vehicle.is_available is False for vehicle in vehicles)
                else DeferralReason.NO_COMPATIBLE_VEHICLE
            )
            deferrals.append(
                DraftDeferral(
                    order.id,
                    reason,
                    "No explicitly available vehicle passes this order's depot, temperature, "
                    "access, individual weight and volume checks.",
                )
            )
            continue
        failures: set[DeferralReason] = set()
        size_limited = False
        accepted = False
        for vehicle_id in compatible:
            vehicle = vehicle_map[vehicle_id]
            positions = [i for i, group in enumerate(groups) if group[0] == vehicle_id]
            options = positions + ([-1] if len(positions) < 2 else [])
            if len(positions) == 2:
                failures.add(DeferralReason.TRIP_LIMIT)
            for position in options:
                ids = (order.id,) if position == -1 else (*groups[position][1], order.id)
                if len({item.outlet_id for item in inputs.orders if item.order_id in ids}) > 25:
                    size_limited = True
                    continue
                if sum(order_map[i].weight_kg for i in ids) > vehicle.weight_cap_kg:
                    failures.add(DeferralReason.WEIGHT_CAPACITY)
                    continue
                if sum(order_map[i].volume_m3 for i in ids) > vehicle.volume_cap_m3:
                    failures.add(DeferralReason.VOLUME_CAPACITY)
                    continue
                proposal = list(groups)
                if position == -1:
                    proposal.append((vehicle_id, ids))
                else:
                    proposal[position] = (vehicle_id, ids)
                attempt = candidate(proposal)
                result = run(attempt)
                if result.status != RouteStatus.INFEASIBLE:
                    groups, scheduled, accepted = proposal, result, True
                    break
                relaxed = run(attempt, diagnose_fuel=True)
                failures.add(
                    DeferralReason.TIME_WINDOW
                    if relaxed.status == RouteStatus.INFEASIBLE
                    else DeferralReason.FUEL_QUOTA
                )
            if accepted:
                break
        if not accepted:
            if size_limited:
                raise RouteInputError("Route size limit prevented completing the insertion search")
            reason = next(
                code
                for code in (
                    DeferralReason.FUEL_QUOTA,
                    DeferralReason.TIME_WINDOW,
                    DeferralReason.WEIGHT_CAPACITY,
                    DeferralReason.VOLUME_CAPACITY,
                    DeferralReason.TRIP_LIMIT,
                )
                if code in failures
            )
            deferrals.append(
                DraftDeferral(
                    order.id,
                    reason,
                    f"Not placed by bounded insertion in this draft ({reason.value}). "
                    "All compatible "
                    "existing groups and unused trip slots were tried against current loads, "
                    "windows/return deadlines, availability and fuel. "
                    "Alternative allocations may differ.",
                )
            )
    return OptimizedDraft(scheduled, tuple(sorted(deferrals, key=lambda item: item.order_id)))
