import { create } from 'zustand'

interface AuthState {
  token: string | null
  username: string | null
  isAuthenticated: boolean
  setAuth: (token: string, username: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('tradingles_token'),
  username: localStorage.getItem('tradingles_username'),
  isAuthenticated: !!localStorage.getItem('tradingles_token'),

  setAuth: (token, username) => {
    localStorage.setItem('tradingles_token', token)
    localStorage.setItem('tradingles_username', username)
    set({ token, username, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('tradingles_token')
    localStorage.removeItem('tradingles_username')
    set({ token: null, username: null, isAuthenticated: false })
  },
}))
