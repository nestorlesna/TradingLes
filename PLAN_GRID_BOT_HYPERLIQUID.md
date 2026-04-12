# Grid Trading Bot — Hyperliquid — Plan de Implementación para Claude Code

## INSTRUCCIONES PARA CLAUDE CODE

Este documento es el plan maestro de implementación de un **bot de trading de grilla** sobre **Hyperliquid** con interfaz web. Debes seguirlo fase por fase, en orden. Cada fase tiene sub-fases con criterios de aceptación claros. **No avances a la siguiente fase hasta que la actual esté funcional y testeada**.

El documento de diseño original está en `grid_bot_hyperliquid.md` en la raíz del proyecto. Consúltalo para detalles técnicos específicos de la API de Hyperliquid, modelo de datos, y flujo de usuario.

---

## CONTEXTO GENERAL

### Qué estamos construyendo
Un bot de grid trading para futuros perpetuos en Hyperliquid (DEX), con interfaz web local, sistema de backtesting, y evaluación de estrategias. Es para uso personal de un solo usuario, pero con autenticación básica y preparado para Docker.

### Stack definido (NO cambiar)

**Backend:**
- Python 3.11+
- FastAPI + Uvicorn
- hyperliquid-python-sdk
- SQLAlchemy 2.x + asyncpg (PostgreSQL)
- websockets
- cryptography (Fernet para encriptar private keys)
- bcrypt (para hash de contraseña de login)
- python-jose[cryptography] (JWT tokens)

**Frontend:**
- React 18 + TypeScript
- Vite
- lightweight-charts (TradingView open source)
- Zustand (estado global)
- @tanstack/react-query
- Tailwind CSS
- react-router-dom v6

**Base de datos:**
- PostgreSQL (el usuario ya lo tiene instalado localmente)
- Para desarrollo: PostgreSQL local directo
- Para producción: PostgreSQL en Docker via docker-compose

**Infraestructura:**
- Docker + Docker Compose para deployment final
- Desarrollo local sin Docker (backend directo, frontend vite dev server)

### URLs de Hyperliquid
```
Mainnet API:     https://api.hyperliquid.xyz
Testnet API:     https://api.hyperliquid-testnet.xyz
Mainnet WS:      wss://api.hyperliquid.xyz/ws
Testnet WS:      wss://api.hyperliquid-testnet.xyz/ws
```

### Estructura del proyecto
```
grid-bot/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── config.py                  # Settings via pydantic-settings
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── models.py              # User SQLAlchemy model
│   │   ├── router.py              # Login/logout endpoints
│   │   ├── security.py            # JWT + bcrypt helpers
│   │   └── dependencies.py        # get_current_user dependency
│   ├── models/
│   │   ├── __init__.py
│   │   ├── database.py            # SQLAlchemy async engine + session
│   │   ├── grid_config.py         # GridConfig model
│   │   ├── bot_session.py         # BotSession model
│   │   ├── order.py               # Order model
│   │   ├── fill.py                # Fill model
│   │   ├── candle.py              # Candle cache model
│   │   ├── app_config.py          # AppConfig key-value model
│   │   └── backtest.py            # BacktestRun + BacktestTrade models
│   ├── services/
│   │   ├── __init__.py
│   │   ├── hyperliquid_client.py  # Wrapper del SDK oficial
│   │   ├── grid_engine.py         # Cálculo de niveles (aritmético/geométrico)
│   │   ├── order_manager.py       # Colocar/cancelar/monitorear órdenes
│   │   ├── websocket_relay.py     # Relay WS Hyperliquid → Frontend
│   │   ├── candle_service.py      # Fetch + cache de OHLCV
│   │   └── backtest_engine.py     # Motor de backtesting sobre datos históricos
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── grid.py                # CRUD de configuraciones
│   │   ├── bot.py                 # Start/stop/status
│   │   ├── history.py             # Historial de fills
│   │   ├── market.py              # Datos de mercado, pares
│   │   ├── settings.py            # Private keys, configuración global
│   │   └── backtest.py            # Ejecutar y consultar backtests
│   ├── alembic/                   # Migraciones
│   │   ├── env.py
│   │   └── versions/
│   ├── alembic.ini
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/            # Sidebar, Header, ProtectedRoute
│   │   │   ├── Auth/              # LoginForm
│   │   │   ├── Chart/             # CandlestickChart, GridOverlay
│   │   │   ├── GridConfig/        # GridConfigForm, GridPreview
│   │   │   ├── BotPanel/          # BotStatus, OrderList, EventLog
│   │   │   ├── History/           # TradeHistory table
│   │   │   ├── Backtest/          # BacktestConfig, BacktestResults
│   │   │   └── Settings/          # KeyManagement, AppSettings
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx  # Chart + selector de par
│   │   │   ├── GridPage.tsx       # Configurar + preview + operar
│   │   │   ├── HistoryPage.tsx
│   │   │   ├── BacktestPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── store/
│   │   │   ├── authStore.ts
│   │   │   ├── marketStore.ts
│   │   │   ├── botStore.ts
│   │   │   └── settingsStore.ts
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useGridCalc.ts
│   │   │   └── useAuth.ts
│   │   ├── api/
│   │   │   ├── client.ts          # Axios/fetch con JWT interceptor
│   │   │   ├── market.ts
│   │   │   ├── grid.ts
│   │   │   ├── bot.ts
│   │   │   ├── backtest.ts
│   │   │   └── auth.ts
│   │   ├── types/
│   │   │   └── index.ts           # Tipos TypeScript compartidos
│   │   ├── utils/
│   │   │   └── gridCalculations.ts # Cálculos de grilla client-side
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx.conf                 # Reverse proxy para producción
├── scripts/
│   ├── init_db.py                 # Setup inicial de PostgreSQL
│   └── create_user.py             # Crear usuario de login
├── docker-compose.yml
├── docker-compose.dev.yml         # Override para desarrollo
├── .env.example
├── .env                           # Variables reales (gitignored)
├── grid_bot_hyperliquid.md        # Documento de diseño original
└── README.md
```

---

## VARIABLES DE ENTORNO (.env)

```env
# === Base de datos ===
DATABASE_URL=postgresql+asyncpg://gridbot:gridbot_pass@localhost:5432/gridbot
# Para Docker:
# DATABASE_URL=postgresql+asyncpg://gridbot:gridbot_pass@postgres:5432/gridbot

# === Seguridad ===
JWT_SECRET_KEY=genera-un-string-aleatorio-de-64-chars-aqui
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440
ENCRYPTION_KEY=   # Se genera automáticamente al crear la app, Fernet key para private keys

# === Hyperliquid ===
HYPERLIQUID_MAINNET_URL=https://api.hyperliquid.xyz
HYPERLIQUID_TESTNET_URL=https://api.hyperliquid-testnet.xyz

# === App ===
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# === Modo por defecto ===
DEFAULT_MODE=testnet
```

---

## MODELO DE DATOS COMPLETO (PostgreSQL)

