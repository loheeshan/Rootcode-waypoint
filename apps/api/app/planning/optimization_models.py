"""Immutable input/result snapshots and replay keys for draft optimization runs."""

from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PlanOptimization(Base):
    __tablename__ = "plan_optimizations"

    request_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    plan_revision_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("plan_revisions.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    input_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    result_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
