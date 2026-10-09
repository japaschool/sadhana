import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { UiLoading } from './ByLayout'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const { pathname, search } = useLocation()
  if (isLoading) return <UiLoading />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: pathname + search }} replace />
  return <Outlet />
}
