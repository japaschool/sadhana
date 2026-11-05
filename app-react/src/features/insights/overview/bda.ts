import type { MarkedPeriod } from '../../../api/markedPeriods'
import type { InsightRow, Series } from './series'
import { daysBetween, eachDay, leftOutDays, mean, periodValue, shift, usualAt, withinUsual } from './usual'
import type { Usual } from './usual'

export type Chip = { kind: 'progress' } | { kind: 'settling' } | { kind: 'back'; days: number } | { kind: 'different' }

export interface BdaRow { row: InsightRow; before: number | null; during: number | null; after: number | null; chip: Chip | null
  /** p75 - p25 of the usual frozen at the start. */
  spread: number | null
}
export interface Bda { period: MarkedPeriod; rows: BdaRow[]; chip: Chip | null; overlaps: MarkedPeriod[] }

const EVALUATED_DAYS = 14
const AFTER_DAYS = 28
const DIFFERENT_AFTER = 30
const CARD_DAYS = 30
const MIN_CARD_DAYS = 3

function valuesIn(s: Series, from: string, to: string): number[] {
  return eachDay(from, to).flatMap((d) => (s.has(d) ? [s.get(d)!] : []))
}

/** The chip of a row once the period has ended, judged against the usual frozen at its start. */
function settledChip(s: Series, usual: Usual, end: string, todayCob: string): Chip {
  const first = shift(end, 1)
  let start = ''
  let count = 0
  for (let e = first; e <= todayCob; e = shift(e, 1)) {
    const vs = valuesIn(s, e > shift(first, 6) ? shift(e, -6) : first, e)
    if (vs.length < 3) continue
    if (!withinUsual(mean(vs), usual)) { count = 0; continue }
    if (count === 0) start = e
    if (++count === EVALUATED_DAYS) return { kind: 'back', days: daysBetween(end, start) }
  }
  return { kind: daysBetween(end, todayCob) > DIFFERENT_AFTER ? 'different' : 'settling' }
}

function cardChip(chips: (Chip | null)[], running: boolean): Chip | null {
  const cs = chips.filter((c): c is Chip => c !== null)
  if (!cs.length) return null
  if (running) return { kind: 'progress' }
  if (cs.some((c) => c.kind === 'different')) return { kind: 'different' }
  if (cs.some((c) => c.kind === 'settling')) return { kind: 'settling' }
  return { kind: 'back', days: Math.max(...cs.map((c) => (c.kind === 'back' ? c.days : 0))) }
}

export function beforeDuringAfter(
  period: MarkedPeriod, rows: InsightRow[], series: Map<string, Series>, periods: MarkedPeriod[], todayCob: string,
): Bda {
  const others = periods.filter((p) => p.id !== period.id)
  const leftOut = leftOutDays(others, todayCob)
  const { end_date: end } = period
  const running = end === null || end >= todayCob

  const bdaRows = rows.map((row): BdaRow => {
    const s = series.get(row.key) ?? new Map<string, number>()
    const usual = usualAt(s, period.start_date, leftOut)
    const during = periodValue(s, period, todayCob)
    let after: number | null = null
    if (!running) {
      const vs = valuesIn(s, shift(end, 1), shift(end, AFTER_DAYS) < todayCob ? shift(end, AFTER_DAYS) : todayCob)
      after = vs.length ? mean(vs) : null
    }
    const chip = !usual ? null : running ? { kind: 'progress' as const } : settledChip(s, usual, end, todayCob)
    return { row, before: usual?.median ?? null, during, after, chip, spread: usual ? usual.p75 - usual.p25 : null }
  })

  const last = end ?? todayCob
  return {
    period,
    rows: bdaRows,
    chip: cardChip(bdaRows.map((r) => r.chip), running),
    overlaps: others.filter((p) => p.start_date <= last && (p.end_date ?? todayCob) >= period.start_date),
  }
}

/** Days a period spans, an open one counted to today. */
export const periodLength = (p: MarkedPeriod, todayCob: string) => daysBetween(p.start_date, p.end_date ?? todayCob) + 1

/** Whether a period is long enough (3+ days) for a card and a detail screen. */
export const hasDetail = (p: MarkedPeriod, todayCob: string) => periodLength(p, todayCob) >= MIN_CARD_DAYS

/** Periods of 3+ days (open ones counted to today) that show a card: until 30 days after the end, newest first. */
export function cardPeriods(periods: MarkedPeriod[], todayCob: string): MarkedPeriod[] {
  return periods
    .filter((p) => {
      const last = p.end_date ?? todayCob
      return hasDetail(p, todayCob) && (p.end_date === null || todayCob <= shift(last, CARD_DAYS))
    })
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
}

/** 7-day mean for each day in from..to; null below 3 values. */
export function movingAverage(s: Series, from: string, to: string): Map<string, number | null> {
  const out = new Map<string, number | null>()
  for (const d of eachDay(from, to)) {
    const vs = valuesIn(s, shift(d, -6), d)
    out.set(d, vs.length >= 3 ? mean(vs) : null)
  }
  return out
}

/** How far a row moved from before to during, in units of its usual range (at least 1 wide); null without a usual or a during value. */
export function changeScore(r: BdaRow): number | null {
  if (r.before === null || r.during === null || r.spread === null) return null
  return Math.abs(r.during - r.before) / Math.max(r.spread, 1)
}

/** Key of the row that moved most from before to during, in units of its usual range (at least 1 wide); null if no row has both. Ties go to the first row. */
export function changedMost(bda: Bda): string | null {
  let best: string | null = null
  let bestScore = -1
  for (const r of bda.rows) {
    const score = changeScore(r)
    if (score !== null && score > bestScore) { best = r.row.key; bestScore = score }
  }
  return best
}
