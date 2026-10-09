import axios from 'axios'
import { setOnline } from '../hooks/useNetworkStatus'
import { readToken, writeToken, USER_KEY } from '../store/authStore'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

export function authHeaders(): Record<string, string> {
  const token = readToken()
  return token ? { Authorization: `Token ${token}` } : {}
}

/** A 401 means the session is gone: drop the token and go to the login page. */
export function handleUnauthorized() {
  writeToken(null)
  localStorage.removeItem(USER_KEY)
  window.location.href = '/login'
}

apiClient.interceptors.request.use((config) => {
  Object.assign(config.headers, authHeaders())
  return config
})

apiClient.interceptors.response.use(
  (res) => { setOnline(true); return res },
  (error) => {
    // Any answer means the server is reachable; none (network error, timeout) means offline. A cancel says nothing.
    if (!axios.isCancel(error)) setOnline(!!error.response)
    // Signing in and changing the password answer 401 for a wrong password, not a lost session.
    const url = error.config?.url ?? ''
    if (error.response?.status === 401 && !url.includes('/users/login') && !url.includes('/user/password')) handleUnauthorized()
    return Promise.reject(error)
  }
)
