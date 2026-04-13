import asyncio
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from auth.dependencies import get_current_user
from auth.models import User
from models.database import get_db
from models.backtest import BacktestRun, BacktestTrade
from services.backtest_engine import run_backtest
from services.candle_service import fetch_candles_with_cache, default_start_ms

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


# ── Schema ────────────────────────────────────────────────────────────────────

class BacktestRunRequest(BaseModel):
    par: str
    precio_min: float
    precio_max: float
    cantidad_niveles: int
    tipo_espaciado: str
    capital_usdc: float
    apalancamiento: float
    fecha_inicio: datetime
    fecha_fin: datetime
    timeframe_simulacion: str = "1h"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/run", status_code=202)
async def start_backtest(
    req: BacktestRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a backtest. Fetches candles if needed, then runs simulation async."""
    if req.precio_min >= req.precio_max:
        raise HTTPException(400, "precio_min debe ser menor que precio_max")
    if req.cantidad_niveles < 2:
        raise HTTPException(400, "cantidad_niveles debe ser al menos 2")

    # Pre-fetch candles into cache so they're available in the background task
    start_ms = int(req.fecha_inicio.timestamp() * 1000)
    end_ms   = int(req.fecha_fin.timestamp() * 1000)

    try:
        await fetch_candles_with_cache(db, req.par, req.timeframe_simulacion, start_ms, end_ms)
    except Exception as e:
        raise HTTPException(500, f"Error cargando velas: {e}")

    # Create run record
    run_id = str(uuid.uuid4())
    db.add(BacktestRun(
        id=uuid.UUID(run_id),
        par=req.par,
        precio_min=Decimal(str(req.precio_min)),
        precio_max=Decimal(str(req.precio_max)),
        cantidad_niveles=req.cantidad_niveles,
        tipo_espaciado=req.tipo_espaciado,
        capital_usdc=Decimal(str(req.capital_usdc)),
        apalancamiento=Decimal(str(req.apalancamiento)),
        fecha_inicio=req.fecha_inicio,
        fecha_fin=req.fecha_fin,
        timeframe_simulacion=req.timeframe_simulacion,
        estado="pendiente",
    ))
    await db.commit()

    # Launch simulation as background task (don't await)
    asyncio.create_task(run_backtest(run_id), name=f"backtest-{run_id[:8]}")

    return {"backtest_id": run_id, "estado": "ejecutando"}


@router.get("/status/{backtest_id}")
async def backtest_status(
    backtest_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.execute(
        select(BacktestRun).where(BacktestRun.id == uuid.UUID(backtest_id))
    )
    bt = row.scalar_one_or_none()
    if not bt:
        raise HTTPException(404, "Backtest no encontrado")

    return {
        "backtest_id": str(bt.id),
        "estado": bt.estado,
        "error_msg": bt.error_msg,
    }


@router.get("/results/{backtest_id}")
async def backtest_results(
    backtest_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.execute(
        select(BacktestRun).where(BacktestRun.id == uuid.UUID(backtest_id))
    )
    bt = row.scalar_one_or_none()
    if not bt:
        raise HTTPException(404, "Backtest no encontrado")

    if bt.estado not in ("completado", "error"):
        return {"estado": bt.estado, "error_msg": bt.error_msg}

    # Trades
    trades_row = await db.execute(
        select(BacktestTrade)
        .where(BacktestTrade.backtest_run_id == uuid.UUID(backtest_id))
        .order_by(BacktestTrade.timestamp)
    )
    trades = trades_row.scalars().all()

    return {
        "id": str(bt.id),
        "estado": bt.estado,
        "error_msg": bt.error_msg,
        "config": {
            "par": bt.par,
            "precio_min": float(bt.precio_min),
            "precio_max": float(bt.precio_max),
            "cantidad_niveles": bt.cantidad_niveles,
            "tipo_espaciado": bt.tipo_espaciado,
            "capital_usdc": float(bt.capital_usdc),
            "apalancamiento": float(bt.apalancamiento),
            "fecha_inicio": bt.fecha_inicio.isoformat(),
            "fecha_fin": bt.fecha_fin.isoformat(),
            "timeframe_simulacion": bt.timeframe_simulacion,
        },
        "resultados": {
            "pnl_total": float(bt.pnl_total or 0),
            "pnl_porcentaje": float(bt.pnl_porcentaje or 0),
            "total_trades": bt.total_trades,
            "trades_ganadores": bt.trades_ganadores,
            "trades_perdedores": bt.trades_perdedores,
            "max_drawdown": float(bt.max_drawdown or 0),
            "max_drawdown_porcentaje": float(bt.max_drawdown_porcentaje or 0),
            "sharpe_ratio": float(bt.sharpe_ratio) if bt.sharpe_ratio else None,
            "comisiones_totales": float(bt.comisiones_totales),
            "fue_liquidado": bt.fue_liquidado,
            "precio_liquidacion": float(bt.precio_liquidacion or 0),
            "timestamp_liquidacion": bt.timestamp_liquidacion.isoformat() if bt.timestamp_liquidacion else None,
            "capital_final": float(bt.capital_final or 0),
            "duracion_segundos": float(bt.duracion_segundos or 0),
        } if bt.pnl_total is not None else None,
        "trades": [
            {
                "timestamp": t.timestamp.isoformat(),
                "lado": t.lado,
                "precio": float(t.precio),
                "cantidad": float(t.cantidad),
                "comision": float(t.comision),
                "pnl": float(t.pnl or 0),
                "nivel_grilla": t.nivel_grilla,
                "capital_acumulado": float(t.capital_acumulado or 0),
            }
            for t in trades
        ],
    }


@router.get("/list")
async def list_backtests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count_q = select(func.count()).select_from(BacktestRun)
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * limit
    rows = await db.execute(
        select(BacktestRun)
        .order_by(BacktestRun.created_at.desc())
        .offset(offset).limit(limit)
    )
    items = rows.scalars().all()

    return {
        "items": [
            {
                "id": str(bt.id),
                "par": bt.par,
                "precio_min": float(bt.precio_min),
                "precio_max": float(bt.precio_max),
                "cantidad_niveles": bt.cantidad_niveles,
                "capital_usdc": float(bt.capital_usdc),
                "apalancamiento": float(bt.apalancamiento),
                "fecha_inicio": bt.fecha_inicio.isoformat(),
                "fecha_fin": bt.fecha_fin.isoformat(),
                "timeframe_simulacion": bt.timeframe_simulacion,
                "estado": bt.estado,
                "pnl_total": float(bt.pnl_total) if bt.pnl_total is not None else None,
                "pnl_porcentaje": float(bt.pnl_porcentaje) if bt.pnl_porcentaje is not None else None,
                "total_trades": bt.total_trades,
                "fue_liquidado": bt.fue_liquidado,
                "created_at": bt.created_at.isoformat() if bt.created_at else None,
            }
            for bt in items
        ],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.delete("/{backtest_id}", status_code=204)
async def delete_backtest(
    backtest_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.execute(
        select(BacktestRun).where(BacktestRun.id == uuid.UUID(backtest_id))
    )
    bt = row.scalar_one_or_none()
    if not bt:
        raise HTTPException(404, "Backtest no encontrado")

    await db.execute(
        delete(BacktestTrade).where(BacktestTrade.backtest_run_id == uuid.UUID(backtest_id))
    )
    await db.delete(bt)
    await db.commit()
