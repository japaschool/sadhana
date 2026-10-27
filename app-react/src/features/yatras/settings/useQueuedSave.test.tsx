import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../../../hooks/useToast'
import { useQueuedSave } from './useQueuedSave'

type Pair = { a: number; b: number }
const set = (k: keyof Pair, v: number, was: number) => ({
  apply: (c: Pair) => ({ ...c, [k]: v }),
  revert: (c: Pair) => ({ ...c, [k]: was }),
})

function setup() {
  const qc = new QueryClient()
  qc.setQueryData<Pair>(['k'], { a: 1, b: 1 })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  const onSaved = vi.fn()
  const { result } = renderHook(() => useQueuedSave<Pair>(['k'], onSaved), { wrapper })
  return { qc, save: result.current, onSaved, now: () => qc.getQueryData<Pair>(['k']) }
}

describe('useQueuedSave', () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }))

  it('shows the change at once and sends one request at a time, in order', async () => {
    const { save, now } = setup()
    const sent: Pair[] = []
    let release!: () => void
    const held = new Promise<void>((r) => { release = r })
    const send = vi.fn((v: Pair) => { sent.push(v); return sent.length === 1 ? held : Promise.resolve() })
    void save(set('a', 2, 1), send, 'a')
    void save(set('b', 3, 1), send, 'b')
    expect(now()).toEqual({ a: 2, b: 3 })
    await waitFor(() => expect(sent).toHaveLength(1))
    release()
    await waitFor(() => expect(sent).toHaveLength(2))
  })

  it('Undo takes back only its own change and keeps later ones', async () => {
    const { save, onSaved, now } = setup()
    const send = vi.fn().mockResolvedValue(undefined)
    await save(set('a', 2, 1), send, 'Saved a')
    await save(set('b', 2, 1), send, 'Saved b')
    expect(onSaved).toHaveBeenCalledTimes(2)
    const undoA = useToastStore.getState().toasts.find((t) => t.message === 'Saved a')!.action!
    act(() => undoA.onClick())
    expect(now()).toEqual({ a: 1, b: 2 })
    await waitFor(() => expect(send).toHaveBeenLastCalledWith({ a: 1, b: 2 }))
  })

  it('does nothing when the change no longer applies', async () => {
    const { save } = setup()
    const send = vi.fn().mockResolvedValue(undefined)
    expect(await save({ apply: (c) => c, revert: (c) => c }, send, 'x')).toBe(true)
    expect(send).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('a failed change is taken back and not sent again by the saves behind it', async () => {
    const { qc, save, now } = setup()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const send = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined)
    const first = save(set('a', 2, 1), send, 'a')
    const second = save(set('b', 2, 1), send, 'b')
    expect(await first).toBe(false)
    expect(await second).toBe(true)
    expect(send).toHaveBeenLastCalledWith({ a: 1, b: 2 })
    expect(now()).toEqual({ a: 1, b: 2 })
    expect(useToastStore.getState().toasts.some((t) => t.variant === 'error')).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['k'] })
  })
})
