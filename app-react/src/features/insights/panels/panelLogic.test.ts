import { describe, it, expect } from 'vitest'
import type { PanelsReport, ReportDataEntry, Source, Stat, Term } from '../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import type { TFunction } from 'i18next'
import { sleepPanels } from './templates'
import {
  makeLookup, windowDays, resolve, stateOf, statResult, visiblePanels, missingRequired, fitHours, chartRows, tipLines,
} from './panelLogic'

const P = (id: string, practice: string, data_type: PracticeDataType, is_active = true): UserPractice =>
  ({ id, practice, data_type, is_active })
const T = (h: number, m: number) => ({ Time: { h, m } })
const D = (n: number) => ({ Duration: n })
const e = (cob_date: string, practice: string, value: unknown): ReportDataEntry => ({ cob_date, practice, value })

const practices = [P('bed', 'Bedtime', 'Time'), P('wake', 'Wake', 'Time'), P('nap', 'Nap', 'Duration'), P('n', 'Count', 'Int')]
const range: Source = { Range: { from: { practice: 'bed', day_offset: -1 }, to: { practice: 'wake', day_offset: 0 } } }
const term = (sign: number, practice: string, day_offset: number, optional = false): Term => ({ sign, practice, day_offset, optional })
const sleepTerms = [term(1, 'wake', 0), term(-1, 'bed', -1)]
const calc = (terms: Term[]): Source => ({ Calc: { terms } })
const night = (wake: [number, number], bed: [number, number]) => [
  e('2026-10-05', 'Wake', T(...wake)), e('2026-10-04', 'Bedtime', T(...bed)),
]
const lk = (entries: ReportDataEntry[], prev?: ReportDataEntry[], ps = practices) => makeLookup(entries, prev, ps)

describe('resolve sleep', () => {
  it('23:00 to 07:00', () => {
    const l = lk(night([7, 0], [23, 0]))
    expect(resolve(calc(sleepTerms), '2026-10-05', l)).toBe(480)
    expect(resolve(range, '2026-10-05', l)).toEqual([660, 1140])
  })
  it('01:00 to 07:00', () => {
    const l = lk(night([7, 0], [1, 0]))
    expect(resolve(calc(sleepTerms), '2026-10-05', l)).toBe(360)
    expect(resolve(range, '2026-10-05', l)).toEqual([780, 1140])
  })
  it('missing sides give null', () => {
    for (const es of [[e('2026-10-05', 'Wake', T(7, 0))], [e('2026-10-04', 'Bedtime', T(23, 0))]]) {
      const l = lk(es)
      expect(resolve(calc(sleepTerms), '2026-10-05', l)).toBeNull()
      expect(resolve(range, '2026-10-05', l)).toBeNull()
    }
  })
  it('zero duration gives null', () => {
    const l = lk(night([7, 0], [7, 0]))
    expect(resolve(calc(sleepTerms), '2026-10-05', l)).toBeNull()
    expect(resolve(range, '2026-10-05', l)).toBeNull()
  })
  it('total with optional nap', () => {
    const total = calc([...sleepTerms, term(1, 'nap', 0, true)])
    expect(resolve(total, '2026-10-05', lk([...night([7, 0], [23, 0]), e('2026-10-05', 'Nap', D(30))]))).toBe(510)
    expect(resolve(total, '2026-10-05', lk(night([7, 0], [23, 0])))).toBe(480)
    expect(resolve(total, '2026-10-05', lk([e('2026-10-05', 'Nap', D(30))]))).toBeNull()
  })
  it('first night reads bedtime from previous', () => {
    const cur = [e('2026-10-05', 'Wake', T(7, 0))]
    const prev = [e('2026-10-04', 'Bedtime', T(23, 0))]
    expect(resolve(calc(sleepTerms), '2026-10-05', lk(cur, prev))).toBe(480)
    expect(resolve(calc(sleepTerms), '2026-10-05', lk(cur, undefined))).toBeNull()
  })
})

