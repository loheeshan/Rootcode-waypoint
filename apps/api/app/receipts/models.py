"""One Store receipt per delivered order, linked to the Driver's delivery evidence."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, ForeignKeyConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReceiptConfirmation(Base):
    __tablename__ = "receipt_confirmations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["order_id", "outlet_id"],
            ["orders.id", "orders.outlet_id"],
            ondelete="RESTRICT",
            name="fk_receipt_confirmations_order_outlet",
        ),
    )

    # The client request ID; replaying it returns this record.
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    order_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, unique=True)
    outlet_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    delivery_event_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("delivery_events.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    confirmed_by: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
