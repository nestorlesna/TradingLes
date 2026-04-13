import client from './client'
import type { BotStatus } from '../types'

export const botApi = {
  getStatus: async (): Promise<BotStatus> => {
    const { data } = await client.get('/bot/status')
    return data
  },

  start: async (grid_config_id: string, master_password: string) => {
    const { data } = await client.post('/bot/start', { grid_config_id, master_password })
    return data
  },

  stop: async (session_id: string) => {
    const { data } = await client.post('/bot/stop', { session_id })
    return data
  },

  pause: async (session_id: string) => {
    const { data } = await client.post('/bot/pause', { session_id })
    return data
  },

  resume: async (session_id: string) => {
    const { data } = await client.post('/bot/resume', { session_id })
    return data
  },

  getSessions: async () => {
    const { data } = await client.get('/bot/sessions')
    return data
  },
}
