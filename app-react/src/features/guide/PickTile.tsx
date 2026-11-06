import type { ReactNode } from 'react'

/**
 * A whole tile is the checkbox's label, so a tap anywhere picks it, and the example's summary stays readable.
 * A round tick in the corner and an accent ring show it's picked.
 */
export function PickTile({ on, label, onToggle, children }: { on: boolean; label: string; onToggle: () => void; children: ReactNode }) {
  return (
    <label className={`relative flex h-full cursor-pointer flex-col rounded-[20px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ui-ink ${on ? 'ring-2 ring-ui-accent' : ''}`}>
      <input type="checkbox" className="sr-only" checked={on} onChange={onToggle} aria-label={label} />
      <span aria-hidden className={`absolute top-2 right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${on ? 'border-ui-accent bg-ui-accent text-ui-surface' : 'border-ui-faint bg-ui-surface'}`}>
        {on && <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>}
      </span>
      {children}
    </label>
  )
}
