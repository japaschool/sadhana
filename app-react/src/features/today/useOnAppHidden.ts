import { useEffect, useRef } from 'react'

/**
 * Runs `fn` when the app goes to the background. An iOS home-screen app that is
 * switched away from or closed never blurs the focused field and never unmounts,
 * so unsaved input must be flushed here. (visibilitychange fires in both cases.)
 */
export function useOnAppHidden(fn: () => void) {
  const ref = useRef(fn)
  useEffect(() => { ref.current = fn })
  useEffect(() => {
    const onChange = () => { if (document.visibilityState === 'hidden') ref.current() }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
}
