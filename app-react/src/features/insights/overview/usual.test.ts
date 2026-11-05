import { describe, expect, it } from 'vitest'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { entries, FOUR, TODAY } from './fixtures'
import { insightRows, loggedDays, rowSeries } from './series'
import type { InsightRow, Series } from './series'
import { isRegular, leftOutDays, meVsNormal, nowValue, usualAt, wordFor } from './usual'

const day = (offset: number, from = TODAY) => toDateStr(addDays(fromDateStr(from), offset))
/** value(i) for i = 0.. days before today (i days back), from..to inclusive. */
const fill = (from: number, to: number, value: (i: number) => number): Series => {
  const s: Series = new Map()
  for (let i = from; i <= to; i++) s.set(day(-i), value(i))
  return s
}
const period = (start: number, end: number | null, exclude = true): MarkedPeriod => ({
  id: 'p', name: 'p', start_date: day(-start), end_date: end === null ? null : day(-end), exclude_from_usual: exclude,
})
const none = new Set<string>()
const row = (kind: InsightRow['kind'] = 'Count'): InsightRow => ({ key: 'r', kind, practice: 'r', special: null })
const u = (p25: number, p75: number) => ({ median: (p25 + p75) / 2, p25, p75, n: 20 })

describe('usualAt', () => {
  it('usual_needs_14_days', () => {
    expect(usualAt(fill(8, 20, () => 5), TODAY, none)).toBeNull()
    expect(usualAt(fill(8, 21, () => 5), TODAY, none)?.n).toBe(14)
  })

  it('usual_skips_last_7_days', () => {
    const s = fill(8, 37, () => 5)
    for (let i = 0; i <= 6; i++) s.set(day(-i), 99)
    s.set(day(-7), 7)
    // day 7 is the first day counted (n = 30 + 1); days 0..6 are not
    expect(usualAt(s, TODAY, none)).toMatchObject({ n: 31, median: 5, p75: 5 })
  })

  it('left_out_days_are_skipped_and_window_reaches_back', () => {
    const s = fill(8, 200, () => 5)
    const p = period(40, 11)
    for (let i = 11; i <= 40; i++) s.set(day(-i), 1000)
    const out = leftOutDays([p], TODAY)
    expect(out.size).toBe(30)
    // days 7..10 kept, 30 left out, then 86 more kept: 3 + 86 values, none from the period
    expect(usualAt(s, TODAY, out)).toMatchObject({ median: 5, p75: 5, n: 89 })
  })

  it('window_stops_at_a_year', () => {
    const s = fill(7, 365, () => 5)
    for (let i = 366; i < 400; i++) s.set(day(-i), 100)
    expect(usualAt(s, TODAY, none)!.n).toBe(90)
    // the walk is eaten by a long left-out stretch and stops at a year, ignoring older values
    const old = fill(301, 400, (i) => (i > 365 ? 100 : 7))
    expect(usualAt(old, TODAY, leftOutDays([period(300, 7)], TODAY))).toMatchObject({ n: 65, p75: 7 })
  })

  it('midnight_wrap_median', () => {
    expect(usualAt(fill(8, 39, (i) => (i % 2 ? 690 : 750)), TODAY, none)!.median).toBeCloseTo(720, 0)
  })
})

describe('nowValue', () => {
  it('now_needs_3_values', () => {
    expect(nowValue(fill(0, 1, () => 4), TODAY, none)).toBeNull()
    expect(nowValue(fill(0, 2, () => 4), TODAY, none)).toBe(4)
  })
})

describe('words', () => {
  it('near_edge_is_usual', () => {
    expect(wordFor(16.2, u(10, 16), 'Count')).toBe('usual')
    expect(wordFor(18, u(10, 16), 'Count')).toBe('above')
    expect(wordFor(8, u(10, 16), 'Count')).toBe('below')
  })

  it('clock_earlier_and_later', () => {
    expect(wordFor(500, u(600, 660), 'Clock')).toBe('earlier')
    expect(wordFor(800, u(600, 660), 'Clock')).toBe('later')
  })
})

describe('meVsNormal', () => {
  const base = () => fill(8, 60, () => 5)

  it('ongoing_left_out_week_gives_hollow_not_word', () => {
    const s = base()
    for (let i = 0; i <= 7; i++) s.set(day(-i), 9)
    const [n] = meVsNormal([row()], new Map([['r', s]]), [period(7, null)], TODAY)
    expect(n.now).toBeNull()
    expect(n.word).toBeNull()
    expect(n.hollow?.value).toBe(9)
    expect(n.usual).not.toBeNull()
  })

  it('recent_period_shows_hollow_for_30_days', () => {
    const s = base()
    s.set(day(-60), 3)
    const at = (end: number) => meVsNormal([row()], new Map([['r', s]]), [period(end + 1, end, false)], TODAY)[0]
    expect(at(30).hollow).not.toBeNull()
    expect(at(31).hollow).toBeNull()
  })

  it('counts_recent_days_and_words', () => {
    const s = base()
    s.set(day(-1), 5)
    s.set(day(0), 5)
    s.set(day(-2), 5)
    const [n] = meVsNormal([row()], new Map([['r', s]]), [], TODAY)
    expect(n.recentDays).toBe(3)
    expect(n.word).toBe('usual')
  })
})

describe('isRegular', () => {
  const T = (h: number, m: number) => ({ Time: { h, m } })
  const at = (offsets: number[], values: Record<string, unknown>) =>
    Object.fromEntries(offsets.map((i) => [day(-i), values]))
  const all = { 'Отбой': T(23, 0), 'Подъём': T(5, 0), 'Кругов за день': 16, 'Кругов до 7': 8 }
  const check = (data: ReturnType<typeof entries>) => {
    const rows = insightRows(FOUR, null)
    const normal = meVsNormal(rows, rowSeries(rows, data, FOUR, null, TODAY), [], TODAY)
    return { normal, regular: isRegular(normal, loggedDays(data, TODAY), TODAY) }
  }
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

  it('regular_vs_less_regular', () => {
    // 20 logged days: 3 recent plus 17 older ones, enough for a usual range on every row
    const twenty = check(entries(at([0, 1, 2, ...range(8, 24)], all)))
    expect(twenty.regular).toBe(true)
    expect(twenty.normal.every((n) => n.usual)).toBe(true)
    // 8 logged days, all inside the last week: no usual range anywhere
    const eight = check(entries(at(range(0, 7), all)))
    expect(eight.regular).toBe(false)
    expect(eight.normal.some((n) => n.usual)).toBe(false)
  })

  it('one_row_with_a_range_is_regular', () => {
    const data = entries({
      ...at(range(0, 5), { 'Отбой': T(23, 0), 'Подъём': T(5, 0) }),
      ...at([0, 1, 2, ...range(8, 24)], { 'Кругов за день': 16 }),
    })
    const { normal, regular } = check(data)
    expect(regular).toBe(true)
    expect(normal.filter((n) => n.usual).map((n) => n.row.key)).toEqual(['rounds'])
  })

  it('needs_3_logged_days_in_the_last_14', () => {
    const base = at(range(14, 30), { 'Кругов за день': 16 })
    expect(check(entries({ ...base, ...at([0, 1], { 'Кругов за день': 16 }) })).regular).toBe(false)
    expect(check(entries({ ...base, ...at([0, 1, 2], { 'Кругов за день': 16 }) })).regular).toBe(true)
  })
})
