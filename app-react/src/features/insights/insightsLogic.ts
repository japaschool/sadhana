import type { BarLayout, ReportDataEntry } from '../../api/charts'
import {
  averageForType, formatMinutesAsHHMM, valueToNumber,
  type ChartDataRow, type Trace, type TraceInput,
} from '../../pages/charts/chartLogic'
import { assignAxes, type Axis } from './axes'
import { fromDateStr } from '../today/date'
import { formatDuration, type DurationUnits } from '../today/values'

export interface Headline { kind: 'duration' | 'count' | 'time'; value: number; delta: number | null }
export interface AverageLine { axis: Axis; value: number; color: string }

const forTrace = (rows: ReportDataEntry[], name: string) => rows.filter((e) => e.practice === name)

/** Mean over the window's days (today excluded, missing = 0) of the traces' summed values; null if nothing was logged. */
export function averageDailyTotal(rows: ReportDataEntry[], traces: TraceInput[], todayCob: string): number | null {
  const types = new Map(traces.map((t) => [t.name, t.dataType]))
  const days = new Set<string>()
  let sum = 0
  let any = false
  for (const e of rows) {
    const dt = types.get(e.practice)
    if (!dt || e.cob_date === todayCob) continue
    days.add(e.cob_date)
    const v = valueToNumber(e.value, dt)
    if (v !== null) { sum += v; any = true }
  }
  return any ? Math.floor(sum / days.size) : null
}

export function headline(
  traces: TraceInput[], rows: ReportDataEntry[], prevRows: ReportDataEntry[] | undefined, todayCob: string,
): Headline | null {
  if (traces.length === 1 && traces[0].dataType === 'Time') {
    const value = averageForType(forTrace(rows, traces[0].name), 'Time', todayCob)
    return value === null ? null : { kind: 'time', value, delta: null }
  }
  const all = (dt: TraceInput['dataType']) => traces.length > 0 && traces.every((t) => t.dataType === dt)
  const kind = all('Duration') ? 'duration' : all('Int') ? 'count' : null
  if (!kind) return null
  const value = averageDailyTotal(rows, traces, todayCob)
  if (value === null) return null
  const prev = prevRows ? averageDailyTotal(prevRows, traces, todayCob) : null
  return { kind, value, delta: prev ? Math.round(((value - prev) / prev) * 100) : null }
}

export function formatHeadline(h: Headline, u: DurationUnits): string {
  if (h.kind === 'duration') return formatDuration(h.value, u)
  if (h.kind === 'time') return formatMinutesAsHHMM(h.value)
  return String(h.value)
}

