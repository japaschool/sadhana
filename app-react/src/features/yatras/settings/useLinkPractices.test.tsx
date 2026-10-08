import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import type { YatraUserPracticeItem } from '../../../types/api'
import { useLinkPractices } from './useLinkPractices'

vi.mock('../../../api/yatras', () => ({
  yatrasApi: { getYatras: vi.fn(), getYatraUserPractices: vi.fn(), updateYatraUserPractices: vi.fn(), getYatraUsers: vi.fn(), leaveYatra: vi.fn() },
}))
vi.mock('../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
import { yatrasApi } from '../../../api/yatras'
import { practicesApi } from '../../../api/practices'
const api = vi.mocked(yatrasApi)

const items: YatraUserPracticeItem[] = [
  { yatra_practice: { id: 'a', practice: 'Reading', data_type: 'Duration' }, user_practice: null },
  { yatra_practice: { id: 'b', practice: 'Lectures', data_type: 'Duration' }, user_practice: null },
]

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return renderHook(() => useLinkPractices('y1'), { wrapper })
}

const sent = () => api.updateYatraUserPractices.mock.calls.map(([, list]) => list.map((i) => i.user_practice))

describe('useLinkPractices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToastStore.setState({ toasts: [] })
    useAuthStore.setState({ user: { id: 'u1', email: '', token: 't', name: 'Me' }, token: 't' })
    api.getYatras.mockResolvedValue([{ id: 'y1', name: 'League', show_stability_metrics: false }])
    api.getYatraUserPractices.mockResolvedValue(items)
    api.getYatraUsers.mockResolvedValue([{ user_id: 'u1', user_name: 'Me', is_admin: false }])
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([])
  })

  it('sends quick successive links in order, each including the previous', async () => {
    let release!: () => void
    api.updateYatraUserPractices.mockImplementationOnce(() => new Promise<void>((r) => { release = r })).mockResolvedValue()
    const { result } = setup()
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    await act(async () => { result.current.link('a', 'Book reading'); result.current.link('b', 'Lecture listening') })
    await waitFor(() => expect(result.current.items.map((i) => i.user_practice)).toEqual(['Book reading', 'Lecture listening']))
    expect(api.updateYatraUserPractices).toHaveBeenCalledTimes(1)
    await act(async () => { release() })
    await waitFor(() => expect(sent()).toEqual([['Book reading', null], ['Book reading', 'Lecture listening']]))
  })

  it('Undo restores the snapshot from before that change', async () => {
    api.updateYatraUserPractices.mockResolvedValue()
    const { result } = setup()
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => result.current.link('a', 'Book reading'))
    await waitFor(() => expect(useToastStore.getState().toasts[0]?.message).toBe('Linked Book reading → Reading'))
    act(() => useToastStore.getState().toasts[0].action!.onClick())
    await waitFor(() => expect(sent().at(-1)).toEqual([null, null]))
    expect(result.current.items.map((i) => i.user_practice)).toEqual([null, null])
    // The undo itself offers no further Undo.
    await waitFor(() => expect(useToastStore.getState().toasts.at(-1)?.action).toBeUndefined())
  })

  it('a failed save shows an error, refetches, and later saves still run', async () => {
    api.updateYatraUserPractices.mockRejectedValueOnce(new Error('500')).mockResolvedValue()
    const { result } = setup()
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => result.current.link('a', 'Book reading'))
    await waitFor(() => expect(useToastStore.getState().toasts.some((t) => t.variant === 'error')).toBe(true))
    await waitFor(() => expect(api.getYatraUserPractices).toHaveBeenCalledTimes(2))
    act(() => result.current.link('b', 'Lecture listening'))
    await waitFor(() => expect(api.updateYatraUserPractices).toHaveBeenCalledTimes(2))
  })

  it('finds the current user among the members', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.me?.user_id).toBe('u1'))
  })
})
