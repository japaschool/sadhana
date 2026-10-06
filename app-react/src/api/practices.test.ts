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

  it('rejects when the server refuses the save', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
    await expect(practicesApi.saveDiaryEntry('2026-10-06', 'Rounds', null)).rejects.toThrow()
  })
})
