import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, field_validator
from auth.dependencies import get_current_user
from auth.models import User
from models.database import get_db
from models.grid_config import GridConfig
from services.grid_engine import GridCalcInput, calculate_grid_levels
from services.websocket_relay import get_current_prices

router = APIRouter(prefix="/api/grid", tags=["grid"])


# ── Schemas ────────────────────────────────────────────────────────────────

class GridCalcRequest(BaseModel):
    par: str
    precio_min: float
    precio_max: float
    cantidad_niveles: int
    tipo_espaciado: str = "geometrico"
    capital_usdc: float
    apalancamiento: float = 3.0

    @field_validator("precio_max")
    @classmethod
    def max_gt_min(cls, v, info):
        if "precio_min" in info.data and v <= info.data["precio_min"]:
            raise ValueError("precio_max debe ser mayor que precio_min")
        return v

    @field_validator("cantidad_niveles")
    @classmethod
    def niveles_min(cls, v):
        if v < 2:
            raise ValueError("cantidad_niveles debe ser al menos 2")
        return v


class GridConfigCreate(BaseModel):
    nombre: str
    par: str
    precio_min: float
    precio_max: float
    cantidad_niveles: int
    tipo_espaciado: str = "geometrico"
    capital_usdc: float
    apalancamiento: float = 3.0
    modo: str = "testnet"
    es_favorita: bool = False


class GridConfigUpdate(BaseModel):
    nombre: str | None = None
    precio_min: float | None = None
    precio_max: float | None = None
    cantidad_niveles: int | None = None
    tipo_espaciado: str | None = None
    capital_usdc: float | None = None
    apalancamiento: float | None = None
    modo: str | None = None
    es_favorita: bool | None = None


def _level_to_dict(level) -> dict:
    return {
        "nivel": level.nivel,
        "precio": float(level.precio),
        "tipo": level.tipo,
        "capital": float(level.capital),
        "cantidad": float(level.cantidad),
        "ganancia_bruta": float(level.ganancia_bruta),
        "comision": float(level.comision),
        "ganancia_neta": float(level.ganancia_neta),
    }


def _config_to_dict(cfg: GridConfig) -> dict:
    return {
        "id": str(cfg.id),
        "nombre": cfg.nombre,
        "par": cfg.par,
        "precio_min": float(cfg.precio_min),
        "precio_max": float(cfg.precio_max),
        "cantidad_niveles": cfg.cantidad_niveles,
        "tipo_espaciado": cfg.tipo_espaciado,
        "capital_usdc": float(cfg.capital_usdc),
        "apalancamiento": float(cfg.apalancamiento),
        "modo": cfg.modo,
        "es_favorita": cfg.es_favorita,
        "created_at": cfg.created_at.isoformat() if cfg.created_at else None,
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/calculate")
async def calculate(
    body: GridCalcRequest,
    current_user: User = Depends(get_current_user),
):
    prices = get_current_prices()
    precio_actual = prices.get(body.par)

    result = calculate_grid_levels(GridCalcInput(
        par=body.par,
        precio_min=Decimal(str(body.precio_min)),
        precio_max=Decimal(str(body.precio_max)),
        cantidad_niveles=body.cantidad_niveles,
        tipo_espaciado=body.tipo_espaciado,
        capital_usdc=Decimal(str(body.capital_usdc)),
        apalancamiento=Decimal(str(body.apalancamiento)),
        precio_actual=Decimal(str(precio_actual)) if precio_actual else None,
    ))

    return {
        "niveles": [_level_to_dict(n) for n in result.niveles],
        "precio_liquidacion": float(result.precio_liquidacion),
        "ganancia_total_ciclo": float(result.ganancia_total_ciclo),
        "roi_por_ciclo": float(result.roi_por_ciclo),
        "capital_por_nivel": float(result.capital_por_nivel),
        "advertencias": result.advertencias,
    }


@router.get("/configs")
async def list_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(GridConfig).order_by(GridConfig.es_favorita.desc(), GridConfig.updated_at.desc())
    )
    return [_config_to_dict(c) for c in result.scalars().all()]


@router.post("/configs", status_code=status.HTTP_201_CREATED)
async def create_config(
    body: GridConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cfg = GridConfig(
        id=uuid.uuid4(),
        nombre=body.nombre,
        par=body.par,
        precio_min=Decimal(str(body.precio_min)),
        precio_max=Decimal(str(body.precio_max)),
        cantidad_niveles=body.cantidad_niveles,
        tipo_espaciado=body.tipo_espaciado,
        capital_usdc=Decimal(str(body.capital_usdc)),
        apalancamiento=Decimal(str(body.apalancamiento)),
        modo=body.modo,
        es_favorita=body.es_favorita,
    )
    db.add(cfg)
    await db.commit()
    await db.refresh(cfg)
    return _config_to_dict(cfg)


@router.get("/configs/{config_id}")
async def get_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(GridConfig).where(GridConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return _config_to_dict(cfg)


@router.put("/configs/{config_id}")
async def update_config(
    config_id: str,
    body: GridConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(GridConfig).where(GridConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")

    for field, value in body.model_dump(exclude_none=True).items():
        if field in ("precio_min", "precio_max", "capital_usdc", "apalancamiento"):
            setattr(cfg, field, Decimal(str(value)))
        else:
            setattr(cfg, field, value)

    await db.commit()
    await db.refresh(cfg)
    return _config_to_dict(cfg)


@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(GridConfig).where(GridConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    await db.delete(cfg)
    await db.commit()
