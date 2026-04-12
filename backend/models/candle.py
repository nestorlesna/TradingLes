from decimal import Decimal
from sqlalchemy import String, Integer, BigInteger, Numeric, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from models.database import Base


class Candle(Base):
    __tablename__ = "candles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    par: Mapped[str] = mapped_column(String(20), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(5), nullable=False)
    timestamp: Mapped[int] = mapped_column(BigInteger, nullable=False)
    open: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    high: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    low: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    close: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    volume: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"), nullable=False)

    __table_args__ = (
        UniqueConstraint("par", "timeframe", "timestamp", name="uq_candle"),
        Index("idx_candles_lookup", "par", "timeframe", "timestamp"),
    )
