import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { UiLoading } from './ByLayout'
import { useReturnTo } from './returnTo'

/** Signed in: on to the page that sent the visitor to Sign in (an invite link), or Today. */
export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const from = useReturnTo()
  if (isLoading) return <UiLoading />
  if (isAuthenticated) return <Navigate to={from ?? '/'} replace />
  return <Outlet />
}
