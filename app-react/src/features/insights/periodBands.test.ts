import { describe, expect, it } from 'vitest'
import type { MarkedPeriod } from '../../api/markedPeriods'
import { periodBands } from './periodBands'

const DAYS = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']
const P = (start_date: string, end_date: string | null, name = 'Retreat'): MarkedPeriod =>
  ({ id: name, name, start_date, end_date, exclude_from_usual: false })

describe('periodBands', () => {
  it('clips_to_window', () => {
    expect(periodBands([P('2026-09-20', '2026-10-02')], DAYS)).toEqual([{ x1: '2026-10-01', x2: '2026-10-02', name: 'Retreat' }])
    expect(periodBands([P('2026-10-04', '2026-11-01')], DAYS)).toEqual([{ x1: '2026-10-04', x2: '2026-10-05', name: 'Retreat' }])
  })
  it('open_period_runs_to_last_day', () => {
    expect(periodBands([P('2026-10-03', null)], DAYS)).toEqual([{ x1: '2026-10-03', x2: '2026-10-05', name: 'Retreat' }])
  })
  it('outside_window_dropped', () => {
    expect(periodBands([P('2026-09-01', '2026-09-30'), P('2026-10-06', null)], DAYS)).toEqual([])
    expect(periodBands([P('2026-10-01', null)], [])).toEqual([])
  })
})
