import { describe, it, expect, vi, afterEach } from 'vitest'
import { practicesApi } from './practices'
import { apiClient } from './client'

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

describe('practicesApi.getIncompleteDays', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  // The server's own date is UTC: in India, yesterday wasn't over there until 05:30 local, and wasn't marked.
  it('sends the local date, so a day counts as over when it is over for the user', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 16, 0, 30) })
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { days: ['2026-10-15'] } })
    await expect(practicesApi.getIncompleteDays('2026-10-11', '2026-10-19')).resolves.toEqual(['2026-10-15'])
    expect(get).toHaveBeenCalledWith('/diary/incomplete-days', { params: { from: '2026-10-11', to: '2026-10-19', today: '2026-10-16' } })
  })
})
