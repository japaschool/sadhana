import { describe, it, expect } from 'vitest'
import { entries, FOUR, practice, TODAY } from './fixtures'
import type { PracticeGroup } from '../../../types/api'
import { insightRows, loggedDays, overviewRows, rowSeries } from './series'

const T = (h: number, m: number) => ({ Time: { h, m } })
const SLEEP = { bedtime: 'bed', wake: 'wake', nap: null }

const seriesOf = (data: ReturnType<typeof entries>, key: string, sleep = null as typeof SLEEP | null, practices = FOUR) =>
  rowSeries(insightRows(practices, [], sleep, {}), data, practices, sleep, TODAY).get(key)

const A: PracticeGroup = { id: 'A', name: 'Morning', is_default: false }
const B: PracticeGroup = { id: 'B', name: 'Evening', is_default: false }
const DEF: PracticeGroup = { id: null, name: '', is_default: true }
const GROUPS = [A, B, DEF]
const inA = { group_id: 'A' }
const inB = { group_id: 'B' }
const keys = (rows: { key: string }[]) => rows.map((r) => r.key)

describe('overviewRows / insightRows', () => {
  it('two_durations_in_named_group_make_a_hidden_member_total', () => {
    const ps = [practice('d1', 'D1', 'Duration', inA), practice('d2', 'D2', 'Duration', inA)]
    const rows = overviewRows(ps, GROUPS, null)
    expect(rows.map((r) => [r.key, r.defaultVisible])).toEqual([['d1', false], ['d2', false], ['total:A', true]])
    const total = rows.find((r) => r.key === 'total:A')!
    expect(total).toMatchObject({ kind: 'Duration', practice: null, special: 'total', members: ['d1', 'd2'], groupName: 'Morning' })
    expect(total.group).toBe(A)
    expect(keys(insightRows(ps, GROUPS, null, {}))).toEqual(['total:A'])
  })

  it('single_duration_in_named_group_shows_itself', () => {
    const ps = [practice('d3', 'D3', 'Duration', inB)]
    expect(overviewRows(ps, GROUPS, null).map((r) => [r.key, r.kind, r.defaultVisible])).toEqual([['d3', 'Duration', true]])
  })

  it('default_group_never_totals', () => {
    const ps = [practice('d4', 'D4', 'Duration'), practice('d5', 'D5', 'Duration', { group_id: null })]
    expect(overviewRows(ps, GROUPS, null).map((r) => [r.key, r.defaultVisible])).toEqual([['d4', true], ['d5', true]])
  })

  it('inactive_duration_does_not_count_toward_total', () => {
    const ps = [practice('d1', 'D1', 'Duration', inA), practice('d2', 'D2', 'Duration', { ...inA, is_active: false })]
    expect(keys(insightRows(ps, GROUPS, null, {}))).toEqual(['d1'])
  })

  it('unknown_group_falls_back_to_default_section', () => {
    const ps = [practice('d6', 'D6', 'Duration', { group_id: 'gone' }), practice('d7', 'D7', 'Duration')]
    expect(keys(insightRows(ps, GROUPS, null, {}))).toEqual(['d6', 'd7'])
  })

  it('order_follows_groups_then_total_then_sleep', () => {
    const ps = [
      practice('a1', 'A1', 'Duration', inA), practice('t0', 'T0', 'Time'), practice('b1', 'B1', 'Int', inB),
      practice('a2', 'A2', 'Duration', inA), practice('i0', 'I0', 'Int'), practice('a3', 'A3', 'Time', inA),
    ]
    const SLEEP_ROWS = { bedtime: 't0', wake: 'a3', nap: null }
    expect(keys(overviewRows(ps, [B, DEF, A], SLEEP_ROWS))).toEqual(['b1', 't0', 'i0', 'a1', 'a2', 'a3', 'total:A', 'sleep'])
    expect(overviewRows(ps, [B, DEF, A], SLEEP_ROWS).at(-1)!.group).toBe(DEF)
  })

  it('overrides_win_over_defaults', () => {
    const ps = [practice('d1', 'D1', 'Duration', inA), practice('d2', 'D2', 'Duration', inA), practice('t1', 'T1', 'Time')]
    expect(keys(insightRows(ps, GROUPS, null, { d1: true, 'total:A': false, t1: false }))).toEqual(['d1'])
  })

  it('stale_overrides_are_ignored', () => {
    const ps = [practice('d1', 'D1', 'Duration', inA), practice('d2', 'D2', 'Duration', inA), practice('t1', 'T1', 'Time')]
    expect(insightRows(ps, GROUPS, null, { gone: true, 'total:B': true })).toEqual(insightRows(ps, GROUPS, null, {}))
  })

  it('sleep_is_always_kept', () => {
    const ps = [practice('bed', 'Bed', 'Time'), practice('wake', 'Wake', 'Time')]
    expect(keys(insightRows(ps, GROUPS, SLEEP, { sleep: false, bed: false }))).toEqual(['wake', 'sleep'])
  })

  it('bool_and_text_are_not_rows', () => {
    const ps = [practice('b', 'B', 'Bool'), practice('x', 'X', 'Text', inA), practice('c', 'C', 'Time'), practice('e', 'E', 'Int', { is_active: false })]
    expect(keys(overviewRows(ps, GROUPS, null))).toEqual(['c'])
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
    const rows = insightRows(ps, [], null, {})
    const s = rowSeries(rows, data, ps, null, TODAY)
    expect(s.get('rounds')).toEqual(new Map([['2026-11-02', 16]]))
    expect(s.get('read')).toEqual(new Map([['2026-11-02', 30]]))
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
    const s = rowSeries(insightRows(ps, [], SLEEP, {}), data, ps, SLEEP, TODAY)
    expect(s.get('wake')!.get(TODAY)).toBe(((5 * 60 - 720) + 1440) % 1440)
    expect(s.get('sleep')!.get(TODAY)).toBe(420)
    expect(s.get('rounds')?.has(TODAY) ?? false).toBe(false)
    expect(s.get('read')?.has(TODAY) ?? false).toBe(false)
  })

  it('clock_is_minutes_after_noon', () => {
    const data = entries({ '2026-11-01': { 'Отбой': T(23, 30) }, '2026-11-02': { 'Отбой': T(0, 30) } })
    expect(seriesOf(data, 'bed')).toEqual(new Map([['2026-11-01', 690], ['2026-11-02', 750]]))
  })

  it('group_total_sums_only_its_members_including_hidden', () => {
    const ps = [...FOUR, practice('d1', 'Чтение', 'Duration', inA), practice('d2', 'Лекция', 'Duration', inA), practice('d3', 'Киртан', 'Duration', inB)]
    const data = entries({
      '2026-11-01': { 'Чтение': 30, 'Лекция': 20, 'Киртан': 60 },
      '2026-11-02': { 'Чтение': 10, 'Киртан': 60 },
      '2026-11-03': { 'Кругов за день': 16 },
    })
    const rows = insightRows(ps, GROUPS, null, {})
    expect(keys(rows)).not.toContain('d1')
    const s = rowSeries(rows, data, ps, null, TODAY)
    // d2 was never filled on 11-02 but is filled elsewhere: 0. 11-03 has a count value: both members are 0.
    expect(s.get('total:A')).toEqual(new Map([['2026-11-01', 50], ['2026-11-02', 10], ['2026-11-03', 0]]))
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
