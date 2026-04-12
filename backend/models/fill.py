import uuid
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base


class Fill(Base):
    __tablename__ = "fills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bot_sessions.id"), nullable=False)
    par: Mapped[str] = mapped_column(String(20), nullable=False)
    lado: Mapped[str] = mapped_column(String(4), nullable=False)
    precio_fill: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    cantidad_fill: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    comision: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"), nullable=False)
    pnl_realizado: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    timestamp: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("idx_fills_session", "session_id"),
        Index("idx_fills_timestamp", "timestamp"),
    )
