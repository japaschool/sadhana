import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../../../hooks/useToast'
import { useQueuedSave } from './useQueuedSave'

function setup() {
  const qc = new QueryClient()
  qc.setQueryData(['k'], 1)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  const onSaved = vi.fn()
  const { result } = renderHook(() => useQueuedSave<number>(['k'], onSaved), { wrapper })
  return { qc, save: result.current, onSaved }
}

describe('useQueuedSave', () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }))

  it('shows the value at once and sends one request at a time, in order', async () => {
    const { qc, save } = setup()
    const sent: number[] = []
    let release!: () => void
    const held = new Promise<void>((r) => { release = r })
    const send = vi.fn((v: number) => { sent.push(v); return v === 2 ? held : Promise.resolve() })
    save(2, send, 'a')
    save(3, send, 'b')
    expect(qc.getQueryData(['k'])).toBe(3)
    await waitFor(() => expect(sent).toEqual([2]))
    release()
    await waitFor(() => expect(sent).toEqual([2, 3]))
  })

  it('Undo restores and resends the value from before the change', async () => {
    const { qc, save, onSaved } = setup()
    const send = vi.fn().mockResolvedValue(undefined)
    save(2, send, 'Saved')
    await waitFor(() => expect(useToastStore.getState().toasts[0]?.action).toBeDefined())
    expect(onSaved).toHaveBeenCalledOnce()
    act(() => useToastStore.getState().toasts[0].action!.onClick())
    expect(qc.getQueryData(['k'])).toBe(1)
    await waitFor(() => expect(send).toHaveBeenLastCalledWith(1))
  })

  it('a failed send shows an error, refetches, and later saves still run', async () => {
    const { qc, save } = setup()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const send = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined)
    save(2, send, 'a')
    save(3, send, 'b')
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2))
    expect(useToastStore.getState().toasts.some((t) => t.variant === 'error')).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['k'] })
  })
})
