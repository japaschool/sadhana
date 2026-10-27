import type { ReactNode } from 'react'

export function ListGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <h2 className="px-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{label}</h2>
      <div className="flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline">
        {children}
      </div>
    </section>
  )
}
