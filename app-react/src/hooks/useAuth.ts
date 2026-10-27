import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, token, isLoading, logout } = useAuthStore()
  return { user, token, isLoading, isAuthenticated: !!token, logout }
}
