import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { UiLoading } from './ByLayout'
import { useAuthStore } from '../store/authStore'
import { invitePath, useReturnTo } from './returnTo'

/** Signed in: on to the page that sent the visitor to Sign in, or Today. A new account honours only an invite, else the guide. */
export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const from = useReturnTo()
  const newAccount = useAuthStore((s) => s.newAccount)
  if (isLoading) return <UiLoading />
  if (isAuthenticated && newAccount) {
    const invite = invitePath(from)
    return invite ? <Navigate to={invite} replace /> : <Navigate to="/guide" state={{ firstRun: true }} replace />
  }
  if (isAuthenticated) return <Navigate to={from ?? '/'} replace />
  return <Outlet />
}
