import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError

from config import get_settings
from auth.security import decode_token
from auth import router as auth_router
from routers import market, grid, bot, history, settings, backtest
from services.websocket_relay import register_client, unregister_client, start_relay

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = get_settings()
    logger.info(f"Starting TradingLes — mode: {cfg.default_mode}")
    start_relay(mode=cfg.default_mode)
    yield
    logger.info("Shutting down TradingLes")


app = FastAPI(title="TradingLes API", version="1.0.0", lifespan=lifespan)

settings_obj = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings_obj.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router.router)
app.include_router(market.router)
app.include_router(grid.router)
app.include_router(bot.router)
app.include_router(history.router)
app.include_router(settings.router)
app.include_router(backtest.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "TradingLes"}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)):
    # Validate JWT
    try:
        decode_token(token)
    except JWTError:
        await ws.close(code=4001)
        return

    await ws.accept()
    register_client(ws)
    try:
        while True:
            data = await ws.receive_json()
            # Handle client messages (subscribe/unsubscribe) — future implementation
            msg_type = data.get("type")
            if msg_type == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"WS client error: {e}")
    finally:
        unregister_client(ws)