```sql
-- =============================================
-- TABLA: users (autenticación)
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- =============================================
-- TABLA: app_config (clave-valor para configuración global)
-- =============================================
CREATE TABLE app_config (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Claves esperadas:
--   'private_key_testnet'       → encriptada con Fernet
--   'private_key_mainnet'       → encriptada con Fernet
--   'wallet_address_testnet'    → plaintext (dirección pública, no es secreto)
--   'wallet_address_mainnet'    → plaintext
--   'fernet_salt'               → salt para derivar clave Fernet de la master password

-- =============================================
-- TABLA: grid_configs (configuraciones de grilla guardadas)
-- =============================================
CREATE TABLE grid_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    par VARCHAR(20) NOT NULL,            -- ej: 'BTC', 'ETH'
    precio_min DECIMAL(20,8) NOT NULL,
    precio_max DECIMAL(20,8) NOT NULL,
    cantidad_niveles INTEGER NOT NULL CHECK (cantidad_niveles >= 2),
    tipo_espaciado VARCHAR(20) NOT NULL DEFAULT 'geometrico', -- 'aritmetico' | 'geometrico'
    capital_usdc DECIMAL(20,8) NOT NULL,
    apalancamiento DECIMAL(5,2) NOT NULL DEFAULT 3.0 CHECK (apalancamiento >= 1 AND apalancamiento <= 10),
    modo VARCHAR(10) NOT NULL DEFAULT 'testnet', -- 'testnet' | 'mainnet'
    es_favorita BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: bot_sessions (cada ejecución del bot)
-- =============================================
CREATE TABLE bot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grid_config_id UUID NOT NULL REFERENCES grid_configs(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo', -- 'activo' | 'pausado' | 'detenido'
    precio_entrada_promedio DECIMAL(20,8),
    capital_inicial DECIMAL(20,8) NOT NULL,
    pnl_realizado DECIMAL(20,8) DEFAULT 0,
    modo VARCHAR(10) NOT NULL, -- 'testnet' | 'mainnet'
    notas TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    stopped_at TIMESTAMPTZ,
    CONSTRAINT chk_estado CHECK (estado IN ('activo', 'pausado', 'detenido'))
);

-- =============================================
-- TABLA: orders (órdenes colocadas en Hyperliquid)
-- =============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES bot_sessions(id),
    hyperliquid_order_id VARCHAR(100),
    par VARCHAR(20) NOT NULL,
    lado VARCHAR(4) NOT NULL,           -- 'buy' | 'sell'
    precio DECIMAL(20,8) NOT NULL,
    cantidad DECIMAL(20,8) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    -- 'pendiente' | 'abierta' | 'ejecutada' | 'cancelada' | 'error'
    nivel_grilla INTEGER NOT NULL,
    intentos INTEGER DEFAULT 0,
    error_msg TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    filled_at TIMESTAMPTZ
);
CREATE INDEX idx_orders_session ON orders(session_id);
CREATE INDEX idx_orders_estado ON orders(estado);

-- =============================================
-- TABLA: fills (operaciones ejecutadas)
-- =============================================
CREATE TABLE fills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    session_id UUID NOT NULL REFERENCES bot_sessions(id),
    par VARCHAR(20) NOT NULL,
    lado VARCHAR(4) NOT NULL,
    precio_fill DECIMAL(20,8) NOT NULL,
    cantidad_fill DECIMAL(20,8) NOT NULL,
    comision DECIMAL(20,8) NOT NULL DEFAULT 0,
    pnl_realizado DECIMAL(20,8),
    timestamp TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_fills_session ON fills(session_id);
CREATE INDEX idx_fills_timestamp ON fills(timestamp);

-- =============================================
-- TABLA: candles (cache de velas OHLCV)
-- =============================================
CREATE TABLE candles (
    id SERIAL PRIMARY KEY,
    par VARCHAR(20) NOT NULL,
    timeframe VARCHAR(5) NOT NULL,       -- '1m','5m','15m','1h','4h','1d'
    timestamp BIGINT NOT NULL,           -- Unix ms
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL DEFAULT 0,
    UNIQUE(par, timeframe, timestamp)
);
CREATE INDEX idx_candles_lookup ON candles(par, timeframe, timestamp);

-- =============================================
-- TABLA: backtest_runs (ejecuciones de backtesting)
-- =============================================
CREATE TABLE backtest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Configuración de la grilla usada
    par VARCHAR(20) NOT NULL,
    precio_min DECIMAL(20,8) NOT NULL,
    precio_max DECIMAL(20,8) NOT NULL,
    cantidad_niveles INTEGER NOT NULL,
    tipo_espaciado VARCHAR(20) NOT NULL,
    capital_usdc DECIMAL(20,8) NOT NULL,
    apalancamiento DECIMAL(5,2) NOT NULL,
    -- Período de backtesting
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    timeframe_simulacion VARCHAR(5) NOT NULL DEFAULT '1h', -- granularidad de la simulación
    -- Resultados
    pnl_total DECIMAL(20,8),
    pnl_porcentaje DECIMAL(10,4),
    total_trades INTEGER DEFAULT 0,
    trades_ganadores INTEGER DEFAULT 0,
    trades_perdedores INTEGER DEFAULT 0,
    max_drawdown DECIMAL(20,8),
    max_drawdown_porcentaje DECIMAL(10,4),
    sharpe_ratio DECIMAL(10,4),
    comisiones_totales DECIMAL(20,8) DEFAULT 0,
    fue_liquidado BOOLEAN DEFAULT FALSE,
    precio_liquidacion DECIMAL(20,8),
    timestamp_liquidacion TIMESTAMPTZ,
    capital_final DECIMAL(20,8),
    -- Meta
    duracion_segundos DECIMAL(10,2),     -- cuánto tardó el backtest
    estado VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente' | 'ejecutando' | 'completado' | 'error'
    error_msg TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: backtest_trades (trades individuales del backtest)
-- =============================================
CREATE TABLE backtest_trades (
    id SERIAL PRIMARY KEY,
    backtest_run_id UUID NOT NULL REFERENCES backtest_runs(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    lado VARCHAR(4) NOT NULL,
    precio DECIMAL(20,8) NOT NULL,
    cantidad DECIMAL(20,8) NOT NULL,
    comision DECIMAL(20,8) NOT NULL,
    pnl DECIMAL(20,8),
    nivel_grilla INTEGER NOT NULL,
    capital_acumulado DECIMAL(20,8),     -- capital total en ese momento
    posicion_neta DECIMAL(20,8)          -- posición abierta en ese momento
);
CREATE INDEX idx_bt_trades_run ON backtest_trades(backtest_run_id);
```

---

## CONTRATOS DE API REST

### Autenticación

```
POST /api/auth/login
  Body: { "username": "string", "password": "string" }
  Response 200: { "access_token": "string", "token_type": "bearer" }
  Response 401: { "detail": "Credenciales inválidas" }

POST /api/auth/setup
  (Solo funciona si no hay usuarios creados aún — primer uso)
  Body: { "username": "string", "password": "string" }
  Response 201: { "message": "Usuario creado exitosamente" }
  Response 409: { "detail": "Ya existe un usuario configurado" }

GET /api/auth/me
  Headers: Authorization: Bearer <token>
  Response 200: { "id": "uuid", "username": "string" }
```

### Market Data

```
GET /api/market/pairs
  Response 200: ["BTC", "ETH", "SOL", "BNB", "DOGE", "ARB", "OP", "AVAX", "MATIC", "LINK", ...]

GET /api/market/candles?par=BTC&timeframe=1h&start=1700000000000&end=1710000000000
  Response 200: [
    { "timestamp": 1700000000000, "open": 95000, "high": 95500, "low": 94800, "close": 95200, "volume": 123.45 },
    ...
  ]

GET /api/market/price/:par
  Response 200: { "par": "BTC", "price": 95430.50, "timestamp": 1700000000000 }
```

### Grid Config

```
GET    /api/grid/configs                → Lista todas las configuraciones guardadas
POST   /api/grid/configs                → Crear nueva configuración
GET    /api/grid/configs/:id            → Detalle de una configuración
PUT    /api/grid/configs/:id            → Actualizar configuración
DELETE /api/grid/configs/:id            → Eliminar configuración

POST   /api/grid/calculate              → Calcular niveles de grilla sin guardar
  Body: { "par": "BTC", "precio_min": 90000, "precio_max": 100000, "cantidad_niveles": 10,
          "tipo_espaciado": "geometrico", "capital_usdc": 500, "apalancamiento": 3 }
  Response 200: {
    "niveles": [
      { "nivel": 1, "precio": 90000, "tipo": "buy", "capital": 50, "cantidad": 0.00166,
        "ganancia_bruta": 1.89, "comision": 0.022, "ganancia_neta": 1.868 },
      ...
    ],
    "precio_liquidacion": 75925.0,
    "ganancia_total_ciclo": 18.68,
    "advertencias": ["El nivel 1 está cerca del precio de liquidación"]
  }
```

