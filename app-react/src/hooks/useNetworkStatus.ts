import { create } from 'zustand'

interface NetState { online: boolean; pending: number }

/** Online/offline from real requests (the worker's and axios'), and how many diary values wait in the worker's outbox. */
export const useNetStore = create<NetState>(() => ({ online: navigator.onLine, pending: 0 }))

export const setOnline = (online: boolean) => useNetStore.setState({ online })

/** Asks the worker to resend its outbox; it answers with a NET message. */
export function flushOutbox() {
  navigator.serviceWorker?.controller?.postMessage({ type: 'FLUSH' })
}

/** Once, at startup. */
export function startNetworkWatch() {
  const sw = navigator.serviceWorker
  sw?.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'NET') useNetStore.setState({ online: e.data.online, pending: e.data.pending })
  })
  sw?.startMessages()
  window.addEventListener('offline', () => setOnline(false))
  window.addEventListener('online', flushOutbox)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flushOutbox() })
  flushOutbox()
}

export default function useNetworkStatus(): NetState {
  return useNetStore()
}
