import type { Report } from '../../api/charts'
import { templateSlug } from './panels/templates'

const BOX = 'inline-flex shrink-0'

/** Bars for a graph, cells for a table, staggered bars for sleep, a ring of beads for japa, stacked bars for duration. Colour comes from `className`. */
export function KindGlyph({ kind, className = 'text-ui-faint' }: { kind: 'graph' | 'table' | 'sleep' | 'japa' | 'duration'; className?: string }) {
  if (kind === 'graph') {
    return (
      <span aria-hidden data-glyph={kind} className={`${BOX} ${className} h-3 w-3.5 items-end gap-0.5`}>
        {[6, 11, 8].map((h, i) => <span key={i} className="w-[3px] rounded-[1px] bg-current" style={{ height: h }} />)}
      </span>
    )
  }
  if (kind === 'duration') {
    return (
      <span aria-hidden data-glyph={kind} className={`${BOX} ${className} h-3 w-3.5 items-end gap-0.5`}>
        {[[4, 4], [3, 7]].map(([top, base], i) => (
          <span key={i} className="flex w-[5px] flex-col gap-px">
            <span className="rounded-t-[1px] bg-current opacity-50" style={{ height: top }} />
            <span className="bg-current" style={{ height: base }} />
          </span>
        ))}
      </span>
    )
  }
  if (kind === 'japa') {
    return (
      <span aria-hidden data-glyph={kind} className={`${BOX} ${className} h-3 w-3.5 items-center justify-center`}>
        <span className="box-border h-3 w-3 rounded-full border-[2.5px] border-dotted border-current" />
      </span>
    )
  }
  if (kind === 'sleep') {
    return (
      <span aria-hidden data-glyph={kind} className={`${BOX} ${className} h-3 w-3.5 items-start gap-0.5`}>
        {[[1, 8], [3, 8], [0, 10]].map(([m, h], i) => (
          <span key={i} className="w-[3px] rounded-[1.5px] bg-current" style={{ height: h, marginTop: m }} />
        ))}
      </span>
    )
  }
  return (
    <span aria-hidden data-glyph={kind} className={`inline-grid shrink-0 ${className} h-3 w-[13px] grid-cols-3 grid-rows-3 gap-[1.5px]`}>
      {Array.from({ length: 9 }, (_, i) => <span key={i} className="rounded-[1px] bg-current" />)}
    </span>
  )
}

/** The muted type glyph before a report's name (Report Templates 15m17). `null` is All practices. */
export function ReportGlyph({ report }: { report: Report | null }) {
  // All practices is a table of every practice (15m17).
  if (report === null) return <KindGlyph kind="table" />
  const d = report.definition
  return <KindGlyph kind={'Graph' in d ? 'graph' : 'Panels' in d ? templateSlug(d.Panels) : 'table'} />
}
