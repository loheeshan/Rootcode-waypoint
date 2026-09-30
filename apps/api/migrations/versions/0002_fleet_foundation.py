"""Create depots, outlets and vehicles without inserting sample master data.

Revision ID: 0002_fleet_foundation
Revises: 0001_user_roles
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_fleet_foundation"
down_revision: str | Sequence[str] | None = "0001_user_roles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "depots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_depots")),
        sa.CheckConstraint("length(trim(name)) > 0", name=op.f("ck_depots_name_not_blank")),
    )
    op.create_table(
        "outlets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("brand", sa.String(120), nullable=False),
        sa.Column("district", sa.String(120), nullable=False),
        sa.Column("depot_id", sa.Uuid(), nullable=False),
        sa.Column("dock_type", sa.String(64), nullable=False),
        sa.Column("parking_constraint", sa.String(16), nullable=False),
        sa.Column("window_open_time", sa.Time(timezone=False), nullable=False),
        sa.Column("window_close_time", sa.Time(timezone=False), nullable=False),
        sa.Column("mall_window", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_outlets")),
        sa.ForeignKeyConstraint(
            ["depot_id"], ["depots.id"], ondelete="RESTRICT",
            name=op.f("fk_outlets_depot_id_depots"),
        ),
        sa.CheckConstraint("length(trim(brand)) > 0", name=op.f("ck_outlets_brand_not_blank")),
        sa.CheckConstraint(
            "length(trim(district)) > 0", name=op.f("ck_outlets_district_not_blank")
        ),
        sa.CheckConstraint(
            "length(trim(dock_type)) > 0", name=op.f("ck_outlets_dock_type_not_blank")
        ),
        sa.CheckConstraint(
            "parking_constraint IN ('none', 'van_only')",
            name=op.f("ck_outlets_parking_constraint_allowed"),
        ),
        sa.CheckConstraint(
            "window_open_time <> window_close_time", name=op.f("ck_outlets_window_not_empty")
        ),
    )
    op.create_index(op.f("ix_outlets_depot_id"), "outlets", ["depot_id"], unique=False)
    op.create_table(
        "vehicles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(16), nullable=False),
        sa.Column("temperature_type", sa.String(16), nullable=False),
        sa.Column("weight_cap_kg", sa.Numeric(12, 3), nullable=False),
        sa.Column("volume_cap_m3", sa.Numeric(12, 3), nullable=False),
        sa.Column("km_per_l", sa.Numeric(8, 3), nullable=False),
        sa.Column("weekly_fuel_quota_l", sa.Numeric(12, 3), nullable=False),
        sa.Column("depot_id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_vehicles")),
        sa.ForeignKeyConstraint(
            ["depot_id"], ["depots.id"], ondelete="RESTRICT",
            name=op.f("fk_vehicles_depot_id_depots"),
        ),
        sa.CheckConstraint("type IN ('van', 'truck')", name=op.f("ck_vehicles_type_allowed")),
        sa.CheckConstraint(
            "temperature_type IN ('ambient', 'reefer')",
            name=op.f("ck_vehicles_temperature_type_allowed"),
        ),
        sa.CheckConstraint(
            "weight_cap_kg > 0 AND weight_cap_kg < 1000000000",
            name=op.f("ck_vehicles_weight_cap_kg_range"),
        ),
        sa.CheckConstraint(
            "volume_cap_m3 > 0 AND volume_cap_m3 < 1000000000",
            name=op.f("ck_vehicles_volume_cap_m3_range"),
        ),
        sa.CheckConstraint(
            "km_per_l > 0 AND km_per_l < 100000", name=op.f("ck_vehicles_km_per_l_range")
        ),
        sa.CheckConstraint(
            "weekly_fuel_quota_l >= 0 AND weekly_fuel_quota_l < 1000000000",
            name=op.f("ck_vehicles_weekly_fuel_quota_l_range"),
        ),
    )
    op.create_index(op.f("ix_vehicles_depot_id"), "vehicles", ["depot_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_vehicles_depot_id"), table_name="vehicles")
    op.drop_table("vehicles")
    op.drop_index(op.f("ix_outlets_depot_id"), table_name="outlets")
    op.drop_table("outlets")
    op.drop_table("depots")
