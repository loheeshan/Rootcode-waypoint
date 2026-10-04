"""Add order outcomes and deferral reasons with consistent route references.

Revision ID: 0006_plan_outcomes
Revises: 0005_planning_foundation
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_plan_outcomes"
down_revision: str | Sequence[str] | None = "0005_planning_foundation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing UUID PKs guarantee uniqueness; these indexes expose composite FK targets.
    op.create_index(op.f("uq_orders_id_outlet"), "orders", ["id", "outlet_id"], unique=True)
    op.create_index(op.f("uq_trips_id_revision"), "trips", ["id", "plan_revision_id"], unique=True)
    op.create_index(op.f("uq_trip_stops_id_trip_outlet"), "trip_stops",
                    ["id", "trip_id", "outlet_id"], unique=True)
    op.create_table(
        "plan_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_revision_id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("outlet_id", sa.Uuid(), nullable=False),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=True),
        sa.Column("trip_stop_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_assignments")),
        sa.UniqueConstraint("plan_revision_id", "order_id",
                            name=op.f("uq_plan_assignments_revision_order")),
        sa.UniqueConstraint("plan_revision_id", "order_id", "outcome",
                            name=op.f("uq_plan_assignments_revision_order_outcome")),
        sa.CheckConstraint("outcome IN ('SERVED', 'DEFERRED')",
                           name=op.f("ck_plan_assignments_outcome_allowed")),
        sa.CheckConstraint(
            "(outcome = 'SERVED' AND trip_id IS NOT NULL AND trip_stop_id IS NOT NULL) OR "
            "(outcome = 'DEFERRED' AND trip_id IS NULL AND trip_stop_id IS NULL)",
            name=op.f("ck_plan_assignments_outcome_route_consistent"),
        ),
        sa.ForeignKeyConstraint(["plan_revision_id"], ["plan_revisions.id"], ondelete="RESTRICT",
                                name=op.f("fk_plan_assignments_plan_revision_id_plan_revisions")),
        sa.ForeignKeyConstraint(["order_id", "outlet_id"], ["orders.id", "orders.outlet_id"],
                                ondelete="RESTRICT", name=op.f("fk_plan_assignments_order_outlet")),
        sa.ForeignKeyConstraint(["trip_id", "plan_revision_id"],
                                ["trips.id", "trips.plan_revision_id"], ondelete="RESTRICT",
                                name=op.f("fk_plan_assignments_trip_revision")),
        sa.ForeignKeyConstraint(["trip_stop_id", "trip_id", "outlet_id"],
                                ["trip_stops.id", "trip_stops.trip_id", "trip_stops.outlet_id"],
                                ondelete="RESTRICT",
                                name=op.f("fk_plan_assignments_stop_trip_outlet")),
    )
    op.create_index(op.f("ix_plan_assignments_order_id"), "plan_assignments", ["order_id"])
    op.create_index(op.f("ix_plan_assignments_trip_id"), "plan_assignments", ["trip_id"])
    op.create_index(op.f("ix_plan_assignments_trip_stop_id"), "plan_assignments", ["trip_stop_id"])
    op.create_table(
        "deferral_decisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_revision_id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("assignment_outcome", sa.String(16), nullable=False, server_default="DEFERRED"),
        sa.Column("reason_code", sa.String(32), nullable=False),
        sa.Column("reason_text", sa.String(1000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deferral_decisions")),
        sa.UniqueConstraint("plan_revision_id", "order_id",
                            name=op.f("uq_deferral_decisions_revision_order")),
        sa.ForeignKeyConstraint(["plan_revision_id", "order_id", "assignment_outcome"],
                                ["plan_assignments.plan_revision_id", "plan_assignments.order_id",
                                 "plan_assignments.outcome"], ondelete="RESTRICT",
                                name=op.f("fk_deferral_decisions_deferred_assignment")),
        sa.CheckConstraint("assignment_outcome = 'DEFERRED'",
                           name=op.f("ck_deferral_decisions_deferred_only")),
        sa.CheckConstraint(
            "reason_code IN ('NO_COMPATIBLE_VEHICLE', 'REEFER_CAPACITY_EXHAUSTED', "
            "'VAN_CAPACITY_EXHAUSTED', 'WEIGHT_CAPACITY', 'VOLUME_CAPACITY', 'TIME_WINDOW', "
            "'FUEL_QUOTA', 'VEHICLE_UNAVAILABLE', 'TRIP_LIMIT')",
            name=op.f("ck_deferral_decisions_reason_code_allowed"),
        ),
        sa.CheckConstraint("length(trim(reason_text, ' \t\n\r')) > 0",
                           name=op.f("ck_deferral_decisions_reason_text_not_blank")),
        sa.CheckConstraint("length(reason_text) <= 1000",
                           name=op.f("ck_deferral_decisions_reason_text_length")),
    )
    op.create_index(op.f("ix_deferral_decisions_order_id"), "deferral_decisions", ["order_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_deferral_decisions_order_id"), table_name="deferral_decisions")
    op.drop_table("deferral_decisions")
    op.drop_index(op.f("ix_plan_assignments_trip_stop_id"), table_name="plan_assignments")
    op.drop_index(op.f("ix_plan_assignments_trip_id"), table_name="plan_assignments")
    op.drop_index(op.f("ix_plan_assignments_order_id"), table_name="plan_assignments")
    op.drop_table("plan_assignments")
    op.drop_index(op.f("uq_trip_stops_id_trip_outlet"), table_name="trip_stops")
    op.drop_index(op.f("uq_trips_id_revision"), table_name="trips")
    op.drop_index(op.f("uq_orders_id_outlet"), table_name="orders")
