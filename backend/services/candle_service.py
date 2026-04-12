import time
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
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

MAX_CANDLES_PER_REQUEST = 5000


async def fetch_candles_with_cache(
    db: AsyncSession,
    par: str,
    timeframe: str,
    start_ms: int,
    end_ms: int,
    mode: str = "testnet",
) -> list[dict]:
    # Get cached candles
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
    cached = result.scalars().all()
    cached_timestamps = {c.timestamp for c in cached}

    # Find gaps to fetch
    client = HyperliquidClient(mode=mode)
    raw = await client.get_candles(par, timeframe, start_ms, end_ms)

    new_candles = []
    for item in raw:
        ts = item["t"]
        if ts not in cached_timestamps:
            candle = Candle(
                par=par,
                timeframe=timeframe,
                timestamp=ts,
                open=Decimal(str(item["o"])),
                high=Decimal(str(item["h"])),
                low=Decimal(str(item["l"])),
                close=Decimal(str(item["c"])),
                volume=Decimal(str(item.get("v", 0))),
            )
            new_candles.append(candle)

    if new_candles:
        db.add_all(new_candles)
        await db.commit()

    # Return all (cached + new) as dicts
    all_candles = await db.execute(
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
        for c in all_candles.scalars().all()
    ]


def default_start_ms(timeframe: str) -> int:
    lookback = TIMEFRAME_LOOKBACK_MS.get(timeframe, 7 * 24 * 3600 * 1000)
    return int(time.time() * 1000) - lookback
