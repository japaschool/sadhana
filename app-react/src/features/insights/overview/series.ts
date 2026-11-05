import type { ReportDataEntry, SleepRows } from '../../../api/charts'
import type { UserPractice } from '../../../types/api'
import { sleepSource } from '../panels/templates'
import type { RowKind } from '../panels/gapLogic'
import { makeLookup, resolve, scalar, windowDays } from '../panels/panelLogic'

export interface InsightRow { key: string; kind: RowKind; practice: string | null; special: 'sleep' | 'total' | null }
/** cob -> value. Clock values are minutes after noon. */
export type Series = Map<string, number>

export function insightRows(practices: UserPractice[], sleep: SleepRows | null): InsightRow[] {
  const rows: InsightRow[] = practices
    .filter((p) => p.is_active && (p.data_type === 'Time' || p.data_type === 'Int'))
    .map((p) => ({ key: p.id, kind: p.data_type === 'Time' ? 'Clock' : 'Count', practice: p.id, special: null }))
  if (sleep) rows.push({ key: 'sleep', kind: 'Duration', practice: null, special: 'sleep' })
  if (practices.some((p) => p.is_active && p.data_type === 'Duration')) {
    rows.push({ key: 'total', kind: 'Duration', practice: null, special: 'total' })
  }
  return rows
}

/** Sorted days with at least one non-null value. */
export function loggedDays(entries: ReportDataEntry[], _todayCob: string): string[] {
  return [...new Set(entries.filter((x) => x.value !== null && x.value !== undefined).map((x) => x.cob_date))].sort()
}

const afterNoon = (minutes: number) => (((minutes - 720) % 1440) + 1440) % 1440

export function rowSeries(
  rows: InsightRow[], entries: ReportDataEntry[], practices: UserPractice[], sleep: SleepRows | null, todayCob: string,
): Map<string, Series> {
  const l = makeLookup(entries, undefined, practices)
  const days = windowDays(entries)
  const active = practices.filter((p) => p.is_active)
  const counted = active.filter((p) => p.data_type === 'Int' || p.data_type === 'Duration')
  const filled = new Set(counted.filter((p) => days.some((d) => l.value(p.id, d) !== null)).map((p) => p.id))
  // A count's empty is 0 only on a past day that has some count value, for a practice filled in elsewhere.
  const count = (id: string, cob: string): number | null => {
    if (cob === todayCob) return null
    const v = l.value(id, cob)
    if (v !== null) return v
    return filled.has(id) && counted.some((p) => l.value(p.id, cob) !== null) ? 0 : null
  }
  const durations = active.filter((p) => p.data_type === 'Duration')
  const sleepSrc = sleep ? sleepSource(sleep) : null

  const out = new Map<string, Series>()
  for (const row of rows) {
    const s: Series = new Map()
    for (const cob of days) {
      let v: number | null = null
      if (row.special === 'sleep') v = sleepSrc ? scalar(resolve(sleepSrc, cob, l), null) : null
      else if (row.special === 'total') {
        const parts = durations.map((p) => count(p.id, cob))
        v = parts.some((x) => x !== null) ? parts.reduce<number>((a, x) => a + (x ?? 0), 0) : null
      } else if (row.kind === 'Clock') {
        const t = l.value(row.practice!, cob)
        v = t === null ? null : afterNoon(t)
      } else v = count(row.practice!, cob)
      if (v !== null) s.set(cob, v)
    }
    out.set(row.key, s)
  }
  return out
}
