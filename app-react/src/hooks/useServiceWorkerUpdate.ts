import { create } from 'zustand'

/** A new release's worker, installed and waiting for SKIP_WAITING. */
export const useSwStore = create<{ waiting: ServiceWorker | null }>(() => ({ waiting: null }))

export function applyUpdate() {
  useSwStore.getState().waiting?.postMessage({ type: 'SKIP_WAITING' })
}

/** Once, after registering. `hadController`: the page was already controlled when it loaded, so a
 *  takeover is an update (reload); a first install isn't. */
export function startUpdateWatch(reg: ServiceWorkerRegistration, hadController: boolean) {
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) window.location.reload() })
  const track = () => useSwStore.setState({ waiting: reg.waiting })
  const watch = (w: ServiceWorker | null) => w?.addEventListener('statechange', track)
  track()
  watch(reg.installing) // already installing: its updatefound fired before we listened
  reg.addEventListener('updatefound', () => watch(reg.installing))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reg.update().catch(() => {})
    // A reload doesn't activate a waiting worker, so a tab that is never closed would stay on the old
    // release forever. Going to the background is the moment nobody is looking; the outbox is in the worker.
    else applyUpdate()
  })
}

export function useServiceWorkerUpdate(): { updateReady: boolean; applyUpdate: () => void } {
  const waiting = useSwStore((s) => s.waiting)
  return { updateReady: !!waiting, applyUpdate }
}
