import { describe, expect, it } from 'vitest'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { TODAY } from './fixtures'
import type { Series } from './series'
import { shift, usualAt } from './usual'
import { enoughHistory, hourTicks, offeredRanges, openingRange, rangeStart, rangeSummary, usualWeeks } from './usualOverTime'

const day = (offset: number, from = TODAY) => toDateStr(addDays(fromDateStr(from), offset))
const fill = (from: number, to: number, value: (i: number) => number): Series => {
  const s: Series = new Map()
  for (let i = from; i <= to; i++) s.set(day(-i), value(i))
  return s
}
const none = new Set<string>()
const u = (p25: number, p75: number) => ({ median: (p25 + p75) / 2, p25, p75, n: 20 })

describe('usualWeeks', () => {
  it('last_point_is_todays_usual', () => {
    const s = fill(0, 400, (i) => 10 + (i % 7))
    const w = usualWeeks(s, none, TODAY, day(-400))
    expect(w[w.length - 1]).toEqual({ week: TODAY, usual: usualAt(s, TODAY, none) })
    expect(w[0].week >= day(-400) && w[1].week === shift(w[0].week, 7)).toBe(true)
  })
  it('gap_over_90_days_breaks_the_line', () => {
    const s = new Map([...fill(0, 60, () => 5), ...fill(250, 400, () => 5)])
    const w = usualWeeks(s, none, TODAY, day(-400))
    const at = (d: number) => w.find((x) => x.week === day(-d))!.usual
    expect(at(0)).not.toBeNull()
    expect(at(119)).toBeNull()
    expect(at(245)).not.toBeNull()
  })
  it('left_out_days_dont_change_the_result', () => {
    const base = fill(0, 300, () => 5)
    const spiked = new Map(base)
    for (let i = 100; i <= 130; i++) spiked.set(day(-i), 99)
    const leftOut = new Set(Array.from({ length: 31 }, (_, k) => day(-(100 + k))))
    expect(usualWeeks(spiked, leftOut, TODAY, day(-300))).toEqual(usualWeeks(base, leftOut, TODAY, day(-300)))
  })
  it('needs_26_points', () => {
    const weeks = (n: number) => Array.from({ length: n }, (_, i) => ({ week: day(-7 * i), usual: u(1, 2) }))
    expect(enoughHistory([...weeks(25), { week: day(-500), usual: null }])).toBe(false)
    expect(enoughHistory(weeks(26))).toBe(true)
  })
})
describe('ranges', () => {
  it('offers_only_covered_ranges', () => {
    expect(offeredRanges(day(-800), TODAY)).toEqual(['1y', '2y', 'all'])
    expect(rangeStart('2y', '2026-11-05', 'x')).toBe('2024-11-05')
    expect(rangeStart('all', '2026-11-05', 'x')).toBe('x')
  })
  it('opening_range_falls_back_to_all', () => {
    expect(openingRange(['1y', '2y', '3y', 'all'])).toBe('2y')
    expect(openingRange(['1y', 'all'])).toBe('1y')
    expect(openingRange(['all'])).toBe('all')
  })
})
describe('rangeSummary', () => {
  it('summary_now_and_start', () => {
    const r = rangeSummary([{ week: 'a', usual: null }, { week: 'b', usual: u(1, 3) }, { week: 'c', usual: u(5, 7) }])
    expect(r).toEqual({ start: u(1, 3), last: { week: 'c', usual: u(5, 7) }, now: true })
  })
  it('summary_last_when_now_is_null', () => {
    expect(rangeSummary([{ week: 'b', usual: u(1, 3) }, { week: 'c', usual: null }])?.now).toBe(false)
  })
  it('summary_none_in_range', () => {
    expect(rangeSummary([{ week: 'c', usual: null }])).toBeNull()
  })
})

describe('hourTicks', () => {
  const w = (p25: number, p75: number) => ({ week: TODAY, usual: { median: (p25 + p75) / 2, p25, p75, n: 90 } })
  it('gives whole hours covering a span of 2h or more', () => {
    expect(hourTicks([w(70, 100), w(150, 200), { week: TODAY, usual: null }])).toEqual([60, 120, 180, 240])
  })
  it('leaves a short span to the chart', () => {
    expect(hourTicks([w(20, 45), w(30, 80)])).toBeNull()
    expect(hourTicks([])).toBeNull()
  })
})
