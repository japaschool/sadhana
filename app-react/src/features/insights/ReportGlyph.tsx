import type { Report } from '../../api/charts'

const BOX = 'inline-flex shrink-0'

/** Bars for a graph, cells for a table, staggered bars for a template. Colour comes from `className`. */
export function KindGlyph({ kind, className = 'text-ui-faint' }: { kind: 'graph' | 'table' | 'template'; className?: string }) {
  if (kind === 'graph') {
    return (
      <span aria-hidden data-glyph={kind} className={`${BOX} ${className} h-3 w-3.5 items-end gap-0.5`}>
        {[6, 11, 8].map((h, i) => <span key={i} className="w-[3px] rounded-[1px] bg-current" style={{ height: h }} />)}
      </span>
    )
  }
  if (kind === 'template') {
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
  return <KindGlyph kind={'Graph' in d ? 'graph' : 'Panels' in d ? 'template' : 'table'} />
}
