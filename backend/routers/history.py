import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, UUID

from auth.dependencies import get_current_user
from auth.models import User
from models.database import get_db
from models.fill import Fill
from models.bot_session import BotSession

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("/fills")
async def get_fills(
    session_id: Optional[str] = Query(None),
    lado: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Fill).order_by(Fill.timestamp.desc())

    if session_id:
        query = query.where(Fill.session_id == uuid.UUID(session_id))
    if lado:
        query = query.where(Fill.lado == lado)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    # Paginate
    offset = (page - 1) * limit
    items_row = await db.execute(query.offset(offset).limit(limit))
    items = items_row.scalars().all()

    return {
        "items": [
            {
                "id": str(f.id),
                "timestamp": f.timestamp.isoformat(),
                "par": f.par,
                "lado": f.lado,
                "precio": float(f.precio_fill),
                "cantidad": float(f.cantidad_fill),
                "comision": float(f.comision),
                "pnl": float(f.pnl_realizado) if f.pnl_realizado else 0.0,
            }
            for f in items
        ],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/summary")
async def history_summary(
    session_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Fill)
    if session_id:
        query = query.where(Fill.session_id == uuid.UUID(session_id))

    rows = await db.execute(query)
    fills = rows.scalars().all()

    total_trades = len(fills)
    pnl_realizado = sum(float(f.pnl_realizado or 0) for f in fills)
    comisiones_totales = sum(float(f.comision) for f in fills)

    return {
        "total_trades": total_trades,
        "pnl_realizado": pnl_realizado,
        "comisiones_totales": comisiones_totales,
        "pnl_neto": pnl_realizado - comisiones_totales,
    }


@router.get("/sessions")
async def get_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await db.execute(
        select(BotSession).order_by(BotSession.started_at.desc()).limit(50)
    )
    sessions = rows.scalars().all()
    return [
        {
            "id": str(s.id),
            "grid_config_id": str(s.grid_config_id),
            "estado": s.estado,
            "capital_inicial": float(s.capital_inicial),
            "pnl_realizado": float(s.pnl_realizado),
            "modo": s.modo,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "stopped_at": s.stopped_at.isoformat() if s.stopped_at else None,
        }
        for s in sessions
    ]
