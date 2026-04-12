import client from './client'
import type { Candle } from '../types'

export const marketApi = {
  getPairs: () => client.get<string[]>('/market/pairs').then(r => r.data),
  getCandles: (par: string, timeframe: string, start?: number, end?: number) => {
    const params: Record<string, string | number> = { par, timeframe }
    if (start) params.start = start
    if (end) params.end = end
    return client.get<Candle[]>('/market/candles', { params }).then(r => r.data)
  },
  getPrice: (par: string) =>
    client.get<{ par: string; price: number; timestamp: number }>(`/market/price/${par}`).then(r => r.data),
}
