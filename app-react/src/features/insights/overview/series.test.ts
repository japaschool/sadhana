import { describe, it, expect } from 'vitest'
import { entries, FOUR, practice, TODAY } from './fixtures'
import { insightRows, loggedDays, rowSeries } from './series'

const T = (h: number, m: number) => ({ Time: { h, m } })
const SLEEP = { bedtime: 'bed', wake: 'wake', nap: null }

const seriesOf = (data: ReturnType<typeof entries>, key: string, sleep = null as typeof SLEEP | null, practices = FOUR) =>
  rowSeries(insightRows(practices, sleep), data, practices, sleep, TODAY).get(key)

describe('insightRows', () => {
  it('rows_follow_practice_order_then_sleep_then_total', () => {
    const ps = [
      practice('a', 'A', 'Int'), practice('b', 'B', 'Bool'), practice('c', 'C', 'Time'),
      practice('d', 'D', 'Text'), practice('e', 'E', 'Int', { is_active: false }), practice('f', 'F', 'Duration'),
    ]
    expect(insightRows(ps, SLEEP).map((r) => [r.key, r.kind, r.special])).toEqual([
      ['a', 'Count', null], ['c', 'Clock', null], ['sleep', 'Duration', 'sleep'], ['total', 'Duration', 'total'],
    ])
    expect(insightRows(ps.slice(0, 3), null).map((r) => r.key)).toEqual(['a', 'c'])
  })
})

describe('rowSeries', () => {
  it('empty_int_is_zero_on_a_day_with_other_numbers', () => {
    const data = entries({
      '2026-11-01': { 'Кругов за день': 16 },
      '2026-11-02': { 'Кругов за день': 16, 'Кругов до 7': 8 },
    })
    expect(seriesOf(data, 'before7')).toEqual(new Map([['2026-11-01', 0], ['2026-11-02', 8]]))
  })

  it('wake_only_day_gives_no_count_values', () => {
    const ps = [...FOUR, practice('read', 'Чтение', 'Duration')]
    const data = entries({
      '2026-11-01': { 'Подъём': T(5, 0) },
      '2026-11-02': { 'Подъём': T(5, 0), 'Кругов за день': 16, 'Чтение': 30 },
    })
    const rows = insightRows(ps, null)
    const s = rowSeries(rows, data, ps, null, TODAY)
    expect(s.get('rounds')).toEqual(new Map([['2026-11-02', 16]]))
    expect(s.get('total')).toEqual(new Map([['2026-11-02', 30]]))
    expect(s.get('wake')!.has('2026-11-01')).toBe(true)
  })

  it('never_filled_int_stays_empty', () => {
    const data = entries({ '2026-11-01': { 'Кругов за день': 16 }, '2026-11-02': { 'Кругов за день': 12 } })
    expect(seriesOf(data, 'before7')?.size ?? 0).toBe(0)
  })

  it('today_counts_for_clock_and_sleep_not_counts', () => {
    const data = entries({
      '2026-11-04': { 'Отбой': T(22, 0) },
      [TODAY]: { 'Подъём': T(5, 0), 'Кругов за день': 4 },
    })
    const ps = [...FOUR, practice('read', 'Чтение', 'Duration')]
    const s = rowSeries(insightRows(ps, SLEEP), data, ps, SLEEP, TODAY)
    expect(s.get('wake')!.get(TODAY)).toBe(((5 * 60 - 720) + 1440) % 1440)
    expect(s.get('sleep')!.get(TODAY)).toBe(420)
    expect(s.get('rounds')?.has(TODAY) ?? false).toBe(false)
    expect(s.get('total')?.has(TODAY) ?? false).toBe(false)
  })

  it('clock_is_minutes_after_noon', () => {
    const data = entries({ '2026-11-01': { 'Отбой': T(23, 30) }, '2026-11-02': { 'Отбой': T(0, 30) } })
    expect(seriesOf(data, 'bed')).toEqual(new Map([['2026-11-01', 690], ['2026-11-02', 750]]))
  })

  it('sleep_is_night_from_previous_bedtime', () => {
    const data = entries({
      '2026-11-01': { 'Отбой': T(22, 0) },
      '2026-11-02': { 'Подъём': T(4, 0) },
      '2026-11-03': { 'Подъём': T(6, 0) },
    })
    expect(seriesOf(data, 'sleep', SLEEP)).toEqual(new Map([['2026-11-02', 360]]))
  })
})

describe('loggedDays', () => {
  it('lists sorted days with any non-null value', () => {
    const data = [...entries({ '2026-11-03': { A: 1 }, '2026-11-01': { A: 2 }, '2026-11-02': { A: null } }), ...entries({ [TODAY]: { A: 1 } })]
    expect(loggedDays(data, TODAY)).toEqual(['2026-11-01', '2026-11-03', TODAY])
  })
})
