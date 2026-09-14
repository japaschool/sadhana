import { useState, useEffect } from 'react'

export function useServiceWorkerUpdate(): { updateReady: boolean; applyUpdate: () => void } {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return
    const handler = () => setUpdateReady(true)
    sw.addEventListener('controllerchange', handler)
    return () => sw.removeEventListener('controllerchange', handler)
  }, [])

  return {
    updateReady,
    applyUpdate: () => window.location.reload(),
  }
}
