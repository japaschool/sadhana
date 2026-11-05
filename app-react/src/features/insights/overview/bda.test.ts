import { describe, expect, it } from 'vitest'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { beforeDuringAfter, cardPeriods, changedMost, movingAverage } from './bda'
import { TODAY } from './fixtures'
import type { InsightRow, Series } from './series'

const day = (offset: number) => toDateStr(addDays(fromDateStr(TODAY), offset))
/** `back` days before today. */
const ago = (n: number) => day(-n)
const period = (start: number, end: number | null, id = 'p', exclude = true): MarkedPeriod => ({
  id, name: id, start_date: ago(start), end_date: end === null ? null : ago(end), exclude_from_usual: exclude,
})
const row = (key = 'r'): InsightRow => ({ key, kind: 'Count', practice: key, special: null })
/** Days `from`..`to` back from today, inclusive, set to value(i). */
const put = (s: Series, from: number, to: number, value: (i: number) => number) => {
  for (let i = Math.min(from, to); i <= Math.max(from, to); i++) s.set(ago(i), value(i))
  return s
}
/** Steady 5 before the period starts `start` days ago. */
const base = (start: number) => put(new Map(), start + 7, start + 120, () => 5)
const run = (s: Series, p: MarkedPeriod, periods = [p]) =>
  beforeDuringAfter(p, [row()], new Map([['r', s]]), periods, TODAY)

describe('beforeDuringAfter', () => {
  it('in_progress_while_open', () => {
    const p = period(10, null)
    const r = run(put(base(10), 10, 0, () => 9), p)
    expect(r.chip).toEqual({ kind: 'progress' })
    expect(r.rows[0]).toMatchObject({ before: 5, during: 9, after: null, chip: { kind: 'progress' } })
  })

  it('settling_then_back_after_n_days', () => {
    // period 50..40; still at 9 until 36, back at 5 from 35 (end+5). The 7-day mean is inside again 5 days later (end+10).
    const s = put(base(50), 50, 36, () => 9)
    put(s, 35, 0, () => 5)
    const p = period(50, 40)
    const back = run(s, p)
    expect(back.rows[0].chip).toEqual({ kind: 'back', days: 10 })
    expect(back.chip).toEqual({ kind: 'back', days: 10 })
    // evaluated days run from 30 days ago: 13 by 18 days ago, the 14th on 17 days ago
    const early = (today: number) => beforeDuringAfter(p, [row()], new Map([['r', s]]), [p], ago(today)).chip
    expect(early(18)).toEqual({ kind: 'settling' })
    expect(early(17)).toEqual({ kind: 'back', days: 10 })
  })

  it('settling_before_14_days', () => {
    const s = put(base(20), 20, 10, () => 9)
    put(s, 9, 0, () => 5) // end+1 = 9 days ago ... 10 evaluated days at most
    const r = run(s, period(20, 10))
    expect(r.rows[0].chip).toEqual({ kind: 'settling' })
  })

  it('different_after_30_days', () => {
    const s = put(base(60), 60, 40, () => 9)
    put(s, 39, 0, () => 9)
    const r = run(s, period(60, 40))
    expect(r.rows[0].chip).toEqual({ kind: 'different' })
    expect(r.chip).toEqual({ kind: 'different' })
  })

  it('different_turns_back_later', () => {
    // end 50 days ago; values stay high until 20 days ago, then return: stretch starts 19 days ago -> first inside window N = 36.
    const s = put(base(70), 70, 20, () => 9)
    put(s, 19, 0, () => 5)
    const r = run(s, period(70, 50))
    expect(r.rows[0].chip).toEqual({ kind: 'back', days: 36 })
  })

  it('logging_gap_neither_counts_nor_breaks', () => {
    // end 30 days ago. Logged 29..25, then a gap: days 20..18 have fewer than 3 values in their window and are
    // skipped; 14 evaluated days are still reached from 27 on.
    const s = put(base(40), 40, 30, () => 9)
    put(s, 29, 25, () => 5)
    put(s, 19, 0, () => 5)
    const r = run(s, period(40, 30))
    expect(r.rows[0].chip?.kind).toBe('back')
    if (r.rows[0].chip?.kind === 'back') expect(r.rows[0].chip.days).toBe(3)
  })

  it('outside_day_resets_stretch', () => {
    // end 30 ago; inside from 27 to 25, an outside spell 24..22 resets, clean again once it leaves the window (15).
    const s = put(base(40), 40, 30, () => 9)
    put(s, 29, 25, () => 5)
    put(s, 24, 22, () => 40)
    put(s, 21, 0, () => 5)
    const r = run(s, period(40, 30))
    const chip = r.rows[0].chip
    expect(chip?.kind).toBe('back')
    // the stretch starts after the outside spell (15 days ago), not at 27 days ago
    expect(chip).toEqual({ kind: 'back', days: 15 })
  })

  it('baseline_frozen_at_start', () => {
    // before the period: 5. After the end the values stay at 20; a usual at today would be 20 but the frozen one is 5.
    const s = put(base(60), 60, 50, () => 5)
    put(s, 49, 0, () => 20)
    const r = run(s, period(60, 50))
    expect(r.rows[0].chip).toEqual({ kind: 'different' })
  })

  it('after_is_mean_of_up_to_28_days_since_end', () => {
    const s = put(base(60), 60, 50, () => 5)
    put(s, 49, 22, () => 7) // 28 days after end
    put(s, 21, 0, () => 100)
    expect(run(s, period(60, 50)).rows[0].after).toBe(7)
  })

  it('card_chip_is_least_settled', () => {
    const p = period(30, 20)
    const back = put(base(30), 30, 20, () => 9)
    put(back, 19, 0, () => 5)
    const settling = put(base(30), 30, 20, () => 9)
    put(settling, 19, 12, () => 5)
    const go = (...ss: Series[]) =>
      beforeDuringAfter(p, ss.map((_, i) => row(`r${i}`)), new Map(ss.map((s, i) => [`r${i}`, s])), [p], TODAY).chip
    expect(go(back)).toEqual({ kind: 'back', days: 3 })
    expect(go(back, settling)).toEqual({ kind: 'settling' })
  })

  it('card_chip_picks_longest_back_and_different_over_settling', () => {
    const a = put(base(50), 50, 40, () => 9)
    put(a, 39, 0, () => 5) // N=3
    const b = put(base(50), 50, 40, () => 9)
    put(b, 39, 36, () => 9)
    put(b, 35, 0, () => 5) // N=10
    const c = put(base(50), 50, 40, () => 9)
    put(c, 39, 0, () => 5)
    const d = put(base(50), 50, 40, () => 9)
    put(d, 39, 0, () => 40)
    const p = period(50, 40)
    const go = (...ss: Series[]) =>
      beforeDuringAfter(p, ss.map((_, i) => row(`r${i}`)), new Map(ss.map((s, i) => [`r${i}`, s])), [p], TODAY).chip
    expect(go(a, b, c)).toEqual({ kind: 'back', days: 10 })
    expect(go(a, b, d)).toEqual({ kind: 'different' })
  })

  it('no_range_rows_ignored_and_no_chip', () => {
    const p = period(30, 20)
    const good = put(base(30), 30, 20, () => 9)
    put(good, 19, 0, () => 5)
    const thin = put(new Map(), 25, 30, () => 5) // under 14 values before start
    const both = beforeDuringAfter(p, [row('a'), row('b')], new Map([['a', good], ['b', thin]]), [p], TODAY)
    expect(both.rows[1].chip).toBeNull()
    expect(both.rows[1].before).toBeNull()
    expect(both.chip).toEqual({ kind: 'back', days: 3 })
    const only = beforeDuringAfter(p, [row('b')], new Map([['b', thin]]), [p], TODAY)
    expect(only.chip).toBeNull()
  })

  it('leaves_this_period_out_of_its_own_exclusion_only', () => {
    // another excluded period eats the baseline days; this period itself would not matter
    const p = period(30, 20)
    const other = period(45, 37, 'o')
    const s = base(30)
    put(s, 45, 37, () => 50)
    expect(run(s, p, [p, other]).rows[0].before).toBe(5)
  })

  it('overlaps_named', () => {
    const p = period(30, 20)
    const o = period(25, 22, 'o')
    const far = period(60, 40, 'f')
    const open = period(5, null, 'x')
    expect(run(new Map(), p, [p, o, far, open]).overlaps.map((x) => x.id)).toEqual(['o'])
    expect(run(new Map(), open, [p, o, far, open]).overlaps).toEqual([])
    expect(run(new Map(), period(10, 5), [p, o, far, open, period(10, 5)]).overlaps.map((x) => x.id)).toEqual(['x'])
  })
})

