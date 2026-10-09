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

/** The last signed-in user, so the app opens offline without /api/user. Only if it belongs to the current token:
 *  the Rust UI shares localStorage and rewrites just the token when another account signs in. */
function readUser(token: string): UserInfo | null {
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null')
    return user && typeof user === 'object' && user.token === token ? user : null
  } catch { return null }
}

interface AuthState {
  user: UserInfo | null
  token: string | null
  isLoading: boolean
  setAuth: (user: UserInfo) => void
  logout: () => void
  setLoading: (v: boolean) => void
}

/** Signed in, signed out or another user: the cached data isn't this account's. /api/user mints a new token on every
 *  call, so a new token for the same user is not a change. */
export const accountChanged = (s: Pick<AuthState, 'user' | 'token'>, prev: Pick<AuthState, 'user' | 'token'>) =>
  !!s.token !== !!prev.token || (!!s.user && !!prev.user && s.user.id !== prev.user.id)

export const useAuthStore = create<AuthState>((set) => {
  const token = readToken()
  return {
    user: token ? readUser(token) : null,
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
