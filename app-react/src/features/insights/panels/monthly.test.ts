import { describe, it, expect } from 'vitest'
import type { ChartPanel, Panel, ReportDataEntry } from '../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { eachDay } from '../overview/usual'
import { makeLookup } from './panelLogic'
import { japaPanels, sleepPanels } from './templates'
import { monthRows } from './monthly'

const P = (id: string, practice: string, data_type: PracticeDataType): UserPractice => ({ id, practice, data_type, is_active: true })
const e = (cob_date: string, practice: string, value: unknown): ReportDataEntry => ({ cob_date, practice, value })
const chart = (panels: Panel[], n = 0) => panels.filter((p) => p.kind === 'Chart')[n] as ChartPanel

const japa = chart(japaPanels({ total: 'r', target: 16, morning: null, quality: null, attunement: null }).panels)
const rounds = [P('r', 'Rounds', 'Int')]

describe('monthRows', () => {
  it('counts the current month up to today only, today once logged, and marks it so far', () => {
    const l = makeLookup([e('2026-11-01', 'Rounds', 16), e('2026-11-02', 'Rounds', 10)], undefined, rounds)
    const days = eachDay('2026-11-01', '2026-11-04')
    const [m] = monthRows(japa, days, l, '2026-11-04', '2026-11-01')
    expect(m).toMatchObject({ month: '2026-11', days: 3, done: 1, pct: 33, soFar: true })
    // Logged today: it counts.
    const [n] = monthRows(japa, days, makeLookup([e('2026-11-04', 'Rounds', 16)], undefined, rounds), '2026-11-04', '2026-11-01')
    expect(n).toMatchObject({ days: 4, done: 1 })
  })

  it('leaves out a month before the first logged day, and the days before it', () => {
    const l = makeLookup([e('2026-10-20', 'Rounds', 16)], undefined, rounds)
    const rows = monthRows(japa, eachDay('2026-09-01', '2026-10-31'), l, '2026-11-12', '2026-10-20')
    expect(rows.map((r) => [r.month, r.days, r.soFar])).toEqual([['2026-10', 12, false]])
  })

  it('takes the median of logged days only, a missing day not counted as 0, even count averaged', () => {
    const l = makeLookup([e('2026-10-01', 'Rounds', 10), e('2026-10-02', 'Rounds', 17), e('2026-10-03', 'Rounds', 0)], undefined, rounds)
    const [m] = monthRows(japa, eachDay('2026-10-01', '2026-10-31'), l, '2026-11-12', '2026-10-01')
    expect(m.median).toBe(13.5)
    expect(m).toMatchObject({ days: 31, done: 1, pct: 3 })
  })

  it('takes median bedtime and wake-up across midnight on the noon clock', () => {
    const sleep = sleepPanels({ bedtime: 'bed', wake: 'wake', nap: null, min: null, max: null }).panels
    const ps = [P('bed', 'Bedtime', 'Time'), P('wake', 'Wake', 'Time')]
    const T = (h: number, m = 0) => ({ Time: { h, m } })
    const l = makeLookup([
      e('2026-10-01', 'Bedtime', T(23, 30)), e('2026-10-02', 'Wake', T(6)),
      e('2026-10-02', 'Bedtime', T(0, 30)), e('2026-10-03', 'Wake', T(7)),
    ], undefined, ps)
    const [m] = monthRows(chart(sleep, 0), eachDay('2026-10-02', '2026-10-31'), l, '2026-11-12', '2026-10-01')
    // Noon clock: 23:30 → 690, 00:30 → 750, so midnight (720); wake 06:00 → 1080, 07:00 → 1140; 6h30 both nights.
    expect(m.range).toEqual([720, 1110])
    expect(m).toMatchObject({ done: 2, median: 390 })
  })
})
