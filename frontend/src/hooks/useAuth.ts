import { create } from 'zustand'

interface AuthState {
  token: string | null
  refreshToken: string | null
  setTokens: (token: string, refresh: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>(set => ({
  token: localStorage.getItem('sonicai_access_token'),
  refreshToken: localStorage.getItem('sonicai_refresh_token'),
  setTokens: (token: string, refresh: string) => {
    localStorage.setItem('sonicai_access_token', token)
    localStorage.setItem('sonicai_refresh_token', refresh)
    set({ token, refreshToken: refresh })
  },
  logout: () => {
    localStorage.removeItem('sonicai_access_token')
    localStorage.removeItem('sonicai_refresh_token')
    set({ token: null, refreshToken: null })
  },
}))
