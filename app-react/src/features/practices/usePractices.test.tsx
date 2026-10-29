import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../../hooks/useToast'
import type { PracticeGroup, UserPractice } from '../../types/api'
import { usePractices } from './usePractices'

vi.mock('../../api/practices', () => ({
  practicesApi: {
    getUserPractices: vi.fn(), createUserPractice: vi.fn(), updateUserPractice: vi.fn(),
    deleteUserPractice: vi.fn(),
    getGroups: vi.fn(), createGroup: vi.fn(), renameGroup: vi.fn(), deleteGroup: vi.fn(), saveLayout: vi.fn(),
  },
}))
import { practicesApi } from '../../api/practices'
const api = vi.mocked(practicesApi)

const GROUPS: PracticeGroup[] = [
  { id: 'g1', name: 'Morning', is_default: false },
  { id: null, name: '', is_default: true },
  { id: 'g2', name: 'Evening', is_default: false },
]
const P1: UserPractice = { id: 'p1', practice: 'Japa', data_type: 'Int', is_active: true, group_id: 'g1' }
const P2: UserPractice = { id: 'p2', practice: 'Reading', data_type: 'Int', is_active: true, group_id: null }

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, ...renderHook(() => usePractices(), { wrapper }) }
}

describe('usePractices saveLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToastStore.setState({ toasts: [] })
    api.getUserPractices.mockResolvedValue([P1, P2])
    api.getGroups.mockResolvedValue(GROUPS)
  })

  it('moves the cached practice as it is now, not as last rendered, and a failure puts the cache back', async () => {
    const { qc, result } = setup()
    await waitFor(() => expect(result.current.practices).toHaveLength(2))
    let fail!: (e: Error) => void
    api.saveLayout.mockReturnValue(new Promise((_, reject) => { fail = reject }))
    const renamed = { ...P1, practice: 'Japa rounds', is_active: false }

    // An edit has just refetched (the update before a group move); the hook hasn't re-rendered yet.
    act(() => {
      qc.setQueryData<UserPractice[]>(['practices'], [renamed, P2])
      result.current.saveLayout.mutate({ groups: ['g1', null, 'g2'], practices: [{ id: 'p2', group_id: null }, { id: 'p1', group_id: 'g2' }] })
    })
    await waitFor(() => expect(qc.getQueryData(['practices'])).toEqual([P2, { ...renamed, group_id: 'g2' }]))

    api.getUserPractices.mockClear()
    await act(async () => { fail(new Error('offline')) })
    await waitFor(() => expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('Something went wrong'))
    await waitFor(() => expect(api.getUserPractices).toHaveBeenCalled())
    expect(api.getGroups).toHaveBeenCalled()
  })

  it('rolls the cache back to before the move when the save fails', async () => {
    const { qc, result } = setup()
    await waitFor(() => expect(result.current.practices).toHaveLength(2))
    api.saveLayout.mockRejectedValue(new Error('offline'))
    // The refetch after the failure doesn't answer, so the cache shows the rollback.
    api.getUserPractices.mockReturnValue(new Promise(() => {}))
    api.getGroups.mockReturnValue(new Promise(() => {}))
    act(() => {
      result.current.saveLayout.mutate({ groups: ['g2', null, 'g1'], practices: [{ id: 'p1', group_id: null }, { id: 'p2', group_id: 'g2' }] })
    })
    await waitFor(() => expect(api.saveLayout).toHaveBeenCalled())
    await waitFor(() => expect(qc.getQueryData(['practices'])).toEqual([P1, P2]))
    expect(qc.getQueryData(['practice-groups'])).toEqual(GROUPS)
  })

  it('leaves out a group it doesn\'t know yet instead of caching a hole', async () => {
    const { qc, result } = setup()
    await waitFor(() => expect(result.current.groups).toHaveLength(3))
    api.saveLayout.mockReturnValue(new Promise(() => {}))
    act(() => {
      result.current.saveLayout.mutate({ groups: ['g1', null, 'g2', 'g3'], practices: [{ id: 'p2', group_id: null }, { id: 'p1', group_id: 'g3' }] })
    })
    await waitFor(() => expect(qc.getQueryData(['practice-groups'])).toEqual(GROUPS))
    expect(() => result.current.sections).not.toThrow()
  })
})

describe('usePractices practice writes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToastStore.setState({ toasts: [] })
    api.getUserPractices.mockResolvedValue([P1, P2])
    api.getGroups.mockResolvedValue(GROUPS)
  })

  const toasts = () => useToastStore.getState().toasts.map((t) => t.message)

  it('a failed save shows the error toast; a taken name does not (it shows under the field)', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.practices).toHaveLength(2))
    api.updateUserPractice.mockRejectedValueOnce({ isAxiosError: true, response: { status: 422 } })
    await act(() => result.current.update.mutateAsync(P1).catch(() => {}))
    expect(toasts()).toEqual([])
    api.updateUserPractice.mockRejectedValueOnce(new Error('offline'))
    await act(() => result.current.update.mutateAsync(P1).catch(() => {}))
    expect(toasts()).toContain('Something went wrong')
  })
})