describe('cardPeriods', () => {
  it('single_day_period_has_no_card', () => {
    expect(cardPeriods([period(5, 5), period(5, 4)], TODAY)).toEqual([])
    expect(cardPeriods([period(2, null)], TODAY)).toHaveLength(1)
    expect(cardPeriods([period(1, null)], TODAY)).toEqual([])
  })

  it('card_shown_until_30_days_after_end', () => {
    expect(cardPeriods([period(40, 30)], TODAY)).toHaveLength(1)
    expect(cardPeriods([period(41, 31)], TODAY)).toEqual([])
  })

  it('open_periods_always_show_and_newest_first', () => {
    const old = period(400, null, 'old')
    const a = period(20, 10, 'a')
    const b = period(8, 6, 'b')
    expect(cardPeriods([a, old, b], TODAY).map((p) => p.id)).toEqual(['b', 'a', 'old'])
  })
})

describe('movingAverage', () => {
  it('means_seven_days_and_needs_three', () => {
    const s = put(new Map(), 10, 8, (i) => i) // 10, 9, 8
    const m = movingAverage(s, ago(10), ago(7))
    expect(m.get(ago(10))).toBeNull()
    expect(m.get(ago(9))).toBeNull()
    expect(m.get(ago(8))).toBe(9)
    expect(m.get(ago(7))).toBe(9)
    expect([...m.keys()]).toHaveLength(4)
  })
})

describe('changedMost', () => {
  const mk = (rows: Partial<ReturnType<typeof run>['rows'][number]>[]) => ({
    period: period(5, 3), chip: null, overlaps: [],
    rows: rows.map((r, i) => ({ row: row(`r${i}`), before: 5, during: 5, after: null, chip: null, spread: 2, ...r })),
  })
  it('picks_largest_relative_change_first_on_ties', () => {
    expect(changedMost(mk([{ during: 6 }, { during: 9 }, { during: 1 }]))).toBe('r1')
    expect(changedMost(mk([{ during: 7 }, { during: 7 }]))).toBe('r0')
  })
  it('ignores_rows_without_range', () => {
    expect(changedMost(mk([{ before: null, spread: null, during: 100 }, { during: 6 }]))).toBe('r1')
    expect(changedMost(mk([{ before: null, spread: null }]))).toBeNull()
  })
})
