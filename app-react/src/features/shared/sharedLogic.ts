import type { ReportDataEntry } from '../../api/charts'
import { valueToNumber, type TraceInput } from '../insights/chartLogic'

/** The 4-step "days done" scale: 0 nothing logged, 3 the most. */
export type Level = 0 | 1 | 2 | 3

export const days = (entries: ReportDataEntry[]) => [...new Set(entries.map((e) => e.cob_date))].sort()

const done = (raw: unknown, dt: TraceInput['dataType']) => (valueToNumber(raw, dt) ?? 0) > 0

/** Per day, how many of the report's practices were done, and that as a level (all of them = 3). */
export function dayLevels(traces: TraceInput[], entries: ReportDataEntry[]): { cob: string; count: number; level: Level }[] {
  const types = new Map(traces.map((t) => [t.name, t.dataType]))
  const counts = new Map(days(entries).map((d) => [d, 0]))
  for (const e of entries) {
    const dt = types.get(e.practice)
    if (dt && done(e.value, dt)) counts.set(e.cob_date, counts.get(e.cob_date)! + 1)
  }
  return [...counts].map(([cob, count]) => {
    const share = traces.length ? count / traces.length : 0
    return { cob, count, level: share === 0 ? 0 : share >= 1 ? 3 : share >= 0.5 ? 2 : 1 }
  })
}

/** Mean practices done per day, today left out (it isn't over); one decimal. */
export function doneAverage(traces: TraceInput[], entries: ReportDataEntry[], todayCob: string): number | null {
  const past = dayLevels(traces, entries).filter((d) => d.cob !== todayCob)
  if (!past.length) return null
  return Math.round((past.reduce((s, d) => s + d.count, 0) / past.length) * 10) / 10
}
