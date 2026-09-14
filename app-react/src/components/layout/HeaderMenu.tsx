import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { FaChevronDown } from 'react-icons/fa'

export type HeaderMenuItem =
  | { label: string; to: string }
  | { label: string; onClick: () => void }

const pill =
  'h-9 px-3 rounded-full text-[12.6px] font-medium flex items-center gap-1.5 transition-colors no-underline backdrop-blur-md'
const glassPill = {
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.18)',
  color: 'rgba(255,255,255,0.90)',
} as const
const itemClass = 'px-4 py-2.5 text-sm text-left no-underline hover:bg-white/10 w-full'
const itemStyle = { color: 'rgba(255,255,255,0.90)' } as const

export function HeaderMenu({ label, items }: { label: string; items: HeaderMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Position the (portaled) menu just under its trigger.
  useLayoutEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, left: r.left })
    }
  }, [open])

  // Close on outside click (trigger + portaled menu both count as "inside").
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={pill}
        style={glassPill}
      >
        {label}
        <FaChevronDown className="w-3 h-3 opacity-70" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="min-w-44 rounded-xl overflow-hidden flex flex-col"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              zIndex: 100,
              background: 'rgba(28,37,48,0.45)',
              border: '1px solid rgba(255,255,255,0.16)',
              backdropFilter: 'blur(24px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            }}
          >
            {items.map((item) =>
              'to' in item ? (
                <Link
                  key={item.label}
                  role="menuitem"
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={itemClass}
                  style={itemStyle}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    item.onClick()
                    setOpen(false)
                  }}
                  className={itemClass}
                  style={itemStyle}
                >
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
