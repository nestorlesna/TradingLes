import uuid
from decimal import Decimal
from sqlalchemy import String, Text, Integer, Boolean, DateTime, Numeric, Index, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base


class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    par: Mapped[str] = mapped_column(String(20), nullable=False)
    precio_min: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    precio_max: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    cantidad_niveles: Mapped[int] = mapped_column(Integer, nullable=False)
    tipo_espaciado: Mapped[str] = mapped_column(String(20), nullable=False)
    capital_usdc: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    apalancamiento: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    fecha_inicio: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    fecha_fin: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    timeframe_simulacion: Mapped[str] = mapped_column(String(5), default="1h", nullable=False)
    pnl_total: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    pnl_porcentaje: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    total_trades: Mapped[int] = mapped_column(Integer, default=0)
    trades_ganadores: Mapped[int] = mapped_column(Integer, default=0)
    trades_perdedores: Mapped[int] = mapped_column(Integer, default=0)
    max_drawdown: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    max_drawdown_porcentaje: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    sharpe_ratio: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    comisiones_totales: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"))
    fue_liquidado: Mapped[bool] = mapped_column(Boolean, default=False)
    precio_liquidacion: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    timestamp_liquidacion: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    capital_final: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    duracion_segundos: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default="pendiente", nullable=False)
    error_msg: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BacktestTrade(Base):
    __tablename__ = "backtest_trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    backtest_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("backtest_runs.id", ondelete="CASCADE"), nullable=False)
    timestamp: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    lado: Mapped[str] = mapped_column(String(4), nullable=False)
    precio: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    cantidad: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    comision: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    pnl: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    nivel_grilla: Mapped[int] = mapped_column(Integer, nullable=False)
    capital_acumulado: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    posicion_neta: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)

    __table_args__ = (
        Index("idx_bt_trades_run", "backtest_run_id"),
    )