describe('retyped practices', () => {
  const total = calc([...sleepTerms, term(1, 'nap', 0, true)])
  const es = [...night([7, 0], [23, 0]), e('2026-10-05', 'Nap', D(30)),
    e('2026-10-05', 'Count', 5)]
  const retyped = (...ids: string[]) =>
    practices.map((p) => (ids.includes(p.id) ? { ...p, data_type: 'Int' as const } : p))
  it('Time source retyped to Int gives null', () => {
    const l = lk(es, undefined, retyped('bed'))
    expect(l.available('bed', 'Time')).toBe(false)
    expect(resolve(range, '2026-10-05', l)).toBeNull()
  })
  it('bedtime retyped', () => {
    const l = lk([...night([7, 0], [23, 0])].map((x) => (x.practice === 'Bedtime' ? e(x.cob_date, 'Bedtime', { Int: 23 }) : x)), undefined, retyped('bed'))
    expect(resolve(calc(sleepTerms), '2026-10-05', l)).toBeNull()
  })
  it('wake-up retyped', () => {
    expect(resolve(calc(sleepTerms), '2026-10-05', lk(es, undefined, retyped('wake')))).toBeNull()
  })
  it('both retyped', () => {
    expect(resolve(calc(sleepTerms), '2026-10-05', lk(es, undefined, retyped('bed', 'wake')))).toBeNull()
  })
  it('nap retyped is skipped', () => {
    expect(resolve(total, '2026-10-05', lk(es, undefined, retyped('nap')))).toBe(480)
  })
  it('required non-Duration term beside Time terms gives null', () => {
    expect(resolve(calc([...sleepTerms, term(1, 'n', 0)]), '2026-10-05', lk(es))).toBeNull()
  })
  it('Duration-only calc is a plain signed sum', () => {
    const l = lk([e('2026-10-05', 'Nap', D(30))])
    expect(resolve(calc([term(1, 'nap', 0), term(1, 'nap', 0)]), '2026-10-05', l)).toBe(60)
  })
  it('Time source retyped Int in lookup', () => {
    expect(lk([], undefined, retyped('bed')).type('bed')).toBe('Int')
  })
})

describe('stateOf', () => {
  it('bands', () => {
    const t = { min: 360, max: 540 }
    expect([359, 360, 540, 541].map((v) => stateOf(v, t))).toEqual(['under', 'ok', 'ok', 'over'])
    expect(stateOf(1000, { min: 360, max: null })).toBe('ok')
    expect(stateOf(100, { min: null, max: 540 })).toBe('ok')
    expect(stateOf(100, { min: null, max: null })).toBe('neutral')
    expect(stateOf(null, t)).toBeNull()
  })
})

describe('averages', () => {
  it('bedtime across midnight', () => {
    const es = [
      e('2026-10-05', 'Wake', T(7, 0)), e('2026-10-04', 'Bedtime', T(23, 30)),
      e('2026-10-06', 'Wake', T(7, 0)), e('2026-10-05', 'Bedtime', T(0, 30)),
    ]
    const l = lk(es)
    const v = { Average: { of: range, pick: 'From' as const, format: 'NoonClock' as const, scope: { today: true, missing_zero: false } } }
    expect(statResult(v, ['2026-10-05', '2026-10-06'], l, '2026-10-07').value).toBe(720)
  })
})

describe('statResult', () => {
  const nap: Source = { Practice: { practice: 'nap' } }
  const l = lk([
    e('2026-10-01', 'Nap', D(10)), e('2026-10-02', 'Nap', D(25)), e('2026-10-04', 'Nap', D(40)),
  ])
  const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']
  it('OnTarget counts logged days', () => {
    const v = { OnTarget: { of: nap, min: 20, max: null, scope: { today: true, missing_zero: false } } }
    expect(statResult(v, days, l, '2026-10-09')).toEqual({ value: 2, of: 3 })
  })
  it('Logged counts days', () => {
    expect(statResult({ Logged: { of: nap, scope: { today: true, missing_zero: false } } }, days, l, '2026-10-09').value).toBe(3)
  })
  it('today in, missing skipped', () => {
    const v = { Average: { of: nap, pick: null, format: 'Duration' as const, scope: { today: true, missing_zero: false } } }
    expect(statResult(v, days, l, '2026-10-04').value).toBe(25)
  })
  it('today out, missing zero, floored', () => {
    const v = { Average: { of: nap, pick: null, format: 'Duration' as const, scope: { today: false, missing_zero: true } } }
    expect(statResult(v, days, l, '2026-10-04').value).toBe(11) // 35 / 3
  })
  it('nothing logged gives null', () => {
    const v = { Average: { of: nap, pick: null, format: 'Duration' as const, scope: { today: true, missing_zero: true } } }
    expect(statResult(v, ['2026-10-09'], l, '2026-10-10').value).toBeNull()
  })
})

