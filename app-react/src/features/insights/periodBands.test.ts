import { describe, expect, it } from 'vitest'
import type { MarkedPeriod } from '../../api/markedPeriods'
import { labelSpots, periodBands } from './periodBands'

const DAYS = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']
const P = (start_date: string, end_date: string | null, name = 'Retreat'): MarkedPeriod =>
  ({ id: name, name, start_date, end_date, exclude_from_usual: false })

describe('periodBands', () => {
  it('clips_to_window', () => {
    expect(periodBands([P('2026-09-20', '2026-10-02')], DAYS)).toEqual([{ x1: '2026-10-01', x2: '2026-10-02', name: 'Retreat', id: 'Retreat' }])
    expect(periodBands([P('2026-10-04', '2026-11-01')], DAYS)).toEqual([{ x1: '2026-10-04', x2: '2026-10-05', name: 'Retreat', id: 'Retreat' }])
  })
  it('open_period_runs_to_last_day', () => {
    expect(periodBands([P('2026-10-03', null)], DAYS)).toEqual([{ x1: '2026-10-03', x2: '2026-10-05', name: 'Retreat', id: 'Retreat' }])
  })
  it('outside_window_dropped', () => {
    expect(periodBands([P('2026-09-01', '2026-09-30'), P('2026-10-06', null)], DAYS)).toEqual([])
    expect(periodBands([P('2026-10-01', null)], [])).toEqual([])
  })
})

describe('labelSpots', () => {
  it('starts_at_the_band_and_stacks_names_that_would_touch', () => {
    // A 1px band still gets its full name; the next band starts inside that name, so it goes a lane down.
    expect(labelSpots([{ x1: 10, x2: 11, w: 60 }, { x1: 30, x2: 90, w: 40 }, { x1: 200, x2: 210, w: 40 }], 0, 400)).toEqual([
      { x: 13, anchor: 'start', lane: 0 }, { x: 33, anchor: 'start', lane: 1 }, { x: 203, anchor: 'start', lane: 0 },
    ])
  })
  it('ends_at_the_band_end_near_the_right_edge', () => {
    expect(labelSpots([{ x1: 380, x2: 395, w: 60 }], 0, 400)).toEqual([{ x: 392, anchor: 'end', lane: 0 }])
  })
})
