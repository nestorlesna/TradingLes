import client from './client'
import type { GridConfig } from '../types'

export interface GridCalcRequest {
  par: string
  precio_min: number
  precio_max: number
  cantidad_niveles: number
  tipo_espaciado: string
  capital_usdc: number
  apalancamiento: number
}

export interface GridCalcResponse {
  niveles: Array<{
    nivel: number
    precio: number
    tipo: 'buy' | 'sell'
    capital: number
    cantidad: number
    ganancia_bruta: number
    comision: number
    ganancia_neta: number
  }>
  precio_liquidacion: number
  ganancia_total_ciclo: number
  roi_por_ciclo: number
  capital_por_nivel: number
  advertencias: string[]
}

export const gridApi = {
  calculate: (body: GridCalcRequest) =>
    client.post<GridCalcResponse>('/grid/calculate', body).then(r => r.data),

  listConfigs: () =>
    client.get<GridConfig[]>('/grid/configs').then(r => r.data),

  getConfig: (id: string) =>
    client.get<GridConfig>(`/grid/configs/${id}`).then(r => r.data),

  createConfig: (body: Omit<GridConfig, 'id' | 'created_at' | 'updated_at'>) =>
    client.post<GridConfig>('/grid/configs', body).then(r => r.data),

  updateConfig: (id: string, body: Partial<GridConfig>) =>
    client.put<GridConfig>(`/grid/configs/${id}`, body).then(r => r.data),

  deleteConfig: (id: string) =>
    client.delete(`/grid/configs/${id}`),
}
