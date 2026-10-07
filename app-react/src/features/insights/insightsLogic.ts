import type { BarLayout, ReportDataEntry } from '../../api/charts'
import {
  averageForType, formatMinutesAsHHMM, resolveAxisId, valueToNumber,
  type AxisId, type Trace, type TraceInput,
} from '../../pages/charts/chartLogic'
import { fromDateStr } from '../today/date'
import { formatDuration, type DurationUnits } from '../today/values'

export interface Headline { kind: 'duration' | 'count' | 'time'; value: number; delta: number | null }
export interface AverageLine { axis: AxisId; value: number; color: string }

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
  const bars = traces.filter((t) => t.type_ === 'Bar')
  if (barLayout === 'Stacked' && bars.length) {
    const axis = resolveAxisId(bars[0].yAxis, bars[0].dataType)
    const stack = bars.filter((t) => resolveAxisId(t.yAxis, t.dataType) === axis)
    const value = averageDailyTotal(rows, stack, todayCob)
    return value === null ? [] : [{ axis, value, color: 'var(--ui-accent)' }]
  }
  return traces.filter((t) => t.showAverage).flatMap((t) => {
    const value = averageForType(forTrace(rows, t.name), t.dataType, todayCob)
    return value === null ? [] : [{ axis: resolveAxisId(t.yAxis, t.dataType), value, color: t.color }]
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

export function formatDay(cob: string, locale: string): string {
  return fromDateStr(cob).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

export function windowLabel(rows: ReportDataEntry[], locale: string): string {
  if (!rows.length) return ''
  return `${formatDay(rows[0].cob_date, locale)} – ${formatDay(rows[rows.length - 1].cob_date, locale)}`
}

export function formatDurationTick(min: number, u: DurationUnits): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}${u.min}`
  return m === 0 ? `${h}${u.h}` : `${h}${u.h}${String(m).padStart(2, '0')}`
}
