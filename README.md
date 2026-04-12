# TradingLes — Grid Trading Bot para Hyperliquid

Bot de grid trading para futuros perpetuos en [Hyperliquid DEX](https://hyperliquid.xyz), con interfaz web local, gráficos de velas en tiempo real y sistema de backtesting.

## Stack

| Capa | Tecnologías |
|------|-------------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.x + asyncpg |
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, lightweight-charts v5 |
| Base de datos | PostgreSQL |
| Exchange | Hyperliquid (SDK oficial, testnet/mainnet) |

---

## Requisitos previos

- Python 3.11+
- Node.js 20+
- PostgreSQL corriendo

---

## Instalación y arranque

### 1. Variables de entorno

```bash
cp .env.example .env
```

El `.env` ya está configurado para la base de datos local. Revisar antes de arrancar.

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
python -m alembic upgrade head
uvicorn main:app --reload --port 8000
```

El backend queda disponible en `http://localhost:8000`.  
Documentación de la API: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`.

### 4. Primer uso

Al abrir la app por primera vez aparece el formulario de **Crear cuenta**. Crea tu usuario y contraseña — a partir de ese momento solo se muestra el formulario de login.

---

## Cómo funciona el caché de velas

Cada par+temporalidad se cachea de forma independiente en la tabla `candles`:

- **Primera vez** que abrís BTC 1h → fetch completo desde Hyperliquid (90 días) → guarda en BD
- **Segunda vez** → sirve directo desde BD sin consultar Hyperliquid
- **Al día siguiente** → solo trae las velas nuevas desde la última cacheada
- **Cambio de temporalidad** → mismo comportamiento, caché independiente por timeframe

---

## Comandos útiles

```bash
# Backend — generar nueva migración tras cambiar modelos
cd backend && python -m alembic revision --autogenerate -m "descripcion"

# Backend — aplicar migraciones pendientes
cd backend && python -m alembic upgrade head

# Frontend — build de producción + type check
cd frontend && npm run build

# Si el puerto 8000 está ocupado (proceso anterior colgado)
# Buscar el PID con: netstat -ano | findstr :8000
# Matar con: taskkill /PID <numero> /F
```

---

## Estructura del proyecto

```
├── backend/
│   ├── main.py              # FastAPI app, WebSocket endpoint /ws
│   ├── config.py            # Settings via pydantic-settings + .env
│   ├── auth/                # JWT, bcrypt, get_current_user dependency
│   ├── models/              # SQLAlchemy ORM — un archivo por tabla
│   ├── services/
│   │   ├── hyperliquid_client.py   # Wrapper HTTP sobre API de Hyperliquid
│   │   ├── candle_service.py       # Cache inteligente de velas OHLCV
│   │   ├── websocket_relay.py      # Relay WS Hyperliquid → frontend
│   │   ├── grid_engine.py          # (Fase 2) Cálculo de niveles de grilla
│   │   └── order_manager.py        # (Fase 2) Órdenes en Hyperliquid
│   ├── routers/             # Endpoints REST por dominio
│   └── alembic/             # Migraciones de BD
├── frontend/
│   └── src/
│       ├── api/             # Axios client + módulos por dominio
│       ├── components/      # Chart, Layout, GridConfig, BotPanel...
│       ├── pages/           # Dashboard, Grid, History, Backtest, Settings
│       ├── store/           # Zustand: auth, market, bot, settings
│       ├── hooks/           # useWebSocket (conexión global con reconexión)
│       └── types/           # Interfaces TypeScript compartidas
├── scripts/                 # Utilidades CLI
├── .env.example             # Plantilla de variables de entorno
└── PLAN_GRID_BOT_HYPERLIQUID.md  # Plan de implementación por fases
```

---

## Estado de implementación

- [x] **Fase 1** — Infraestructura completa: auth, gráficos en tiempo real, caché de velas
- [x] **Fase 2.1** — Motor de grilla, formulario con cálculos en tiempo real, overlay en gráfico
- [ ] **Fase 2.2** — Gestión de private keys (Fernet)
- [ ] **Fase 2.3** — Control del bot (start/stop/pause/resume)
- [ ] **Fase 3** — Backtesting sobre datos históricos
- [ ] **Fase 4** — Historial avanzado y analytics

---

## Seguridad

- Las private keys se almacenan **siempre cifradas** con Fernet (PBKDF2 desde contraseña maestra)
- La contraseña maestra **nunca se guarda** — se ingresa cada vez que se inicia el bot
- La app arranca en modo **testnet** por defecto
- `.env` está en `.gitignore`
