import { describe, it, expect, vi, afterEach } from 'vitest'
import { practicesApi } from './practices'

describe('practicesApi.saveDiaryEntry', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

  it('sends a keepalive fetch so the save survives the app being closed', async () => {
    localStorage.setItem('yew.token', 'abc')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
    await practicesApi.saveDiaryEntry('2026-10-06', 'Rounds', { Int: 16 })
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/diary/2026-10-06/entry')
    expect(init).toMatchObject({ method: 'PUT', keepalive: true })
    expect(new Headers(init?.headers).get('Authorization')).toBe('Token abc')
    expect(JSON.parse(String(init?.body))).toEqual({ entry: { practice: 'Rounds', value: { Int: 16 } } })
  })

  it('resolves on a 202 the worker queued', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('null', { status: 202, headers: { 'X-Queued': '1' } }))
    await expect(practicesApi.saveDiaryEntry('2026-10-06', 'Rounds', null)).resolves.toBeUndefined()
  })

  it('gives up after 15 s and skips keepalive when a worker holds the value', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: {} } })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
    await practicesApi.saveDiaryEntry('2026-10-06', 'Rounds', null)
    const init = fetchSpy.mock.calls[0][1]!
    expect(init.keepalive).toBe(false)
    expect(init.signal).toBeInstanceOf(AbortSignal)
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })
  })

  it('rejects when the server refuses the save', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
    await expect(practicesApi.saveDiaryEntry('2026-10-06', 'Rounds', null)).rejects.toThrow()
  })
})

describe('practicesApi.reorderUserPractices', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends the ids as `practices`, the field the server reads', async () => {
    const { apiClient } = await import('./client')
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: null })
    await practicesApi.reorderUserPractices(['p2', 'p1'])
    expect(put).toHaveBeenCalledWith('/user/practices/reorder', { practices: ['p2', 'p1'] })
  })
})