describe('visiblePanels', () => {
  const pr = (practice: string): Source => ({ Practice: { practice } })
  const series = (source: Source, only_with: number | null = null) =>
    ({ label: null, mark: 'Bar' as const, source, axis: 'Left' as const, only_with })
  const chart = (s: ReturnType<typeof series>[], format: 'Duration' | 'Count' = 'Count') => ({
    kind: 'Chart' as const, title: null, series: s, bar_layout: 'Grouped' as const, format,
    reversed: false, target: null, lines: [],
  })
  const def = (panels: PanelsReport['panels']): PanelsReport => ({ version: 1, template: null, required: [], panels })
  const l = lk([])

  it('drops unavailable series and empty charts; deleted ids do not throw', () => {
    const out = visiblePanels(def([chart([series(pr('n')), series(pr('gone'))]), chart([series(pr('gone'))])]), l)
    expect(out).toHaveLength(1)
    expect((out[0] as { series: unknown[] }).series).toHaveLength(1)
  })
  it('optional missing term keeps series', () => {
    const src = calc([term(1, 'nap', 0), term(1, 'gone', 0, true)])
    expect(visiblePanels(def([chart([series(src)])]), l)).toHaveLength(1)
    expect(visiblePanels(def([chart([series(calc([term(1, 'gone', 0)]))])]), l)).toHaveLength(0)
  })
  it('drops stats with unavailable sources, keeps the rest', () => {
    const stat = (practice: string): Stat => ({ label: { Text: 'x' }, value: { Logged: { of: pr(practice), scope: { today: true, missing_zero: false } } }, under: null })
    const out = visiblePanels(def([{ kind: 'Stats', stats: [stat('n'), stat('gone')] }, { kind: 'Stats', stats: [stat('gone')] }]), l)
    expect(out).toHaveLength(1)
    expect((out[0] as { stats: unknown[] }).stats).toHaveLength(1)
  })
  it('drops a Practice series of the wrong type in a Duration chart', () => {
    expect(visiblePanels(def([chart([series(pr('n'))], 'Duration')]), l)).toHaveLength(0)
    expect(visiblePanels(def([chart([series(pr('nap'))], 'Duration')]), l)).toHaveLength(1)
  })
  it('hidden practice is unavailable', () => {
    const hidden = lk([], undefined, practices.map((p) => (p.id === 'n' ? { ...p, is_active: false } : p)))
    expect(visiblePanels(def([chart([series(pr('n'))])]), hidden)).toHaveLength(0)
  })
  it('missingRequired lists unavailable rows', () => {
    const d = { ...def([]), required: [
      { practice: 'n', label: { Text: 'a' } }, { practice: 'gone', label: { Text: 'b' } },
    ] }
    const hidden = lk([], undefined, practices.map((p) => (p.id === 'n' ? { ...p, is_active: false } : p)))
    expect(missingRequired(d, hidden).map((r) => r.practice)).toEqual(['n', 'gone'])
    expect(missingRequired(d, l).map((r) => r.practice)).toEqual(['gone'])
  })
})

describe('windowDays and fitHours', () => {
  it('sorted unique', () => {
    expect(windowDays([e('b', 'x', 1), e('a', 'x', 1), e('b', 'y', 1)])).toEqual(['a', 'b'])
  })
  it('fitHours', () => {
    expect(fitHours([690, 1140])).toEqual([660, 1200])
    expect(fitHours([])).toEqual([0, 720])
  })
})

describe('chart rows and tips', () => {
  const def = sleepPanels({ bedtime: 'bed', wake: 'wake', nap: 'nap', min: 360, max: 540 })
  const charts = def.panels.flatMap((p) => (p.kind === 'Chart' ? [p] : []))
  const t = ((k: string) => k) as unknown as TFunction
  const u = { h: 'h', min: 'min' }
  const day = '2026-10-05'

  it('a row has a column per series and the state of the total', () => {
    const l = lk([...night([7, 0], [23, 0]), e(day, 'Nap', D(90))])
    expect(chartRows(charts[1], [day], l)).toEqual([{ cob: day, state: 'over', s0: 480, s1: 90 }])
    expect(chartRows(charts[0], [day], l)).toEqual([{ cob: day, state: 'over', s0: [660, 1140] }])
  })

  it('a nap without its night is dropped, and a zero nap draws nothing', () => {
    expect(chartRows(charts[1], [day], lk([e(day, 'Wake', T(7, 0)), e(day, 'Nap', D(30))]))[0])
      .toEqual({ cob: day, state: null, s0: null, s1: null })
    expect(chartRows(charts[1], [day], lk([...night([7, 0], [23, 0]), e(day, 'Nap', D(0))]))[0].s1).toBeNull()
  })

  it('the tip reads bedtime to wake-up, night, nap, total', () => {
    const l = lk([...night([7, 0], [23, 0]), e(day, 'Nap', D(30))])
    expect(tipLines(def.panels, day, l, t, u).map((x) => [x.name, x.text])).toEqual([
      ['reportPanels.sleep', '23:00 → 07:00'],
      ['reportPanels.night', '8 h'],
      ['reportPanels.nap', '30 min'],
      ['reportPanels.total', '8 h 30 min'],
    ])
    expect(tipLines(def.panels, '2026-10-04', l, t, u)).toEqual([])
  })

  it('Logged says how many days it counted', () => {
    const scope = { today: true, missing_zero: false }
    expect(statResult({ Logged: { of: range, scope } }, ['2026-10-04', day], lk(night([7, 0], [23, 0])), day))
      .toEqual({ value: 1, of: 2 })
  })
})
