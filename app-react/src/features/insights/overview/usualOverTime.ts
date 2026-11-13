import { fromDateStr, toDateStr } from '../../today/date'
import type { Series } from './series'
import { shift, usualAt } from './usual'
import type { Usual } from './usual'

export interface Week { week: string; usual: Usual | null }

export const MIN_WEEKS = 26

/** The usual as it stood each week: at todayCob, todayCob − 7, … back to `from`, ascending. */
export function usualWeeks(series: Series, leftOut: Set<string>, todayCob: string, from: string): Week[] {
  const out: Week[] = []
  for (let d = todayCob; d >= from; d = shift(d, -7)) out.push({ week: d, usual: usualAt(series, d, leftOut) })
  return out.reverse()
}

export const enoughHistory = (weeks: Week[]) => weeks.filter((w) => w.usual).length >= MIN_WEEKS

export type UsualRange = '1y' | '2y' | '3y' | '5y' | 'all'
export const USUAL_RANGES: UsualRange[] = ['1y', '2y', '3y', '5y', 'all']

export function rangeStart(r: UsualRange, todayCob: string, first: string): string {
  if (r === 'all') return first
  const d = fromDateStr(todayCob)
  d.setFullYear(d.getFullYear() - parseInt(r))
  return toDateStr(d)
}

export const offeredRanges = (first: string, todayCob: string): UsualRange[] =>
  USUAL_RANGES.filter((r) => r === 'all' || first < rangeStart(r, todayCob, first))

export const openingRange = (offered: UsualRange[]): UsualRange =>
  offered.includes('2y') ? '2y' : offered.includes('1y') ? '1y' : 'all'

/** First and last usual in the shown weeks; `now` when the last is the final week. */
export function rangeSummary(weeks: Week[]): { start: Usual; last: { week: string; usual: Usual }; now: boolean } | null {
  const has = weeks.filter((w): w is { week: string; usual: Usual } => w.usual !== null)
  if (!has.length) return null
  const last = has[has.length - 1]
  return { start: has[0].usual, last, now: last.week === weeks[weeks.length - 1].week }
}

/** Whole-hour y ticks for a duration chart spanning 2h or more; null leaves the ticks to the chart (minutes). */
export function hourTicks(weeks: Week[]): number[] | null {
  const vs = weeks.flatMap((w) => (w.usual ? [w.usual.p25, w.usual.p75] : []))
  const lo = Math.floor(Math.min(...vs) / 60), hi = Math.ceil(Math.max(...vs) / 60)
  if (!vs.length || Math.max(...vs) - Math.min(...vs) < 120) return null
  return Array.from({ length: hi - lo + 1 }, (_, i) => (lo + i) * 60)
}
