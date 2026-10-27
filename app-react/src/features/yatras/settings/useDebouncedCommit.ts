import { useCallback, useEffect, useRef } from 'react'

export const DEBOUNCE_MS = 600

/** Runs the latest `commit` 600 ms after the last schedule(), on flush(), and on unmount if one is pending. */
export function useDebouncedCommit(commit: () => void) {
  const latest = useRef(commit)
  useEffect(() => { latest.current = commit })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef(false)

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (!pending.current) return
    pending.current = false
    latest.current()
  }, [])

  const schedule = useCallback(() => {
    pending.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, DEBOUNCE_MS)
  }, [flush])

  useEffect(() => flush, [flush])
  return { schedule, flush }
}