### Bot Control

```
POST /api/bot/start
  Body: { "grid_config_id": "uuid" }
  Response 200: { "session_id": "uuid", "estado": "activo", "ordenes_colocadas": 10 }

POST /api/bot/stop
  Body: { "session_id": "uuid" }
  Response 200: { "estado": "detenido", "ordenes_canceladas": 5, "pnl_final": 45.20 }

POST /api/bot/pause
  Body: { "session_id": "uuid" }
  Response 200: { "estado": "pausado" }

POST /api/bot/resume
  Body: { "session_id": "uuid" }
  Response 200: { "estado": "activo" }

GET /api/bot/status
  Response 200: {
    "session_id": "uuid", "estado": "activo",
    "precio_actual": 95430, "posicion": { "size": 0.05, "avg_entry": 95000 },
    "pnl_realizado": 45.20, "pnl_no_realizado": -12.30,
    "margen_usado": 150.0, "margen_disponible": 350.0,
    "precio_liquidacion": 75925.0,
    "ordenes_abiertas": [
      { "id": "uuid", "precio": 94000, "lado": "buy", "cantidad": 0.001, "nivel": 3 },
      ...
    ],
    "eventos_recientes": [
      { "tipo": "fill", "mensaje": "Compra ejecutada nivel 5 @ $95,000", "timestamp": "..." },
      ...
    ]
  }
```

### Historial

```
GET /api/history/fills?session_id=uuid&page=1&limit=50&lado=buy&desde=2025-01-01&hasta=2025-06-01
  Response 200: {
    "items": [ { "id": "uuid", "timestamp": "...", "par": "BTC", "lado": "buy",
                 "precio": 95000, "cantidad": 0.001, "comision": 0.033, "pnl": 1.87 }, ... ],
    "total": 150, "page": 1, "pages": 3
  }

GET /api/history/summary?session_id=uuid
  Response 200: {
    "total_trades": 150, "pnl_realizado": 245.50,
    "comisiones_totales": 12.30, "pnl_neto": 233.20
  }
```

### Backtest

```
POST /api/backtest/run
  Body: {
    "par": "BTC", "precio_min": 90000, "precio_max": 100000,
    "cantidad_niveles": 10, "tipo_espaciado": "geometrico",
    "capital_usdc": 500, "apalancamiento": 3,
    "fecha_inicio": "2025-01-01T00:00:00Z",
    "fecha_fin": "2025-12-31T23:59:59Z",
    "timeframe_simulacion": "1h"
  }
  Response 202: { "backtest_id": "uuid", "estado": "ejecutando" }

GET /api/backtest/status/:id
  Response 200: { "estado": "ejecutando", "progreso": 65 }  // porcentaje

GET /api/backtest/results/:id
  Response 200: {
    "id": "uuid", "estado": "completado",
    "config": { ...configuración usada... },
    "resultados": {
      "pnl_total": 245.50, "pnl_porcentaje": 49.1,
      "total_trades": 312, "trades_ganadores": 180, "trades_perdedores": 132,
      "max_drawdown": -85.20, "max_drawdown_porcentaje": -17.04,
      "sharpe_ratio": 1.45, "comisiones_totales": 32.10,
      "fue_liquidado": false, "capital_final": 745.50,
      "duracion_segundos": 12.5
    },
    "equity_curve": [ { "timestamp": "...", "capital": 500 }, ... ],
    "trades": [ { "timestamp": "...", "lado": "buy", "precio": 95000, ... }, ... ]
  }

GET /api/backtest/list?page=1&limit=20
  Response 200: { "items": [...], "total": 5 }

DELETE /api/backtest/:id
```

### Settings

```
POST /api/settings/private-key
  Body: { "mode": "testnet", "private_key": "0x...", "master_password": "..." }
  Response 200: { "wallet_address": "0x1234...", "mode": "testnet" }

GET /api/settings/wallet-info
  Response 200: {
    "testnet": { "configured": true, "wallet_address": "0x1234..." },
    "mainnet": { "configured": false, "wallet_address": null }
  }

POST /api/settings/verify-key
  Body: { "mode": "testnet", "master_password": "..." }
  Response 200: { "valid": true, "balance": 1000.50 }
```

### Protocolo WebSocket (Backend → Frontend)

```
Conexión: ws://localhost:8000/ws?token=<jwt_token>

Mensajes del servidor al cliente:

{ "type": "price_update", "par": "BTC", "price": 95430.50, "timestamp": 1234567890 }

{ "type": "candle_update", "par": "BTC", "timeframe": "1h",
  "candle": { "timestamp": 1234567890, "open": 95000, "high": 95500, "low": 94800, "close": 95200, "volume": 123 } }

{ "type": "fill_event", "order_id": "uuid", "precio": 95000, "lado": "buy",
  "cantidad": 0.001, "comision": 0.033, "pnl": 1.87, "nivel": 5 }

{ "type": "bot_state", "estado": "activo", "pnl_realizado": 45.20,
  "pnl_no_realizado": -12.30, "precio_liquidacion": 75925, "posicion": {...} }

{ "type": "order_update", "orders": [...] }

{ "type": "connection_status", "hyperliquid": "connected" | "reconnecting" | "disconnected" }

{ "type": "error", "message": "Descripción del error", "severity": "warning" | "error" }

{ "type": "backtest_progress", "backtest_id": "uuid", "progreso": 65 }

Mensajes del cliente al servidor:

{ "type": "subscribe_pair", "par": "BTC" }
{ "type": "unsubscribe_pair", "par": "BTC" }
{ "type": "subscribe_timeframe", "timeframe": "1h" }
```

---

# ═══════════════════════════════════════════════════════════
# FASE 1: INFRAESTRUCTURA + CHARTS
# Objetivo: Web funcional con gráficos de cripto en tiempo real
# ═══════════════════════════════════════════════════════════

## Fase 1.1 — Scaffolding del proyecto

**Qué hacer:**
1. Crear toda la estructura de directorios según el árbol de arriba
2. Inicializar el backend Python:
   - Crear `requirements.txt` con todas las dependencias
   - Crear `config.py` con pydantic-settings cargando variables de `.env`
   - Crear `main.py` con FastAPI app básica (health check endpoint)
3. Inicializar el frontend React:
   - `npm create vite@latest frontend -- --template react-ts`
   - Instalar dependencias: `tailwind`, `zustand`, `@tanstack/react-query`, `react-router-dom`, `lightweight-charts`, `axios`
   - Configurar Tailwind CSS
   - Configurar Vite proxy para redirigir `/api` al backend (puerto 8000)
4. Crear `.env.example` y `.env` con valores por defecto
5. Crear `README.md` con instrucciones de setup

