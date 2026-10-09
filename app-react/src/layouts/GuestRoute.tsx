import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { UiLoading } from './ByLayout'

/** Signed in: on to the page that sent the visitor to Sign in (an invite link), or Today. */
export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const from = (useLocation().state as { from?: string } | null)?.from
  if (isLoading) return <UiLoading />
  if (isAuthenticated) return <Navigate to={from ?? '/'} replace />
  return <Outlet />
}
