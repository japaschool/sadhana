import type { Report } from '../../api/charts'
import { templateSlug } from './panels/templates'

const BOX = 'inline-flex shrink-0'

/**
 * Bars for a graph, cells for a table, staggered bars for sleep, bars under a target line for japa (shown as Daily count),
 * stacked bars for duration, a lit month for days, dots at different heights on a baseline for gaps. Colour comes from `className`.
 */
export function KindGlyph({ kind, className = 'text-ui-faint' }: { kind: 'graph' | 'table' | 'sleep' | 'japa' | 'duration' | 'days' | 'gaps'; className?: string }) {
  if (kind === 'gaps') {
    return (
      <span aria-hidden data-glyph={kind} className={`${BOX} ${className} relative h-3 w-3.5 items-end justify-between`}>
        {[4, 9, 6].map((b, i) => <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" style={{ marginBottom: b }} />)}
        <span className="absolute inset-x-0 bottom-0 h-[1.4px] bg-current" />
      </span>
    )
  }
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
  if (kind === 'days') {
    return (
      <span aria-hidden data-glyph={kind} className={`inline-grid shrink-0 ${className} h-3 w-[13px] grid-cols-3 grid-rows-3 gap-[1.5px]`}>
        {Array.from({ length: 9 }, (_, i) => <span key={i} className={`rounded-[1px] bg-current ${[0, 4, 5, 8].includes(i) ? '' : 'opacity-30'}`} />)}
      </span>
    )
  }
  if (kind === 'japa') {
    return (
      <span aria-hidden data-glyph={kind} className={`${BOX} ${className} relative h-3 w-3.5 items-end gap-0.5`}>
        {[[9, 1], [5, 0.5], [11, 1]].map(([h, o], i) => (
          <span key={i} className="w-[3px] rounded-[1px] bg-current" style={{ height: h, opacity: o }} />
        ))}
        <span className="absolute -left-px -right-px top-[3px] h-[1.4px] bg-current" />
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
