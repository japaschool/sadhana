import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { isPreview, setPreview, switchChannel } from './releaseChannel'

function stubCookie(jar: string) {
  const writes: string[] = []
  Object.defineProperty(document, 'cookie', { configurable: true, get: () => jar, set: (v: string) => { writes.push(v) } })
  return writes
}

describe('releaseChannel', () => {
  afterEach(() => { Reflect.deleteProperty(document, 'cookie') })

  it('parses a preview cookie among others', () => {
    stubCookie('foo=bar; sadhana_release_channel=preview; x=1')
    expect(isPreview()).toBe(true)
  })

  it('reads a missing or other value as stable', () => {
    stubCookie('foo=bar')
    expect(isPreview()).toBe(false)
    stubCookie('sadhana_release_channel=stable')
    expect(isPreview()).toBe(false)
  })

  it('ignores look-alike names and values', () => {
    stubCookie('xsadhana_release_channel=preview; sadhana_release_channel=preview2')
    expect(isPreview()).toBe(false)
  })

  it('setPreview writes the exact cookie string', () => {
    const writes = stubCookie('')
    setPreview(true)
    setPreview(false)
    expect(writes).toEqual([
      'sadhana_release_channel=preview; Path=/; Secure; SameSite=Lax; Max-Age=2592000',
      'sadhana_release_channel=stable; Path=/; Secure; SameSite=Lax; Max-Age=2592000',
    ])
  })
})

describe('switchChannel', () => {
  let onChange: (() => void) | undefined
  const reload = vi.fn()
  const update = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    reload.mockClear()
    update.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(window, 'location', { configurable: true, value: { reload } })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: async () => ({ update }),
        addEventListener: (_: string, cb: () => void) => { onChange = cb },
      },
    })
  })
  afterEach(() => vi.useRealTimers())

  it('reloads once the other channel’s worker takes over', async () => {
    const done = switchChannel()
    await vi.advanceTimersByTimeAsync(0)
    expect(update).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()
    onChange!()
    await done
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads anyway after 10 s', async () => {
    const done = switchChannel()
    await vi.advanceTimersByTimeAsync(9_999)
    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await done
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads when getRegistration rejects', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: () => Promise.reject(new Error('no sw')), addEventListener: () => {} },
    })
    await switchChannel()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads at once without a worker', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })
    await switchChannel()
    expect(reload).toHaveBeenCalledOnce()
  })
})
