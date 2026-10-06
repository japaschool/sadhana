import axios from 'axios'

const TOKEN_KEY = 'yew.token'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Token ${token}` } : {}
}

/** A 401 means the session is gone: drop the token and go to the login page. */
export function handleUnauthorized() {
  localStorage.removeItem(TOKEN_KEY)
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
