import { describe, expect, it } from 'vitest'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { TODAY } from './fixtures'
import type { InsightRow, Series } from './series'
import { detectChange, openPeriodToAsk } from './suggest'

const day = (offset: number) => toDateStr(addDays(fromDateStr(TODAY), offset))
const rows: InsightRow[] = [
  { key: 'wake', kind: 'Clock', practice: 'wake', special: null },
  { key: 'rounds', kind: 'Count', practice: 'rounds', special: null },
  { key: 'bed', kind: 'Clock', practice: 'bed', special: null },
]
/** Deterministic noise in -1..1. */
const noise = (i: number) => ((i * 7) % 5) / 2 - 1
const WAKE = 980 // 4:20 as minutes after noon

function build(days: number, shiftFrom: number | null, moving: string[] = ['wake', 'rounds']) {
  const wake: Series = new Map()
  const rounds: Series = new Map()
  const bed: Series = new Map()
  const logged: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const shifted = shiftFrom !== null && i <= shiftFrom
    wake.set(day(-i), WAKE + noise(i) * 5 - (shifted && moving.includes('wake') ? 60 : 0))
    rounds.set(day(-i), 16 + noise(i) + (shifted && moving.includes('rounds') ? 8 : 0))
    bed.set(day(-i), 600 + noise(i) * 5)
    logged.push(day(-i))
  }
  return { series: new Map([['wake', wake], ['rounds', rounds], ['bed', bed]]), logged }
}
const period = (start: number, end: number | null): MarkedPeriod => ({
  id: 'p', name: 'p', start_date: day(-start), end_date: end === null ? null : day(-end), exclude_from_usual: false,
})

describe('detectChange', () => {
  it('quiet_on_flat_series', () => {
    const { series, logged } = build(180, null)
    expect(detectChange(series, rows, logged, [], [], TODAY)).toBeNull()
  })

  it('fires_on_synthetic_shift', () => {
    const { series, logged } = build(180, 10)
    const s = detectChange(series, rows, logged, [], [], TODAY)
    expect(s).not.toBeNull()
    expect(Math.abs(Math.round((fromDateStr(s!.start).getTime() - fromDateStr(day(-10)).getTime()) / 864e5))).toBeLessThanOrEqual(2)
    expect(s!.rows).toEqual(['wake', 'rounds'])
  })

  it('one_row_moving_is_quiet', () => {
    const { series, logged } = build(180, 10, ['wake'])
    expect(detectChange(series, rows, logged, [], [], TODAY)).toBeNull()
  })

  it('needs_45_logged_days', () => {
    const a = build(44, 10)
    expect(detectChange(a.series, rows, a.logged, [], [], TODAY)).toBeNull()
    const b = build(70, 10)
    expect(detectChange(b.series, rows, b.logged, [], [], TODAY)).not.toBeNull()
  })

  it('not_inside_marked_period', () => {
    const { series, logged } = build(180, 10)
    expect(detectChange(series, rows, logged, [period(9, 5)], [], TODAY)).toBeNull()
    expect(detectChange(series, rows, logged, [period(30, null)], [], TODAY)).toBeNull()
    expect(detectChange(series, rows, logged, [period(60, 40)], [], TODAY)).not.toBeNull()
  })

  it('dismissed_start_stays_quiet', () => {
    const { series, logged } = build(180, 10)
    const s = detectChange(series, rows, logged, [], [], TODAY)!
    expect(detectChange(series, rows, logged, [], [s.start], TODAY)).toBeNull()
  })
})

describe('openPeriodToAsk', () => {
  it('open_period_asked_every_30_days', () => {
    const open = period(30, null)
    expect(openPeriodToAsk([open], {}, TODAY)).toBe(open)
    expect(openPeriodToAsk([period(29, null)], {}, TODAY)).toBeNull()
    expect(openPeriodToAsk([period(60, 40)], {}, TODAY)).toBeNull()
    expect(openPeriodToAsk([open], { p: day(-29) }, TODAY)).toBeNull()
    expect(openPeriodToAsk([open], { p: day(-30) }, TODAY)).toBe(open)
  })
})
