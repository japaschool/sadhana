import { describe, it, expect } from 'vitest'
import type { AroundRow, ReportDataEntry, Source } from '../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { makeLookup } from './panelLogic'
import { aroundTable, eventOptions, gapEvents, gapFigures, rowKind, type GapEvent } from './gapLogic'

const P = (id: string, practice: string, data_type: PracticeDataType, dropdown_variants?: string): UserPractice =>
  ({ id, practice, data_type, is_active: true, ...(dropdown_variants && { dropdown_variants }) })
const e = (cob_date: string, practice: string, value: unknown): ReportDataEntry => ({ cob_date, practice, value })
const T = (h: number, m: number) => ({ Time: { h, m } })
const practices = [
  P('ev', 'Event', 'Bool'), P('tx', 'Note', 'Text'), P('dd', 'Kind', 'Text', 'Fast, Feast'),
  P('n', 'Rounds', 'Int'), P('t', 'Wake', 'Time'), P('d', 'Read', 'Duration'),
]
const lk = (entries: ReportDataEntry[], prev: ReportDataEntry[] = []) => makeLookup(entries, prev, practices)
const day = (d: number) => `2026-10-${String(d).padStart(2, '0')}`
const row = (practice: string): AroundRow => ({ label: null, source: { Practice: { practice } } })
const ev = (cob: string): GapEvent => ({ cob, option: null, prev: null, gap: null })

describe('gapEvents', () => {
  const oct = [day(2), day(3), day(5)]
  const sept = ['2026-09-28']
  const entries = [e(day(2), 'Event', { Bool: true }), e(day(3), 'Event', { Bool: false }), e(day(5), 'Event', { Bool: true })]

  it('measures each gap from the previous event, reaching into the previous window', () => {
    const l = lk(entries, [e('2026-09-28', 'Event', { Bool: true })])
    expect(gapEvents('ev', oct, sept, l)).toEqual([
      { cob: '2026-10-02', option: null, prev: '2026-09-28', gap: 4 },
      { cob: '2026-10-05', option: null, prev: '2026-10-02', gap: 3 },
    ])
  })

  it('the first event with nothing before it has no gap', () => {
    expect(gapEvents('ev', oct, [], lk(entries))[0]).toEqual({ cob: day(2), option: null, prev: null, gap: null })
  })

  it('a Text practice counts non-empty text; a dropdown sets the option', () => {
    const l = lk([e(day(1), 'Note', { Text: '' }), e(day(2), 'Note', { Text: 'hi' }), e(day(3), 'Kind', { Text: 'Fast' })])
    expect(gapEvents('tx', [day(1), day(2), day(3)], [], l).map((x) => [x.cob, x.option])).toEqual([[day(2), null]])
    expect(gapEvents('dd', [day(1), day(2), day(3)], [], l).map((x) => [x.cob, x.option])).toEqual([[day(3), 'Fast']])
  })

  it('lists current options first, then retired ones as seen', () => {
    const l = lk([e(day(1), 'Kind', { Text: 'Feast' }), e(day(2), 'Kind', { Text: 'Old' }), e(day(3), 'Kind', { Text: 'Fast' })])
    const events = gapEvents('dd', [day(1), day(2), day(3)], [], l)
    expect(eventOptions('dd', events, l)).toEqual(['Fast', 'Feast', 'Old'])
  })
})

describe('gapFigures', () => {
  const gaps = (gs: (number | null)[]): GapEvent[] => gs.map((gap, i) => ({ cob: day(i + 1), option: null, prev: null, gap }))

  it('typical gap needs 5 events and takes the median', () => {
    expect(gapFigures(gaps([null, 3, 5, 4, 10])).typical).toBe(5)
    expect(gapFigures(gaps([null, 3, 5, 4])).typical).toBeNull()
    expect(gapFigures(gaps([null, 3, 5, 4, 10, 7])).typical).toBe(5)
  })

  it('longest prefers the later of equal gaps; latest is the last with a gap', () => {
    const f = gapFigures(gaps([null, 6, 2, 6, 1]))
    expect(f.longest?.cob).toBe(day(4))
    expect(f.latest?.cob).toBe(day(5))
    expect(gapFigures(gaps([null]))).toEqual({ typical: null, longest: null, latest: null })
  })
})

