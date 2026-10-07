import axios from 'axios'
import { readToken, writeToken } from '../store/authStore'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

export function authHeaders(): Record<string, string> {
  const token = readToken()
  return token ? { Authorization: `Token ${token}` } : {}
}

/** A 401 means the session is gone: drop the token and go to the login page. */
export function handleUnauthorized() {
  writeToken(null)
  window.location.href = '/login'
}

apiClient.interceptors.request.use((config) => {
  Object.assign(config.headers, authHeaders())
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/users/login')) handleUnauthorized()
    return Promise.reject(error)
  }
)
