import uuid
from decimal import Decimal
from sqlalchemy import String, Integer, Boolean, DateTime, Numeric, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base


class GridConfig(Base):
    __tablename__ = "grid_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    par: Mapped[str] = mapped_column(String(20), nullable=False)
    precio_min: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    precio_max: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    cantidad_niveles: Mapped[int] = mapped_column(Integer, nullable=False)
    tipo_espaciado: Mapped[str] = mapped_column(String(20), default="geometrico", nullable=False)
    capital_usdc: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    apalancamiento: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("3.0"), nullable=False)
    modo: Mapped[str] = mapped_column(String(10), default="testnet", nullable=False)
    es_favorita: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("cantidad_niveles >= 2", name="chk_niveles_min"),
        CheckConstraint("apalancamiento >= 1 AND apalancamiento <= 10", name="chk_apalancamiento"),
        CheckConstraint("tipo_espaciado IN ('aritmetico', 'geometrico')", name="chk_tipo_espaciado"),
        CheckConstraint("modo IN ('testnet', 'mainnet')", name="chk_modo_grid"),
    )
