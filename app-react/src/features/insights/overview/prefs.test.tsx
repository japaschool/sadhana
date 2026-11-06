import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../api/insightPrefs', () => ({ insightPrefsApi: { get: vi.fn(), save: vi.fn() }, INSIGHT_PREFS_KEY: ['insight-prefs'] }))
const showToast = vi.fn()
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast }) }))
import { insightPrefsApi } from '../../../api/insightPrefs'
import { useInsightPrefs } from './prefs'

const DEFAULTS = { streaks: false, suggest: true, sleep: null, dismissed: [], openAsked: {}, visibility: {} }
const KEY = 'sadhana.insights'
const get = vi.mocked(insightPrefsApi.get)
const save = vi.mocked(insightPrefsApi.save)

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return (n = 1) => Array.from({ length: n }, () => renderHook(() => useInsightPrefs(), { wrapper }))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  save.mockResolvedValue(undefined)
})

describe('useInsightPrefs', () => {
  it('server_prefs_win_and_local_key_is_removed', async () => {
    localStorage.setItem(KEY, JSON.stringify({ streaks: true }))
    get.mockResolvedValue({ suggest: false })
    const [{ result }] = setup()()
    await waitFor(() => expect(result.current[2]).toBe(true))
    expect(result.current[0]).toEqual({ ...DEFAULTS, suggest: false })
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(save).not.toHaveBeenCalled()
  })

  it('null_server_migrates_local_once', async () => {
    localStorage.setItem(KEY, JSON.stringify({ streaks: true }))
    get.mockResolvedValue(null)
    const [{ result }] = setup()()
    await waitFor(() => expect(result.current[2]).toBe(true))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ ...DEFAULTS, streaks: true })
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(result.current[0].streaks).toBe(true)
  })

  it('null_server_without_local_gives_defaults_without_saving', async () => {
    get.mockResolvedValue(null)
    const [{ result }] = setup()()
    await waitFor(() => expect(result.current[2]).toBe(true))
    expect(result.current[0]).toEqual(DEFAULTS)
    expect(save).not.toHaveBeenCalled()
  })

  it('failed_migration_keeps_local_key_and_reads_it', async () => {
    localStorage.setItem(KEY, JSON.stringify({ streaks: true }))
    get.mockResolvedValue(null)
    save.mockRejectedValue(new Error('offline'))
    const [{ result }] = setup()()
    await waitFor(() => expect(save).toHaveBeenCalled())
    await act(async () => {})
    expect(localStorage.getItem(KEY)).not.toBeNull()
    expect(result.current[0].streaks).toBe(true)
    expect(result.current[2]).toBe(false)
  })

  it('pending_reads_local_and_is_not_ready', () => {
    localStorage.setItem(KEY, JSON.stringify({ streaks: true }))
    get.mockReturnValue(new Promise(() => {}))
    const [{ result }] = setup()()
    expect(result.current[0]).toEqual({ ...DEFAULTS, streaks: true })
    expect(result.current[2]).toBe(false)
  })

  it('set_prefs_is_optimistic_and_saves_merged', async () => {
    get.mockResolvedValue({ suggest: false })
    save.mockReturnValue(new Promise(() => {})) // still saving: the new value shows anyway
    const [{ result }] = setup()()
    await waitFor(() => expect(result.current[2]).toBe(true))
    act(() => result.current[1]({ streaks: true }))
    await waitFor(() => expect(result.current[0]).toEqual({ ...DEFAULTS, suggest: false, streaks: true }))
    expect(save).toHaveBeenCalledWith({ ...DEFAULTS, suggest: false, streaks: true })
  })

  it('failed_save_rolls_back', async () => {
    get.mockResolvedValue({})
    let fail!: (e: Error) => void
    save.mockReturnValue(new Promise((_, reject) => { fail = reject }))
    const [{ result }] = setup()()
    await waitFor(() => expect(result.current[2]).toBe(true))
    act(() => result.current[1]({ streaks: true }))
    await waitFor(() => expect(result.current[0].streaks).toBe(true))
    act(() => fail(new Error('500')))
    await waitFor(() => expect(result.current[0].streaks).toBe(false))
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
  })

  it('shares_state_between_hooks', async () => {
    get.mockResolvedValue({})
    const [a, b] = setup()(2)
    await waitFor(() => expect(a.result.current[2]).toBe(true))
    act(() => a.result.current[1]({ suggest: false }))
    await waitFor(() => expect(b.result.current[0].suggest).toBe(false))
  })

  it('bad_values_fall_back', async () => {
    get.mockResolvedValue({ streaks: true, dismissed: 5, visibility: { a: true, b: 'x' } })
    const [{ result }] = setup()()
    await waitFor(() => expect(result.current[2]).toBe(true))
    expect(result.current[0]).toEqual({ ...DEFAULTS, streaks: true, visibility: { a: true } })
  })

  it('bad_local_json_falls_back', () => {
    localStorage.setItem(KEY, '{nope')
    get.mockReturnValue(new Promise(() => {}))
    const [{ result }] = setup()()
    expect(result.current[0]).toEqual(DEFAULTS)
  })
})
