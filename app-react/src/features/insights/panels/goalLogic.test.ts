import { describe, it, expect } from 'vitest'
import type { Goal, ReportDataEntry } from '../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { daysLeft, goalAvailable, goalSquares, loggedDays, periodOf, squareState } from './goalLogic'
import { makeLookup } from './panelLogic'

const P = (id: string, practice: string, data_type: PracticeDataType, is_active = true): UserPractice =>
  ({ id, practice, data_type, is_active })
const entry = (cob_date: string, practice: string, value: unknown): ReportDataEntry => ({ cob_date, practice, value })
const practices = [P('x', 'Rounds', 'Int'), P('y', 'Other', 'Int'), P('b', 'Yes', 'Bool'), P('d', 'Sit', 'Duration'), P('t', 'Note', 'Text')]
const goal = (practice: string, o: Partial<Goal> = {}): Goal =>
  ({ practice, direction: 'AtLeast', amount: 10, period: 'Week', counts: 'Total', ...o })
const run = (g: Goal, entries: ReportDataEntry[], today = '2026-11-06') =>
  goalSquares(g, makeLookup(entries, undefined, practices), loggedDays(entries), today)
const brief = (sq: ReturnType<typeof run>) => sq.map(({ from, value, state }) => ({ from, value, state }))

describe('squareState', () => {
  it('at least', () => {
    expect(squareState('AtLeast', 100, 100, false, false)).toEqual({ state: 'full', fill: 1 })
    expect(squareState('AtLeast', 95, 100, false, false)).toEqual({ state: 'part', fill: 0.9 })
    expect(squareState('AtLeast', 50, 100, false, false)).toEqual({ state: 'part', fill: 0.5 })
    expect(squareState('AtLeast', 0, 5, true, false)).toEqual({ state: 'part', fill: 0 })
  })
  it('no more than', () => {
    expect(squareState('AtMost', 0, 5, false, false)).toEqual({ state: 'full', fill: 1 })
    expect(squareState('AtMost', 1, 5, false, false)).toEqual({ state: 'part', fill: 0.8 })
    expect(squareState('AtMost', 5, 5, false, false)).toEqual({ state: 'limit', fill: 0 })
    expect(squareState('AtMost', 6, 5, false, false)).toEqual({ state: 'over', fill: 0 })
    expect(squareState('AtMost', 6, 5, true, false)).toEqual({ state: 'over', fill: 0 })
    expect(squareState('AtMost', 0, 0, false, false)).toEqual({ state: 'full', fill: 1 })
    expect(squareState('AtMost', 1, 0, false, false)).toEqual({ state: 'over', fill: 0 })
  })
  it('blank past periods, both directions', () => {
    expect(squareState('AtMost', 0, 5, false, true).state).toBe('blank')
    expect(squareState('AtLeast', 0, 5, false, true).state).toBe('blank')
  })
})

