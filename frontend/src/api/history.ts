import client from './client'

export const historyApi = {
  getFills: async (params: {
    session_id?: string
    lado?: string
    page?: number
    limit?: number
  } = {}) => {
    const { data } = await client.get('/history/fills', { params })
    return data
  },

  getSummary: async (session_id?: string) => {
    const { data } = await client.get('/history/summary', {
      params: session_id ? { session_id } : {},
    })
    return data
  },

  getSessions: async () => {
    const { data } = await client.get('/history/sessions')
    return data as Array<{
      id: string
      grid_config_id: string
      estado: string
      capital_inicial: number
      pnl_realizado: number
      modo: string
      started_at: string | null
      stopped_at: string | null
    }>
  },
}
