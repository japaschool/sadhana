import { describe, it, expect } from 'vitest'
import type { ReportDataEntry } from '../../api/charts'
import type { Trace } from '../../pages/charts/chartLogic'
import {
  averageDailyTotal, headline, formatHeadline, formatDelta, averageLines,
  traceAverageLabel, formatDay, windowLabel, formatDurationTick,
} from './insightsLogic'

const TODAY = '2026-10-06'
const U = { h: 'h', min: 'min' }
const e = (cob_date: string, practice: string, value: unknown): ReportDataEntry => ({ cob_date, practice, value })
const tr = (name: string, dataType: Trace['dataType'], extra: Partial<Trace> = {}): Trace => ({
  name, dataType, type_: { Line: { style: 'Regular' } }, color: `c-${name}`, showAverage: false, yAxis: null, ...extra,
})
const dur = (n: number) => ({ Duration: n })

describe('averageDailyTotal', () => {
  it('sums traces per day, counts missing as 0, floors', () => {
    const rows = [
      e('2026-10-04', 'A', dur(30)), e('2026-10-04', 'B', dur(10)),
      e('2026-10-05', 'A', dur(25)), e('2026-10-05', 'B', null),
      e('2026-10-05', 'Other', dur(999)),
    ]
    expect(averageDailyTotal(rows, [tr('A', 'Duration'), tr('B', 'Duration')], TODAY)).toBe(32) // 65 / 2
  })
  it('excludes today from the daily total', () => {
    const rows = [e('2026-10-05', 'A', dur(60)), e(TODAY, 'A', dur(0))]
    expect(averageDailyTotal(rows, [tr('A', 'Duration')], TODAY)).toBe(60)
  })
  it('is null when nothing was logged', () => {
    expect(averageDailyTotal([e('2026-10-05', 'A', null)], [tr('A', 'Duration')], TODAY)).toBeNull()
  })
})

describe('headline', () => {
  const cur = [e('2026-10-04', 'A', dur(40)), e('2026-10-05', 'A', dur(60))]
  const prev = [e('2026-09-03', 'A', dur(40)), e('2026-09-04', 'A', dur(40))]

  it('all Duration → average daily total with delta', () => {
    expect(headline([tr('A', 'Duration')], cur, prev, TODAY)).toEqual({ kind: 'duration', value: 50, delta: 25 })
  })
  it('all Int → count', () => {
    const rows = [e('2026-10-04', 'N', { Int: 3 }), e('2026-10-05', 'N', { Int: 4 })]
    expect(headline([tr('N', 'Int')], rows, undefined, TODAY)).toEqual({ kind: 'count', value: 3, delta: null })
  })
  it('exactly one Time → its average time, never a delta', () => {
    const rows = [e('2026-10-04', 'W', { Time: { h: 5, m: 0 } }), e('2026-10-05', 'W', { Time: { h: 5, m: 30 } })]
    expect(headline([tr('W', 'Time')], rows, rows, TODAY)).toEqual({ kind: 'time', value: 315, delta: null })
  })
  it('anything else → no headline', () => {
    expect(headline([tr('A', 'Duration'), tr('N', 'Int')], cur, prev, TODAY)).toBeNull()
    expect(headline([tr('B', 'Bool')], cur, prev, TODAY)).toBeNull()
    expect(headline([tr('W', 'Time'), tr('X', 'Time')], cur, prev, TODAY)).toBeNull()
    expect(headline([], cur, prev, TODAY)).toBeNull()
  })
  it('no headline when nothing was logged', () => {
    expect(headline([tr('A', 'Duration')], [e('2026-10-05', 'A', null)], prev, TODAY)).toBeNull()
  })
  it('hides the delta without previous data or when previous is 0', () => {
    expect(headline([tr('A', 'Duration')], cur, undefined, TODAY)!.delta).toBeNull()
    expect(headline([tr('A', 'Duration')], cur, [e('2026-09-04', 'A', null)], TODAY)!.delta).toBeNull()
    expect(headline([tr('A', 'Duration')], cur, [e('2026-09-04', 'A', dur(0))], TODAY)!.delta).toBeNull()
  })
  it('rounds the delta to a whole percent', () => {
    const p45 = [e('2026-09-04', 'A', dur(45))]
    expect(headline([tr('A', 'Duration')], cur, p45, TODAY)!.delta).toBe(11) // 50 vs 45 = 11.1%
    const c40 = [e('2026-10-05', 'A', dur(40))]
    expect(headline([tr('A', 'Duration')], c40, p45, TODAY)!.delta).toBe(-11)
  })
})

