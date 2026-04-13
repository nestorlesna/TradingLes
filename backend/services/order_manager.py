"""
OrderManager — places and monitors grid orders on Hyperliquid.

Architecture:
  - One BotSessionContext per active session, stored in-memory.
  - A background asyncio task polls fills every 3 s and re-places the
    companion order for each executed level.
  - All synchronous SDK calls run in asyncio.to_thread() to avoid blocking.
"""
import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from eth_account import Account
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import AsyncSessionLocal
from models.bot_session import BotSession
from models.order import Order
from models.fill import Fill
from services.grid_engine import GridCalcInput, calculate_grid_levels
from services.websocket_relay import broadcast

logger = logging.getLogger(__name__)

# ── GTC limit order type constant ────────────────────────────────────────────
GTC_ORDER: dict = {"limit": {"tif": "Gtc"}}

# ── Sizing precision helper ───────────────────────────────────────────────────
def _round_sz(value: float, decimals: int = 5) -> float:
    return round(value, decimals)


def _round_px(value: float, decimals: int = 1) -> float:
    return round(value, decimals)


# ── Session context ───────────────────────────────────────────────────────────
@dataclass
class BotSessionContext:
    session_id: str
    grid_config_id: str
    par: str
    mode: str                       # 'testnet' | 'mainnet'
    exchange: Exchange
    info: Info
    wallet_address: str
    levels: list                    # GridLevel objects from grid_engine
    estado: str = "activo"          # activo | pausado | detenido
    # nivel_index → hyperliquid oid
    open_orders: dict[int, int] = field(default_factory=dict)
    pnl_realizado: float = 0.0
    last_fill_time: int = 0         # epoch ms, used for polling
    monitor_task: Optional[asyncio.Task] = None