describe('periodOf', () => {
  it('days', () => expect(periodOf('2026-11-06', 'Day')).toEqual({ from: '2026-11-06', to: '2026-11-06' }))
  it('weeks start on Monday and cross years', () => {
    expect(periodOf('2026-01-01', 'Week')).toEqual({ from: '2025-12-29', to: '2026-01-04' })
    expect(periodOf('2026-11-08', 'Week')).toEqual({ from: '2026-11-02', to: '2026-11-08' })
    expect(periodOf('2026-11-02', 'Week')).toEqual({ from: '2026-11-02', to: '2026-11-08' })
  })
  it('months of different lengths', () => {
    expect(periodOf('2026-02-10', 'Month')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(periodOf('2028-02-10', 'Month').to).toBe('2028-02-29')
  })
})

describe('loggedDays and goalAvailable', () => {
  it('null values do not log a day', () => {
    expect([...loggedDays([entry('2026-11-01', 'Rounds', null), entry('2026-11-02', 'Rounds', { Int: 0 })])]).toEqual(['2026-11-02'])
  })
  it('only Bool, Int and Duration that are active', () => {
    const l = makeLookup([], undefined, [...practices, P('h', 'Hidden', 'Int', false)])
    expect(['x', 'b', 'd'].map((p) => goalAvailable(goal(p), l))).toEqual([true, true, true])
    expect(['t', 'h', 'zz'].map((p) => goalAvailable(goal(p), l))).toEqual([false, false, false])
  })
  it('a days goal on a practice that is no longer Duration was retyped, so it is gone', () => {
    const l = makeLookup([], undefined, practices)
    expect(['d', 'x', 'b'].map((p) => goalAvailable(goal(p, { counts: 'Days' }), l))).toEqual([true, false, false])
  })
})

describe('goalSquares', () => {
  // today 2026-11-06 (Friday); this week 11-02..11-08, last week 10-26..11-01
  it('a blank on a logged day counts as 0, an unlogged week is blank', () => {
    const es = [
      entry('2026-10-19', 'Rounds', { Int: 4 }),
      entry('2026-10-28', 'Other', { Int: 1 }),
      entry('2026-11-03', 'Rounds', { Int: 3 }),
    ]
    expect(brief(run(goal('x'), es))).toEqual([
      { from: '2026-10-19', value: 4, state: 'part' },
      { from: '2026-10-26', value: 0, state: 'part' },
      { from: '2026-11-02', value: 3, state: 'part' },
    ])
    const gap = [entry('2026-10-12', 'Rounds', { Int: 4 }), entry('2026-11-03', 'Rounds', { Int: 12 })]
    expect(brief(run(goal('x'), gap))).toEqual([
      { from: '2026-10-12', value: 4, state: 'part' },
      { from: '2026-10-19', value: 0, state: 'blank' },
      { from: '2026-10-26', value: 0, state: 'blank' },
      { from: '2026-11-02', value: 12, state: 'full' },
    ])
  })
  it('AtMost month with nothing logged is blank, not met', () => {
    const es = [entry('2026-09-10', 'Rounds', { Int: 2 })]
    expect(brief(run(goal('x', { direction: 'AtMost', amount: 5, period: 'Month' }), es))).toEqual([
      { from: '2026-09-01', value: 2, state: 'part' },
      { from: '2026-10-01', value: 0, state: 'blank' },
      { from: '2026-11-01', value: 0, state: 'full' },
    ])
  })
  it('weeks cross a year', () => {
    const es = [entry('2025-12-30', 'Rounds', { Int: 10 }), entry('2026-01-02', 'Rounds', { Int: 5 })]
    const sq = run(goal('x'), es, '2026-01-07')
    expect(brief(sq)).toEqual([
      { from: '2025-12-29', value: 15, state: 'full' },
      { from: '2026-01-05', value: 0, state: 'part' },
    ])
    expect(sq[0].to).toBe('2026-01-04')
  })
  it('today being a Sunday ends the running week today', () => {
    const sq = run(goal('x'), [entry('2026-11-08', 'Rounds', { Int: 2 })], '2026-11-08')
    expect(brief(sq)).toEqual([{ from: '2026-11-02', value: 2, state: 'part' }])
    expect(daysLeft(sq[0], '2026-11-08')).toBe(1)
  })
  it('starts at the first period with a value, at most 12 squares', () => {
    const three = run(goal('x'), [entry('2026-10-14', 'Rounds', { Int: 1 })])
    expect(three.map((s) => s.from)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'])
    const year = run(goal('x'), [entry('2025-11-06', 'Rounds', { Int: 1 })])
    expect(year).toHaveLength(12)
    expect(year[0].from).toBe('2026-08-17')
    expect(year[11].running).toBe(true)
    expect(year.slice(0, 11).every((s) => !s.running)).toBe(true)
    const none = run(goal('x'), [entry('2026-11-03', 'Other', { Int: 1 })])
    expect(brief(none)).toEqual([{ from: '2026-11-02', value: 0, state: 'part' }])
  })
  it('Duration by Days counts days above 0, Total sums minutes', () => {
    const es = [
      entry('2026-11-02', 'Sit', { Duration: 30 }), entry('2026-11-03', 'Sit', { Duration: 0 }),
      entry('2026-11-04', 'Sit', { Duration: 45 }),
    ]
    expect(brief(run(goal('d', { counts: 'Days', amount: 3 }), es))).toEqual([{ from: '2026-11-02', value: 2, state: 'part' }])
    expect(brief(run(goal('d', { counts: 'Total', amount: 60 }), es))).toEqual([{ from: '2026-11-02', value: 75, state: 'full' }])
  })
  it('Bool counts days marked yes', () => {
    const es = [
      entry('2026-11-02', 'Yes', { Bool: true }), entry('2026-11-03', 'Yes', { Bool: false }), entry('2026-11-04', 'Yes', { Bool: true }),
    ]
    expect(brief(run(goal('b', { amount: 2 }), es))).toEqual([{ from: '2026-11-02', value: 2, state: 'full' }])
  })
  it('the running period counts days up to today only, and is never blank', () => {
    const es = [entry('2026-11-05', 'Rounds', { Int: 2 }), entry('2026-11-07', 'Rounds', { Int: 50 })]
    expect(brief(run(goal('x', { direction: 'AtMost', amount: 3 }), es))).toEqual([{ from: '2026-11-02', value: 2, state: 'part' }])
    const day = run(goal('x', { period: 'Day', direction: 'AtMost', amount: 3 }), [])
    expect(brief(day)).toEqual([{ from: '2026-11-06', value: 0, state: 'full' }])
  })
  it('a Day goal lists one square per day, running last', () => {
    const sq = run(goal('x', { period: 'Day' }), [entry('2026-11-04', 'Rounds', { Int: 10 })])
    expect(brief(sq)).toEqual([
      { from: '2026-11-04', value: 10, state: 'full' },
      { from: '2026-11-05', value: 0, state: 'blank' },
      { from: '2026-11-06', value: 0, state: 'part' },
    ])
  })
})

describe('daysLeft', () => {
  const sq = (from: string, to: string) => ({ from, to, value: 0, running: true, state: 'part' as const, fill: 0 })
  it('includes today', () => {
    expect(daysLeft(sq('2026-11-02', '2026-11-08'), '2026-11-06')).toBe(3)
    expect(daysLeft(sq('2026-11-01', '2026-11-30'), '2026-11-06')).toBe(25)
  })
  it('is null for a Day goal', () => expect(daysLeft(sq('2026-11-06', '2026-11-06'), '2026-11-06')).toBeNull())
})
