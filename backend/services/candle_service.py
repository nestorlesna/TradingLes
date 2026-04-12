import time
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from models.candle import Candle
from services.hyperliquid_client import HyperliquidClient

TIMEFRAME_LOOKBACK_MS = {
    "1d": 180 * 24 * 3600 * 1000,
    "4h": 180 * 24 * 3600 * 1000,
    "1h":  90 * 24 * 3600 * 1000,
    "15m": 14 * 24 * 3600 * 1000,
    "5m":   3 * 24 * 3600 * 1000,
    "1m":   3 * 24 * 3600 * 1000,
}

# Velas cerradas: cuántos ms "de margen" antes del fin del rango
# se considera que la última vela aún puede estar abierta
CANDLE_DURATION_MS = {
    "1d": 24 * 3600 * 1000,
    "4h":  4 * 3600 * 1000,
    "1h":      3600 * 1000,
    "15m":      15 * 60 * 1000,
    "5m":        5 * 60 * 1000,
    "1m":            60 * 1000,
}


async def fetch_candles_with_cache(
    db: AsyncSession,
    par: str,
    timeframe: str,
    start_ms: int,
    end_ms: int,
    mode: str = "testnet",
) -> list[dict]:
    now_ms = int(time.time() * 1000)
    candle_ms = CANDLE_DURATION_MS.get(timeframe, 3600 * 1000)

    # Verificar qué rango tenemos cacheado
    cached_range = await db.execute(
        select(func.min(Candle.timestamp), func.max(Candle.timestamp)).where(
            and_(Candle.par == par, Candle.timeframe == timeframe)
        )
    )
    cached_min, cached_max = cached_range.one()

    # Decidir qué fetch hacer:
    # - Sin caché: traer todo
    # - Con caché pero el rango pedido empieza antes: traer la parte anterior
    # - Con caché: traer solo desde la última vela cacheada (para actualizar)
    fetch_start = start_ms
    fetch_end = end_ms

    if cached_min is not None and cached_max is not None:
        # Tenemos datos. Solo necesitamos:
        # 1. Parte anterior al caché (si se pide un rango más antiguo)
        # 2. Parte nueva desde la última vela cacheada
        needs_old = cached_min > start_ms
        needs_new = cached_max < (now_ms - candle_ms)  # hay velas cerradas nuevas

        if not needs_old and not needs_new:
            # Caché completo — devolver directo sin tocar Hyperliquid
            return await _query_db(db, par, timeframe, start_ms, end_ms)

        if needs_old and not needs_new:
            fetch_start = start_ms
            fetch_end = cached_min - 1
        elif not needs_old and needs_new:
            fetch_start = cached_max  # incluir última para posible actualización
            fetch_end = end_ms
        # else: necesitamos ambos extremos — fetch completo (fetch_start/end ya están)

    # Fetch desde Hyperliquid solo el rango necesario
    client = HyperliquidClient(mode=mode)
    raw = await client.get_candles(par, timeframe, fetch_start, fetch_end)

    if raw:
        rows = [
            {
                "par": par,
                "timeframe": timeframe,
                "timestamp": item["t"],
                "open": Decimal(str(item["o"])),
                "high": Decimal(str(item["h"])),
                "low": Decimal(str(item["l"])),
                "close": Decimal(str(item["c"])),
                "volume": Decimal(str(item.get("v", 0))),
            }
            for item in raw
        ]
        stmt = pg_insert(Candle).values(rows).on_conflict_do_update(
            index_elements=["par", "timeframe", "timestamp"],
            set_={
                # Actualizar OHLCV de la última vela (puede estar aún abierta)
                "open":   pg_insert(Candle).excluded.open,
                "high":   pg_insert(Candle).excluded.high,
                "low":    pg_insert(Candle).excluded.low,
                "close":  pg_insert(Candle).excluded.close,
                "volume": pg_insert(Candle).excluded.volume,
            }
        )
        await db.execute(stmt)
        await db.commit()

    return await _query_db(db, par, timeframe, start_ms, end_ms)


async def _query_db(
    db: AsyncSession, par: str, timeframe: str, start_ms: int, end_ms: int
) -> list[dict]:
    result = await db.execute(
        select(Candle).where(
            and_(
                Candle.par == par,
                Candle.timeframe == timeframe,
                Candle.timestamp >= start_ms,
                Candle.timestamp <= end_ms,
            )
        ).order_by(Candle.timestamp)
    )
    return [
        {
            "timestamp": c.timestamp,
            "open": float(c.open),
            "high": float(c.high),
            "low": float(c.low),
            "close": float(c.close),
            "volume": float(c.volume),
        }
        for c in result.scalars().all()
    ]


def default_start_ms(timeframe: str) -> int:
    lookback = TIMEFRAME_LOOKBACK_MS.get(timeframe, 7 * 24 * 3600 * 1000)
    return int(time.time() * 1000) - lookback
