import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useToday } from './useToday'
import { useToastStore } from '../../hooks/useToast'
import type { UserPractice } from '../../types/api'

vi.mock('../../api/practices', () => ({
  practicesApi: {
    getUserPractices: vi.fn(),
    getDiaryEntries: vi.fn(),
    getIncompleteDays: vi.fn(),
    saveDiaryEntry: vi.fn(),
    createUserPractice: vi.fn(),
  },
}))
import { practicesApi } from '../../api/practices'
const api = vi.mocked(practicesApi)

const A: UserPractice = { id: 'a', practice: 'A', data_type: 'Bool', is_active: true, is_required: true }
const B: UserPractice = { id: 'b', practice: 'B', data_type: 'Int', is_active: true, is_required: true }
const C: UserPractice = { id: 'c', practice: 'C', data_type: 'Text', is_active: true }
const D: UserPractice = { id: 'd', practice: 'D', data_type: 'Int', is_active: false, is_required: true }

function setup(date = new Date(2026, 9, 6)) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, ...renderHook(({ d }) => useToday(d), { wrapper, initialProps: { d: date } }) }
}

describe('useToday', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToastStore.setState({ toasts: [] })
    api.getUserPractices.mockResolvedValue([A, B, C, D])
    api.getDiaryEntries.mockImplementation(async (date) =>
      date === '2026-10-06'
        ? [{ practice: 'A', data_type: 'Bool', value: { Bool: false } }, { practice: 'C', data_type: 'Text', value: { Text: 'x' } }]
        : [])
    api.getIncompleteDays.mockResolvedValue(['2026-10-04', '2026-10-04', '2026-10-05'])
    api.saveDiaryEntry.mockResolvedValue(undefined)
  })

  it('counts filled, total and required-left over active practices', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading || result.current.dayLoading).toBe(false))
    expect(result.current.summary).toEqual({ filled: 2, total: 3, requiredLeft: 1 })
    expect(result.current.practices.map((p) => p.practice)).toEqual(['A', 'B', 'C'])
  })

  it('loads incomplete days for the 9-day window', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.incomplete.size).toBe(2))
    expect(api.getIncompleteDays).toHaveBeenCalledWith('2026-10-04', '2026-10-12')
  })

  it('sends null to clear a value and skips unchanged values', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading || result.current.dayLoading).toBe(false))
    act(() => result.current.save(C, { Text: 'x' }))
    act(() => result.current.save(B, null))
    expect(api.saveDiaryEntry).not.toHaveBeenCalled()
    act(() => result.current.save(C, null))
    await waitFor(() => expect(api.saveDiaryEntry).toHaveBeenCalledWith('2026-10-06', 'C', null))
  })

  it('sends saves one at a time, in order', async () => {
    let resolveFirst!: () => void
    api.saveDiaryEntry.mockReturnValueOnce(new Promise<void>((r) => { resolveFirst = r }))
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading || result.current.dayLoading).toBe(false))
    act(() => result.current.save(B, { Int: 4 }))
    act(() => result.current.save(B, { Int: 45 }))
    await waitFor(() => expect(api.saveDiaryEntry).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(api.saveDiaryEntry).toHaveBeenCalledTimes(1)
    act(() => resolveFirst())
    await waitFor(() => expect(api.saveDiaryEntry).toHaveBeenLastCalledWith('2026-10-06', 'B', { Int: 45 }))
    expect(api.saveDiaryEntry).toHaveBeenCalledTimes(2)
  })

  it('rolls back and flags the practice when a save fails', async () => {
    api.saveDiaryEntry.mockRejectedValue(new Error('boom'))
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading || result.current.dayLoading).toBe(false))
    act(() => result.current.save(B, { Int: 5 }))
    await waitFor(() => expect(result.current.failed).toBe('B'))
    expect(result.current.values.B).toBeUndefined()
  })

  it('invalidates the day the save was made on, even after switching day', async () => {
    let resolve!: () => void
    api.saveDiaryEntry.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const { result, rerender, qc } = setup()
    await waitFor(() => expect(result.current.isLoading || result.current.dayLoading).toBe(false))
    act(() => result.current.save(B, { Int: 5 }))
    rerender({ d: new Date(2026, 9, 7) })
    await act(async () => { resolve() })
    expect(api.saveDiaryEntry).toHaveBeenCalledWith('2026-10-06', 'B', { Int: 5 })
    // The 6th is no longer on screen, so it's marked stale rather than refetched.
    await waitFor(() => expect(qc.getQueryState(['diary', '2026-10-06'])?.isInvalidated).toBe(true))
  })

  it('only the practices gate loading; a failed day still renders rows and flags it', async () => {
    api.getDiaryEntries.mockRejectedValue(new Error('offline'))
    const { result } = setup()
    await waitFor(() => expect(result.current.dayFailed).toBe(true))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.practices.map((p) => p.practice)).toEqual(['A', 'B', 'C'])
    expect(result.current.values).toEqual({})
  })

  it('a queued save keeps the value with no error, even when the refetch fails', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading || result.current.dayLoading).toBe(false))
    api.getDiaryEntries.mockRejectedValue(new Error('offline'))
    act(() => result.current.save(B, { Int: 7 }))
    await waitFor(() => expect(api.saveDiaryEntry).toHaveBeenCalled())
    await waitFor(() => expect(result.current.dayLoading).toBe(false))
    expect(result.current.values.B).toEqual({ Int: 7 })
    expect(result.current.failed).toBeNull()
    expect(result.current.dayFailed).toBe(false)
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('keeps cached practices on screen when their refetch fails', async () => {
    const { result, qc } = setup()
    await waitFor(() => expect(result.current.practices).toHaveLength(3))
    api.getUserPractices.mockRejectedValue(new Error('offline'))
    await act(() => qc.refetchQueries({ queryKey: ['practices'] }))
    expect(result.current.isError).toBe(false)
    expect(result.current.practices).toHaveLength(3)
  })
})
