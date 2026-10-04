"""Publish one effective revision per plan with driver and fuel reservation records."""

import sqlalchemy as sa
from alembic import op

revision = "0009_plan_publications"
down_revision = "0008_plan_optimizations"
branch_labels = None
depends_on = None

PUBLISHED = sa.text("status = 'PUBLISHED'")


def upgrade() -> None:
    op.create_index(
        "uq_plan_revisions_one_published",
        "plan_revisions",
        ["plan_id"],
        unique=True,
        postgresql_where=PUBLISHED,
        sqlite_where=PUBLISHED,
    )
    op.create_index("uq_trips_id_vehicle", "trips", ["id", "vehicle_id"], unique=True)
    op.create_table(
        "plan_publications",
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("plan_revision_id", sa.Uuid(), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("published_by", sa.Uuid(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("result_snapshot", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("request_id", name=op.f("pk_plan_publications")),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["plans.id"],
            ondelete="RESTRICT",
            name=op.f("fk_plan_publications_plan_id_plans"),
        ),
        sa.ForeignKeyConstraint(
            ["plan_revision_id"],
            ["plan_revisions.id"],
            ondelete="RESTRICT",
            name=op.f("fk_plan_publications_plan_revision_id_plan_revisions"),
        ),
        sa.ForeignKeyConstraint(
            ["published_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_plan_publications_published_by_users"),
        ),
        sa.UniqueConstraint("plan_id", name=op.f("uq_plan_publications_plan_id")),
        sa.UniqueConstraint("plan_revision_id", name=op.f("uq_plan_publications_plan_revision_id")),
    )
    op.create_index(
        op.f("ix_plan_publications_published_by"), "plan_publications", ["published_by"]
    )
    op.create_table(
        "fuel_reservations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("vehicle_id", sa.Uuid(), nullable=False),
        sa.Column("service_date", sa.Date(), nullable=False),
        sa.Column("fuel_l", sa.Numeric(12, 3), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fuel_reservations")),
        sa.ForeignKeyConstraint(
            ["trip_id", "vehicle_id"],
            ["trips.id", "trips.vehicle_id"],
            ondelete="RESTRICT",
            name="fk_fuel_reservations_trip_vehicle",
        ),
        sa.UniqueConstraint("trip_id", name=op.f("uq_fuel_reservations_trip_id")),
        sa.CheckConstraint(
            "fuel_l >= 0 AND fuel_l < 1000000000", name=op.f("ck_fuel_reservations_fuel_l_range")
        ),
    )
    op.create_index(
        "ix_fuel_reservations_vehicle_service_date",
        "fuel_reservations",
        ["vehicle_id", "service_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_fuel_reservations_vehicle_service_date", table_name="fuel_reservations")
    op.drop_table("fuel_reservations")
    op.drop_index(op.f("ix_plan_publications_published_by"), table_name="plan_publications")
    op.drop_table("plan_publications")
    op.drop_index("uq_trips_id_vehicle", table_name="trips")
    op.drop_index("uq_plan_revisions_one_published", table_name="plan_revisions")
