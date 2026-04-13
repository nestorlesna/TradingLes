import client from './client'

export interface BacktestRunRequest {
  par: string
  precio_min: number
  precio_max: number
  cantidad_niveles: number
  tipo_espaciado: string
  capital_usdc: number
  apalancamiento: number
  fecha_inicio: string  // ISO datetime
  fecha_fin: string
  timeframe_simulacion: string
}

export const backtestApi = {
  run: async (req: BacktestRunRequest) => {
    const { data } = await client.post('/backtest/run', req)
    return data as { backtest_id: string; estado: string }
  },

  getStatus: async (id: string) => {
    const { data } = await client.get(`/backtest/status/${id}`)
    return data
  },

  getResults: async (id: string) => {
    const { data } = await client.get(`/backtest/results/${id}`)
    return data
  },

  list: async (page = 1, limit = 20) => {
    const { data } = await client.get('/backtest/list', { params: { page, limit } })
    return data
  },

  delete: async (id: string) => {
    await client.delete(`/backtest/${id}`)
  },
}
