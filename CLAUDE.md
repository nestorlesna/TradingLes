# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Grid Trading Bot for Hyperliquid** — a full-stack web application for algorithmic trading on Hyperliquid DEX (perpetual futures). Single-user, personal tool with JWT authentication, backtesting, and real-time price feeds via WebSocket.

The master implementation plan is in `PLAN_GRID_BOT_HYPERLIQUID.md`. The original design document with Hyperliquid API details is in `grid_bot_hyperliquid.md`. **Follow phases in order; do not skip ahead.**

---

## Stack (DO NOT CHANGE)

**Backend:** Python 3.11+, FastAPI + Uvicorn, hyperliquid-python-sdk, SQLAlchemy 2.x + asyncpg, websockets, cryptography (Fernet), bcrypt, python-jose[cryptography]

**Frontend:** React 18 + TypeScript, Vite, lightweight-charts (TradingView OSS), Zustand, @tanstack/react-query, Tailwind CSS, react-router-dom v6, axios

**Database:** PostgreSQL (local for dev, Docker for prod)

---

## Development Commands

### Backend (run from `backend/`)
```bash
cd backend
pip install -r requirements.txt          # First time
python -m alembic upgrade head           # Run/update migrations
python -m alembic revision --autogenerate -m "description"  # New migration
uvicorn main:app --reload --port 8000    # Dev server
```

### Frontend (run from `frontend/`)
```bash
cd frontend
npm install          # First time
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # Production build
```

### Database
The DB connection is `postgresql+asyncpg://arnaldo:Arnaldo.2019@localhost:15434/tradingles`.
Migrations already applied. To add tables: edit models, then `alembic revision --autogenerate`.

### First-time user setup
Open `http://localhost:5173` after starting both servers — the app auto-detects no users and shows the setup form.

---

## Architecture

### Backend (`backend/`)

- `main.py` — FastAPI app, mounts all routers, configures CORS and WebSocket
- `config.py` — pydantic-settings reading from `.env`
- `auth/` — JWT + bcrypt login, `get_current_user` FastAPI dependency
- `models/` — SQLAlchemy async ORM models + `database.py` (engine/session factory)
- `services/` — All business logic:
  - `hyperliquid_client.py` — Wraps the official SDK
  - `grid_engine.py` — Arithmetic/geometric grid level calculations
  - `order_manager.py` — Place/cancel/monitor orders on Hyperliquid
  - `websocket_relay.py` — Bridges Hyperliquid WS feed → frontend WS
  - `candle_service.py` — Fetches + caches OHLCV data
  - `backtest_engine.py` — Runs simulations on historical candle data
- `routers/` — Thin API layer: `grid`, `bot`, `history`, `market`, `settings`, `backtest`

### Frontend (`frontend/src/`)

- `pages/` — Route-level components: `LoginPage`, `DashboardPage`, `GridPage`, `HistoryPage`, `BacktestPage`, `SettingsPage`
- `components/` — Feature-grouped: `Layout/`, `Auth/`, `Chart/`, `GridConfig/`, `BotPanel/`, `History/`, `Backtest/`, `Settings/`
- `store/` — Zustand stores: `authStore`, `marketStore`, `botStore`, `settingsStore`
- `api/` — Axios client with JWT interceptor (`client.ts`) + per-feature modules
- `hooks/` — `useWebSocket`, `useGridCalc`, `useAuth`
- `types/index.ts` — All shared TypeScript interfaces

### Data flow
1. Frontend authenticates → receives JWT → stores in `authStore`
2. `api/client.ts` attaches JWT to every request
3. WebSocket connection to backend relays real-time Hyperliquid prices
4. `marketStore` holds current price; `botStore` holds active session state
5. Grid calculations run both client-side (`utils/gridCalculations.ts`) and server-side (`grid_engine.py`)

---

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Single admin user, bcrypt password |
| `app_config` | Key-value store; private keys stored Fernet-encrypted |
| `grid_configs` | Saved grid strategies (pair, price range, levels, capital, leverage) |
| `bot_sessions` | Each bot run; tracks state (activo/pausado/detenido), PnL |
| `orders` | Orders placed on Hyperliquid |
| `fills` | Executed trades with realized PnL |
| `candles` | OHLCV cache (1m/5m/15m/1h/4h/1d) |
| `backtest_runs` / `backtest_trades` | Backtest results |

---

## Environment Variables

Copy `.env.example` to `.env`. Key variables:
- `DATABASE_URL` — `postgresql+asyncpg://arnaldo:Arnaldo.2019@localhost:15434/tradingles`
- `JWT_SECRET_KEY` — 64-char random string
- `ENCRYPTION_KEY` — Fernet key (auto-generated on first run)
- `DEFAULT_MODE` — `testnet` or `mainnet`
- `CORS_ORIGINS` — `http://localhost:5173` for dev

---

## Security Notes

- Private keys are **always** stored encrypted (Fernet, derived from master password)
- The `ENCRYPTION_KEY` / Fernet salt lives in `app_config` table, not `.env`
- The app starts in `testnet` mode by default — explicit action required to switch to `mainnet`
- `.env` is gitignored; never commit it

---

## Hyperliquid API Endpoints

```
Mainnet REST:  https://api.hyperliquid.xyz
Testnet REST:  https://api.hyperliquid-testnet.xyz
Mainnet WS:    wss://api.hyperliquid.xyz/ws
Testnet WS:    wss://api.hyperliquid-testnet.xyz/ws
```
