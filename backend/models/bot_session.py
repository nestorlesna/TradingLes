import uuid
from decimal import Decimal
from sqlalchemy import String, Text, DateTime, Numeric, CheckConstraint, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base


class BotSession(Base):
    __tablename__ = "bot_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grid_config_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grid_configs.id"), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default="activo", nullable=False)
    precio_entrada_promedio: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    capital_inicial: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    pnl_realizado: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"))
    modo: Mapped[str] = mapped_column(String(10), nullable=False)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    stopped_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("estado IN ('activo', 'pausado', 'detenido')", name="chk_estado"),
    )
