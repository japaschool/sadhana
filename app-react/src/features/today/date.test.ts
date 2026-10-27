import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { toDateStr, fromDateStr, nineDayWindow, monthGrid, isFuture, isSameDay } from './date'

describe('date helpers', () => {
  beforeAll(() => { vi.stubEnv('TZ', 'Europe/Kyiv') })
  afterAll(() => { vi.unstubAllEnvs() })

  it('formats the local calendar day, not the UTC one', () => {
    const justAfterMidnight = new Date(2026, 9, 6, 0, 30)
    // Guard: proves the TZ stub is active (UTC is still on the 5th).
    expect(justAfterMidnight.toISOString().startsWith('2026-10-05')).toBe(true)
    expect(toDateStr(justAfterMidnight)).toBe('2026-10-06')
  })

  it('round-trips through fromDateStr', () => {
    expect(toDateStr(fromDateStr('2026-02-28'))).toBe('2026-02-28')
  })

  it('builds Sun + Mon–Sun + Mon around any day of the week', () => {
    for (const day of [5, 6, 11]) { // Mon, Tue, Sun
      const w = nineDayWindow(new Date(2026, 9, day))
      expect(w).toHaveLength(9)
      expect(toDateStr(w[0])).toBe('2026-10-04')
      expect(toDateStr(w[8])).toBe('2026-10-12')
    }
  })

  it('builds a Monday-first month grid', () => {
    const oct = monthGrid(2026, 9) // 1 Oct 2026 is a Thursday
    expect(oct.slice(0, 3)).toEqual([null, null, null])
    expect(oct).toHaveLength(3 + 31)
    const feb = monthGrid(2027, 1) // 1 Feb 2027 is a Monday
    expect(feb[0]?.getDate()).toBe(1)
    expect(feb).toHaveLength(28)
  })

  it('compares days and future-ness by calendar day', () => {
    const today = new Date(2026, 9, 6, 23, 0)
    expect(isFuture(new Date(2026, 9, 6, 1, 0), today)).toBe(false)
    expect(isFuture(new Date(2026, 9, 7), today)).toBe(true)
    expect(isSameDay(new Date(2026, 9, 6, 1), new Date(2026, 9, 6, 22))).toBe(true)
  })
})
