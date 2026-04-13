import client from './client'

export interface WalletInfo {
  testnet: { configured: boolean; wallet_address: string | null }
  mainnet: { configured: boolean; wallet_address: string | null }
}

export const settingsApi = {
  getWalletInfo: async (): Promise<WalletInfo> => {
    const { data } = await client.get('/settings/wallet-info')
    return data
  },

  saveKey: async (payload: {
    mode: 'testnet' | 'mainnet'
    master_password: string
    private_key: string
    wallet_address: string
  }): Promise<{ ok: boolean; message: string }> => {
    const { data } = await client.post('/settings/keys', payload)
    return data
  },

  verifyPassword: async (mode: 'testnet' | 'mainnet', master_password: string): Promise<boolean> => {
    try {
      await client.post('/settings/verify-password', { mode, master_password })
      return true
    } catch {
      return false
    }
  },

  deleteKey: async (mode: 'testnet' | 'mainnet'): Promise<void> => {
    await client.delete(`/settings/keys/${mode}`)
  },
}
