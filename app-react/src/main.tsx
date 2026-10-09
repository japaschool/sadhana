import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { CACHE_MAX_AGE, CACHE_VERSION, persister, shouldPersist } from './api/persister'
import './i18n'
import './index.css'
import { router } from './router'
import { readToken, useAuthStore } from './store/authStore'
import { startNetworkWatch } from './hooks/useNetworkStatus'
import { startUpdateWatch } from './hooks/useServiceWorkerUpdate'
import { hydrateAuth } from './store/hydrateAuth'
import { applyThemePref } from './ui/theme'
import { UiLoading } from './layouts/ByLayout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Never collect from memory: a collected query is also dropped from the next save. CACHE_MAX_AGE would overflow
      // setTimeout (max 2^31-1 ms) and collect at once; restore is still bounded by the persister's maxAge.
      gcTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
    // Send writes even when the browser says offline: the worker queues diary entries; other writes fail as usual.
    mutations: { networkMode: 'always' },
  },
})

// A different user (or none) must not see the last one's cached practices and diary, in memory or on disk.
useAuthStore.subscribe((s, prev) => {
  if (s.token !== prev.token) { queryClient.clear(); void persister.removeClient() }
})

// A token with no matching saved user means another account signed in (e.g. via the Rust UI): drop the old cache
// before the provider restores it.
if (readToken() && !useAuthStore.getState().user) void persister.removeClient()

applyThemePref()

// The app's worker: shell cache, diary outbox, takeover from the Rust UI (public/service_worker.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  void navigator.serviceWorker.register('/service_worker.js', { updateViaCache: 'none' })
    .then((reg) => startUpdateWatch(reg, hadController))
}

startNetworkWatch()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{
      persister,
      maxAge: CACHE_MAX_AGE,
      buster: CACHE_VERSION,
      dehydrateOptions: { shouldDehydrateQuery: shouldPersist, shouldDehydrateMutation: () => false },
    }}>
      <Suspense fallback={<UiLoading />}><RouterProvider router={router} /></Suspense>
    </PersistQueryClientProvider>
  </React.StrictMode>
)
void hydrateAuth()
