# TradingLes — Grid Trading Bot para Hyperliquid

Bot de grid trading para futuros perpetuos en [Hyperliquid DEX](https://hyperliquid.xyz), con interfaz web local, gráficos de velas en tiempo real y sistema de backtesting.

## Stack

| Capa | Tecnologías |
|------|-------------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.x + asyncpg |
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, lightweight-charts |
| Base de datos | PostgreSQL |
| Exchange | Hyperliquid (SDK oficial, testnet/mainnet) |

---

## Requisitos previos

- Python 3.11+
- Node.js 20+
- PostgreSQL corriendo (local o Docker)

---

## Instalación y arranque

### 1. Variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con los valores reales (la DB ya está configurada por defecto para desarrollo local).

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
python -m alembic upgrade head    # Crea las tablas en la BD
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

Al abrir la app por primera vez aparece el formulario de **Crear cuenta** (ya que no hay usuarios). Crea tu usuario y contraseña — a partir de ese momento solo se muestra el formulario de login.

---

## Comandos útiles

```bash
# Backend — generar nueva migración de BD
cd backend && python -m alembic revision --autogenerate -m "descripcion"

# Backend — aplicar migraciones pendientes
cd backend && python -m alembic upgrade head

# Frontend — build de producción
cd frontend && npm run build

# Crear usuario desde CLI (si es necesario)
python scripts/create_user.py
```

---

## Estructura del proyecto

```
├── backend/
│   ├── main.py              # FastAPI app, WebSocket endpoint
│   ├── config.py            # Settings (pydantic-settings + .env)
│   ├── auth/                # JWT, login, bcrypt
│   ├── models/              # SQLAlchemy ORM (PostgreSQL)
│   ├── services/            # Lógica: Hyperliquid client, candles, WS relay
│   ├── routers/             # Endpoints REST por dominio
│   └── alembic/             # Migraciones de BD
├── frontend/
│   └── src/
│       ├── api/             # Axios client + módulos por dominio
│       ├── components/      # Chart, Layout, BotPanel, etc.
│       ├── pages/           # Rutas: Dashboard, Grid, History, Backtest, Settings
│       ├── store/           # Zustand: auth, market, bot, settings
│       ├── hooks/           # useWebSocket, useGridCalc, useAuth
│       └── types/           # Interfaces TypeScript compartidas
├── scripts/                 # Utilidades CLI
├── .env.example             # Plantilla de variables de entorno
└── PLAN_GRID_BOT_HYPERLIQUID.md  # Plan de implementación por fases
```

---

## Estado de implementación

- [x] **Fase 1** — Infraestructura, autenticación, gráficos en tiempo real
- [ ] **Fase 2** — Motor de grilla, configuración, control del bot
- [ ] **Fase 3** — Backtesting
- [ ] **Fase 4** — Historial avanzado y analytics

---

## Seguridad

- Las private keys se almacenan **siempre cifradas** con Fernet (derivado de contraseña maestra)
- La app arranca en modo **testnet** por defecto
- El archivo `.env` está en `.gitignore` — nunca se sube al repositorio
