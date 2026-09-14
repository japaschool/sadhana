import { create } from 'zustand'
import type { UserInfo } from '../types/api'

export const TOKEN_KEY = 'yew.token'

interface AuthState {
  user: UserInfo | null
  token: string | null
  isLoading: boolean
  setAuth: (user: UserInfo) => void
  logout: () => void
  setLoading: (v: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isLoading: true,
  setAuth: (user) => {
    localStorage.setItem(TOKEN_KEY, user.token)
    set({ user, token: user.token })
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ user: null, token: null })
  },
  setLoading: (isLoading) => set({ isLoading }),
}))
