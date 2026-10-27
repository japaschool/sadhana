import { describe, expect, it } from 'vitest'
import type { YatraPractice } from '../../../types/api'
import { aggregationsFor, newStatistic, statValue, withPractice } from './statistics'

const u = { h: 'h', min: 'min' }
const japa: YatraPractice = { id: 'p1', practice: 'Japa rounds', data_type: 'Int' }
const wake: YatraPractice = { id: 'p2', practice: 'Wake up', data_type: 'Time' }
const arati: YatraPractice = { id: 'p4', practice: 'Mangala arati', data_type: 'Bool' }

describe('statistics', () => {
  it('offers only aggregations that mean something for the type', () => {
    expect(aggregationsFor('Int')).toEqual(['Sum', 'Avg', 'Min', 'Max', 'Count'])
    expect(aggregationsFor('Time')).toEqual(['Avg', 'Min', 'Max', 'Count'])
    expect(aggregationsFor('Bool')).toEqual(['Count'])
    expect(aggregationsFor('Text')).toEqual(['Count'])
  })

  it('switches to Count when the new practice cannot take the aggregation', () => {
    const sum = { label: 'x', practice_id: 'p1', aggregation: 'Sum' as const, time_range: 'ThisWeek' as const }
    expect(withPractice(sum, wake)).toMatchObject({ practice_id: 'p2', aggregation: 'Count' })
    expect(withPractice({ ...sum, aggregation: 'Min' }, wake).aggregation).toBe('Min')
  })

  it('defaults a new statistic to the first measurable practice, Average, last 30 days', () => {
    expect(newStatistic([arati, japa])).toEqual({ label: 'Japa rounds', practice_id: 'p1', aggregation: 'Avg', time_range: 'Last30Days' })
    expect(newStatistic([arati])).toMatchObject({ practice_id: 'p4', aggregation: 'Count' })
    expect(newStatistic([])).toBeNull()
  })

  it('formats tile values, unwrapping counts and fractional averages', () => {
    expect(statValue({ Int: 15.83 }, 'Avg', 'Int', u)).toBe('15.8')
    expect(statValue({ Time: { h: 1, m: 52 } }, 'Count', 'Time', u)).toBe('112')
    expect(statValue({ Time: { h: 3, m: 55 } }, 'Min', 'Time', u)).toBe('03:55')
    expect(statValue({ Time: { h: 4.25, m: 15.4 } }, 'Avg', 'Time', u)).toBe('04:15')
    expect(statValue({ Duration: 2480 }, 'Sum', 'Duration', u)).toBe('41 h 20 min')
    expect(statValue(null, 'Sum', 'Int', u)).toBe('—')
  })
})
