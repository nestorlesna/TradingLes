import { create } from 'zustand'
import type { GridCalcResult } from '../utils/gridCalculations'

export interface GridFormValues {
  par: string
  precioMin: string
  precioMax: string
  cantidadNiveles: number
  tipoEspaciado: 'aritmetico' | 'geometrico'
  capitalUsdc: string
  apalancamiento: number
  modo: 'testnet' | 'mainnet'
  nombre: string
}

interface GridState {
  form: GridFormValues
  calcResult: GridCalcResult | null
  selectedConfigId: string | null
  setForm: (values: Partial<GridFormValues>) => void
  setCalcResult: (r: GridCalcResult | null) => void
  setSelectedConfigId: (id: string | null) => void
  resetForm: () => void
}

const DEFAULT_FORM: GridFormValues = {
  par: 'BTC',
  precioMin: '',
  precioMax: '',
  cantidadNiveles: 10,
  tipoEspaciado: 'geometrico',
  capitalUsdc: '',
  apalancamiento: 3,
  modo: 'testnet',
  nombre: '',
}

export const useGridStore = create<GridState>((set) => ({
  form: { ...DEFAULT_FORM },
  calcResult: null,
  selectedConfigId: null,

  setForm: (values) =>
    set((state) => ({ form: { ...state.form, ...values } })),

  setCalcResult: (r) => set({ calcResult: r }),
  setSelectedConfigId: (id) => set({ selectedConfigId: id }),

  resetForm: () => set({ form: { ...DEFAULT_FORM }, calcResult: null, selectedConfigId: null }),
}))
