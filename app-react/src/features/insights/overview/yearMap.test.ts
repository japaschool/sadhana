import { describe, it, expect } from 'vitest'
import { fromDateStr } from '../../today/date'
import type { InsightRow, Series } from './series'
import { eachDay, shift } from './usual'
import { mondayOf, weekStarts, yearMap } from './yearMap'

const count: InsightRow = { key: 'a', kind: 'Count', practice: 'a', special: null }
const clock: InsightRow = { key: 'c', kind: 'Clock', practice: 'c', special: null }
const mk = (vals: Record<string, number>): Series => new Map(Object.entries(vals))

describe('yearMap', () => {
  it('weeks_run_monday_to_sunday_across_new_year_and_dst', () => {
    // Spans the 2025/26 new year, EU and US DST changes.
    for (const today of ['2026-01-04', '2026-03-29', '2026-11-01', '2026-11-05']) {
      const weeks = weekStarts(52, today)
      expect(weeks).toHaveLength(52)
      for (const w of weeks) expect(fromDateStr(w).getDay()).toBe(1)
      expect(weeks.at(-1)).toBe(mondayOf(today))
      const from = weeks[0]
      const hits = new Map<string, number>()
      for (const d of eachDay(from, today)) hits.set(mondayOf(d), (hits.get(mondayOf(d)) ?? 0) + 1)
      expect([...hits.keys()].sort()).toEqual(weeks)
      for (const [w, n] of hits) expect(n).toBe(w === weeks.at(-1) ? eachDay(w, today).length : 7)
      weeks.slice(1).forEach((w, i) => expect(shift(weeks[i], 7)).toBe(w))
    }
  })

  it('empty_week_is_blank', () => {
    const today = '2026-11-05'
    const [w0, w1] = weekStarts(26, today).slice(-3, -1)
    const [r] = yearMap([count], new Map([['a', mk({ [w0]: 4 })]]), 26, today)
    const cell = r.cells.find((c) => c.week === w1)!
    expect(cell).toEqual({ week: w1, mean: null, days: 0, step: 0 })
    expect(r.cells.find((c) => c.week === w0)!.days).toBe(1)
  })

  it('steps_scale_by_mad', () => {
    const today = '2026-11-05'
    const w = weekStarts(26, today).slice(-6, -1) // five weeks of means 10,10,12,20,40
    const [r] = yearMap([count], new Map([['a', mk(Object.fromEntries(w.map((d, i) => [d, [10, 10, 12, 20, 40][i]])))]]), 26, today)
    // median 12, deviations 2,2,0,8,28 -> MAD 2
    expect(r.median).toBe(12)
    expect(w.map((d) => r.cells.find((c) => c.week === d)!.step)).toEqual([-1, -1, 0, 3, 3])
    const s = yearMap([count], new Map([['a', mk(Object.fromEntries(w.map((d, i) => [d, [10, 11, 12, 13, 15][i]])))]]), 26, today)[0]
    // MAD 1: k = -2,-1,0,1,3
    expect(w.map((d) => s.cells.find((c) => c.week === d)!.step)).toEqual([-2, -1, 0, 1, 3])
  })

  it('zero_mad_gives_neutral', () => {
    const today = '2026-11-05'
    const w = weekStarts(26, today).slice(-3, -1)
    const [r] = yearMap([count], new Map([['a', mk({ [w[0]]: 5, [w[1]]: 5 })]]), 26, today)
    expect(r.cells.every((c) => c.step === 0)).toBe(true)
  })

  it('clock_earlier_is_positive', () => {
    const today = '2026-11-05'
    const w = weekStarts(26, today).slice(-4, -1)
    const [r] = yearMap([clock], new Map([['c', mk({ [w[0]]: 100, [w[1]]: 110, [w[2]]: 120 })]]), 26, today)
    expect(w.map((d) => r.cells.find((c) => c.week === d)!.step)).toEqual([1, 0, -1])
  })
})
