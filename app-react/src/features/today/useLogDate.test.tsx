import { act, renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
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
})
