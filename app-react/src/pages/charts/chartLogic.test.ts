// app-react/src/pages/charts/chartLogic.test.ts
import { describe, it, expect } from 'vitest'
import {
  axisKindFor, valueToNumber, computeTimeOverflow,
  buildChartData, averageForType, formatMinutesAsHHMM,
  chartUnitFor, groupTracesByUnit,
} from './chartLogic'

describe('axisKindFor', () => {
  it('routes data types to axes', () => {
    expect(axisKindFor('Int')).toBe('num')
    expect(axisKindFor('Duration')).toBe('num')
    expect(axisKindFor('Time')).toBe('time')
    expect(axisKindFor('Bool')).toBe('unit')
    expect(axisKindFor('Text')).toBe('unit')
  })
})

describe('valueToNumber', () => {
  it('Int passthrough', () => {
    expect(valueToNumber({ Int: 5 }, 'Int')).toBe(5)
    expect(valueToNumber(null, 'Int')).toBeNull()
  })
  it('Duration → minutes', () => {
    expect(valueToNumber({ Duration: 45 }, 'Duration')).toBe(45)
  })
  it('Bool true → 1, false → null (gap)', () => {
    expect(valueToNumber({ Bool: true }, 'Bool')).toBe(1)
    expect(valueToNumber({ Bool: false }, 'Bool')).toBeNull()
  })
  it('Text present → 1, empty/missing → null', () => {
    expect(valueToNumber({ Text: 'note' }, 'Text')).toBe(1)
    expect(valueToNumber({ Text: '' }, 'Text')).toBeNull()
    expect(valueToNumber(null, 'Text')).toBeNull()
  })
  it('Time → minutes of day', () => {
    expect(valueToNumber({ Time: { h: 6, m: 30 } }, 'Time')).toBe(390)
  })
})

describe('computeTimeOverflow', () => {
  it('mostly-evening with a morning straggler → +1', () => {
    expect(computeTimeOverflow([22, 23, 23, 1])).toBe(1)
  })
  it('mostly-morning with an evening straggler → -1', () => {
    expect(computeTimeOverflow([6, 7, 5, 23])).toBe(-1)
  })
  it('tie and empty default to +1', () => {
    expect(computeTimeOverflow([])).toBe(1)
    expect(computeTimeOverflow([10, 22])).toBe(1)
  })
})

describe('buildChartData', () => {
  it('keys rows by practice name and maps values', () => {
    const rows = buildChartData(
      [{ cob_date: '2026-08-01', practice: 'Reading', value: { Bool: true } }],
      [{ name: 'Reading', dataType: 'Bool' }],
      'en',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].Reading).toBe(1)
    expect(rows[0].cob).toBe('2026-08-01')
  })
  it('applies time overflow so a post-midnight value sits above the evening cluster', () => {
    const rows = buildChartData(
      [
        { cob_date: '2026-08-01', practice: 'Sleep', value: { Time: { h: 23, m: 0 } } },
        { cob_date: '2026-08-02', practice: 'Sleep', value: { Time: { h: 0, m: 30 } } },
      ],
      [{ name: 'Sleep', dataType: 'Time' }],
      'en',
    )
    // evening 23:00 → 1380; 00:30 shifted +1440 → 1470 (stays adjacent, not far below)
    expect(rows[0].Sleep).toBe(1380)
    expect(rows[1].Sleep).toBe(1470)
  })
})

describe('averageForType', () => {
  const today = '2026-08-08'
  it('Int mean excludes today', () => {
    const entries = [
      { cob_date: '2026-08-06', value: { Int: 2 } },
      { cob_date: '2026-08-07', value: { Int: 4 } },
      { cob_date: today, value: { Int: 100 } },
    ]
    expect(averageForType(entries, 'Int', today)).toBe(3)
  })
  it('Bool/Text have no average', () => {
    expect(averageForType([{ cob_date: '2026-08-06', value: { Bool: true } }], 'Bool', today)).toBeNull()
    expect(averageForType([{ cob_date: '2026-08-06', value: { Text: 'x' } }], 'Text', today)).toBeNull()
  })
  it('Int mean counts a missing day as 0 in the denominator (Rust parity)', () => {
    const entries = [
      { cob_date: '2026-08-05', value: { Int: 4 } },
      { cob_date: '2026-08-06', value: null },
      { cob_date: today, value: { Int: 100 } },
    ]
    expect(averageForType(entries, 'Int', today)).toBe(2) // (4 + 0) / 2, floored
  })

  it('Time average is overflow-aware (minutes)', () => {
    const entries = [
      { cob_date: '2026-08-05', value: { Time: { h: 23, m: 0 } } },
      { cob_date: '2026-08-06', value: { Time: { h: 1, m: 0 } } },
    ]
    expect(averageForType(entries, 'Time', today)).toBe(1440) // 1380 + 1500, /2
  })
})

describe('formatMinutesAsHHMM', () => {
  it('formats minutes, wrapping past a day', () => {
    expect(formatMinutesAsHHMM(390)).toBe('06:30')
    expect(formatMinutesAsHHMM(1470)).toBe('00:30')
  })
})

describe('chartUnitFor', () => {
  it('maps each data type to its charting unit', () => {
    expect(chartUnitFor('Duration')).toBe('duration')
    expect(chartUnitFor('Int')).toBe('count')
    expect(chartUnitFor('Time')).toBe('time')
    expect(chartUnitFor('Bool')).toBe('bool')
  })
  it('excludes Text (not chartable)', () => {
    expect(chartUnitFor('Text')).toBeNull()
  })
})

describe('groupTracesByUnit', () => {
  it('groups traces by unit, drops Text, and orders duration→count→time→bool', () => {
    const traces = [
      { name: 'Water', dataType: 'Int' as const },
      { name: 'Journal', dataType: 'Text' as const },
      { name: 'Wake', dataType: 'Time' as const },
      { name: 'Reading', dataType: 'Duration' as const },
      { name: 'Cold shower', dataType: 'Bool' as const },
      { name: 'Dishes', dataType: 'Duration' as const },
    ]
    const groups = groupTracesByUnit(traces)
    expect(groups.map((g) => g.unit)).toEqual(['duration', 'count', 'time', 'bool'])
    expect(groups[0].traces.map((t) => t.name)).toEqual(['Reading', 'Dishes'])
    expect(groups.some((g) => g.traces.some((t) => t.name === 'Journal'))).toBe(false)
  })
})
