type Listener = () => void
const listeners = new Set<Listener>()
let width = 390

/** Installs a matchMedia stub that evaluates `(min-width: Npx)` against `w`, then notifies subscribers. */
export function setViewportWidth(w: number) {
  width = w
  window.matchMedia = ((query: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0)
    return {
      matches: width >= min,
      media: query,
      onchange: null,
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  }) as typeof window.matchMedia
  listeners.forEach((l) => l())
}
