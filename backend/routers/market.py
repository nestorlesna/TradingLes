import time
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from auth.dependencies import get_current_user
from auth.models import User
from models.database import get_db
from services.hyperliquid_client import HyperliquidClient
from services.candle_service import fetch_candles_with_cache, default_start_ms
from services.websocket_relay import get_current_prices
from config import get_settings

router = APIRouter(prefix="/api/market", tags=["market"])

POPULAR_PAIRS = ["BTC", "ETH", "SOL", "BNB", "DOGE", "ARB", "OP", "AVAX", "MATIC", "LINK"]


@router.get("/pairs")
async def get_pairs(
    current_user: User = Depends(get_current_user),
):
    settings = get_settings()
    client = HyperliquidClient(mode=settings.default_mode)
    try:
        meta = await client.get_meta()
        universe = meta.get("universe", [])
        pairs = [asset["name"] for asset in universe]
        # Sort: popular first, then alphabetically
        popular = [p for p in POPULAR_PAIRS if p in pairs]
        rest = sorted([p for p in pairs if p not in POPULAR_PAIRS])
        return popular + rest
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Error fetching pairs: {str(e)}")


@router.get("/candles")
async def get_candles(
    par: str = Query(...),
    timeframe: str = Query("1h"),
    start: int = Query(None),
    end: int = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = get_settings()
    now_ms = int(time.time() * 1000)
    start_ms = start if start else default_start_ms(timeframe)
    end_ms = end if end else now_ms

    candles = await fetch_candles_with_cache(
        db=db, par=par, timeframe=timeframe,
        start_ms=start_ms, end_ms=end_ms, mode=settings.default_mode
    )
    return candles


@router.get("/price/{par}")
async def get_price(
    par: str,
    current_user: User = Depends(get_current_user),
):
    prices = get_current_prices()
    if par in prices:
        return {"par": par, "price": prices[par], "timestamp": int(time.time() * 1000)}

    # Fallback: fetch directly
    settings = get_settings()
    client = HyperliquidClient(mode=settings.default_mode)
    try:
        price = await client.get_price(par)
        if price is None:
            raise HTTPException(status_code=404, detail=f"Par '{par}' no encontrado")
        return {"par": par, "price": price, "timestamp": int(time.time() * 1000)}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