export function formatDelta(pct: number): string {
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}%`
}

// ponytail: a stacked report's single line uses the first bar's axis; stacks split across Y1/Y2 get no second line.
export function averageLines(traces: Trace[], rows: ReportDataEntry[], barLayout: BarLayout, todayCob: string): AverageLine[] {
  if (!traces.some((t) => t.showAverage)) return []
  const axes = assignAxes(traces)
  const bars = traces.flatMap((t, i) => (t.type_ === 'Bar' ? [i] : []))
  if (barLayout === 'Stacked' && bars.length) {
    const axis = axes[bars[0]]
    const stack = bars.filter((i) => axes[i] === axis).map((i) => traces[i])
    const value = averageDailyTotal(rows, stack, todayCob)
    return value === null ? [] : [{ axis, value, color: 'var(--ui-accent)' }]
  }
  return traces.flatMap((t, i) => {
    const value = t.showAverage ? averageForType(forTrace(rows, t.name), t.dataType, todayCob) : null
    return value === null ? [] : [{ axis: axes[i], value, color: t.color }]
  })
}

export function traceAverageLabel(trace: TraceInput, rows: ReportDataEntry[], todayCob: string, u: DurationUnits): string {
  const entries = forTrace(rows, trace.name)
  if (trace.dataType === 'Bool' || trace.dataType === 'Text') {
    const past = entries.filter((e) => e.cob_date !== todayCob)
    const done = past.filter((e) => valueToNumber(e.value, trace.dataType) === 1).length
    return `${done}/${past.length}`
  }
  const avg = averageForType(entries, trace.dataType, todayCob)
  if (avg === null) return '—'
  if (trace.dataType === 'Duration') return formatDuration(avg, u)
  if (trace.dataType === 'Time') return formatMinutesAsHHMM(avg)
  return String(avg)
}

export function formatDay(cob: string, locale: string, withYear = false): string {
  return fromDateStr(cob).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(withYear && { year: 'numeric' }) })
}

/** X-axis tick: 'Oct 4', or '01/24' (numeric month/year, short in every language) when the chart spans years. */
export function formatTick(cob: string, locale: string, spansYears: boolean): string {
  if (!spansYears) return formatDay(cob, locale)
  return fromDateStr(cob).toLocaleDateString(locale, { month: '2-digit', year: '2-digit' })
}

export const spansYears = (first: string, last: string) => first.slice(0, 4) !== last.slice(0, 4)

export function windowLabel(rows: ReportDataEntry[], locale: string): string {
  if (!rows.length) return ''
  const first = rows[0].cob_date
  const last = rows[rows.length - 1].cob_date
  const y = spansYears(first, last)
  return `${formatDay(first, locale, y)} – ${formatDay(last, locale, y)}`
}

export function formatDurationTick(min: number, u: DurationUnits): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}${u.min}`
  return m === 0 ? `${h}${u.h}` : `${h}${u.h}${String(m).padStart(2, '0')}`
}

export interface BarPlacement { stackId?: string; xAxisId?: string; rounded: boolean; fillOpacity: number }

/** How each trace is drawn as a bar for a report's bar layout (null for non-bars), by position.
 *  Mirrors Plotly's group / relative / overlay bar modes in the old Yew chart. */
export function barPlacement(traces: Trace[], barLayout: BarLayout): (BarPlacement | null)[] {
  const axes = assignAxes(traces)
  let nthBar = 0
  return traces.map((t, i) => {
    if (t.type_ !== 'Bar') return null
    const n = nthBar++
    if (barLayout === 'Stacked') {
      const stackId = axes[i]
      // ponytail: the top trace is rounded even on days it is 0, leaving a square top there.
      const top = !traces.some((b, j) => j > i && b.type_ === 'Bar' && axes[j] === stackId)
      return { stackId, rounded: top, fillOpacity: 1 }
    }
    if (barLayout === 'Overlaid') {
      // Recharts lays bars sharing an x axis side by side; a hidden x axis each makes them overlap.
      return { ...(n > 0 && { xAxisId: `overlay-${n}` }), rounded: true, fillOpacity: 0.6 }
    }
    return { rounded: true, fillOpacity: 1 }
  })
}

/** Chart data with one column per trace (t0, t1, …). A report may chart the same practice twice,
 *  and Recharts keys its series by dataKey, so shared keys made it loop and freeze the page. */
export function seriesRows(rows: ChartDataRow[], traces: TraceInput[]): Record<string, string | number | null>[] {
  return rows.map((r) => ({ cob: r.cob, ...Object.fromEntries(traces.map((t, i) => [`t${i}`, r[t.name] ?? null])) }))
}

/** A table cell's text; '' when nothing was logged (a Bool that is off counts as nothing). */
export function cellText(raw: unknown, dt: TraceInput['dataType'], u: DurationUnits): string {
  if (dt === 'Text') {
    const s = typeof raw === 'string' ? raw : (raw as { Text?: unknown } | null)?.Text
    return typeof s === 'string' ? s : ''
  }
  const n = valueToNumber(raw, dt)
  if (n === null) return ''
  if (dt === 'Bool') return '✓'
  if (dt === 'Duration') return formatDuration(n, u)
  if (dt === 'Time') return formatMinutesAsHHMM(n)
  return String(n)
}