describe('formatting', () => {
  it('formatHeadline per kind', () => {
    expect(formatHeadline({ kind: 'duration', value: 128, delta: null }, U)).toBe('2 h 8 min')
    expect(formatHeadline({ kind: 'count', value: 16, delta: null }, U)).toBe('16')
    expect(formatHeadline({ kind: 'time', value: 1470, delta: null }, U)).toBe('00:30')
  })
  it('formatDelta signs', () => {
    expect(formatDelta(12)).toBe('+12%')
    expect(formatDelta(-8)).toBe('−8%')
    expect(formatDelta(0)).toBe('+0%')
  })
  it('formatDurationTick', () => {
    const u = { h: 'h', min: 'm' }
    expect([30, 60, 90, 125, 0].map((m) => formatDurationTick(m, u))).toEqual(['30m', '1h', '1h30', '2h05', '0m'])
  })
  it('window labels', () => {
    expect(formatDay('2026-09-07', 'en')).toBe('Sep 7')
    expect(windowLabel([e('2026-09-07', 'A', null), e('2026-10-06', 'A', null)], 'en')).toBe('Sep 7 – Oct 6')
    expect(windowLabel([], 'en')).toBe('')
  })
})

describe('traceAverageLabel', () => {
  it('yes/no shows done over past days', () => {
    const rows = [
      e('2026-10-03', 'R', { Bool: true }), e('2026-10-04', 'R', { Bool: false }),
      e('2026-10-05', 'R', { Bool: true }), e(TODAY, 'R', { Bool: true }),
    ]
    expect(traceAverageLabel(tr('R', 'Bool'), rows, TODAY, U)).toBe('2/3')
  })
  it('duration, time, count and no data', () => {
    expect(traceAverageLabel(tr('A', 'Duration'), [e('2026-10-05', 'A', dur(128))], TODAY, U)).toBe('2 h 8 min')
    expect(traceAverageLabel(tr('W', 'Time'), [e('2026-10-05', 'W', { Time: { h: 5, m: 15 } })], TODAY, U)).toBe('05:15')
    expect(traceAverageLabel(tr('N', 'Int'), [e('2026-10-05', 'N', { Int: 7 })], TODAY, U)).toBe('7')
    expect(traceAverageLabel(tr('N', 'Int'), [], TODAY, U)).toBe('—')
  })
})

describe('averageLines', () => {
  const rows = [e('2026-10-05', 'A', dur(30)), e('2026-10-05', 'B', dur(20))]
  it('one line per trace with show_average, in its colour and on its axis', () => {
    const traces = [tr('A', 'Duration', { showAverage: true, yAxis: 'Y2' }), tr('B', 'Duration')]
    expect(averageLines(traces, rows, 'Grouped', TODAY)).toEqual([{ axis: 'num-right', value: 30, color: 'c-A' }])
  })
  it('stacked: one accent line at the average total of the bars', () => {
    const traces = [tr('A', 'Duration', { type_: 'Bar', showAverage: true }), tr('B', 'Duration', { type_: 'Bar' })]
    expect(averageLines(traces, rows, 'Stacked', TODAY)).toEqual([{ axis: 'num', value: 50, color: 'var(--ui-accent)' }])
  })
  it('none when no trace asks for one', () => {
    expect(averageLines([tr('A', 'Duration', { type_: 'Bar' })], rows, 'Stacked', TODAY)).toEqual([])
  })
})