# ── Singleton manager ─────────────────────────────────────────────────────────
class OrderManager:
    def __init__(self):
        self._sessions: dict[str, BotSessionContext] = {}

    # ── Public API ────────────────────────────────────────────────────────────

    async def start_session(
        self,
        session_id: str,
        grid_config_id: str,
        par: str,
        precio_min: float,
        precio_max: float,
        cantidad_niveles: int,
        tipo_espaciado: str,
        capital_usdc: float,
        apalancamiento: float,
        modo: str,
        private_key: str,
        wallet_address: str,
    ) -> dict:
        """
        Initialise a bot session:
        1. Build Exchange + Info clients.
        2. Set leverage.
        3. Calculate grid levels.
        4. Place initial limit orders.
        5. Start background fill-monitor task.
        """
        base_url = (
            "https://api.hyperliquid-testnet.xyz"
            if modo == "testnet"
            else "https://api.hyperliquid.xyz"
        )

        wallet = Account.from_key(private_key)
        exchange = Exchange(wallet=wallet, base_url=base_url)
        info = Info(base_url=base_url, skip_ws=True)

        # Get current price for initial placement
        try:
            mids = await asyncio.to_thread(info.all_mids)
            current_price = float(mids.get(par, 0))
        except Exception:
            current_price = 0.0

        # Calculate grid levels
        calc_input = GridCalcInput(
            par=par,
            precio_min=Decimal(str(precio_min)),
            precio_max=Decimal(str(precio_max)),
            cantidad_niveles=cantidad_niveles,
            tipo_espaciado=tipo_espaciado,
            capital_usdc=Decimal(str(capital_usdc)),
            apalancamiento=Decimal(str(apalancamiento)),
            precio_actual=Decimal(str(current_price)) if current_price else None,
        )
        calc_result = calculate_grid_levels(calc_input)

        # Set leverage
        try:
            await asyncio.to_thread(
                exchange.update_leverage,
                int(apalancamiento),
                par,
                True,  # is_cross
            )
        except Exception as e:
            logger.warning(f"Could not set leverage: {e}")

        ctx = BotSessionContext(
            session_id=session_id,
            grid_config_id=grid_config_id,
            par=par,
            mode=modo,
            exchange=exchange,
            info=info,
            wallet_address=wallet_address,
            levels=calc_result.niveles,
        )
        self._sessions[session_id] = ctx

        # Place initial orders and persist to DB
        placed = await self._place_initial_orders(ctx, current_price)

        # Start monitor
        ctx.monitor_task = asyncio.create_task(
            self._monitor_loop(session_id),
            name=f"monitor-{session_id[:8]}",
        )

        return {
            "session_id": session_id,
            "estado": "activo",
            "ordenes_colocadas": placed,
            "precio_entrada": current_price,
        }

    async def stop_session(self, session_id: str) -> dict:
        ctx = self._sessions.get(session_id)
        if not ctx:
            return {"error": "Sesión no encontrada"}

        ctx.estado = "detenido"
        if ctx.monitor_task:
            ctx.monitor_task.cancel()

        cancelled = await self._cancel_all_orders(ctx)

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(BotSession)
                .where(BotSession.id == session_id)
                .values(
                    estado="detenido",
                    stopped_at=datetime.utcnow(),
                    pnl_realizado=Decimal(str(ctx.pnl_realizado)),
                )
            )
            await db.commit()

        del self._sessions[session_id]

        return {
            "estado": "detenido",
            "ordenes_canceladas": cancelled,
            "pnl_final": ctx.pnl_realizado,
        }

    async def pause_session(self, session_id: str) -> dict:
        ctx = self._sessions.get(session_id)
        if not ctx:
            return {"error": "Sesión no encontrada"}

        ctx.estado = "pausado"
        cancelled = await self._cancel_all_orders(ctx)

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(BotSession)
                .where(BotSession.id == session_id)
                .values(estado="pausado")
            )
            await db.commit()

        return {"estado": "pausado", "ordenes_canceladas": cancelled}

    async def resume_session(self, session_id: str) -> dict:
        ctx = self._sessions.get(session_id)
        if not ctx:
            return {"error": "Sesión no encontrada"}

        ctx.estado = "activo"

        try:
            mids = await asyncio.to_thread(ctx.info.all_mids)
            current_price = float(mids.get(ctx.par, 0))
        except Exception:
            current_price = 0.0

        placed = await self._place_initial_orders(ctx, current_price)

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(BotSession)
                .where(BotSession.id == session_id)
                .values(estado="activo")
            )
            await db.commit()

        return {"estado": "activo", "ordenes_colocadas": placed}

    def get_status(self, session_id: str) -> Optional[dict]:
        ctx = self._sessions.get(session_id)
        if not ctx:
            return None
        return {
            "session_id": session_id,
            "estado": ctx.estado,
            "par": ctx.par,
            "pnl_realizado": ctx.pnl_realizado,
            "ordenes_abiertas": [
                {"nivel": nivel, "oid": oid}
                for nivel, oid in ctx.open_orders.items()
            ],
        }

    def get_active_session_id(self) -> Optional[str]:
        for sid, ctx in self._sessions.items():
            if ctx.estado in ("activo", "pausado"):
                return sid
        return None

    def list_sessions(self) -> list[dict]:
        return [
            {
                "session_id": sid,
                "par": ctx.par,
                "estado": ctx.estado,
                "pnl_realizado": ctx.pnl_realizado,
            }
            for sid, ctx in self._sessions.items()
        ]

    # ── Internal helpers ──────────────────────────────────────────────────────

    async def _place_initial_orders(self, ctx: BotSessionContext, current_price: float) -> int:
        """Place buy orders below current price, sell orders above."""
        ctx.open_orders.clear()
        placed = 0

        for level in ctx.levels:
            is_buy = level.tipo == "buy"
            # If we have a current price, use it to decide
            if current_price > 0:
                is_buy = float(level.precio) < current_price

            try:
                result = await asyncio.to_thread(
                    ctx.exchange.order,
                    ctx.par,
                    is_buy,
                    _round_sz(float(level.cantidad)),
                    _round_px(float(level.precio)),
                    GTC_ORDER,
                )
                oid = self._extract_oid(result)
                if oid:
                    ctx.open_orders[level.nivel] = oid
                    placed += 1
                    await self._persist_order(
                        ctx.session_id, ctx.par, level.nivel,
                        "buy" if is_buy else "sell",
                        float(level.precio), float(level.cantidad), oid
                    )
            except Exception as e:
                logger.error(f"Error placing order level {level.nivel}: {e}")

        return placed

    async def _cancel_all_orders(self, ctx: BotSessionContext) -> int:
        cancelled = 0
        for nivel, oid in list(ctx.open_orders.items()):
            try:
                await asyncio.to_thread(ctx.exchange.cancel, ctx.par, oid)
                cancelled += 1
            except Exception as e:
                logger.warning(f"Error cancelling order {oid}: {e}")
        ctx.open_orders.clear()

        # Also cancel anything still open on exchange
        try:
            open_orders = await asyncio.to_thread(ctx.info.open_orders, ctx.wallet_address)
            for o in open_orders:
                if o.get("coin") == ctx.par:
                    try:
                        await asyncio.to_thread(ctx.exchange.cancel, ctx.par, o["oid"])
                        cancelled += 1
                    except Exception:
                        pass
        except Exception:
            pass

        return cancelled

    async def _monitor_loop(self, session_id: str) -> None:
        """Background task: poll fills, re-place companion orders."""
        logger.info(f"Monitor started for session {session_id[:8]}")
        from services.websocket_relay import broadcast

        while True:
            try:
                await asyncio.sleep(3)
                ctx = self._sessions.get(session_id)
                if not ctx or ctx.estado != "activo":
                    continue

                # Fetch new fills since last check
                new_fills = await asyncio.to_thread(
                    ctx.info.user_fills_by_time,
                    ctx.wallet_address,
                    ctx.last_fill_time + 1,
                )

                for fill_data in new_fills:
                    if fill_data.get("coin") != ctx.par:
                        continue

                    await self._handle_fill(ctx, fill_data)
                    ctx.last_fill_time = max(ctx.last_fill_time, fill_data.get("time", 0))

            except asyncio.CancelledError:
                logger.info(f"Monitor cancelled for session {session_id[:8]}")
                return
            except Exception as e:
                logger.error(f"Monitor error for {session_id[:8]}: {e}")
                await asyncio.sleep(5)

    async def _handle_fill(self, ctx: BotSessionContext, fill_data: dict) -> None:
        """Process a fill: persist it, update PnL, place companion order."""
        side = "buy" if fill_data.get("side") == "B" else "sell"
        precio_fill = float(fill_data.get("px", 0))
        cantidad_fill = float(fill_data.get("sz", 0))
        comision = float(fill_data.get("fee", 0))
        pnl = float(fill_data.get("closedPnl", 0))

        ctx.pnl_realizado += pnl

        # Find which level this matches
        nivel = self._find_nivel_for_price(ctx, precio_fill)

        async with AsyncSessionLocal() as db:
            # Find matching order in DB
            result = await db.execute(
                select(Order)
                .where(Order.session_id == ctx.session_id)
                .where(Order.nivel_grilla == nivel)
                .where(Order.estado == "abierta")
            )
            order_obj = result.scalar_one_or_none()
            order_id = str(order_obj.id) if order_obj else None

            if order_obj:
                order_obj.estado = "ejecutada"
                order_obj.filled_at = datetime.utcnow()

            db.add(Fill(
                order_id=order_id,
                session_id=ctx.session_id,
                par=ctx.par,
                lado=side,
                precio_fill=Decimal(str(precio_fill)),
                cantidad_fill=Decimal(str(cantidad_fill)),
                comision=Decimal(str(comision)),
                pnl_realizado=Decimal(str(pnl)),
                timestamp=datetime.utcfromtimestamp(fill_data.get("time", 0) / 1000),
            ))

            await db.execute(
                update(BotSession)
                .where(BotSession.id == ctx.session_id)
                .values(pnl_realizado=Decimal(str(ctx.pnl_realizado)))
            )
            await db.commit()

        # Remove from open_orders
        if nivel in ctx.open_orders:
            del ctx.open_orders[nivel]

        # Place companion order
        await self._place_companion_order(ctx, nivel, side, precio_fill)

        # Broadcast fill event
        await broadcast({
            "type": "fill_event",
            "session_id": ctx.session_id,
            "par": ctx.par,
            "lado": side,
            "precio": precio_fill,
            "cantidad": cantidad_fill,
            "comision": comision,
            "pnl": pnl,
            "nivel": nivel,
            "pnl_acumulado": ctx.pnl_realizado,
        })

    async def _place_companion_order(
        self, ctx: BotSessionContext, nivel: int, filled_side: str, filled_price: float
    ) -> None:
        """When a buy fills → place sell at level+1. When sell fills → place buy at level-1."""
        if filled_side == "buy":
            # Find next level up
            target_nivel = nivel + 1
            is_buy = False
        else:
            target_nivel = nivel - 1
            is_buy = True

        target_level = next(
            (lv for lv in ctx.levels if lv.nivel == target_nivel), None
        )
        if not target_level:
            return

        try:
            result = await asyncio.to_thread(
                ctx.exchange.order,
                ctx.par,
                is_buy,
                _round_sz(float(target_level.cantidad)),
                _round_px(float(target_level.precio)),
                GTC_ORDER,
            )
            oid = self._extract_oid(result)
            if oid:
                ctx.open_orders[target_nivel] = oid
                await self._persist_order(
                    ctx.session_id, ctx.par, target_nivel,
                    "buy" if is_buy else "sell",
                    float(target_level.precio), float(target_level.cantidad), oid
                )
        except Exception as e:
            logger.error(f"Error placing companion order level {target_nivel}: {e}")

    def _find_nivel_for_price(self, ctx: BotSessionContext, price: float) -> int:
        """Find the grid level closest to the given price."""
        if not ctx.levels:
            return 0
        closest = min(ctx.levels, key=lambda lv: abs(float(lv.precio) - price))
        return closest.nivel

    @staticmethod
    def _extract_oid(result: Any) -> Optional[int]:
        """Extract order ID from Hyperliquid API response."""
        try:
            statuses = result["response"]["data"]["statuses"]
            for s in statuses:
                if "resting" in s:
                    return s["resting"]["oid"]
                if "filled" in s:
                    return s["filled"].get("oid")
        except (KeyError, TypeError, IndexError):
            pass
        return None

    @staticmethod
    async def _persist_order(
        session_id: str, par: str, nivel: int,
        lado: str, precio: float, cantidad: float, oid: int
    ) -> None:
        try:
            async with AsyncSessionLocal() as db:
                db.add(Order(
                    session_id=session_id,
                    hyperliquid_order_id=str(oid),
                    par=par,
                    lado=lado,
                    precio=Decimal(str(precio)),
                    cantidad=Decimal(str(cantidad)),
                    estado="abierta",
                    nivel_grilla=nivel,
                ))
                await db.commit()
        except Exception as e:
            logger.error(f"Error persisting order: {e}")


# Singleton instance
order_manager = OrderManager()
