import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './i18n'
import './index.css'
import { router } from './router'
import { useAuthStore } from './store/authStore'
import { Spinner } from './components/ui/Spinner'
import { authApi } from './api/auth'
import { applyThemePref } from './ui/theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
  },
})

async function hydrateAuth() {
  const { setAuth, setLoading, token } = useAuthStore.getState()
  if (!token) { setLoading(false); return }
  try {
    const user = await authApi.getUser()
    setAuth(user)
  } catch {
    // token invalid — logout happens via 401 interceptor
  } finally {
    setLoading(false)
  }
}

applyThemePref()

// Replaces the Rust UI's worker on installed apps (see public/service_worker.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/service_worker.js', { updateViaCache: 'none' })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<Spinner />}><RouterProvider router={router} /></Suspense>
    </QueryClientProvider>
  </React.StrictMode>
)
hydrateAuth()
