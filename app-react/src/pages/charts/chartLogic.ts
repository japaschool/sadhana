// app-react/src/pages/charts/chartLogic.ts
import type { PracticeDataType } from '../../types/api'

export type AxisKind = 'num' | 'time' | 'unit'

export interface ChartDataRow {
  date: string
  cob: string
  [key: string]: number | null | string
}

export interface TraceInput {
  name: string
  dataType: PracticeDataType
}

export function axisKindFor(dt: PracticeDataType): AxisKind {
  if (dt === 'Time') return 'time'
  if (dt === 'Bool' || dt === 'Text') return 'unit'
  return 'num' // Int, Duration
}

export function valueToNumber(raw: unknown, dt: PracticeDataType): number | null {
  if (raw === null || raw === undefined) return null
  const o = raw as Record<string, unknown>
  switch (dt) {
    case 'Int':
      if (typeof raw === 'number') return raw
      return typeof o.Int === 'number' ? (o.Int as number) : null
    case 'Duration':
      if (typeof raw === 'number') return raw
      return typeof o.Duration === 'number' ? (o.Duration as number) : null
    case 'Bool': {
      const b = typeof raw === 'boolean' ? raw : (o.Bool as boolean | undefined)
      return b === true ? 1 : null // false or missing → gap
    }
    case 'Text': {
      const s = typeof raw === 'string' ? raw : (o.Text as string | undefined)
      return typeof s === 'string' && s.length > 0 ? 1 : null
    }
    case 'Time': {
      const t = (o.Time ?? raw) as { h: number; m: number } | undefined
      if (t && typeof t.h === 'number' && typeof t.m === 'number') return t.h * 60 + t.m
      return null
    }
  }
}

/** Mirrors Rust overflow_time: morning>evening ⇒ -1 else +1. */
export function computeTimeOverflow(hours: number[]): -1 | 1 {
  let morning = 0
  let evening = 0
  for (const h of hours) {
    if (h < 24 && h > 15) evening += 1
    if (h < 12) morning += 1
  }
  return morning > evening ? -1 : 1
}

function timeHour(raw: unknown): number | null {
  const o = raw as Record<string, unknown>
  const t = (o?.Time ?? raw) as { h: number } | undefined
  return t && typeof t.h === 'number' ? t.h : null
}

/** Apply the Rust y_value day adjustment to a Time value, in minutes. */
function timeMinutesWithOverflow(raw: unknown, overflow: -1 | 1): number | null {
  const base = valueToNumber(raw, 'Time')
  if (base === null) return null
  const h = timeHour(raw)
  if (h === null) return base
  if (overflow > 0 && h < 12) return base + 1440
  if (overflow < 0 && h > 15) return base - 1440
  return base
}

function shortDate(iso: string, locale: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

export function buildChartData(
  rawValues: { cob_date: string; practice: string; value: unknown }[],
  traces: TraceInput[],
  locale: string,
): ChartDataRow[] {
  const typeByName = new Map(traces.map((t) => [t.name, t.dataType]))
  const names = new Set(traces.map((t) => t.name))

  // Per Time-practice overflow, computed from all of that practice's hours.
  const overflowByName = new Map<string, -1 | 1>()
  for (const t of traces) {
    if (t.dataType !== 'Time') continue
    const hours = rawValues
      .filter((e) => e.practice === t.name)
      .map((e) => timeHour(e.value))
      .filter((h): h is number => h !== null)
    overflowByName.set(t.name, computeTimeOverflow(hours))
  }

  const dateMap = new Map<string, ChartDataRow>()
  for (const entry of rawValues) {
    if (!names.has(entry.practice)) continue
    const key = entry.cob_date
    if (!dateMap.has(key)) dateMap.set(key, { date: shortDate(key, locale), cob: key })
    const row = dateMap.get(key)!
    const dt = typeByName.get(entry.practice)!
    row[entry.practice] =
      dt === 'Time'
        ? timeMinutesWithOverflow(entry.value, overflowByName.get(entry.practice) ?? 1)
        : valueToNumber(entry.value, dt)
  }
  // Sort by cob ascending for a stable x-axis.
  return Array.from(dateMap.values()).sort((a, b) => a.cob.localeCompare(b.cob))
}

export function averageForType(
  entries: { cob_date: string; value: unknown }[],
  dt: PracticeDataType,
  todayCob: string,
): number | null {
  if (dt === 'Bool' || dt === 'Text') return null
  const past = entries.filter((e) => e.cob_date !== todayCob)
  const hasAny = past.some((e) => e.value !== null && e.value !== undefined)
  if (!hasAny) return null
  if (dt === 'Time') {
    const hours = past.map((e) => timeHour(e.value)).filter((h): h is number => h !== null)
    if (hours.length === 0) return null
    const overflow = computeTimeOverflow(hours)
    let sum = 0
    let count = 0
    for (const e of past) {
      const v = timeMinutesWithOverflow(e.value, overflow)
      if (v !== null) { sum += v; count += 1 }
    }
    if (count === 0) return null
    return Math.floor(sum / count)
  }
  // Int / Duration: divide by ALL past days (missing counts as 0 in the sum),
  // integer floor — matches Rust average_value.
  let sum = 0
  for (const e of past) {
    sum += valueToNumber(e.value, dt) ?? 0
  }
  return Math.floor(sum / past.length)
}

export function formatMinutesAsHHMM(min: number): string {
  const norm = ((Math.round(min) % 1440) + 1440) % 1440
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export type ChartUnit = 'duration' | 'count' | 'time' | 'bool'

/** The single-unit chart bucket a data type belongs to; null = not chartable (Text). */
export function chartUnitFor(dt: PracticeDataType): ChartUnit | null {
  switch (dt) {
    case 'Duration': return 'duration'
    case 'Int':      return 'count'
    case 'Time':     return 'time'
    case 'Bool':     return 'bool'
    case 'Text':     return null
  }
}

export interface UnitGroup<T extends { dataType: PracticeDataType }> {
  unit: ChartUnit
  traces: T[]
}

const UNIT_ORDER: ChartUnit[] = ['duration', 'count', 'time', 'bool']

/** Split traces into per-unit groups (stable within a group), excluding Text,
 *  ordered duration→count→time→bool. Empty groups are omitted. */
export function groupTracesByUnit<T extends { dataType: PracticeDataType }>(
  traces: T[],
): UnitGroup<T>[] {
  const map = new Map<ChartUnit, T[]>()
  for (const tr of traces) {
    const u = chartUnitFor(tr.dataType)
    if (u === null) continue
    if (!map.has(u)) map.set(u, [])
    map.get(u)!.push(tr)
  }
  return UNIT_ORDER.filter((u) => map.has(u)).map((u) => ({ unit: u, traces: map.get(u)! }))
}
