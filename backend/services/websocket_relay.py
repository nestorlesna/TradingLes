import asyncio
import json
import logging
from typing import Set
from fastapi import WebSocket
import websockets
from config import get_settings

logger = logging.getLogger(__name__)

# In-memory state
_current_prices: dict[str, float] = {}
_connected_clients: Set[WebSocket] = set()
_relay_task: asyncio.Task | None = None


def get_current_prices() -> dict[str, float]:
    return _current_prices.copy()


def register_client(ws: WebSocket):
    _connected_clients.add(ws)


def unregister_client(ws: WebSocket):
    _connected_clients.discard(ws)


async def broadcast(message: dict):
    disconnected = set()
    for client in _connected_clients.copy():
        try:
            await client.send_json(message)
        except Exception:
            disconnected.add(client)
    for c in disconnected:
        _connected_clients.discard(c)


async def _relay_loop(mode: str):
    settings = get_settings()
    ws_url = (
        "wss://api.hyperliquid-testnet.xyz/ws" if mode == "testnet"
        else "wss://api.hyperliquid.xyz/ws"
    )
    backoff = 1

    while True:
        try:
            logger.info(f"Connecting to Hyperliquid WS ({mode})...")
            async with websockets.connect(ws_url, ping_interval=20) as ws:
                await ws.send(json.dumps({"method": "subscribe", "subscription": {"type": "allMids"}}))
                await broadcast({"type": "connection_status", "hyperliquid": "connected"})
                backoff = 1

                async for raw in ws:
                    data = json.loads(raw)
                    if data.get("channel") == "allMids":
                        mids = data["data"]["mids"]
                        for par, price_str in mids.items():
                            price = float(price_str)
                            _current_prices[par] = price

                        # Broadcast subscribed pairs
                        for par, price in mids.items():
                            await broadcast({
                                "type": "price_update",
                                "par": par,
                                "price": float(price),
                                "timestamp": asyncio.get_event_loop().time(),
                            })

        except Exception as e:
            logger.warning(f"WS relay error: {e}. Reconnecting in {backoff}s...")
            await broadcast({"type": "connection_status", "hyperliquid": "reconnecting"})
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


def start_relay(mode: str = "testnet"):
    global _relay_task
    if _relay_task is None or _relay_task.done():
        _relay_task = asyncio.create_task(_relay_loop(mode))
