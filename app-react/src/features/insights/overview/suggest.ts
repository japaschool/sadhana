import type { MarkedPeriod } from '../../../api/markedPeriods'
import type { InsightRow, Series } from './series'
import { percentile, shift } from './usual'

export interface Suggestion { start: string; rows: string[] }

// Tunable thresholds.
const MIN_LOGGED = 45
const SCAN_DAYS = 30
const RECENT_DAYS = 5
const MIN_RECENT = 3
const BASE_DAYS = 56
const MIN_BASE = 14
const MIN_ROWS_OUT = 2
const MIN_RUN = 3
const FRESH_DAYS = 14

function valuesIn(s: Series, from: string, to: string): number[] {
  const out: number[] = []
  for (let d = from; d <= to; d = shift(d, 1)) {
    const v = s.get(d)
    if (v !== undefined) out.push(v)
  }
  return out.sort((a, b) => a - b)
}

/** Rows whose last-5-days median is outside their P10-P90 of the 56 days before. */
function rowsOutOn(d: string, rows: InsightRow[], series: Map<string, Series>): string[] {
  const out: string[] = []
  for (const row of rows) {
    const s = series.get(row.key)
    if (!s) continue
    const recent = valuesIn(s, shift(d, -(RECENT_DAYS - 1)), d)
    const base = valuesIn(s, shift(d, -(RECENT_DAYS - 1 + BASE_DAYS)), shift(d, -RECENT_DAYS))
    if (recent.length < MIN_RECENT || base.length < MIN_BASE) continue
    const m = percentile(recent, 0.5)
    if (m < percentile(base, 0.1) || m > percentile(base, 0.9)) out.push(row.key)
  }
  return out
}

/** A stretch where 2+ rows sit outside their own recent range for 3+ days, as a prompt to name it. */
export function detectChange(
  series: Map<string, Series>, rows: InsightRow[], logged: string[], periods: MarkedPeriod[],
  dismissed: string[], todayCob: string,
): Suggestion | null {
  if (logged.length < MIN_LOGGED) return null
  const first = logged[MIN_LOGGED - 1]
  const runs: { days: string[]; out: Set<string> }[] = []
  let cur: { days: string[]; out: Set<string> } | null = null
  for (let d = shift(todayCob, -SCAN_DAYS); d <= todayCob; d = shift(d, 1)) {
    const out = d >= first ? rowsOutOn(d, rows, series) : []
    if (out.length >= MIN_ROWS_OUT) {
      if (!cur) runs.push((cur = { days: [], out: new Set() }))
      cur.days.push(d)
      out.forEach((k) => cur!.out.add(k))
    } else cur = null
  }
  const run = runs.filter((r) => r.days.length >= MIN_RUN && r.days[r.days.length - 1] >= shift(todayCob, -FRESH_DAYS)).pop()
  if (!run) return null
  const start = shift(run.days[0], -(RECENT_DAYS - 1))
  if (dismissed.includes(start)) return null
  const last = run.days[run.days.length - 1]
  const marked = periods.some((p) => p.start_date <= last && (p.end_date ?? todayCob) >= start)
  if (marked) return null
  return { start, rows: rows.filter((r) => run.out.has(r.key)).map((r) => r.key) }
}

/** An ongoing period that has run 30 days, and not been asked about in the last 30. */
export function openPeriodToAsk(
  periods: MarkedPeriod[], openAsked: Record<string, string>, todayCob: string,
): MarkedPeriod | null {
  const cutoff = shift(todayCob, -30)
  return periods.find((p) => p.end_date === null && p.start_date <= cutoff && (!openAsked[p.id] || openAsked[p.id] <= cutoff)) ?? null
}
