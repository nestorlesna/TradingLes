export interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface GridConfig {
  id: string
  nombre: string
  par: string
  precio_min: number
  precio_max: number
  cantidad_niveles: number
  tipo_espaciado: 'aritmetico' | 'geometrico'
  capital_usdc: number
  apalancamiento: number
  modo: 'testnet' | 'mainnet'
  es_favorita: boolean
  created_at: string
  updated_at: string
}

export interface GridLevel {
  nivel: number
  precio: number
  tipo: 'buy' | 'sell'
  capital: number
  cantidad: number
  ganancia_bruta: number
  comision: number
  ganancia_neta: number
}

export interface GridCalculation {
  niveles: GridLevel[]
  precio_liquidacion: number
  ganancia_total_ciclo: number
  advertencias: string[]
}

export interface BotOrder {
  id: string
  precio: number
  lado: 'buy' | 'sell'
  cantidad: number
  nivel: number
  estado: string
}

export interface BotStatus {
  session_id: string | null
  estado: 'activo' | 'pausado' | 'detenido'
  precio_actual?: number
  posicion?: { size: number; avg_entry: number }
  pnl_realizado?: number
  pnl_no_realizado?: number
  margen_usado?: number
  margen_disponible?: number
  precio_liquidacion?: number
  ordenes_abiertas?: BotOrder[]
  eventos_recientes?: BotEvent[]
}

export interface BotEvent {
  tipo: string
  mensaje: string
  timestamp: string
}

export interface Fill {
  id: string
  timestamp: string
  par: string
  lado: 'buy' | 'sell'
  precio: number
  cantidad: number
  comision: number
  pnl: number
}

export interface BacktestResult {
  id: string
  estado: 'pendiente' | 'ejecutando' | 'completado' | 'error'
  config: Partial<GridConfig>
  resultados?: {
    pnl_total: number
    pnl_porcentaje: number
    total_trades: number
    trades_ganadores: number
    trades_perdedores: number
    max_drawdown: number
    max_drawdown_porcentaje: number
    sharpe_ratio: number
    comisiones_totales: number
    fue_liquidado: boolean
    capital_final: number
    duracion_segundos: number
  }
  equity_curve?: Array<{ timestamp: string; capital: number }>
  trades?: Array<{
    timestamp: string
    lado: string
    precio: number
    cantidad: number
    pnl: number
    nivel_grilla: number
  }>
}

export type WsMessage =
  | { type: 'price_update'; par: string; price: number; timestamp: number }
  | { type: 'candle_update'; par: string; timeframe: string; candle: Candle }
  | { type: 'fill_event'; order_id: string; precio: number; lado: string; cantidad: number; comision: number; pnl: number; nivel: number }
  | { type: 'bot_state'; estado: string; pnl_realizado: number; pnl_no_realizado: number; precio_liquidacion: number; posicion: object }
  | { type: 'order_update'; orders: BotOrder[] }
  | { type: 'connection_status'; hyperliquid: 'connected' | 'reconnecting' | 'disconnected' }
  | { type: 'error'; message: string; severity: 'warning' | 'error' }
  | { type: 'backtest_progress'; backtest_id: string; progreso: number }
  | { type: 'pong' }
