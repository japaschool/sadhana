import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useInsightPrefs } from './prefs'

const DEFAULTS = { streaks: false, suggest: true, sleep: null, dismissed: [], openAsked: {} }

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('useInsightPrefs', () => {
  it('prefs_default_and_round_trip', () => {
    const { result } = renderHook(() => useInsightPrefs())
    expect(result.current[0]).toEqual(DEFAULTS)
    act(() => result.current[1]({ streaks: true, dismissed: ['2026-10-01'] }))
    expect(result.current[0]).toEqual({ ...DEFAULTS, streaks: true, dismissed: ['2026-10-01'] })
    expect(JSON.parse(localStorage.getItem('sadhana.insights')!).streaks).toBe(true)
    const second = renderHook(() => useInsightPrefs())
    expect(second.result.current[0].streaks).toBe(true)
  })

  it('shares_state_between_hooks', () => {
    const a = renderHook(() => useInsightPrefs())
    const b = renderHook(() => useInsightPrefs())
    act(() => a.result.current[1]({ suggest: false }))
    expect(b.result.current[0].suggest).toBe(false)
  })

  it('bad_json_and_missing_fields_fall_back', () => {
    localStorage.setItem('sadhana.insights', '{nope')
    expect(renderHook(() => useInsightPrefs()).result.current[0]).toEqual(DEFAULTS)
    localStorage.setItem('sadhana.insights', JSON.stringify({ streaks: true, dismissed: 5 }))
    expect(renderHook(() => useInsightPrefs()).result.current[0]).toEqual({ ...DEFAULTS, streaks: true })
  })

  it('blocked_storage_gives_defaults_and_keeps_visit_working', async () => {
    vi.resetModules() // a fresh module, as on a first visit
    const { useInsightPrefs } = await import('./prefs')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useInsightPrefs())
    expect(result.current[0]).toEqual(DEFAULTS)
    act(() => result.current[1]({ streaks: true }))
    expect(result.current[0].streaks).toBe(true)
  })
})
