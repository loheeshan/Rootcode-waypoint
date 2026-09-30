"""Create identity tables and the four application roles.

Revision ID: 0001_user_roles
Revises: none
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision: str = "0001_user_roles"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        sa.CheckConstraint(
            "email = lower(trim(email))", name=op.f("ck_users_email_normalized")
        ),
        sa.CheckConstraint("length(email) > 0", name=op.f("ck_users_email_not_empty")),
        sa.CheckConstraint(
            "length(password_hash) > 0", name=op.f("ck_users_password_hash_not_empty")
        ),
    )
    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roles")),
        sa.UniqueConstraint("code", name=op.f("uq_roles_code")),
        sa.CheckConstraint(
            "code IN ('DISPATCHER', 'STORE_MANAGER', 'DRIVER', 'LOADER')",
            name=op.f("ck_roles_code_allowed"),
        ),
    )
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role_id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "role_id", name=op.f("pk_user_roles")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE", name=op.f("fk_user_roles_user_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["role_id"], ["roles.id"], ondelete="CASCADE", name=op.f("fk_user_roles_role_id_roles")
        ),
    )
    roles = sa.table("roles", sa.column("id", sa.Uuid()), sa.column("code", sa.String(32)))
    # Historical migrations must not import mutable application enums or model code.
    op.bulk_insert(
        roles,
        [
            {"id": UUID("00000000-0000-4000-8000-000000000001"), "code": "DISPATCHER"},
            {"id": UUID("00000000-0000-4000-8000-000000000002"), "code": "STORE_MANAGER"},
            {"id": UUID("00000000-0000-4000-8000-000000000003"), "code": "DRIVER"},
            {"id": UUID("00000000-0000-4000-8000-000000000004"), "code": "LOADER"},
        ],
    )


def downgrade() -> None:
    op.drop_table("user_roles")
    op.drop_table("roles")
    op.drop_table("users")
