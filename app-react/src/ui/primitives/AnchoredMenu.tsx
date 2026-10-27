import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { UiPortal } from './UiPortal'

const WIDTH = 210
const GAP = 6
const ITEM = '[role^="menuitem"]'

interface AnchoredMenuProps { anchor: HTMLElement; onClose: () => void; label: string; children: ReactNode }

/** Menu anchored under (or, without room, above) `anchor`, right-aligned. */
export function AnchoredMenu({ anchor, onClose, label, children }: AnchoredMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' })

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const height = ref.current?.offsetHeight ?? 0
    const fitsBelow = window.innerHeight - r.bottom - GAP >= height
    // Right-align to the anchor unless the menu would then overflow the left edge.
    const fitsRightAligned = r.right - WIDTH >= 8
    setPos({
      ...(fitsRightAligned ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, r.left) }),
      ...(fitsBelow ? { top: r.bottom + GAP } : { bottom: window.innerHeight - r.top + GAP }),
    })
  }, [anchor])

  // Focus (and so scroll to) the checked item once placed: a visibility:hidden element can't take focus.
  useEffect(() => {
    if (pos.visibility === 'hidden') return
    const target = ref.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? ref.current?.querySelector<HTMLElement>(ITEM)
    target?.focus()
  }, [pos])

  useEffect(() => () => anchor.focus(), [anchor])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation() // don't also close a sheet this menu sits in
      onClose()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <UiPortal>
      <div data-testid="menu-backdrop" className="fixed inset-0 z-50" onClick={onClose} />
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        onKeyDown={onKeyDown}
        style={{ ...pos, width: WIDTH }}
        className="fixed z-50 flex max-h-[372px] flex-col overflow-y-auto rounded-2xl bg-ui-surface p-1.5 shadow-[0_18px_48px_-12px_rgba(40,28,10,.35),0_0_0_1px_rgba(40,28,10,.06)]"
      >
        {children}
      </div>
    </UiPortal>
  )
}

interface MenuItemProps { children: ReactNode; onSelect: () => void; selected?: boolean; muted?: boolean }

export function MenuItem({ children, onSelect, selected, muted }: MenuItemProps) {
  const radio = selected !== undefined
  const tone = selected ? 'bg-ui-accent-soft font-bold' : muted ? 'text-sm font-semibold text-ui-muted' : 'font-medium text-ui-ink2'
  return (
    <button
      type="button"
      role={radio ? 'menuitemradio' : 'menuitem'}
      aria-checked={radio ? selected : undefined}
      onClick={onSelect}
      className={`flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-left text-[15px] outline-none focus-visible:bg-ui-accent-soft ${tone}`}
    >
      {children}
      {selected && <span aria-hidden className="shrink-0 text-ui-accent">✓</span>}
    </button>
  )
}

export function MenuDivider() {
  return <div role="separator" className="mx-1.5 my-1 h-px bg-ui-hairline" />
}
