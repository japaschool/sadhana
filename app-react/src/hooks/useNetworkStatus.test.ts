import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNetStore, startNetworkWatch } from './useNetworkStatus'

describe('network status', () => {
  let onMessage: ((e: MessageEvent) => void) | undefined
  const postMessage = vi.fn()

  beforeEach(() => {
    postMessage.mockClear()
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { postMessage },
        addEventListener: (_: string, cb: (e: MessageEvent) => void) => { onMessage = cb },
        startMessages: vi.fn(),
      },
    })
    useNetStore.setState({ online: true, pending: 0 })
  })

  it('takes online and pending from the worker, and asks it to flush on start, online and visible', () => {
    startNetworkWatch()
    expect(postMessage).toHaveBeenCalledWith({ type: 'FLUSH' })
    onMessage!(new MessageEvent('message', { data: { type: 'NET', online: false, pending: 3 } }))
    expect(useNetStore.getState()).toMatchObject({ online: false, pending: 3 })
    window.dispatchEvent(new Event('online'))
    expect(postMessage).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event('offline'))
    expect(useNetStore.getState().online).toBe(false)
  })
})
