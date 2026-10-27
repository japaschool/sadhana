import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { toDateStr } from './date'
import { useLogDate } from './useLogDate'

describe('useLogDate', () => {
  it('carries the picked day to the next screen, and picking today goes back to following the clock', () => {
    const first = renderHook(() => useLogDate())
    act(() => first.result.current[1](new Date(2020, 0, 2)))
    first.unmount()
    const next = renderHook(() => useLogDate())
    expect(toDateStr(next.result.current[0])).toBe('2020-01-02')
    act(() => next.result.current[1](new Date()))
    expect(toDateStr(next.result.current[0])).toBe(toDateStr(new Date()))
  })
  it('moves on to the new day when the app wakes up after midnight', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2020, 0, 2, 23, 59))
    const { result } = renderHook(() => useLogDate())
    act(() => result.current[1](new Date()))
    vi.setSystemTime(new Date(2020, 0, 3, 7, 0))
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(toDateStr(result.current[0])).toBe('2020-01-03')
    vi.useRealTimers()
  })
})