**requirements.txt del backend:**
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.35
asyncpg==0.30.0
alembic==1.14.0
pydantic-settings==2.5.0
python-jose[cryptography]==3.3.0
bcrypt==4.2.0
passlib[bcrypt]==1.7.4
cryptography==43.0.0
websockets==13.0
httpx==0.27.0
hyperliquid-python-sdk>=0.4.0
python-multipart==0.0.9
```

**Criterio de aceptación:**
- `cd backend && uvicorn main:app --reload` levanta en puerto 8000
- `GET /api/health` devuelve `{"status": "ok"}`
- `cd frontend && npm run dev` levanta en puerto 5173
- La app React muestra una página en blanco con "Grid Bot" como título

---

## Fase 1.2 — Base de datos + Migraciones

**Qué hacer:**
1. Crear `models/database.py`:
   - AsyncEngine con asyncpg
   - async_sessionmaker
   - Función `get_db()` como dependency de FastAPI
   - Base declarativa de SQLAlchemy
2. Crear todos los modelos SQLAlchemy según el schema SQL de arriba:
   - `auth/models.py` → tabla `users`
   - `models/app_config.py` → tabla `app_config`
   - `models/grid_config.py` → tabla `grid_configs`
   - `models/bot_session.py` → tabla `bot_sessions`
   - `models/order.py` → tabla `orders`
   - `models/fill.py` → tabla `fills`
   - `models/candle.py` → tabla `candles`
   - `models/backtest.py` → tablas `backtest_runs` + `backtest_trades`
3. Configurar Alembic para migraciones async
4. Generar migración inicial con todas las tablas
5. Crear `scripts/init_db.py` que:
   - Crea la base de datos `gridbot` si no existe
   - Ejecuta las migraciones
   - Muestra mensaje de confirmación

**Criterio de aceptación:**
- `python scripts/init_db.py` crea la BD y todas las tablas
- `alembic upgrade head` funciona sin errores
- Las tablas existen en PostgreSQL con todos los índices

---

## Fase 1.3 — Sistema de autenticación

**Qué hacer:**
1. Backend — `auth/security.py`:
   - `hash_password(password: str) -> str` usando bcrypt
   - `verify_password(plain: str, hashed: str) -> bool`
   - `create_access_token(data: dict) -> str` usando python-jose con JWT
   - `decode_token(token: str) -> dict`
2. Backend — `auth/dependencies.py`:
   - `get_current_user(token)` — dependency de FastAPI que extrae el JWT del header Authorization, lo decodifica, y busca el usuario en la BD. Si falla, lanza HTTPException 401.
3. Backend — `auth/router.py`:
   - `POST /api/auth/setup` — Crea el primer (y único) usuario. Si ya existe uno, devuelve 409. Esto permite el "primer uso" sin necesidad de scripts CLI.
   - `POST /api/auth/login` — Valida credenciales, devuelve JWT token.
   - `GET /api/auth/me` — Devuelve info del usuario autenticado.
4. Frontend — `LoginPage.tsx`:
   - Formulario con username + password
   - Si es el primer uso (detectar con un endpoint `GET /api/auth/has-users`), mostrar formulario de "Crear cuenta" en vez de "Iniciar sesión"
   - Almacenar JWT en localStorage (es uso personal local, está bien)
   - Redirigir al dashboard después del login
5. Frontend — `ProtectedRoute`:
   - Componente wrapper que verifica si hay token válido en localStorage
   - Si no hay token, redirige a `/login`
   - En `App.tsx`, todas las rutas excepto `/login` deben ser protegidas
6. Frontend — API client:
   - Crear `api/client.ts` con un axios instance que:
     - Añade `Authorization: Bearer <token>` a cada request
     - Intercepta 401 y redirige a `/login`

**IMPORTANTE sobre seguridad del WebSocket:**
- El WebSocket debe aceptar el JWT como query parameter: `ws://localhost:8000/ws?token=<jwt>`
- En el backend, validar el token al hacer el upgrade a WS. Rechazar conexión si es inválido.

**Criterio de aceptación:**
- La primera vez que se abre la app, muestra formulario de "Crear cuenta"
- Después de crear la cuenta, muestra formulario de login
- Login exitoso redirige al dashboard
- Acceder a cualquier ruta sin token redirige a `/login`
- El token expira según JWT_ACCESS_TOKEN_EXPIRE_MINUTES

---

## Fase 1.4 — Layout y navegación

**Qué hacer:**
1. Crear el layout principal con sidebar:
   - Sidebar izquierdo con navegación: Dashboard, Grid, Historial, Backtest, Configuración
   - Header superior con: título de la página actual, indicador testnet/mainnet (pill verde/rojo), botón de logout
   - Área de contenido principal
2. Crear las páginas vacías con placeholder:
   - `DashboardPage` → "Dashboard — Próximamente"
   - `GridPage` → "Configuración de Grilla — Próximamente"
   - `HistoryPage` → "Historial — Próximamente"
   - `BacktestPage` → "Backtesting — Próximamente"
   - `SettingsPage` → "Configuración — Próximamente"
3. React Router con rutas protegidas

