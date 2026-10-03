"""Add depot/day plans, revisions, trips and stops without changing existing data.

Revision ID: 0005_planning_foundation
Revises: 0004_user_scopes
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_planning_foundation"
down_revision: str | Sequence[str] | None = "0004_user_scopes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("depot_id", sa.Uuid(), nullable=False),
        sa.Column("delivery_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="DRAFT"),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plans")),
        sa.ForeignKeyConstraint(["depot_id"], ["depots.id"], ondelete="RESTRICT",
                                name=op.f("fk_plans_depot_id_depots")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT",
                                name=op.f("fk_plans_created_by_users")),
        sa.UniqueConstraint("depot_id", "delivery_date", name=op.f("uq_plans_depot_delivery_date")),
        sa.CheckConstraint("status IN ('DRAFT', 'PUBLISHED')",
                           name=op.f("ck_plans_status_allowed")),
    )
    op.create_index(op.f("ix_plans_delivery_date"), "plans", ["delivery_date"], unique=False)
    op.create_index(op.f("ix_plans_created_by"), "plans", ["created_by"], unique=False)
    op.create_table(
        "plan_revisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="DRAFT"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_revisions")),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="RESTRICT",
                                name=op.f("fk_plan_revisions_plan_id_plans")),
        sa.UniqueConstraint("plan_id", "revision_number",
                            name=op.f("uq_plan_revisions_plan_number")),
        sa.CheckConstraint("revision_number > 0",
                           name=op.f("ck_plan_revisions_revision_number_positive")),
        sa.CheckConstraint("status IN ('DRAFT', 'PUBLISHED')",
                           name=op.f("ck_plan_revisions_status_allowed")),
        sa.CheckConstraint(
            "(status = 'DRAFT' AND published_at IS NULL) OR "
            "(status = 'PUBLISHED' AND published_at IS NOT NULL)",
            name=op.f("ck_plan_revisions_publication_consistent"),
        ),
    )
    op.create_table(
        "trips",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_revision_id", sa.Uuid(), nullable=False),
        sa.Column("vehicle_id", sa.Uuid(), nullable=False),
        sa.Column("driver_id", sa.Uuid(), nullable=True),
        sa.Column("trip_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="PLANNED"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_trips")),
        sa.ForeignKeyConstraint(["plan_revision_id"], ["plan_revisions.id"], ondelete="RESTRICT",
                                name=op.f("fk_trips_plan_revision_id_plan_revisions")),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], ondelete="RESTRICT",
                                name=op.f("fk_trips_vehicle_id_vehicles")),
        sa.ForeignKeyConstraint(["driver_id"], ["users.id"], ondelete="RESTRICT",
                                name=op.f("fk_trips_driver_id_users")),
        sa.UniqueConstraint("plan_revision_id", "vehicle_id", "trip_number",
                            name=op.f("uq_trips_revision_vehicle_number")),
        sa.CheckConstraint("trip_number IN (1, 2)", name=op.f("ck_trips_trip_number_allowed")),
        sa.CheckConstraint(
            "status IN ('PLANNED', 'LOADING', 'READY', 'IN_PROGRESS', 'COMPLETED')",
            name=op.f("ck_trips_status_allowed"),
        ),
    )
    op.create_index(op.f("ix_trips_vehicle_id"), "trips", ["vehicle_id"], unique=False)
    op.create_index(op.f("ix_trips_driver_id"), "trips", ["driver_id"], unique=False)
    op.create_table(
        "trip_stops",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("outlet_id", sa.Uuid(), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("planned_arrival_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="PLANNED"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_trip_stops")),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="RESTRICT",
                                name=op.f("fk_trip_stops_trip_id_trips")),
        sa.ForeignKeyConstraint(["outlet_id"], ["outlets.id"], ondelete="RESTRICT",
                                name=op.f("fk_trip_stops_outlet_id_outlets")),
        sa.UniqueConstraint("trip_id", "sequence_number", name=op.f("uq_trip_stops_trip_sequence")),
        sa.UniqueConstraint("trip_id", "outlet_id", name=op.f("uq_trip_stops_trip_outlet")),
        sa.CheckConstraint("sequence_number > 0",
                           name=op.f("ck_trip_stops_sequence_number_positive")),
        sa.CheckConstraint("status IN ('PLANNED', 'ARRIVED', 'DELIVERED', 'FAILED')",
                           name=op.f("ck_trip_stops_status_allowed")),
    )
    op.create_index(op.f("ix_trip_stops_outlet_id"), "trip_stops", ["outlet_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_trip_stops_outlet_id"), table_name="trip_stops")
    op.drop_table("trip_stops")
    op.drop_index(op.f("ix_trips_driver_id"), table_name="trips")
    op.drop_index(op.f("ix_trips_vehicle_id"), table_name="trips")
    op.drop_table("trips")
    op.drop_table("plan_revisions")
    op.drop_index(op.f("ix_plans_created_by"), table_name="plans")
    op.drop_index(op.f("ix_plans_delivery_date"), table_name="plans")
    op.drop_table("plans")
