import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../../../hooks/useToast'
import type { YatraPractice, YatraUser } from '../../../types/api'
import { mockAdmin, PRACTICES, YATRA } from './mobile/adminTestUtils'
import { useYatraAdmin } from './useYatraAdmin'

vi.mock('../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../api/yatras'
const api = vi.mocked(yatrasApi)

function setup() {
  mockAdmin(api)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useYatraAdmin('y1'), { wrapper })
  return { qc, result }
}
const undo = (message: string) => act(() => useToastStore.getState().toasts.find((t) => t.message === message)!.action!.onClick())

describe('useYatraAdmin', () => {
  beforeEach(() => { vi.clearAllMocks(); useToastStore.setState({ toasts: [] }) })

  it("Undo of an edit to a practice that's since been deleted doesn't bring it back", async () => {
    const { qc, result } = setup()
    await waitFor(() => expect(result.current.practices).toHaveLength(5))
    act(() => result.current.savePractice({ ...PRACTICES[2], practice: 'Study' }, 'Renamed'))
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    api.getYatraPractices.mockResolvedValue(structuredClone(PRACTICES).filter((p) => p.id !== 'p3'))
    await act(() => result.current.deletePractice.mutateAsync(PRACTICES[2]))
    await waitFor(() => expect(qc.getQueryData<YatraPractice[]>(['yatra-practices', 'y1'])).toHaveLength(4))
    undo('Renamed')
    expect(qc.getQueryData<YatraPractice[]>(['yatra-practices', 'y1'])!.map((p) => p.id)).not.toContain('p3')
    expect(api.updateYatraPractice).toHaveBeenCalledOnce()
  })

  it('Undo of one admin toggle leaves a later toggle alone', async () => {
    const { qc, result } = setup()
    await waitFor(() => expect(result.current.users).toHaveLength(3))
    act(() => result.current.toggleAdmin(result.current.users[2]))
    await waitFor(() => expect(api.toggleAdmin).toHaveBeenCalledTimes(1))
    act(() => result.current.toggleAdmin(qc.getQueryData<YatraUser[]>(['yatra-users', 'y1'])![1]))
    await waitFor(() => expect(api.toggleAdmin).toHaveBeenCalledTimes(2))
    undo('Madhava das is now an admin')
    expect(qc.getQueryData<YatraUser[]>(['yatra-users', 'y1'])!.map((u) => u.is_admin)).toEqual([true, false, false])
    await waitFor(() => expect(api.toggleAdmin).toHaveBeenLastCalledWith('y1', 'u3'))
  })

  it('Undo of a reorder keeps a practice added since', async () => {
    const { qc, result } = setup()
    await waitFor(() => expect(result.current.practices).toHaveLength(5))
    act(() => result.current.reorder(['p2', 'p1', 'p3', 'p4', 'p5']))
    await waitFor(() => expect(api.reorderPractices).toHaveBeenCalledOnce())
    act(() => { qc.setQueryData<YatraPractice[]>(['yatra-practices', 'y1'], (c) => [...c!, { id: 'p6', practice: 'Seva', data_type: 'Bool' }]) })
    undo('Order saved')
    expect(qc.getQueryData<YatraPractice[]>(['yatra-practices', 'y1'])!.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'])
  })

  it('puts the statistics back when the practice itself fails to delete', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.yatra).toBeDefined())
    api.deleteYatraPractice.mockRejectedValueOnce(new Error('x'))
    await act(() => result.current.deletePractice.mutateAsync(PRACTICES[0]).catch(() => {}))
    expect(api.updateYatra).toHaveBeenCalledTimes(2)
    expect(api.updateYatra.mock.calls[0][1].statistics!.statistics).toHaveLength(1)
    expect(api.updateYatra.mock.calls[1][1].statistics).toEqual(YATRA.statistics)
  })

  it('never sends a statistic whose practice is gone', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.practices).toHaveLength(5))
    const stats = { visible_to_all: true, statistics: [...YATRA.statistics!.statistics, { label: 'Ghost', practice_id: 'gone', aggregation: 'Count' as const, time_range: 'Last7Days' as const }] }
    act(() => result.current.saveYatra({ statistics: stats }, 'Saved'))
    await waitFor(() => expect(api.updateYatra).toHaveBeenCalledOnce())
    expect(api.updateYatra.mock.calls[0][1].statistics).toEqual(YATRA.statistics)
  })

  it('reorder shows the new order at once and sends every id', async () => {
    mockAdmin(api)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useYatraAdmin('y1'), { wrapper })
    await waitFor(() => expect(result.current.practices).toHaveLength(5))
    act(() => result.current.reorder(['p2', 'p1', 'p3', 'p4', 'p5']))
    // The cache changes at once; observers are notified on the next tick.
    expect(qc.getQueryData<{ id: string }[]>(['yatra-practices', 'y1'])!.map((p) => p.id)).toEqual(['p2', 'p1', 'p3', 'p4', 'p5'])
    await waitFor(() => expect(api.reorderPractices).toHaveBeenCalledWith('y1', ['p2', 'p1', 'p3', 'p4', 'p5']))
  })
})
