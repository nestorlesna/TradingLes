import uuid
from decimal import Decimal
from sqlalchemy import String, Text, Integer, DateTime, Numeric, Index, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bot_sessions.id"), nullable=False)
    hyperliquid_order_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    par: Mapped[str] = mapped_column(String(20), nullable=False)
    lado: Mapped[str] = mapped_column(String(4), nullable=False)
    precio: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    cantidad: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default="pendiente", nullable=False)
    nivel_grilla: Mapped[int] = mapped_column(Integer, nullable=False)
    intentos: Mapped[int] = mapped_column(Integer, default=0)
    error_msg: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    filled_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_orders_session", "session_id"),
        Index("idx_orders_estado", "estado"),
    )
