"""
Backtesting engine for the grid bot.

Simulates grid trading over historical OHLCV candles.
Each candle's high/low is checked against open orders to determine fills.
Progress is broadcast via WebSocket every 5%.
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import AsyncSessionLocal
from models.backtest import BacktestRun, BacktestTrade
from models.candle import Candle
from services.grid_engine import GridCalcInput, calculate_grid_levels
from services.websocket_relay import broadcast

logger = logging.getLogger(__name__)

MAKER_FEE = 0.0001   # 0.01%
TAKER_FEE = 0.00035  # 0.035%


async def _log(backtest_id: str, mensaje: str, nivel: str = "info") -> None:
    await broadcast({"type": "backtest_log", "backtest_id": backtest_id, "nivel": nivel, "mensaje": mensaje})


# ── Data structures ──────────────────────────────────────────────────────────

@dataclass
class SimOrder:
    nivel: int
    is_buy: bool
    price: float
    quantity: float


@dataclass
class EquityPoint:
    timestamp: datetime
    capital: float


# ── Main engine ──────────────────────────────────────────────────────────────

async def run_backtest(backtest_id: str) -> None:
    """Entry point: load config from DB, run simulation, save results."""
    async with AsyncSessionLocal() as db:
        row = await db.execute(
            select(BacktestRun).where(BacktestRun.id == UUID(backtest_id))
        )
        bt = row.scalar_one_or_none()
        if not bt:
            logger.error(f"Backtest {backtest_id} not found")
            return

        await _update_state(db, bt, "ejecutando")

    start_wall = time.time()

    try:
        await _execute_backtest(backtest_id)
    except asyncio.CancelledError:
        async with AsyncSessionLocal() as db:
            row = await db.execute(
                select(BacktestRun).where(BacktestRun.id == UUID(backtest_id))
            )
            bt = row.scalar_one_or_none()
            if bt:
                bt.estado = "cancelado"
                bt.duracion_segundos = Decimal(str(round(time.time() - start_wall, 2)))
                await db.commit()
        raise
    except Exception as e:
        logger.error(f"Backtest {backtest_id} failed: {e}", exc_info=True)
        async with AsyncSessionLocal() as db:
            row = await db.execute(
                select(BacktestRun).where(BacktestRun.id == UUID(backtest_id))
            )
            bt = row.scalar_one_or_none()
            if bt:
                bt.estado = "error"
                bt.error_msg = str(e)
                bt.duracion_segundos = Decimal(str(round(time.time() - start_wall, 2)))
                await db.commit()


async def _execute_backtest(backtest_id: str) -> None:
    start_wall = time.time()

    async with AsyncSessionLocal() as db:
        row = await db.execute(
            select(BacktestRun).where(BacktestRun.id == UUID(backtest_id))
        )
        bt = row.scalar_one_or_none()

        # Load candles from DB (assume they've been cached already)
        start_ms = int(bt.fecha_inicio.replace(tzinfo=timezone.utc).timestamp() * 1000)
        end_ms   = int(bt.fecha_fin.replace(tzinfo=timezone.utc).timestamp() * 1000)

        candles_row = await db.execute(
            select(Candle)
            .where(
                Candle.par == bt.par,
                Candle.timeframe == bt.timeframe_simulacion,
                Candle.timestamp >= start_ms,
                Candle.timestamp <= end_ms,
            )
            .order_by(Candle.timestamp)
        )
        candles = candles_row.scalars().all()

    if not candles:
        async with AsyncSessionLocal() as db:
            row = await db.execute(
                select(BacktestRun).where(BacktestRun.id == UUID(backtest_id))
            )
            bt = row.scalar_one_or_none()
            bt.estado = "error"
            bt.error_msg = f"No hay velas para {bt.par}/{bt.timeframe_simulacion} en el rango seleccionado. Abrí el gráfico con ese par y timeframe primero para cachear los datos."
            await db.commit()
        await _log(backtest_id, "Error: sin velas en el rango seleccionado", "error")
        return

    async with AsyncSessionLocal() as db:
        row = await db.execute(
            select(BacktestRun).where(BacktestRun.id == UUID(backtest_id))
        )
        bt = row.scalar_one_or_none()

        fecha_ini = datetime.fromtimestamp(candles[0].timestamp / 1000, tz=timezone.utc).strftime("%d/%m/%Y")
        fecha_fin = datetime.fromtimestamp(candles[-1].timestamp / 1000, tz=timezone.utc).strftime("%d/%m/%Y")
        await _log(backtest_id, f"{len(candles):,} velas · {fecha_ini} → {fecha_fin}", "ok")

        # Calculate grid levels
        precio_inicial = float(candles[0].open)
        calc_input = GridCalcInput(
            par=bt.par,
            precio_min=bt.precio_min,
            precio_max=bt.precio_max,
            cantidad_niveles=bt.cantidad_niveles,
            tipo_espaciado=bt.tipo_espaciado,
            capital_usdc=bt.capital_usdc,
            apalancamiento=bt.apalancamiento,
            precio_actual=Decimal(str(precio_inicial)),
        )
        calc_result = calculate_grid_levels(calc_input)
        levels = calc_result.niveles
        precio_liq = float(calc_result.precio_liquidacion)
        await _log(backtest_id, f"Grilla: {len(levels)} niveles · ${float(bt.precio_min):,.0f} – ${float(bt.precio_max):,.0f} · precio inicial ${precio_inicial:,.2f}")

        # Simulation state
        capital = float(bt.capital_usdc)
        posicion_neta = 0.0          # net position in coins
        precio_entrada_promedio = 0.0
        pnl_realizado = 0.0
        comisiones_totales = 0.0
        total_trades = 0
        trades_ganadores = 0
        trades_perdedores = 0
        fue_liquidado = False
        timestamp_liquidacion = None
        precio_liq_real = None

        equity_curve: list[EquityPoint] = []
        trades_list: list[dict] = []

        # Initial orders
        open_orders: list[SimOrder] = []
        for lv in levels:
            is_buy = float(lv.precio) < precio_inicial
            open_orders.append(SimOrder(
                nivel=lv.nivel,
                is_buy=is_buy,
                price=float(lv.precio),
                quantity=float(lv.cantidad),
            ))

        peak_capital = capital
        max_drawdown = 0.0

        total_candles = len(candles)
        last_progress = -1
        await _log(backtest_id, f"Simulación iniciada · {total_candles:,} velas a procesar")

        for idx, candle in enumerate(candles):
            # Yield every 50 candles so the event loop stays responsive
            # (allows CancelledError delivery and WS message dispatch)
            if idx % 50 == 0:
                await asyncio.sleep(0)

            # Progress broadcasts
            progress = int((idx / total_candles) * 100)
            if progress != last_progress and progress % 5 == 0:
                last_progress = progress
                await broadcast({
                    "type": "backtest_progress",
                    "backtest_id": backtest_id,
                    "progreso": progress,
                })
                if progress > 0 and progress % 10 == 0:
                    equity_now = capital + posicion_neta * float(candle.close) if posicion_neta > 0 else capital
                    await _log(backtest_id, f"{progress}% · {total_trades} trades · capital ${equity_now:,.2f}")

            c_high = float(candle.high)
            c_low  = float(candle.low)
            c_ts   = datetime.fromtimestamp(candle.timestamp / 1000, tz=timezone.utc)

            # Check liquidation
            if posicion_neta > 0 and precio_liq_real and c_low <= precio_liq_real:
                fue_liquidado = True
                timestamp_liquidacion = c_ts
                capital = 0.0
                break

            # Process fills
            orders_to_remove = []
            new_orders = []

            for order in open_orders:
                filled = False
                pnl_trade = 0.0
                commission = float(order.quantity) * float(order.price) * (MAKER_FEE + TAKER_FEE)

                if order.is_buy and c_low <= order.price:
                    # Buy fill
                    cost = order.price * order.quantity
                    commission = cost * (MAKER_FEE + TAKER_FEE)

                    # Update average entry price before incrementing position
                    if posicion_neta == 0:
                        precio_entrada_promedio = order.price
                    else:
                        total_cost = precio_entrada_promedio * posicion_neta + order.price * order.quantity
                        precio_entrada_promedio = total_cost / (posicion_neta + order.quantity)

                    posicion_neta += order.quantity  # only once
                    capital -= cost + commission
                    comisiones_totales += commission
                    total_trades += 1
                    filled = True

                    # Recalculate liquidation price
                    if posicion_neta > 0 and bt.apalancamiento > 1:
                        precio_liq_real = precio_entrada_promedio * (1 - 1/float(bt.apalancamiento) + 0.005)

                    # Place sell at next level up
                    next_level = next((lv for lv in levels if lv.nivel == order.nivel + 1), None)
                    if next_level:
                        new_orders.append(SimOrder(
                            nivel=next_level.nivel,
                            is_buy=False,
                            price=float(next_level.precio),
                            quantity=float(next_level.cantidad),
                        ))

                elif not order.is_buy and c_high >= order.price:
                    # Sell fill
                    proceeds = order.price * order.quantity
                    commission = proceeds * (MAKER_FEE + TAKER_FEE)
                    entry_cost = precio_entrada_promedio * order.quantity if precio_entrada_promedio > 0 else 0
                    pnl_trade = proceeds - entry_cost - commission

                    posicion_neta -= order.quantity
                    if posicion_neta < 0:
                        posicion_neta = 0

                    capital += proceeds - commission
                    pnl_realizado += pnl_trade
                    comisiones_totales += commission
                    total_trades += 1
                    filled = True

                    if pnl_trade >= 0:
                        trades_ganadores += 1
                    else:
                        trades_perdedores += 1

                    # Place buy at next level down
                    prev_level = next((lv for lv in levels if lv.nivel == order.nivel - 1), None)
                    if prev_level:
                        new_orders.append(SimOrder(
                            nivel=prev_level.nivel,
                            is_buy=True,
                            price=float(prev_level.precio),
                            quantity=float(prev_level.cantidad),
                        ))

                if filled:
                    orders_to_remove.append(order)
                    trades_list.append({
                        "ts": c_ts,
                        "lado": "buy" if order.is_buy else "sell",
                        "precio": order.price,
                        "cantidad": order.quantity,
                        "comision": commission,
                        "pnl": pnl_trade,
                        "nivel": order.nivel,
                        "capital_acumulado": capital + posicion_neta * float(candle.close),
                    })

            # Update open orders
            for o in orders_to_remove:
                open_orders.remove(o)
            for o in new_orders:
                # Don't duplicate levels
                if not any(existing.nivel == o.nivel and existing.is_buy == o.is_buy for existing in open_orders):
                    open_orders.append(o)

            # Equity at close
            unrealized = posicion_neta * float(candle.close) - (precio_entrada_promedio * posicion_neta if precio_entrada_promedio > 0 else 0)
            equity = capital + max(0, unrealized)
            equity_curve.append(EquityPoint(timestamp=c_ts, capital=equity))

            # Max drawdown
            if equity > peak_capital:
                peak_capital = equity
            drawdown = peak_capital - equity
            if drawdown > max_drawdown:
                max_drawdown = drawdown

        # Final metrics
        capital_final = capital + posicion_neta * float(candles[-1].close) if candles else capital
        pnl_total = capital_final - float(bt.capital_usdc)
        pnl_porcentaje = (pnl_total / float(bt.capital_usdc)) * 100 if bt.capital_usdc > 0 else 0
        max_dd_pct = (max_drawdown / peak_capital) * 100 if peak_capital > 0 else 0

        # Sharpe ratio (simplified: annualized daily returns)
        sharpe = None
        if len(equity_curve) > 30:
            import math
            returns = []
            for i in range(1, min(len(equity_curve), 252)):
                if equity_curve[i-1].capital > 0:
                    r = (equity_curve[i].capital - equity_curve[i-1].capital) / equity_curve[i-1].capital
                    returns.append(r)
            if returns:
                mean_r = sum(returns) / len(returns)
                std_r = (sum((r - mean_r) ** 2 for r in returns) / len(returns)) ** 0.5
                if std_r > 0:
                    sharpe = round((mean_r / std_r) * math.sqrt(252), 4)

        duracion = round(time.time() - start_wall, 2)

        # Save results + trades
        row2 = await db.execute(
            select(BacktestRun).where(BacktestRun.id == UUID(backtest_id))
        )
        bt = row2.scalar_one_or_none()
        bt.estado = "completado"
        bt.pnl_total = Decimal(str(round(pnl_total, 8)))
        bt.pnl_porcentaje = Decimal(str(round(pnl_porcentaje, 4)))
        bt.total_trades = total_trades
        bt.trades_ganadores = trades_ganadores
        bt.trades_perdedores = trades_perdedores
        bt.max_drawdown = Decimal(str(round(max_drawdown, 8)))
        bt.max_drawdown_porcentaje = Decimal(str(round(max_dd_pct, 4)))
        bt.sharpe_ratio = Decimal(str(sharpe)) if sharpe is not None else None
        bt.comisiones_totales = Decimal(str(round(comisiones_totales, 8)))
        bt.fue_liquidado = fue_liquidado
        bt.precio_liquidacion = Decimal(str(round(precio_liq, 2)))
        bt.timestamp_liquidacion = timestamp_liquidacion
        bt.capital_final = Decimal(str(round(capital_final, 8)))
        bt.duracion_segundos = Decimal(str(duracion))

        # Delete previous trades for this run (idempotent)
        await db.execute(
            delete(BacktestTrade).where(BacktestTrade.backtest_run_id == UUID(backtest_id))
        )

        # Bulk insert trades (sample max 2000 to avoid huge payloads)
        step = max(1, len(trades_list) // 2000)
        for t in trades_list[::step]:
            db.add(BacktestTrade(
                backtest_run_id=UUID(backtest_id),
                timestamp=t["ts"],
                lado=t["lado"],
                precio=Decimal(str(round(t["precio"], 8))),
                cantidad=Decimal(str(round(t["cantidad"], 8))),
                comision=Decimal(str(round(t["comision"], 8))),
                pnl=Decimal(str(round(t["pnl"], 8))),
                nivel_grilla=t["nivel"],
                capital_acumulado=Decimal(str(round(t["capital_acumulado"], 8))),
                posicion_neta=None,
            ))

        await db.commit()

    # Broadcast completion
    pnl_sign = "+" if pnl_total >= 0 else ""
    nivel_fin = "ok" if pnl_total >= 0 else "warn"
    if fue_liquidado:
        nivel_fin = "error"
        await _log(backtest_id, f"LIQUIDADO · {total_trades} trades · PnL {pnl_sign}${pnl_total:.2f} ({pnl_porcentaje:.2f}%) · {duracion:.1f}s", nivel_fin)
    else:
        await _log(backtest_id, f"Completado · {total_trades} trades · PnL {pnl_sign}${pnl_total:.2f} ({pnl_porcentaje:.2f}%) · {duracion:.1f}s", nivel_fin)

    await broadcast({
        "type": "backtest_progress",
        "backtest_id": backtest_id,
        "progreso": 100,
        "completado": True,
        "pnl_total": pnl_total,
        "fue_liquidado": fue_liquidado,
    })

    logger.info(f"Backtest {backtest_id[:8]} completed in {duracion}s: PnL={pnl_total:.2f} trades={total_trades}")


async def _update_state(db: AsyncSession, bt: BacktestRun, estado: str) -> None:
    bt.estado = estado
    await db.commit()