**Diseño visual:**
- Tema oscuro (fondo #0f1117 o similar, como las plataformas de trading)
- Sidebar: ancho fijo 240px, fondo ligeramente más claro
- Header: altura 56px, con border bottom sutil
- Colores: verde #22c55e para profit/testnet, rojo #ef4444 para loss/mainnet, azul #3b82f6 para acciones primarias
- Font: monospace para números/precios (font-mono de Tailwind)

**Criterio de aceptación:**
- Navegación entre todas las páginas funciona
- Sidebar destaca la página activa
- El indicador testnet/mainnet es visible en todo momento
- Responsive básico (sidebar colapsable en mobile)

---

## Fase 1.5 — Servicio de datos de mercado (backend)

**Qué hacer:**
1. `services/hyperliquid_client.py`:
   - Clase `HyperliquidClient` que wrappea el SDK oficial
   - Constructor recibe `mode: "testnet" | "mainnet"` y configura URL base
   - Método `get_all_mids() -> dict[str, float]` — precios mid de todos los pares
   - Método `get_candles(par, timeframe, start_ms, end_ms) -> list[Candle]` — velas históricas
   - Método `get_meta() -> dict` — metadata de pares disponibles (para saber qué pares existen y sus decimales)
   - **NO** necesita private key para datos de mercado (solo lectura)
   - Usar `httpx.AsyncClient` para las requests HTTP

2. `services/candle_service.py`:
   - `fetch_candles_with_cache(par, timeframe, start_ms, end_ms)`:
     - Buscar en la tabla `candles` qué rango ya tenemos cacheado
     - Pedir a Hyperliquid solo las velas que faltan
     - Guardar las nuevas en la BD
     - Devolver todas las velas del rango solicitado
   - Para timeframes de 1d y 4h: cargar últimos 6 meses
   - Para 1h: últimos 3 meses
   - Para 15m: últimas 2 semanas
   - Para 5m y 1m: últimos 3 días
   - Las velas se piden paginadas (Hyperliquid devuelve máximo ~5000 por request)

3. `routers/market.py`:
   - `GET /api/market/pairs` — lista de pares disponibles (obtener de Hyperliquid meta)
   - `GET /api/market/candles?par=BTC&timeframe=1h&start=...&end=...` — velas con cache
   - `GET /api/market/price/:par` — precio actual (de allMids)

4. `services/websocket_relay.py`:
   - Conectar al WebSocket de Hyperliquid (`allMids` stream)
   - Mantener un dict en memoria con precios actuales de todos los pares
   - Emitir `price_update` a los clientes frontend conectados
   - Reconexión con backoff exponencial si se cae la conexión
   - Emitir `connection_status` al frontend

**Detalles del API de Hyperliquid para velas:**
```python
# Request de velas históricas
import httpx

async def get_candles(par: str, timeframe: str, start_ms: int, end_ms: int):
    url = "https://api.hyperliquid-testnet.xyz/info"  # o mainnet
    payload = {
        "type": "candleSnapshot",
        "coin": par,       # ej: "BTC"
        "interval": timeframe,  # ej: "1h"
        "startTime": start_ms,
        "endTime": end_ms
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload)
        return resp.json()
    # Devuelve lista de: {"t": timestamp_ms, "o": open, "h": high, "l": low, "c": close, "v": volume}

# WebSocket para precios en tiempo real
# Conectar a wss://api.hyperliquid-testnet.xyz/ws
# Enviar: {"method": "subscribe", "subscription": {"type": "allMids"}}
# Recibe: {"channel": "allMids", "data": {"mids": {"BTC": "95430.5", "ETH": "3200.1", ...}}}
```

**Criterio de aceptación:**
- `GET /api/market/pairs` devuelve lista de pares desde Hyperliquid testnet
- `GET /api/market/candles?par=BTC&timeframe=1h` devuelve velas históricas correctas
- Las velas se cachean en PostgreSQL (segunda llamada es instantánea)
- El WebSocket relay transmite precios en tiempo real

---

## Fase 1.6 — Gráfico de velas (frontend)

**Qué hacer:**
1. `components/Chart/CandlestickChart.tsx`:
   - Usar `lightweight-charts` para renderizar velas
   - Props: `par: string`, `timeframe: string`
   - Al montar: cargar velas históricas via `GET /api/market/candles`
   - Conectar al WebSocket para actualizaciones en tiempo real
   - Actualizar la última vela (o crear nueva) según llegan datos del WS
   - Configuración del chart:
     - Tema oscuro (background: #0f1117, text: #d1d5db)
     - Velas verdes (#22c55e) para alcistas, rojas (#ef4444) para bajistas
     - Crosshair habilitado
     - Eje Y con formato de precio correcto (ej: BTC con 2 decimales, DOGE con 5)
     - Eje X con timestamps
     - Grid lines sutiles
   - Dimensiones: 100% del ancho del contenedor, alto fijo 500px (o responsive)

2. `components/Chart/TimeframeSelector.tsx`:
   - Botones para: 1m, 5m, 15m, 1h, 4h, 1d
   - Al cambiar timeframe: recargar velas históricas
   - Destacar el botón activo

3. `components/Chart/PairSelector.tsx`:
   - Dropdown/selector con pares disponibles
   - Pares principales destacados: BTC, ETH, SOL, BNB
   - Al cambiar par: recargar velas y re-suscribir WebSocket
   - Mostrar precio actual al lado del nombre del par

4. `hooks/useWebSocket.ts`:
   - Custom hook que maneja la conexión WebSocket al backend
   - Auto-reconexión con backoff
   - Parse de mensajes según `type`
   - Retorna: `{ lastPrice, lastCandle, isConnected }`

5. `DashboardPage.tsx`:
   - Selector de par (parte superior)
   - Selector de timeframe (debajo del selector de par)
   - Gráfico de velas (área principal)
   - Precio actual en grande con color verde/rojo según la dirección
   - Ticker de cambio porcentual 24h (si está disponible)

**Criterio de aceptación:**
- Al abrir Dashboard, se ve el gráfico de BTC con velas históricas
- Se puede cambiar entre BTC, ETH, SOL, BNB y otros pares
- Se puede cambiar el timeframe y las velas se recargan
- El precio se actualiza en tiempo real via WebSocket
- La última vela se actualiza en tiempo real (no espera a que cierre)
- El gráfico se ve profesional con tema oscuro
- No hay errores de consola ni glitches visuales

---

## Fase 1.7 — Docker setup (base)

**Qué hacer:**
1. `docker/Dockerfile.backend`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

2. `docker/Dockerfile.frontend`:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

3. `docker/nginx.conf`:
   - Servir estáticos del frontend
   - Proxy `/api` y `/ws` al backend (container `backend:8000`)

4. `docker-compose.yml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: gridbot
      POSTGRES_USER: gridbot
      POSTGRES_PASSWORD: ${DB_PASSWORD:-gridbot_pass}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gridbot"]
      interval: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: docker/Dockerfile.backend
    environment:
      DATABASE_URL: postgresql+asyncpg://gridbot:${DB_PASSWORD:-gridbot_pass}@postgres:5432/gridbot
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "8000:8000"

  frontend:
    build:
      context: .
      dockerfile: docker/Dockerfile.frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  pgdata:
```

5. `docker-compose.dev.yml` (override para desarrollo):
   - Solo levanta PostgreSQL en Docker
   - Backend y frontend corren localmente

**Criterio de aceptación:**
- `docker compose up --build` levanta los 3 servicios
- La app es accesible en http://localhost:3000
- La BD persiste datos entre reinicios (volume pgdata)
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` solo levanta PostgreSQL

---

# ═══════════════════════════════════════════════════════════
# FASE 2: CONFIGURACIÓN Y MOTOR DEL BOT
# Objetivo: Configurar la grilla, ver preview, operar en testnet
# ═══════════════════════════════════════════════════════════

## Fase 2.1 — Motor de cálculo de grilla (backend + frontend)

**Qué hacer:**
1. `services/grid_engine.py`:
   - `calculate_grid_levels(config: GridCalcInput) -> GridCalcResult`
   - Implementar cálculo **aritmético**:
     ```python
     step = (precio_max - precio_min) / (cantidad_niveles - 1)
     niveles = [precio_min + i * step for i in range(cantidad_niveles)]
     ```
   - Implementar cálculo **geométrico**:
     ```python
     ratio = (precio_max / precio_min) ** (1 / (cantidad_niveles - 1))
     niveles = [precio_min * (ratio ** i) for i in range(cantidad_niveles)]
     ```
   - Para cada nivel calcular:
     - `capital_por_nivel = capital_total / cantidad_niveles`
     - `capital_con_apalancamiento = capital_por_nivel * apalancamiento`
     - `cantidad = capital_con_apalancamiento / precio_nivel`
     - `ganancia_bruta = abs(nivel[i+1] - nivel[i]) * cantidad`
     - `comision_maker = capital_con_apalancamiento * 0.0001`  (0.01%)
     - `comision_taker = capital_con_apalancamiento * 0.00035` (0.035%)
     - `comision_ciclo = comision_maker + comision_taker`
     - `ganancia_neta = ganancia_bruta - comision_ciclo`
   - Calcular precio de liquidación:
     ```python
     # Para LONG (el bot mantiene posición neta long cuando compra):
     precio_liq = precio_entrada * (1 - 1/apalancamiento + 0.005)
     # Donde 0.005 es el margen de mantenimiento de Hyperliquid
     ```
   - Generar advertencias si:
     - Algún nivel está por debajo del precio de liquidación
     - La ganancia neta por ciclo es negativa (comisiones > ganancia)
     - El espaciado entre niveles es menor al tick size del par
     - El capital por nivel es menor al mínimo de Hyperliquid

2. `routers/grid.py`:
   - `POST /api/grid/calculate` — calcula sin guardar (para preview)
   - CRUD de `grid_configs` (guardar/editar/eliminar configuraciones)

3. Frontend — `utils/gridCalculations.ts`:
   - Misma lógica de cálculo pero en TypeScript para cálculos instantáneos en el frontend
   - Se usa para feedback inmediato al cambiar valores en el form (sin esperar al backend)
   - El backend es la fuente de verdad al guardar/ejecutar

4. Frontend — `components/GridConfig/GridConfigForm.tsx`:
   - Formulario con todos los campos según la spec:
     - Par (dropdown), Precio mín, Precio máx, Cantidad niveles, Tipo espaciado, Capital USDC, Apalancamiento, Modo testnet/mainnet
   - Cálculos en tiempo real al cambiar cualquier campo (debounced 300ms)
   - Panel lateral con métricas calculadas:
     - Ganancia neta estimada por ciclo completo
     - ROI estimado por ciclo
     - Precio de liquidación
     - Capital por nivel
   - Advertencias visibles (bordes rojos, iconos ⚠️)
   - Botones: "Calcular preview", "Guardar configuración"

5. Frontend — `components/GridConfig/GridPreview.tsx`:
   - Tabla con columnas: Nivel, Precio, Tipo (buy/sell), Capital, Cantidad, Ganancia neta
   - Highlight del nivel más cercano al precio actual
   - Niveles de compra en verde, venta en rojo
   - Fila total con sumas

6. Frontend — `components/Chart/GridOverlay.tsx`:
   - Dibujar líneas horizontales sobre el gráfico de lightweight-charts
   - Líneas verdes punteadas para niveles de compra
   - Líneas rojas punteadas para niveles de venta
   - Línea roja gruesa para precio de liquidación
   - Labels con el precio en cada línea (lado derecho)
   - Las líneas se actualizan cuando cambia la configuración
   - Usar `chart.addLineSeries()` o `addBaselineSeries()` para los overlays

**Criterio de aceptación:**
- El formulario calcula en tiempo real los niveles
- La tabla de preview muestra todos los niveles correctamente
- Las líneas se dibujan sobre el gráfico cuando se configura una grilla
- Las advertencias se muestran correctamente
- Se pueden guardar/cargar/eliminar configuraciones

---

## Fase 2.2 — Gestión de private keys (backend)

**Qué hacer:**
1. `services/crypto.py` (o parte de `config.py`):
   - Derivar clave Fernet de una "master password" que ingresa el usuario:
     ```python
     from cryptography.fernet import Fernet
     from cryptography.hazmat.primitives import hashes
     from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
     import base64, os

     def derive_fernet_key(password: str, salt: bytes) -> bytes:
         kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32,
                          salt=salt, iterations=480000)
         key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
         return key

     def encrypt_private_key(private_key: str, master_password: str, salt: bytes) -> str:
         fernet = Fernet(derive_fernet_key(master_password, salt))
         return fernet.encrypt(private_key.encode()).decode()

     def decrypt_private_key(encrypted: str, master_password: str, salt: bytes) -> str:
         fernet = Fernet(derive_fernet_key(master_password, salt))
         return fernet.decrypt(encrypted.encode()).decode()
     ```
   - El salt se genera una vez y se guarda en `app_config` clave `'fernet_salt'`
   - La private key encriptada se guarda en `app_config` clave `'private_key_testnet'` o `'private_key_mainnet'`
   - La master password **NUNCA** se guarda en la BD. El usuario la ingresa cada vez que inicia el bot.

2. `routers/settings.py`:
   - Endpoints para guardar y verificar private keys (ver contratos API arriba)

3. Frontend — `SettingsPage.tsx`:
   - Sección "Wallet Testnet":
     - Input para private key (type=password)
     - Input para master password
     - Botón "Guardar y verificar"
     - Muestra wallet address derivada si está configurada
     - Botón "Verificar conexión" (comprueba balance)
   - Sección "Wallet Mainnet" (igual pero con advertencia en rojo)
   - **Advertencia prominente**: "Usa una wallet dedicada exclusivamente al bot. NUNCA uses tu wallet principal."

**Criterio de aceptación:**
- Se puede guardar private key de testnet encriptada
- Se puede verificar que la key funciona (muestra balance)
- La key se desencripta correctamente con la master password
- Sin la master password correcta, la key no se puede recuperar

---

## Fase 2.3 — Order Manager y motor del bot

**Qué hacer:**
1. `services/order_manager.py`:
   - `place_order(par, side, price, quantity, order_type="limit") -> OrderResult`
     - Llama al SDK de Hyperliquid para colocar orden
     - Guarda en BD tabla `orders`
     - Maneja errores y retry con backoff exponencial (1s, 2s, 4s, max 3 intentos)
   - `cancel_order(order_id) -> bool`
   - `cancel_all_orders(session_id) -> int` — cancela todas las órdenes de una sesión
   - `get_open_orders() -> list[Order]` — consulta órdenes abiertas en Hyperliquid
   - `sync_orders(session_id)` — sincroniza estado de órdenes entre BD y Hyperliquid

2. `services/grid_engine.py` (ampliar):
   - `start_grid(session: BotSession, config: GridConfig, master_password: str)`:
     - Desencriptar private key
     - Calcular niveles
     - Determinar precio actual
     - Para niveles por debajo del precio actual → colocar órdenes BUY
     - Para niveles por encima del precio actual → colocar órdenes SELL
     - Usar cola interna con rate limit (max 10 req/s) para evitar ráfagas
     - Guardar todas las órdenes en BD
   - `handle_fill(fill_event)`:
     - Cuando se ejecuta compra en nivel N → colocar venta en nivel N+1
     - Cuando se ejecuta venta en nivel N → colocar compra en nivel N-1
     - Actualizar PnL realizado
     - Guardar fill en BD
     - Emitir evento por WebSocket al frontend
   - `stop_grid(session_id)`:
     - Cancelar todas las órdenes abiertas
     - Actualizar estado de sesión a "detenido"
   - `pause_grid(session_id)` / `resume_grid(session_id)`

3. WebSocket listener para fills:
   - Suscribirse a `userFills` en Hyperliquid WS (requiere wallet address)
   - Parsear cada fill y llamar a `handle_fill`
   - Manejar reconexión con sincronización vía REST

4. `routers/bot.py`:
   - Endpoints de start/stop/pause/resume/status (ver contratos API)
   - `start` requiere `master_password` en el body (para desencriptar la key)

**Detalles del SDK de Hyperliquid para órdenes:**
```python
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants
import eth_account

# Setup
account = eth_account.Account.from_key("0x_PRIVATE_KEY")
info = Info(constants.TESTNET_API_URL, skip_ws=True)
exchange = Exchange(account, constants.TESTNET_API_URL)

# Colocar orden limit
result = exchange.order(
    coin="BTC",
    is_buy=True,
    sz=0.001,          # cantidad
    limit_px=95000.0,  # precio
    order_type={"limit": {"tpc": "Gtc"}}  # Good til cancel
)

# Cancelar orden
exchange.cancel(coin="BTC", oid=order_id)

# Consultar posiciones
positions = info.user_state(account.address)

# WebSocket para fills
from hyperliquid.websocket import WebsocketManager
ws = WebsocketManager(constants.TESTNET_API_URL)
ws.subscribe({"type": "userFills", "user": account.address}, callback)
```

**Criterio de aceptación:**
- Se puede iniciar un bot con una configuración guardada
- Las órdenes se colocan correctamente en Hyperliquid testnet
- Cuando se ejecuta una orden, el bot recoloca la orden inversa
- El estado se persiste en la BD
- Se puede pausar/reanudar/detener el bot
- Los fills se muestran en tiempo real en el frontend

---

## Fase 2.4 — Panel de estado del bot (frontend)

**Qué hacer:**
1. `components/BotPanel/BotStatus.tsx`:
   - Estado actual (badge: Activo verde, Pausado amarillo, Detenido gris)
   - Precio actual del par
   - Posición abierta: tamaño, precio promedio de entrada, dirección (long/short)
   - PnL realizado (verde/rojo) con acumulado desde el inicio de sesión
   - PnL no realizado (actualizado en tiempo real)
   - Margen usado / disponible (barra de progreso)
   - Precio de liquidación (rojo, destacado si está cerca)
   - Botones: Pausar, Reanudar, Detener (con confirmación modal)

2. `components/BotPanel/OrderList.tsx`:
   - Tabla con órdenes abiertas: precio, lado (buy/sell coloreado), cantidad, nivel
   - Actualización en tiempo real via WebSocket
   - Indicador visual de qué órdenes están cerca del precio actual

3. `components/BotPanel/EventLog.tsx`:
   - Lista scrollable de eventos recientes (últimos 50)
   - Cada evento: timestamp, tipo (fill/error/recolocación), descripción
   - Color coding: fills en verde/rojo, errores en naranja, info en gris
   - Auto-scroll al último evento

4. Integrar todo en `GridPage.tsx`:
   - Layout: izquierda el gráfico con overlay de niveles, derecha el panel del bot
   - Abajo: tabla de preview / órdenes
   - Cuando el bot está activo, reemplazar el form de config con el panel de estado

**Criterio de aceptación:**
- El panel muestra el estado del bot en tiempo real
- Los fills aparecen instantáneamente en el event log
- El PnL se actualiza en tiempo real
- Se puede detener el bot y las órdenes se cancelan en Hyperliquid

---

## Fase 2.5 — Historial de operaciones

**Qué hacer:**
1. `routers/history.py`:
   - Endpoint de fills paginado con filtros (ver contratos API)
   - Endpoint de resumen

2. `HistoryPage.tsx`:
   - Tabla paginada con todas las operaciones
   - Columnas: Fecha, Par, Lado, Precio, Cantidad, Comisión, PnL
   - Filtros: rango de fechas, par, lado (buy/sell/todos)
   - Fila de totales: suma de comisiones, PnL total
   - Selector de sesión (para ver historial de una sesión específica o todas)
   - Exportar a CSV (botón)

**Criterio de aceptación:**
- Se ven todas las operaciones ejecutadas paginadas
- Los filtros funcionan
- Los totales se calculan correctamente
- La exportación a CSV funciona

---

# ═══════════════════════════════════════════════════════════
# FASE 3: BACKTESTING
# Objetivo: Simular el bot sobre datos históricos y evaluar resultados
# ═══════════════════════════════════════════════════════════

## Fase 3.1 — Motor de backtesting (backend)

**Qué hacer:**
1. `services/backtest_engine.py`:

   El backtesting simula la ejecución del grid bot sobre datos históricos de velas.

   **Algoritmo:**
   ```
   Input: configuración de grilla + rango de fechas + timeframe de simulación

   1. Cargar velas históricas del período (usar candle_service con cache)
   2. Calcular los niveles de la grilla según la configuración
   3. Inicializar estado:
      - capital = capital_usdc
      - posicion = 0
      - ordenes_abiertas = []
      - pnl_realizado = 0
      - equity_curve = []

   4. Determinar precio inicial (open de la primera vela)
   5. Colocar órdenes iniciales:
      - BUY en niveles por debajo del precio inicial
      - SELL en niveles por encima del precio inicial

   6. Para cada vela del período:
      a. Obtener high y low de la vela
      b. Para cada orden abierta:
         - Si es BUY y low <= precio_orden → fill de compra
           - Actualizar posición, calcular comisión
           - Colocar nueva orden SELL un nivel arriba
         - Si es SELL y high >= precio_orden → fill de venta
           - Actualizar posición, calcular PnL y comisión
           - Colocar nueva orden BUY un nivel abajo
      c. Calcular PnL no realizado con el precio de cierre
      d. Verificar si precio de liquidación fue alcanzado:
         - Si low <= precio_liq (para longs) → LIQUIDACIÓN
         - Registrar el evento y terminar
      e. Registrar punto en equity_curve
      f. Emitir progreso via WebSocket (cada 5%)

   7. Calcular métricas finales:
      - PnL total (realizado + no realizado al cierre)
      - Max drawdown (mayor caída desde un pico en la equity curve)
      - Sharpe ratio (si hay suficientes datos)
      - Win rate, total trades, etc.

   8. Guardar resultados en backtest_runs y trades en backtest_trades
   ```

   **Consideraciones:**
   - El backtest se ejecuta en un background task (asyncio) para no bloquear
   - Emitir progreso via WebSocket para que el frontend muestre barra de progreso
   - Para un año de velas de 1h = ~8,760 velas, el backtest debe completarse en <30 segundos
   - Manejar el caso de que no haya suficientes datos históricos (error claro)
   - Las comisiones se aplican iguales que en real: 0.01% maker, 0.035% taker

   **Cálculo del precio de liquidación dinámico:**
   - A medida que la simulación avanza, la posición cambia
   - El precio de liquidación se recalcula en cada fill basándose en:
     - Precio promedio de entrada actual
     - Apalancamiento
     - Margen de mantenimiento (0.5%)

2. `routers/backtest.py`:
   - `POST /api/backtest/run` → inicia backtest como background task, devuelve ID
   - `GET /api/backtest/status/:id` → estado y progreso
   - `GET /api/backtest/results/:id` → resultados completos
   - `GET /api/backtest/list` → lista de backtests ejecutados
   - `DELETE /api/backtest/:id` → elimina un backtest y sus trades

**Criterio de aceptación:**
- Se puede lanzar un backtest sobre un período histórico
- El backtest usa datos reales de Hyperliquid (via cache de velas)
- El progreso se reporta en tiempo real
- Los resultados incluyen todas las métricas especificadas
- Un backtest de 1 año con velas de 1h completa en <30 segundos
- La liquidación se detecta correctamente

---

## Fase 3.2 — Interfaz de backtesting (frontend)

**Qué hacer:**
1. `BacktestPage.tsx` — layout con dos secciones:
   - Panel de configuración (izquierda o arriba)
   - Panel de resultados (derecha o abajo)

2. `components/Backtest/BacktestConfig.tsx`:
   - Reusar los mismos campos del formulario de grilla (par, precios, niveles, etc.)
   - Campos adicionales:
     - Fecha inicio (date picker)
     - Fecha fin (date picker)
     - Timeframe de simulación (1h recomendado, opciones: 15m, 1h, 4h)
   - Preset de períodos rápidos: "Último mes", "Últimos 3 meses", "Últimos 6 meses", "Todo 2025", "Todo 2024"
   - Botón "Ejecutar backtest"
   - Barra de progreso durante la ejecución

3. `components/Backtest/BacktestResults.tsx`:
   - **Tarjetas de métricas** (grid 2x3):
     - PnL Total ($) con color verde/rojo
     - PnL (%) con color
     - Total trades
     - Win rate (%)
     - Max Drawdown ($ y %)
     - Comisiones totales
   - **Gráfico de equity curve** (usar lightweight-charts lineSeries):
     - Eje X: tiempo
     - Eje Y: capital
     - Línea verde si termina en profit, roja si en loss
     - Línea punteada horizontal en el capital inicial
   - **Gráfico de velas con trades superpuestos**:
     - Las velas del período del backtest
     - Triángulos verdes (▲) para compras, rojos (▼) para ventas
     - Overlay de los niveles de la grilla
     - Línea roja de liquidación
   - **Tabla de trades** (colapsable):
     - Todas las operaciones del backtest
     - Columnas: #, Fecha, Lado, Precio, Cantidad, Comisión, PnL, Capital acumulado
   - **Resumen textual**:
     - "Con esta configuración, entre [fecha_inicio] y [fecha_fin], el bot habría..."
     - Resultado: "GANADO $X (+Y%)" o "PERDIDO $X (-Y%)" o "FUE LIQUIDADO el [fecha]"
   - Si fue liquidado: banner rojo prominente con la fecha y precio de liquidación

4. `components/Backtest/BacktestHistory.tsx`:
   - Lista de backtests anteriores ejecutados
   - Columnas: Fecha, Par, Config resumen, PnL, Estado
   - Click para ver resultados detallados
   - Botón eliminar

**Criterio de aceptación:**
- Se puede configurar y ejecutar un backtest desde la UI
- La barra de progreso funciona en tiempo real
- Los resultados se muestran con todos los gráficos y métricas
- Se puede comparar visualmente el resultado en el gráfico de velas
- El historial de backtests anteriores se muestra correctamente

---

# ═══════════════════════════════════════════════════════════
# FASE 4: TESTING EN VIVO (TESTNET)
# Objetivo: Ejecutar el bot en testnet, monitorear, evaluar
# ═══════════════════════════════════════════════════════════

## Fase 4.1 — Evaluación de sesión en vivo

**Qué hacer:**
1. Añadir al panel de estado del bot (`BotPanel`):
   - Timer de tiempo activo (cuánto lleva corriendo la sesión)
   - Gráfico de equity curve en tiempo real (se actualiza con cada fill)
   - Métricas acumuladas en tiempo real:
     - PnL realizado
     - PnL no realizado
     - PnL total (realizado + no realizado)
     - Número de ciclos completados
     - Comisiones acumuladas
     - ROI actual vs capital inicial

2. Comparación backtest vs realidad:
   - Si hay un backtest guardado con la misma configuración y período:
     - Mostrar PnL del backtest al lado del PnL real
     - Mostrar diferencia ("Backtest: +$45, Real: +$38, Diferencia: -$7")

3. Sesión de evaluación post-ejecución:
   - Cuando se detiene el bot, generar un "reporte de sesión":
     - Duración total
     - PnL neto (realizado - comisiones)
     - Trades ejecutados, win rate
     - Max drawdown durante la sesión
     - Equity curve completa
   - Guardar en la BD como parte de `bot_sessions`
   - Visible en `HistoryPage` con un tab "Sesiones"

**Criterio de aceptación:**
- El bot corre en testnet de Hyperliquid con dinero de prueba
- Las métricas se acumulan y se muestran en tiempo real
- Al detener el bot, se genera un reporte de sesión
- Se puede comparar con el backtest equivalente

---

## Fase 4.2 — Hardening y pulido final

**Qué hacer:**
1. **Manejo de errores robusto:**
   - Si Hyperliquid devuelve error al colocar orden → retry con backoff, max 3 intentos
   - Si WebSocket de Hyperliquid se cae → reconexión automática, sincronizar fills perdidos
   - Si el backend se reinicia mientras el bot está activo → al iniciar, detectar sesiones activas, re-suscribir a fills, sincronizar estado
   - Si el precio sale del rango de la grilla → pausar bot, notificar usuario (no cancelar órdenes)
   - Si el usuario pierde conexión al frontend → el bot sigue operando en el backend, el frontend se reconecta y sincroniza

2. **Logging:**
   - Usar `logging` estándar de Python
   - Logs estructurados con nivel: DEBUG para desarrollo, INFO para producción
   - Log de cada orden colocada/cancelada/ejecutada
   - Log de errores con traceback
   - **NUNCA** loggear la private key ni la master password
   - Rotación de logs en Docker (configurar en docker-compose)

3. **Validaciones:**
   - Validar que el capital por nivel cumple con el mínimo de Hyperliquid
   - Validar que el apalancamiento solicitado está disponible para el par
   - Validar que el tick size del par es compatible con el espaciado de la grilla
   - Validar que la wallet tiene suficiente balance antes de iniciar

4. **UI final:**
   - Tooltip de ayuda en cada campo del formulario de grilla
   - Modal de confirmación antes de iniciar bot en mainnet (DOBLE confirmación)
   - Indicador de conexión WebSocket en el header (●verde = conectado, ●rojo = desconectado)
   - Favicon y título de la página con nombre del bot
   - Notificación toast para eventos importantes (fill, error, etc.)

5. **Docker producción:**
   - Actualizar `docker-compose.yml` con restart policies
   - Healthchecks para todos los servicios
   - Variables de entorno con defaults seguros
   - Asegurar que el backend ejecuta migraciones al iniciar
   - Documentar comandos de backup de la BD

6. **README completo:**
   - Requisitos: Docker, PostgreSQL (para desarrollo), Node.js (para desarrollo)
   - Setup de desarrollo paso a paso
   - Setup de producción con Docker
   - Cómo obtener fondos de testnet de Hyperliquid
   - Cómo crear wallet dedicada para el bot
   - FAQ y troubleshooting

**Criterio de aceptación:**
- La app es robusta ante fallos de red y reconexiones
- Los logs son útiles para debugging sin exponer secretos
- Todas las validaciones previenen errores del usuario
- El Docker compose levanta la app completa de forma confiable
- El README permite a alguien (o al mismo usuario en el futuro) levantar la app desde cero

---

# ═══════════════════════════════════════════════════════════
# INFORMACIÓN DE REFERENCIA ADICIONAL
# ═══════════════════════════════════════════════════════════

## Pares de trading principales en Hyperliquid

Los pares más líquidos y recomendados para grid trading:
- **BTC** — Bitcoin, el más líquido, spreads mínimos
- **ETH** — Ethereum, segundo más líquido
- **SOL** — Solana, alta volatilidad (bueno para grillas)
- **BNB** — Binance Coin
- **DOGE** — Dogecoin, alta volatilidad
- **ARB** — Arbitrum
- **OP** — Optimism
- **AVAX** — Avalanche
- **MATIC** (o POL) — Polygon
- **LINK** — Chainlink
- **WIF**, **PEPE**, **BONK** — memecoins con alta volatilidad

La lista completa se obtiene del endpoint `meta` de Hyperliquid. El frontend debe mostrar los principales arriba y el resto en orden alfabético.

## Notas sobre el SDK de Hyperliquid

```python
# Instalación
pip install hyperliquid-python-sdk

# Import principal
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants

# URLs
constants.MAINNET_API_URL = "https://api.hyperliquid.xyz"
constants.TESTNET_API_URL = "https://api.hyperliquid-testnet.xyz"

# Info (no requiere auth)
info = Info(constants.TESTNET_API_URL, skip_ws=True)

# Exchange (requiere private key)
import eth_account
wallet = eth_account.Account.from_key("0xPRIVATE_KEY")
exchange = Exchange(wallet, constants.TESTNET_API_URL)

# Obtener meta info (pares, decimales, etc)
meta = info.meta()
# Devuelve: {"universe": [{"name": "BTC", "szDecimals": 5, ...}, ...]}

# Obtener precios
all_mids = info.all_mids()
# Devuelve: {"BTC": "95430.5", "ETH": "3200.1", ...}

# Obtener estado del usuario
user_state = info.user_state(wallet.address)
# Devuelve: {"marginSummary": {...}, "assetPositions": [...]}

# Colocar orden limit GTC (Good-til-Cancel)
result = exchange.order(
    coin="BTC",
    is_buy=True,
    sz=0.001,
    limit_px=95000.0,
    order_type={"limit": {"tpc": "Gtc"}}
)
# result: {"status": "ok", "response": {"type": "order", "data": {"statuses": [{"resting": {"oid": 123456}}]}}}

# Cancelar orden
exchange.cancel(coin="BTC", oid=123456)

# Setear apalancamiento
exchange.update_leverage(leverage=3, coin="BTC")
```

## Configuración recomendada para testnet

Para probar el bot, configuración sugerida:
- Par: BTC
- Precio min: precio actual - 5%
- Precio max: precio actual + 5%
- Niveles: 10
- Tipo: Geométrico
- Capital: $100 USDC (testnet)
- Apalancamiento: 3x
- Modo: Testnet

Para obtener fondos de testnet:
1. Ir a https://app.hyperliquid-testnet.xyz
2. Conectar wallet (MetaMask u otra)
3. Hay un faucet o se puede usar la funcionalidad de deposit simulado

## Orden de ejecución de las fases

```
FASE 1: Infraestructura + Charts
  1.1 Scaffolding           ← empezar aquí
  1.2 Base de datos
  1.3 Autenticación
  1.4 Layout y navegación
  1.5 Servicio de mercado
  1.6 Gráfico de velas       ← CHECKPOINT: web funcional con charts
  1.7 Docker setup

FASE 2: Configuración del Bot
  2.1 Motor de cálculo
  2.2 Private keys
  2.3 Order manager           ← CHECKPOINT: bot operando en testnet
  2.4 Panel de estado
  2.5 Historial

FASE 3: Backtesting
  3.1 Motor de backtest
  3.2 UI de backtest          ← CHECKPOINT: backtesting funcional

FASE 4: Testing en vivo
  4.1 Evaluación en vivo
  4.2 Hardening               ← CHECKPOINT: app completa y robusta
```

## Comandos de desarrollo rápido

```bash
# === Setup inicial ===
cd grid-bot

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Linux
# venv\Scripts\activate   # Windows
pip install -r requirements.txt
python scripts/init_db.py
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev

# === Docker (producción) ===
docker compose up --build -d
docker compose logs -f

# === Migraciones ===
cd backend
alembic revision --autogenerate -m "descripcion"
alembic upgrade head
```

---

**FIN DEL PLAN DE IMPLEMENTACIÓN**

Seguir las fases en orden. Cada sub-fase tiene un criterio de aceptación que debe cumplirse antes de avanzar. Si hay dudas sobre la API de Hyperliquid, consultar el documento `grid_bot_hyperliquid.md` y el SDK oficial en GitHub: https://github.com/hyperliquid-dex/hyperliquid-python-sdk
