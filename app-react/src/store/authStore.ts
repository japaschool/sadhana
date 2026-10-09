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

export const USER_KEY = 'sadhana.user'

/** The last signed-in user, so the app opens offline without /api/user. */
function readUser(): UserInfo | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') } catch { return null }
}

interface AuthState {
  user: UserInfo | null
  token: string | null
  isLoading: boolean
  setAuth: (user: UserInfo) => void
  logout: () => void
  setLoading: (v: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => {
  const token = readToken()
  return {
    user: token ? readUser() : null,
    token,
    isLoading: true,
    setAuth: (user) => {
      writeToken(user.token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      set({ user, token: user.token })
    },
    logout: () => {
      writeToken(null)
      localStorage.removeItem(USER_KEY)
      set({ user: null, token: null })
    },
    setLoading: (isLoading) => set({ isLoading }),
  }
})
