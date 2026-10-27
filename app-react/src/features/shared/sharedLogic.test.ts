import { describe, expect, it } from 'vitest'
import { dayLevels, doneAverage, practiceCells } from './sharedLogic'

const e = (cob_date: string, practice: string, value: unknown) => ({ cob_date, practice, value })
const rows = [
  e('2026-10-01', 'Japa', { Int: 16 }), e('2026-10-01', 'Wake', { Bool: true }),
  e('2026-10-02', 'Japa', { Int: 4 }), e('2026-10-02', 'Wake', { Bool: false }),
  e('2026-10-03', 'Japa', null), e('2026-10-03', 'Wake', null),
]
const traces = [{ name: 'Japa', dataType: 'Int' as const }, { name: 'Wake', dataType: 'Bool' as const }]

describe('shared report grid', () => {
  it('shades numbers by their share of the best day; yes/no is done or not', () => {
    expect(practiceCells(traces[0], rows).map((c) => c.level)).toEqual([3, 1, 0])
    expect(practiceCells(traces[1], rows).map((c) => c.level)).toEqual([3, 0, 0])
  })

  it('counts practices done per day', () => {
    expect(dayLevels(traces, rows).map((d) => [d.count, d.level])).toEqual([[2, 3], [1, 2], [0, 0]])
  })

  it('averages done practices over past days, today left out', () => {
    expect(doneAverage(traces, rows, '2026-10-03')).toBe(1.5)
    expect(doneAverage(traces, [], '2026-10-03')).toBeNull()
  })
})
