import { create } from 'zustand'

interface PriceData {
  price: number
  prevPrice: number
  direction: 'up' | 'down' | 'neutral'
}

interface MarketState {
  selectedPair: string
  selectedTimeframe: string
  prices: Record<string, PriceData>
  isWsConnected: boolean
  hyperliquidStatus: 'connected' | 'reconnecting' | 'disconnected'

  setSelectedPair: (pair: string) => void
  setSelectedTimeframe: (tf: string) => void
  updatePrice: (par: string, price: number) => void
  setWsConnected: (v: boolean) => void
  setHyperliquidStatus: (s: 'connected' | 'reconnecting' | 'disconnected') => void
}

export const useMarketStore = create<MarketState>((set, get) => ({
  selectedPair: 'BTC',
  selectedTimeframe: '1h',
  prices: {},
  isWsConnected: false,
  hyperliquidStatus: 'disconnected',

  setSelectedPair: (pair) => set({ selectedPair: pair }),
  setSelectedTimeframe: (tf) => set({ selectedTimeframe: tf }),

  updatePrice: (par, price) => {
    const prev = get().prices[par]
    set((state) => ({
      prices: {
        ...state.prices,
        [par]: {
          price,
          prevPrice: prev?.price ?? price,
          direction: prev
            ? price > prev.price ? 'up' : price < prev.price ? 'down' : 'neutral'
            : 'neutral',
        },
      },
    }))
  },

  setWsConnected: (v) => set({ isWsConnected: v }),
  setHyperliquidStatus: (s) => set({ hyperliquidStatus: s }),
}))
