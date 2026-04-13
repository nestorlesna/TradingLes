# TradingLes — Grid Trading Bot para Hyperliquid

Bot de grid trading para futuros perpetuos en [Hyperliquid DEX](https://hyperliquid.xyz), con interfaz web local, gráficos de velas en tiempo real, backtesting sobre datos históricos y gestión segura de claves privadas.

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
- PostgreSQL corriendo en `localhost:15434`

---

## Instalación y arranque

### 1. Variables de entorno

```bash
cp .env.example .env
```

El `.env` ya está configurado para la base de datos local. Verificar antes de arrancar.

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

Al abrir la app por primera vez aparece el formulario de **Crear cuenta**. Creá tu usuario y contraseña — a partir de ese momento solo se muestra el formulario de login.

---

## Funcionalidades

### Dashboard
- Gráfico de velas en tiempo real (lightweight-charts v5)
- Selector de par y timeframe
- Precios actualizados vía WebSocket desde Hyperliquid

### Grid Trading
- Calculadora de grilla (aritmética o geométrica) con preview instantáneo
- Overlay de niveles sobre el gráfico
- Tabla detallada de niveles con ganancia neta por ciclo, comisiones y capital por nivel
- Guardado/carga/eliminación de configuraciones
- Panel de control del bot: iniciar, pausar, reanudar, detener
- Órdenes abiertas y log de eventos en tiempo real

### Ajustes (Claves privadas)
- Configuración de wallet para testnet y mainnet
- La private key se cifra con **Fernet (AES-128 + HMAC)** derivado via **PBKDF2 (480k iteraciones)**
- La contraseña maestra **nunca se guarda** — se ingresa cada vez que se inicia el bot
- El salt Fernet se persiste en la DB, no en el código

### Backtesting
- Simulación sobre datos históricos reales de Hyperliquid (cacheados en la DB)
- Configuración completa de grilla + rango de fechas + timeframe de simulación
- Presets de período (1 mes, 3 meses, 6 meses, 1 año)
- Métricas: PnL, ROI, win rate, max drawdown, Sharpe ratio, comisiones, liquidación
- Curva de equity en canvas
- Tabla detallada de trades
- Historial de backtests anteriores con resultados guardados

### Historial
- Tabla paginada de todas las operaciones ejecutadas
- Filtros por sesión y por lado (buy/sell)
- Resumen: PnL realizado, comisiones totales, PnL neto
- Vista de sesiones del bot
- Exportar a CSV

---

## Cómo funciona el caché de velas

Cada par + temporalidad se cachea de forma independiente en la tabla `candles`:

- **Primera vez** que abrís BTC 1h → fetch completo desde Hyperliquid (90 días) → guarda en BD
- **Segunda vez** → sirve directo desde BD sin consultar Hyperliquid
- **Al día siguiente** → solo trae las velas nuevas desde la última cacheada
- **Cambio de temporalidad** → mismo comportamiento, caché independiente por timeframe

El backtesting también usa este caché — al ejecutar un backtest el sistema pre-fetchea las velas si aún no están cacheadas.

---

## Seguridad

- Las private keys se almacenan **siempre cifradas** con Fernet (PBKDF2 desde contraseña maestra, 480.000 iteraciones)
- La contraseña maestra **nunca se guarda** — se ingresa cada vez que se inicia el bot
- La app arranca en modo **testnet** por defecto
- `.env` está en `.gitignore`
- Usá una **wallet dedicada exclusivamente al bot**, nunca tu wallet principal

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
│   ├── main.py                    # FastAPI app, WebSocket endpoint /ws
│   ├── config.py                  # Settings via pydantic-settings + .env
│   ├── auth/                      # JWT, bcrypt, get_current_user dependency
│   ├── models/                    # SQLAlchemy ORM — un archivo por tabla
│   │   └── database.py            # Engine + get_db() + AsyncSessionLocal
│   ├── services/
│   │   ├── hyperliquid_client.py  # Wrapper HTTP sobre API de Hyperliquid
│   │   ├── candle_service.py      # Cache inteligente de velas OHLCV
│   │   ├── websocket_relay.py     # Relay WS Hyperliquid → frontend
│   │   ├── grid_engine.py         # Cálculo de niveles de grilla
│   │   ├── crypto.py              # PBKDF2 + Fernet para private keys
│   │   ├── order_manager.py       # Órdenes en Hyperliquid + fill monitoring
│   │   └── backtest_engine.py     # Simulación de grilla sobre velas históricas
│   ├── routers/                   # Endpoints REST por dominio
│   └── alembic/                   # Migraciones de BD
├── frontend/
│   └── src/
│       ├── api/                   # Axios client + módulos por dominio
│       ├── components/            # Chart, Layout, GridConfig, BotPanel
│       ├── pages/                 # Dashboard, Grid, History, Backtest, Settings
│       ├── store/                 # Zustand: auth, market, grid, bot, settings
│       ├── hooks/                 # useWebSocket, useGridCalc
│       ├── utils/                 # gridCalculations (mirror del motor backend)
│       └── types/                 # Interfaces TypeScript compartidas
├── .env.example
└── PLAN_GRID_BOT_HYPERLIQUID.md   # Plan de implementación original
```

---

## Estado de implementación

- [x] **Fase 1** — Infraestructura completa: auth, gráficos en tiempo real, caché de velas
- [x] **Fase 2.1** — Motor de grilla, formulario con cálculos en tiempo real, overlay en gráfico
- [x] **Fase 2.2** — Gestión de claves privadas (Fernet + PBKDF2)
- [x] **Fase 2.3** — Control del bot (start/stop/pause/resume), órdenes en Hyperliquid, monitoreo de fills
- [x] **Fase 3** — Backtesting sobre datos históricos con métricas completas
- [x] **Fase 4** — Historial de operaciones y sesiones con export CSV