describe('rowKind', () => {
  const l = lk([])
  it('maps types, Calc to Duration, and unknown to null', () => {
    expect(rowKind(row('n').source, l)).toBe('Count')
    expect(rowKind(row('d').source, l)).toBe('Duration')
    expect(rowKind(row('t').source, l)).toBe('Clock')
    expect(rowKind(row('ev').source, l)).toBeNull()
    expect(rowKind(row('gone').source, l)).toBeNull()
    const calc: Source = { Calc: { terms: [{ sign: 1, practice: 't', day_offset: 0, optional: false }] } }
    expect(rowKind(calc, l)).toBe('Duration')
  })
})

describe('aroundTable', () => {
  it('a Time row averages 23:30 and 00:30 to 00:00', () => {
    const l = lk([e(day(2), 'Wake', T(23, 30)), e(day(5), 'Wake', T(0, 30))])
    const [line] = aroundTable([row('t')], [ev(day(2)), ev(day(5))], [day(2), day(5)], l, day(20))
    expect(line.kind).toBe('Clock')
    expect(line.cells[1].value).toBe(720)
    expect(line.usual).toBe(720)
  })

  it('leaves out today for Int rows but keeps today for Time rows', () => {
    const l = lk([e(day(9), 'Rounds', { Int: 4 }), e(day(10), 'Rounds', { Int: 16 }), e(day(10), 'Wake', T(5, 0))])
    const [n, t] = aroundTable([row('n'), row('t')], [ev(day(10))], [day(9), day(10)], l, day(10))
    expect(n.cells[0].value).toBe(4)
    expect(n.cells[1].value).toBeNull()
    expect(n.usual).toBeNull() // only one past value
    expect(t.cells[1].value).toBe(((5 * 60 - 720) % 1440 + 1440) % 1440)
    expect(t.cells[2].value).toBeNull() // tomorrow: the future
  })

  it('colours a cell only from 0.3 SD, earlier is + for Clock rows', () => {
    // usual over days 1-2: 8 and 12 → mean 10, sd 2
    const base = [e(day(1), 'Rounds', { Int: 8 }), e(day(2), 'Rounds', { Int: 12 })]
    const step = (v: number) => {
      const l = lk([...base, e(day(10), 'Rounds', { Int: v })])
      return aroundTable([row('n')], [ev(day(10))], [day(1), day(2)], l, day(30))[0].cells[1].step
    }
    expect(step(10.5)).toBe(0)
    expect(step(10.6)).toBe(1)
    expect(step(11.2)).toBe(2)
    expect(step(12)).toBe(3)
    expect(step(8)).toBe(-3)

    // wake usual 06:00 ± 1h; an event-day 05:00 is earlier by 1 sd → +3
    const l = lk([e(day(1), 'Wake', T(5, 0)), e(day(2), 'Wake', T(7, 0)), e(day(10), 'Wake', T(5, 0))])
    expect(aroundTable([row('t')], [ev(day(10))], [day(1), day(2)], l, day(30))[0].cells[1].step).toBe(3)
  })

  it('a row with fewer than 2 values has no usual and no colour', () => {
    const l = lk([e(day(1), 'Rounds', { Int: 8 }), e(day(10), 'Rounds', { Int: 30 })])
    const [line] = aroundTable([row('n')], [ev(day(10))], [day(1)], l, day(30))
    expect(line.usual).toBeNull()
    expect(line.cells.map((c) => c.step)).toEqual([0, 0, 0, 0])
    expect(line.cells[1].value).toBe(30)
  })

  it('drops rows it cannot read', () => {
    expect(aroundTable([row('ev')], [ev(day(1))], [day(1)], lk([]), day(30))).toEqual([])
  })
})
