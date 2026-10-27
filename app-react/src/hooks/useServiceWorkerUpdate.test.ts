import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startUpdateWatch, useServiceWorkerUpdate, useSwStore } from './useServiceWorkerUpdate'

function setVisibility(v: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: v })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('service worker updates', () => {
  let swListeners: Record<string, () => void>
  let regListeners: Record<string, () => void>
  let reg: { waiting: { postMessage: ReturnType<typeof vi.fn> } | null; installing: EventTarget | null; update: ReturnType<typeof vi.fn>; addEventListener: (e: string, cb: () => void) => void }
  const reload = vi.fn()

  beforeEach(() => {
    swListeners = {}
    regListeners = {}
    reload.mockClear()
    useSwStore.setState({ waiting: null })
    Object.defineProperty(window, 'location', { configurable: true, value: { reload } })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { addEventListener: (e: string, cb: () => void) => { swListeners[e] = cb } },
    })
    reg = { waiting: null, installing: null, update: vi.fn().mockResolvedValue(undefined), addEventListener: (e, cb) => { regListeners[e] = cb } }
  })

  const start = (hadController = true) => startUpdateWatch(reg as unknown as ServiceWorkerRegistration, hadController)

  it('a waiting worker makes an update ready', () => {
    reg.waiting = { postMessage: vi.fn() }
    start()
    const { result } = renderHook(() => useServiceWorkerUpdate())
    expect(result.current.updateReady).toBe(true)
  })

  it('notices a worker that finishes installing later', () => {
    start()
    const installing = new EventTarget()
    reg.installing = installing
    regListeners.updatefound()
    reg.waiting = { postMessage: vi.fn() }
    act(() => { installing.dispatchEvent(new Event('statechange')) })
    expect(useSwStore.getState().waiting).toBe(reg.waiting)
  })

  it('notices a worker that was already installing at start', () => {
    const installing = new EventTarget()
    reg.installing = installing
    start()
    reg.waiting = { postMessage: vi.fn() }
    act(() => { installing.dispatchEvent(new Event('statechange')) })
    expect(useSwStore.getState().waiting).toBe(reg.waiting)
  })

  it('checks for an update when visible and applies a waiting one when hidden', () => {
    start()
    setVisibility('visible')
    expect(reg.update).toHaveBeenCalledOnce()
    reg.waiting = { postMessage: vi.fn() }
    useSwStore.setState({ waiting: reg.waiting as unknown as ServiceWorker })
    setVisibility('hidden')
    expect(reg.waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('reloads when the new worker takes over, but not on a first install', () => {
    start(true)
    swListeners.controllerchange()
    expect(reload).toHaveBeenCalledOnce()
    reload.mockClear()
    start(false)
    swListeners.controllerchange()
    expect(reload).not.toHaveBeenCalled()
  })

  it('a page that loaded uncontrolled reloads once it has applied an update', () => {
    start(false)
    reg.waiting = { postMessage: vi.fn() }
    useSwStore.setState({ waiting: reg.waiting as unknown as ServiceWorker })
    setVisibility('hidden')
    swListeners.controllerchange()
    expect(reload).toHaveBeenCalledOnce()
  })
})
