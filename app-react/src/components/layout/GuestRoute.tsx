import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Spinner } from '../ui/Spinner'
import { AuthBackground } from './AuthBackground'

export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (isAuthenticated) return <Navigate to="/" replace />
  return (
    <>
      <AuthBackground />
      <Outlet />
    </>
  )
}
