import httpx
from config import get_settings


class HyperliquidClient:
    def __init__(self, mode: str = "testnet"):
        settings = get_settings()
        self.mode = mode
        self.base_url = (
            settings.hyperliquid_testnet_url if mode == "testnet"
            else settings.hyperliquid_mainnet_url
        )

    async def get_all_mids(self) -> dict[str, float]:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{self.base_url}/info", json={"type": "allMids"})
            resp.raise_for_status()
            data = resp.json()
            return {k: float(v) for k, v in data.items()}

    async def get_candles(self, par: str, timeframe: str, start_ms: int, end_ms: int) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.base_url}/info", json={
                "type": "candleSnapshot",
                "req": {
                    "coin": par,
                    "interval": timeframe,
                    "startTime": start_ms,
                    "endTime": end_ms,
                },
            })
            resp.raise_for_status()
            return resp.json()

    async def get_meta(self) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{self.base_url}/info", json={"type": "meta"})
            resp.raise_for_status()
            return resp.json()

    async def get_price(self, par: str) -> float | None:
        mids = await self.get_all_mids()
        return mids.get(par)
