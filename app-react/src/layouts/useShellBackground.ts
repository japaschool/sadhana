import { useEffect } from 'react'
import type { RefObject } from 'react'

/** Matches the browser chrome and overscroll area to the shell's background (system scheme or theme override) while mounted. */
export function useShellBackground(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    const html = document.documentElement
    const prevBg = html.style.backgroundColor
    const apply = () => {
      if (!ref.current) return
      const bg = getComputedStyle(ref.current).getPropertyValue('--ui-bg').trim()
      meta!.content = bg
      html.style.backgroundColor = bg
    }
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    // Settings → Theme flips data-ui-theme on <html>; follow it without any wiring.
    const observer = new MutationObserver(apply)
    apply()
    scheme.addEventListener('change', apply)
    observer.observe(html, { attributes: true, attributeFilter: ['data-ui-theme'] })
    return () => {
      observer.disconnect()
      scheme.removeEventListener('change', apply)
      html.style.backgroundColor = prevBg
      if (created) meta!.remove()
    }
  }, [ref])
}
