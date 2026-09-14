import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Renders `children` only once the placeholder scrolls within `rootMargin` of
 * the viewport. Falls back to rendering immediately when IntersectionObserver
 * is unavailable (jsdom / SSR), so tests and non-IO environments still render.
 */
export function DeferUntilVisible({
  children,
  rootMargin = '400px',
  className,
}: {
  children: ReactNode
  rootMargin?: string
  className?: string
}) {
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible, rootMargin])

  if (visible) return <>{children}</>
  return <div ref={ref} className={className} aria-hidden />
}
