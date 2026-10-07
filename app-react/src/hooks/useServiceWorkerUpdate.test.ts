import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useServiceWorkerUpdate } from './useServiceWorkerUpdate'

describe('useServiceWorkerUpdate', () => {
  let listeners: Record<string, EventListener[]>

  beforeEach(() => {
    listeners = {}
    const mockSW = {
      addEventListener: vi.fn((event: string, cb: EventListener) => {
        listeners[event] = listeners[event] ?? []
        listeners[event].push(cb)
      }),
      removeEventListener: vi.fn(),
      controller: {} as object | null,
    }
    Object.defineProperty(navigator, 'serviceWorker', {
      value: mockSW,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with updateReady = false', () => {
    const { result } = renderHook(() => useServiceWorkerUpdate())
    expect(result.current.updateReady).toBe(false)
  })

  it('sets updateReady = true when controllerchange fires', async () => {
    const { result } = renderHook(() => useServiceWorkerUpdate())
    act(() => {
      listeners['controllerchange']?.forEach(cb => cb(new Event('controllerchange')))
    })
    expect(result.current.updateReady).toBe(true)
  })

  it('ignores the first worker taking control of a fresh client', () => {
    ;(navigator.serviceWorker as unknown as { controller: null }).controller = null
    const { result } = renderHook(() => useServiceWorkerUpdate())
    act(() => {
      listeners['controllerchange']?.forEach(cb => cb(new Event('controllerchange')))
    })
    expect(result.current.updateReady).toBe(false)
  })

  it('applyUpdate calls window.location.reload', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, configurable: true })
    const { result } = renderHook(() => useServiceWorkerUpdate())
    act(() => { result.current.applyUpdate() })
    expect(reload).toHaveBeenCalledOnce()
  })
})
