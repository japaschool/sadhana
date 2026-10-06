import { useSyncExternalStore } from 'react'

export type Layout = 'mobile' | 'tablet' | 'desktop'

// Tailwind's sm / lg breakpoints.
const TABLET = '(min-width: 640px)'
const DESKTOP = '(min-width: 1024px)'

function current(): Layout {
  if (window.matchMedia(DESKTOP).matches) return 'desktop'
  if (window.matchMedia(TABLET).matches) return 'tablet'
  return 'mobile'
}

function subscribe(onChange: () => void) {
  const queries = [window.matchMedia(TABLET), window.matchMedia(DESKTOP)]
  queries.forEach((q) => q.addEventListener('change', onChange))
  return () => queries.forEach((q) => q.removeEventListener('change', onChange))
}

export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, current)
}
