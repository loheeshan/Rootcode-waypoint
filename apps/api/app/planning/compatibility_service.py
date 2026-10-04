from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.auth.models import User, UserDepot
from app.fleet.models import Depot, Outlet, ParkingConstraint, TemperatureType, Vehicle, VehicleType
from app.fleet.operations_models import VehicleAvailability
from app.fleet.schemas import DepotResponse, OutletResponse, VehicleResponse
from app.orders.dispatcher_schemas import DispatcherOrderResponse
from app.orders.models import Order, OrderStatus, TemperatureRequirement
from app.orders.schemas import OrderResponse
from app.planning.compatibility import (
    CompatibilityOrder,
    CompatibilityVehicle,
    build_compatibility_matrix,
)
from app.planning.compatibility_schemas import (
    CompatibilityVehicleResponse,
    OrderCompatibilityResponse,
    PlanCompatibilityResponse,
    VehicleExclusionResponse,
)
from app.planning.models import Plan

MAX_PREVIEW_VEHICLES = 500


def preview_compatibility(
    session: Session,
    user: User,
    plan_id: UUID,
    *,
    limit: int,
    offset: int,
) -> PlanCompatibilityResponse:
    allowed = select(UserDepot.depot_id).where(UserDepot.user_id == user.id)
    plan = session.scalar(select(Plan).where(Plan.id == plan_id, Plan.depot_id.in_(allowed)))
    if plan is None:
        raise HTTPException(
            status_code=404, detail="Plan not found", headers={"Cache-Control": "no-store"}
        )

    # Bind availability to the PLAN day in the JOIN, so missing input stays unknown
    # and a record for yesterday cannot make a vehicle available today.
    vehicle_rows = session.execute(
        select(Vehicle, VehicleAvailability.is_available)
        .outerjoin(
            VehicleAvailability,
            and_(
                VehicleAvailability.vehicle_id == Vehicle.id,
                VehicleAvailability.availability_date == plan.delivery_date,
            ),
        )
        .where(Vehicle.depot_id == plan.depot_id)
        .order_by(Vehicle.id)
        .limit(MAX_PREVIEW_VEHICLES + 1)
    ).all()
    if len(vehicle_rows) > MAX_PREVIEW_VEHICLES:
        raise HTTPException(
            status_code=422,
            detail="Compatibility preview supports at most 500 vehicles per depot",
            headers={"Cache-Control": "no-store"},
        )
    vehicles = [
        CompatibilityVehicle(
            id=vehicle.id,
            depot_id=vehicle.depot_id,
            type=VehicleType(vehicle.type),
            temperature_type=TemperatureType(vehicle.temperature_type),
            weight_cap_kg=vehicle.weight_cap_kg,
            volume_cap_m3=vehicle.volume_cap_m3,
            is_available=available,
        )
        for vehicle, available in vehicle_rows
    ]

    # Eligibility and the total are scoped before pagination; no user-selected IDs
    # can pull orders from another day/depot or from non-confirmed workflow states.
    query = (
        select(Order, Outlet, Depot)
        .join(Outlet, Order.outlet_id == Outlet.id)
        .join(Depot, Outlet.depot_id == Depot.id)
        .where(
            Outlet.depot_id == plan.depot_id,
            Order.requested_delivery_date == plan.delivery_date,
            Order.status == OrderStatus.CONFIRMED,
        )
    )
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = session.execute(query.order_by(Order.id).offset(offset).limit(limit)).all()
    orders = [
        CompatibilityOrder(
            id=order.id,
            depot_id=outlet.depot_id,
            temperature_requirement=TemperatureRequirement(order.temperature_requirement),
            parking_constraint=ParkingConstraint(outlet.parking_constraint),
            weight_kg=order.order_weight_kg,
            volume_m3=order.order_volume_m3,
        )
        for order, outlet, _ in rows
    ]
    details = {
        order.id: DispatcherOrderResponse(
            **OrderResponse.from_order(order).model_dump(),
            outlet=OutletResponse.model_validate(outlet),
            depot=DepotResponse.model_validate(depot),
        )
        for order, outlet, depot in rows
    }
    matrix = build_compatibility_matrix(orders, vehicles)
    return PlanCompatibilityResponse(
        plan_id=plan.id,
        depot_id=plan.depot_id,
        delivery_date=plan.delivery_date,
        items=[
            OrderCompatibilityResponse(
                order=details[result.order_id],
                candidate_vehicle_ids=list(result.candidate_vehicle_ids),
                excluded_vehicles=[
                    VehicleExclusionResponse(
                        vehicle_id=excluded.vehicle_id, reasons=list(excluded.reasons)
                    )
                    for excluded in result.excluded_vehicles
                ],
            )
            for result in matrix
        ],
        vehicles=[
            CompatibilityVehicleResponse(
                vehicle=VehicleResponse.model_validate(vehicle), is_available=available
            )
            for vehicle, available in vehicle_rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
