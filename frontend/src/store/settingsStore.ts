import { create } from 'zustand'

interface SettingsState {
  mode: 'testnet' | 'mainnet'
  testnetConfigured: boolean
  mainnetConfigured: boolean
  setMode: (m: 'testnet' | 'mainnet') => void
  setWalletStatus: (testnet: boolean, mainnet: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  mode: 'testnet',
  testnetConfigured: false,
  mainnetConfigured: false,
  setMode: (m) => set({ mode: m }),
  setWalletStatus: (testnet, mainnet) =>
    set({ testnetConfigured: testnet, mainnetConfigured: mainnet }),
}))
