import { create } from 'zustand'
import type { UserInfo } from '../types/api'

export const TOKEN_KEY = 'yew.token'

// The Rust UI (gloo storage) keeps the token JSON-encoded, with quotes. Read both
// forms and write the JSON one, so a session survives switching between the two UIs.
export function readToken(): string | null {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return raw }
}

export function writeToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  else localStorage.removeItem(TOKEN_KEY)
}

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
  token: readToken(),
  isLoading: true,
  setAuth: (user) => {
    writeToken(user.token)
    set({ user, token: user.token })
  },
  logout: () => {
    writeToken(null)
    set({ user: null, token: null })
  },
  setLoading: (isLoading) => set({ isLoading }),
}))
