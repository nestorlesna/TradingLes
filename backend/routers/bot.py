import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from auth.dependencies import get_current_user
from auth.models import User
from models.database import get_db
from models.bot_session import BotSession
from models.grid_config import GridConfig
from models.order import Order
from models.app_config import AppConfig
from services.crypto import salt_from_hex, decrypt_key
from services.order_manager import order_manager

router = APIRouter(prefix="/api/bot", tags=["bot"])

# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_config_value(db: AsyncSession, clave: str) -> Optional[str]:
    row = await db.execute(select(AppConfig).where(AppConfig.clave == clave))
    obj = row.scalar_one_or_none()
    return obj.valor if obj else None


# ── Schemas ──────────────────────────────────────────────────────────────────

class StartBotRequest(BaseModel):
    grid_config_id: str
    master_password: str


class StopBotRequest(BaseModel):
    session_id: str


class PauseResumeRequest(BaseModel):
    session_id: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/start")
async def start_bot(
    req: StartBotRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if there's already an active session
    existing_id = order_manager.get_active_session_id()
    if existing_id:
        raise HTTPException(status_code=409, detail="Ya hay una sesión activa. Detené el bot primero.")

    # Load grid config
    row = await db.execute(
        select(GridConfig).where(GridConfig.id == uuid.UUID(req.grid_config_id))
    )
    cfg = row.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Configuración de grilla no encontrada")

    # Decrypt private key
    modo = cfg.modo
    encrypted_key = await _get_config_value(db, f"private_key_{modo}")
    wallet_address = await _get_config_value(db, f"wallet_address_{modo}")

    if not encrypted_key:
        raise HTTPException(
            status_code=400,
            detail=f"No hay clave privada configurada para {modo}. Configurala en Ajustes."
        )

    salt_hex = await _get_config_value(db, "fernet_salt")
    if not salt_hex:
        raise HTTPException(status_code=500, detail="Salt no encontrado")

    try:
        private_key = decrypt_key(encrypted_key, req.master_password, salt_from_hex(salt_hex))
    except ValueError:
        raise HTTPException(status_code=401, detail="Contraseña maestra incorrecta")

    # Create bot session in DB
    session_id = str(uuid.uuid4())
    db_session = BotSession(
        id=uuid.UUID(session_id),
        grid_config_id=cfg.id,
        estado="activo",
        capital_inicial=cfg.capital_usdc,
        pnl_realizado=Decimal("0"),
        modo=modo,
    )
    db.add(db_session)
    await db.commit()

    # Start order manager session
    try:
        result = await order_manager.start_session(
            session_id=session_id,
            grid_config_id=req.grid_config_id,
            par=cfg.par,
            precio_min=float(cfg.precio_min),
            precio_max=float(cfg.precio_max),
            cantidad_niveles=cfg.cantidad_niveles,
            tipo_espaciado=cfg.tipo_espaciado,
            capital_usdc=float(cfg.capital_usdc),
            apalancamiento=float(cfg.apalancamiento),
            modo=modo,
            private_key=private_key,
            wallet_address=wallet_address or "",
        )
    except Exception as e:
        # Clean up DB session on failure
        await db.execute(
            select(BotSession).where(BotSession.id == uuid.UUID(session_id))
        )
        raise HTTPException(status_code=500, detail=f"Error iniciando bot: {str(e)}")

    return result


@router.post("/stop")
async def stop_bot(
    req: StopBotRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await order_manager.stop_session(req.session_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/pause")
async def pause_bot(
    req: PauseResumeRequest,
    current_user: User = Depends(get_current_user),
):
    result = await order_manager.pause_session(req.session_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/resume")
async def resume_bot(
    req: PauseResumeRequest,
    current_user: User = Depends(get_current_user),
):
    result = await order_manager.resume_session(req.session_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/status")
async def bot_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    active_id = order_manager.get_active_session_id()

    if not active_id:
        # Check DB for the last session
        row = await db.execute(
            select(BotSession).order_by(BotSession.started_at.desc()).limit(1)
        )
        last = row.scalar_one_or_none()
        if last:
            return {
                "session_id": str(last.id),
                "estado": last.estado,
                "pnl_realizado": float(last.pnl_realizado),
                "ordenes_abiertas": [],
            }
        return {"session_id": None, "estado": "detenido", "pnl_realizado": 0.0, "ordenes_abiertas": []}

    status = order_manager.get_status(active_id)
    if not status:
        return {"session_id": None, "estado": "detenido", "pnl_realizado": 0.0, "ordenes_abiertas": []}

    # Enrich with open orders from DB
    orders_row = await db.execute(
        select(Order)
        .where(Order.session_id == uuid.UUID(active_id))
        .where(Order.estado == "abierta")
        .order_by(Order.precio)
    )
    orders = orders_row.scalars().all()
    status["ordenes_abiertas"] = [
        {
            "id": str(o.id),
            "precio": float(o.precio),
            "lado": o.lado,
            "cantidad": float(o.cantidad),
            "nivel": o.nivel_grilla,
            "estado": o.estado,
        }
        for o in orders
    ]

    return status


@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await db.execute(
        select(BotSession).order_by(BotSession.started_at.desc()).limit(20)
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
