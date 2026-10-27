import { authApi } from '../api/auth'
import { useAuthStore } from './authStore'

/** Opens on the saved user straight away and refreshes it in the background. Offline keeps the saved one;
 *  a bad token still logs out through the 401 interceptor. */
export async function hydrateAuth() {
  const { token, user, setLoading } = useAuthStore.getState()
  if (!token || user) setLoading(false)
  if (!token) return
  try {
    const fresh = await authApi.getUser()
    // Signed out (or into another account) while this was in flight: don't bring the old session back.
    if (useAuthStore.getState().token === token) useAuthStore.getState().setAuth(fresh)
  } catch {
    // offline or server down: keep the saved user
  } finally {
    setLoading(false)
  }
}
