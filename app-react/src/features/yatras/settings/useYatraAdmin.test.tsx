import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { mockAdmin } from './mobile/adminTestUtils'
import { useYatraAdmin } from './useYatraAdmin'

vi.mock('../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../api/yatras'
const api = vi.mocked(yatrasApi)

describe('useYatraAdmin', () => {
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
