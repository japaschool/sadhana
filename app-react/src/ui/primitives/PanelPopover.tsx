import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { UiPortal } from './UiPortal'

const INSET = 16
const GAP = 8

/** Marks the container a PanelPopover opened inside it spans and stays within (the desktop log panel). */
const POPOVER_BOUNDS = 'data-popover-bounds'

interface PanelPopoverProps { anchor: HTMLElement; label: string; onClose: () => void; children: ReactNode }

/** A card as wide as the anchor's bounds container (less a 16px inset), just below the anchor, or above it
 *  when there's no room below. Dims the container; any click outside the card or Escape closes it. */
export function PanelPopover({ anchor, label, onClose, children }: PanelPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 }) // not visibility:hidden, which would stop focus() below
  const bounds = (anchor.closest(`[${POPOVER_BOUNDS}]`) ?? document.body).getBoundingClientRect()

  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect()
    const b = (anchor.closest(`[${POPOVER_BOUNDS}]`) ?? document.body).getBoundingClientRect()
    const maxHeight = b.height - 2 * INSET
    const height = Math.min(ref.current?.offsetHeight ?? 0, maxHeight)
    const below = a.bottom + GAP
    const top = below + height <= b.bottom - INSET ? below : Math.max(b.top + INSET, a.top - GAP - height)
    setStyle({ left: b.left + INSET, width: b.width - 2 * INSET, top, maxHeight })
    ref.current?.focus()
  }, [anchor])

  useEffect(() => () => anchor.focus(), [anchor])

  // On the window so Escape works wherever focus is; a menu inside that handles Escape first prevents default.
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) close.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <UiPortal>
      <div data-testid="popover-backdrop" className="fixed inset-0 z-50" onClick={onClose} />
      <div aria-hidden className="pointer-events-none fixed z-50 bg-ui-backdrop"
        style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={style}
        className="fixed z-50 flex flex-col gap-4 overflow-y-auto rounded-[22px] border border-ui-control bg-ui-sheet p-4 shadow-[0_30px_60px_-16px_rgba(0,0,0,.35)] outline-none">
        {children}
      </div>
    </UiPortal>
  )
}
