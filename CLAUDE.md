# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Grid Trading Bot for Hyperliquid** — a full-stack web application for algorithmic trading on Hyperliquid DEX (perpetual futures). Single-user, personal tool with JWT authentication, backtesting, and real-time price feeds via WebSocket.

The master implementation plan is in `PLAN_GRID_BOT_HYPERLIQUID.md`. **Follow phases in order; do not skip ahead.**

---

## Stack (DO NOT CHANGE)

**Backend:** Python 3.11+, FastAPI + Uvicorn, hyperliquid-python-sdk, SQLAlchemy 2.x + asyncpg, websockets, cryptography (Fernet), bcrypt, python-jose[cryptography]

**Frontend:** React 18 + TypeScript, Vite, lightweight-charts v5 (TradingView OSS), Zustand, @tanstack/react-query, Tailwind CSS, react-router-dom v6, axios

**Database:** PostgreSQL at `localhost:15434`, database `tradingles`, user `arnaldo`

---

## Development Commands

### Backend (run from `backend/`)
```bash
pip install -r requirements.txt                                    # First time
python -m alembic upgrade head                                     # Run/update migrations
python -m alembic revision --autogenerate -m "description"        # New migration after model changes
uvicorn main:app --reload --port 8000                             # Dev server
```

### Frontend (run from `frontend/`)
```bash
npm install        # First time
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # Production build (also runs tsc type check)
```

### First-time user setup
Open `http://localhost:5173` — the app auto-detects no users and shows the setup form directly.

---

## Architecture

### Backend (`backend/`)

- `main.py` — FastAPI app, mounts all routers, starts WS relay on lifespan, WebSocket endpoint `/ws?token=<jwt>`
- `config.py` — pydantic-settings reading from `../.env`
- `auth/` — JWT + bcrypt: `security.py`, `dependencies.py` (`get_current_user`), `router.py` (`/api/auth/*`)
- `models/` — SQLAlchemy async ORM. Each file = one table. `database.py` holds engine + `get_db()` dependency
- `services/` — All business logic:
  - `hyperliquid_client.py` — HTTP wrapper over Hyperliquid REST. Candle request uses `{"type":"candleSnapshot","req":{...}}` format
  - `candle_service.py` — Smart cache: queries DB first, fetches only missing ranges from Hyperliquid, upserts via `INSERT ... ON CONFLICT DO UPDATE`
  - `websocket_relay.py` — Connects to Hyperliquid WS (`allMids`), broadcasts `price_update` to all frontend clients
  - `grid_engine.py` — (Phase 2) Grid level calculations
  - `order_manager.py` — (Phase 2) Place/cancel/monitor orders
  - `backtest_engine.py` — (Phase 3) Backtest simulation
- `routers/` — Thin HTTP layer. Each file maps to an API domain

### Frontend (`frontend/src/`)

- `pages/` — Route-level: `LoginPage`, `DashboardPage`, `GridPage`, `HistoryPage`, `BacktestPage`, `SettingsPage`
- `components/Chart/` — `CandlestickChart` (lightweight-charts v5 using `chart.addSeries(CandlestickSeries, opts)`), `PairSelector`, `TimeframeSelector`
- `components/Layout/` — `AppLayout` (sidebar + header), `Sidebar`, `Header`, `ProtectedRoute`
- `store/` — Zustand: `authStore` (JWT + localStorage), `marketStore` (prices, pair, timeframe, WS status), `botStore`, `settingsStore`
- `api/client.ts` — Axios instance with JWT interceptor; 401 redirects to `/login`
- `hooks/useWebSocket.ts` — Single global WS connection, auto-reconnect with backoff, dispatches to stores
- `types/index.ts` — All shared TypeScript interfaces

### Data flow
1. Frontend authenticates → JWT stored in `authStore` + localStorage
2. `api/client.ts` attaches `Authorization: Bearer <token>` to every request
3. `useWebSocket` (mounted in `AppLayout`) connects to `ws://localhost:8000/ws?token=<jwt>`
4. WS messages dispatch to `marketStore` (prices) and `botStore` (bot events)
5. Candle cache: first request fetches full history from Hyperliquid → stored in `candles` table → subsequent requests served from DB, only new candles fetched

### lightweight-charts v5 API note
v5 changed the series creation API. Use:
```ts
chart.addSeries(CandlestickSeries, { upColor: '...', ... })   // ✓ v5
chart.addCandlestickSeries({ ... })                            // ✗ v4 (removed)
```

---

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Single admin user, bcrypt password |
| `app_config` | Key-value store; private keys stored Fernet-encrypted |
| `grid_configs` | Saved grid strategies (pair, price range, levels, capital, leverage) |
| `bot_sessions` | Each bot run; state: activo/pausado/detenido, PnL tracking |
| `orders` | Orders placed on Hyperliquid |
| `fills` | Executed trades with realized PnL |
| `candles` | OHLCV cache indexed by (par, timeframe, timestamp) — unique constraint `uq_candle` |
| `backtest_runs` / `backtest_trades` | Backtest results and individual trades |

---

## Environment Variables

Copy `.env.example` to `.env`. Key variables:
- `DATABASE_URL` — `postgresql+asyncpg://arnaldo:Arnaldo.2019@localhost:15434/tradingles`
- `JWT_SECRET_KEY` — 64-char random string
- `ENCRYPTION_KEY` — Fernet key
- `DEFAULT_MODE` — `testnet` or `mainnet`
- `CORS_ORIGINS` — `http://localhost:5173` for dev

---

## Security Notes

- Private keys are **always** stored encrypted (Fernet derived from user's master password via PBKDF2)
- The master password is **never** stored — user must enter it each time the bot starts
- The Fernet salt lives in `app_config` table (key `fernet_salt`), not in `.env`
- App starts in `testnet` mode by default
- `.env` is gitignored

---

## Hyperliquid API

```
Mainnet REST / WS:  https://api.hyperliquid.xyz        wss://api.hyperliquid.xyz/ws
Testnet REST / WS:  https://api.hyperliquid-testnet.xyz  wss://api.hyperliquid-testnet.xyz/ws
```

**Candle snapshot request format** (422 if wrong):
```json
{ "type": "candleSnapshot", "req": { "coin": "BTC", "interval": "1h", "startTime": 0, "endTime": 0 } }
```

---

## Implementation Status

- [x] **Fase 1.1** — Project scaffolding (backend + frontend structure)
- [x] **Fase 1.2** — Database models + Alembic migrations (all tables)
- [x] **Fase 1.3** — JWT authentication, first-user setup via web
- [x] **Fase 1.4** — Dark UI layout: sidebar, header, navigation, mode indicator
- [x] **Fase 1.5** — Market data service: Hyperliquid client, candle cache, WS relay
- [x] **Fase 1.6** — Candlestick chart with real-time price updates
- [x] **Fase 2.1** — Grid calculation engine + form + overlay on chart
- [ ] **Fase 2.2** — Private key management (Fernet encryption)
- [ ] **Fase 2.3** — Order manager + bot start/stop/pause/resume
- [ ] **Fase 3**   — Backtesting engine
- [ ] **Fase 4**   — Trade history + analytics
