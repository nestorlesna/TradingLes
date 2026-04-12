import { create } from 'zustand'
import type { BotStatus, BotEvent } from '../types'

interface BotState {
  status: BotStatus
  events: BotEvent[]
  updateStatus: (s: Partial<BotStatus>) => void
  addEvent: (e: BotEvent) => void
}

export const useBotStore = create<BotState>((set) => ({
  status: { session_id: null, estado: 'detenido' },
  events: [],

  updateStatus: (s) =>
    set((state) => ({ status: { ...state.status, ...s } })),

  addEvent: (e) =>
    set((state) => ({ events: [e, ...state.events].slice(0, 100) })),
}))
