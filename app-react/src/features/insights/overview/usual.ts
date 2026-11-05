import type { MarkedPeriod } from '../../../api/markedPeriods'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import type { RowKind } from '../panels/gapLogic'
import type { InsightRow, Series } from './series'

export interface Usual { median: number; p25: number; p75: number; n: number }

const MIN_USUAL = 14
const USUAL_DAYS = 90
const MAX_LOOKBACK = 365
const HOLLOW_DAYS = 30

export const shift = (cob: string, n: number) => toDateStr(addDays(fromDateStr(cob), n))

/** Whole days from a to b; negative when b is earlier. */
export const daysBetween = (a: string, b: string) => Math.round((fromDateStr(b).getTime() - fromDateStr(a).getTime()) / 864e5)

export function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = shift(d, 1)) out.push(d)
  return out
}

/** Days of periods that are left out of "usual"; an open period runs to today. */
export function leftOutDays(periods: MarkedPeriod[], todayCob: string): Set<string> {
  const out = new Set<string>()
  for (const p of periods) {
    if (p.exclude_from_usual) for (const d of eachDay(p.start_date, p.end_date ?? todayCob)) out.add(d)
  }
  return out
}

export function percentile(sorted: number[], q: number): number {
  const rank = q * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo)
}

/** The days a usual range is drawn from as if `cob` were today: up to 90 kept days ending a week before it, reaching back up to a year. */
function usualDays(cob: string, leftOut: Set<string>): string[] {
  const oldest = shift(cob, -MAX_LOOKBACK)
  const out: string[] = []
  for (let d = shift(cob, -7); d >= oldest && out.length < USUAL_DAYS; d = shift(d, -1)) {
    if (!leftOut.has(d)) out.push(d)
  }
  return out
}

/** Logged days inside today's usual window: what unlocks Me vs my normal at 14. */
export function usualWindowCount(logged: string[], todayCob: string, leftOut: Set<string>): number {
  const set = new Set(logged)
  return usualDays(todayCob, leftOut).filter((d) => set.has(d)).length
}

/** The usual range as if `cob` were today. */
export function usualAt(series: Series, cob: string, leftOut: Set<string>): Usual | null {
  const values = usualDays(cob, leftOut).flatMap((d) => (series.has(d) ? [series.get(d)!] : []))
  if (values.length < MIN_USUAL) return null
  values.sort((a, b) => a - b)
  return { median: percentile(values, 0.5), p25: percentile(values, 0.25), p75: percentile(values, 0.75), n: values.length }
}

export const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length

/** Mean over the last 7 days without left-out days; null below 3 values. */
export function nowValue(series: Series, todayCob: string, leftOut: Set<string>): number | null {
  const vs = eachDay(shift(todayCob, -6), todayCob)
    .filter((d) => !leftOut.has(d) && series.has(d))
    .map((d) => series.get(d)!)
  return vs.length >= 3 ? mean(vs) : null
}

/** Mean over the period's days up to today; null when none has a value. */
export function periodValue(series: Series, p: MarkedPeriod, todayCob: string): number | null {
  const end = p.end_date && p.end_date < todayCob ? p.end_date : todayCob
  const vs = eachDay(p.start_date, end).filter((d) => series.has(d)).map((d) => series.get(d)!)
  return vs.length ? mean(vs) : null
}

export type Word = 'usual' | 'above' | 'below' | 'earlier' | 'later'

export function withinUsual(v: number, u: Usual): boolean {
  const m = Math.max(0.15 * (u.p75 - u.p25), 1)
  return v >= u.p25 - m && v <= u.p75 + m
}

export function wordFor(now: number, u: Usual, kind: RowKind): Word {
  if (withinUsual(now, u)) return 'usual'
  const below = now < u.p25
  if (kind === 'Clock') return below ? 'earlier' : 'later'
  return below ? 'below' : 'above'
}

export interface NormalRow {
  row: InsightRow
  now: number | null
  usual: Usual | null
  word: Word | null
  hollow: { period: MarkedPeriod; value: number } | null
  recentDays: number
}

/** The period to show hollow: the ongoing left-out one when the week is eaten, else the latest that ended within 30 days. */
function hollowPeriod(periods: MarkedPeriod[], now: number | null, todayCob: string): MarkedPeriod | null {
  if (now === null) {
    const ongoing = periods.find((p) => p.exclude_from_usual && p.start_date <= todayCob && (p.end_date ?? todayCob) >= todayCob)
    if (ongoing) return ongoing
  }
  const cutoff = shift(todayCob, -HOLLOW_DAYS)
  const recent = periods
    .filter((p) => p.start_date <= todayCob && (p.end_date ?? todayCob) >= cutoff)
    .sort((a, b) => (b.end_date ?? todayCob).localeCompare(a.end_date ?? todayCob))
  return recent[0] ?? null
}

export function meVsNormal(
  rows: InsightRow[], series: Map<string, Series>, periods: MarkedPeriod[], todayCob: string,
): NormalRow[] {
  const leftOut = leftOutDays(periods, todayCob)
  const week = eachDay(shift(todayCob, -6), todayCob)
  return rows.map((row) => {
    const s = series.get(row.key) ?? new Map<string, number>()
    const now = nowValue(s, todayCob, leftOut)
    const usual = usualAt(s, todayCob, leftOut)
    const period = hollowPeriod(periods, now, todayCob)
    const value = period ? periodValue(s, period, todayCob) : null
    return {
      row, now, usual,
      word: now !== null && usual ? wordFor(now, usual, row.kind) : null,
      hollow: period && value !== null ? { period, value } : null,
      recentDays: week.filter((d) => s.has(d)).length,
    }
  })
}

/** Enough to say something: a row with a usual range and 3+ logged days in the last 14. */
export function isRegular(normal: NormalRow[], logged: string[], todayCob: string): boolean {
  const from = shift(todayCob, -13)
  return normal.some((n) => n.usual) && logged.filter((d) => d >= from && d <= todayCob).length >= 3
}
