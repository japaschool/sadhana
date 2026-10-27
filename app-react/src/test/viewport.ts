type Listener = () => void
const listeners = new Set<Listener>()
let width = 390
let height = 844

/** Installs a matchMedia stub that evaluates `(min-width: Npx)` / `(min-height: Npx)` against `w` × `h`, then notifies subscribers. */
export function setViewportWidth(w: number, h = 1000) {
  width = w
  height = h
  window.matchMedia = ((query: string) => {
    const minW = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0)
    const minH = Number(/min-height:\s*(\d+)px/.exec(query)?.[1] ?? 0)
    return {
      matches: width >= minW && height >= minH,
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
