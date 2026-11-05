import { describe, it, expect } from 'vitest'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { fingerprint, fingerprintRows } from './fingerprint'
import { entries, practice, TODAY } from './fixtures'
import { rowSeries, type Series } from './series'
import { eachDay, shift } from './usual'
import { fromDateStr } from '../../today/date'

const row = { key: 'a', kind: 'Count' as const, practice: 'a', special: null }
const daily = (from: string, to: string, f: (d: string) => number): Series =>
  new Map(eachDay(from, to).map((d) => [d, f(d)]))
const monday = (d: string) => fromDateStr(d).getDay() === 1

describe('fingerprint', () => {
  it('fingerprint_needs_8_weeks', () => {
    const few = new Map([['a', daily(shift(TODAY, -40), TODAY, () => 3)]]) // 6 weeks
    expect(fingerprint([row], few, [], TODAY)).toBeNull()
    const enough = new Map([['a', daily(shift(TODAY, -62), TODAY, () => 3)]])
    expect(fingerprint([row], enough, [], TODAY)).not.toBeNull()
  })

  it('fingerprint_steps_by_weekday', () => {
    const s = new Map([['a', daily(shift(TODAY, -100), TODAY, (d) => (monday(d) ? 10 : 2))]])
    const [r] = fingerprint([row], s, [], TODAY)!
    expect(r.days[0].avg).toBe(10)
    expect(r.days[0].step).toBe(3)
    expect(r.days[1].avg).toBe(2)
    expect(r.days[1].step).toBe(-1)
  })

  it('fingerprint_skips_left_out_days', () => {
    const start = shift(TODAY, -100)
    const s = new Map([['a', daily(start, TODAY, (d) => (d >= '2026-09-01' && d <= '2026-09-30' ? 100 : 2))]])
    const p: MarkedPeriod = { id: 'p', name: 'x', start_date: '2026-09-01', end_date: '2026-09-30', exclude_from_usual: true }
    const [r] = fingerprint([row], s, [p], TODAY)!
    expect(r.typical).toBe(2)
    expect(fingerprint([row], s, [], TODAY)![0].typical).toBeGreaterThan(2)
    // left-out days don't count towards the 8 weeks either
    const only = new Map([['a', daily('2026-08-01', '2026-10-05', () => 1)]])
    const q: MarkedPeriod = { ...p, start_date: '2026-08-01', end_date: '2026-10-05' }
    expect(fingerprint([row], only, [q], TODAY)).toBeNull()
  })

  it('fingerprint_has_no_time_rows', () => {
    const ps = [
      practice('a', 'A', 'Int'), practice('t', 'T', 'Time'), practice('d', 'D', 'Duration'),
      practice('e', 'E', 'Int', { is_active: false }), practice('b', 'B', 'Bool'),
    ]
    expect(fingerprintRows(ps).map((r) => [r.key, r.kind, r.special])).toEqual([['a', 'Count', null], ['d', 'Duration', null]])
  })

  it('per_practice_duration_row_gets_a_series_with_empty_as_zero', () => {
    const ps = [practice('a', 'A', 'Int'), practice('d', 'D', 'Duration'), practice('d2', 'D2', 'Duration')]
    const data = entries({ '2026-11-01': { D: 30 }, '2026-11-02': { D: 20, D2: 5 } })
    const s = rowSeries(fingerprintRows(ps), data, ps, null, TODAY)
    expect(s.get('d')).toEqual(new Map([['2026-11-01', 30], ['2026-11-02', 20]]))
    expect(s.get('d2')).toEqual(new Map([['2026-11-01', 0], ['2026-11-02', 5]]))
  })
})
