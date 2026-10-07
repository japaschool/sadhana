import { useState, useEffect } from 'react'

export function useServiceWorkerUpdate(): { updateReady: boolean; applyUpdate: () => void } {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return
    // A new release's worker takes control (skipWaiting + claim). The first install
    // on a fresh client also fires this, but that isn't an update.
    const hadController = !!sw.controller
    const handler = () => { if (hadController) setUpdateReady(true) }
    sw.addEventListener('controllerchange', handler)
    return () => sw.removeEventListener('controllerchange', handler)
  }, [])

  return {
    updateReady,
    applyUpdate: () => window.location.reload(),
  }
}
