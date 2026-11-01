import type { Report } from '../../api/charts'

const BOX = 'inline-flex shrink-0 text-ui-faint'

/** The muted type glyph before a report's name (Report Templates 15m17): bars for a graph, cells for a table, staggered bars for a template. `null` is All practices. */
export function ReportGlyph({ report }: { report: Report | null }) {
  const d = report?.definition
  const kind = d && 'Graph' in d ? 'graph' : d && 'Panels' in d ? 'template' : 'table'
  if (d && 'Graph' in d) {
    return (
      <span aria-hidden data-glyph={kind} className={`${BOX} h-3 w-3.5 items-end gap-0.5`}>
        {[6, 11, 8].map((h, i) => <span key={i} className="w-[3px] rounded-[1px] bg-current" style={{ height: h }} />)}
      </span>
    )
  }
  if (d && 'Panels' in d) {
    return (
      <span aria-hidden data-glyph={kind} className={`${BOX} h-3 w-3.5 items-start gap-0.5`}>
        {[[1, 8], [3, 8], [0, 10]].map(([m, h], i) => (
          <span key={i} className="w-[3px] rounded-[1.5px] bg-current" style={{ height: h, marginTop: m }} />
        ))}
      </span>
    )
  }
  return (
    <span aria-hidden data-glyph={kind} className={`${BOX} grid h-3 w-[13px] grid-cols-3 grid-rows-3 gap-[1.5px]`}>
      {Array.from({ length: 9 }, (_, i) => <span key={i} className="rounded-[1px] bg-current" />)}
    </span>
  )
}
