import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import type { Query } from '@tanstack/react-query'
import type { PersistedClient } from '@tanstack/react-query-persist-client'

// jsdom has no IndexedDB: a Map behind the few calls the persister makes.
const data = new Map<string, unknown>()
function request<T>(result: () => T) {
  const r: { result?: T; onsuccess?: () => void; onerror?: () => void; onupgradeneeded?: () => void } = {}
  setTimeout(() => { r.result = result(); r.onsuccess?.() })
  return r
}
const store = {
  put: (v: unknown, k: string) => request(() => { data.set(k, v) }),
  get: (k: string) => request(() => data.get(k)),
  delete: (k: string) => request(() => { data.delete(k) }),
}
beforeAll(() => {
  vi.stubGlobal('indexedDB', { open: () => request(() => ({ transaction: () => ({ objectStore: () => store }) })) })
})

const { persister, shouldPersist } = await import('./persister')

const q = (queryKey: unknown[], status = 'success') => ({ queryKey, state: { status } }) as unknown as Query
const client = { timestamp: 1, buster: '1', clientState: { queries: [], mutations: [] } } as PersistedClient

describe('shouldPersist', () => {
  it('saves the user’s own loaded data', () => {
    for (const k of ['practices', 'diary', 'incomplete-days', 'reports', 'report-data', 'yatras', 'yatra-data']) {
      expect(shouldPersist(q([k, 'x']))).toBe(true)
    }
  })

  it('skips shared reports, one-off lookups and unloaded queries', () => {
    for (const k of [['shared', 'u1', 'reports'], ['confirmation', 'c'], ['version'], ['yatra-users', 'y'], ['yatra-user-practices', 'y'], ['yatra', 'y']]) {
      expect(shouldPersist(q(k))).toBe(false)
    }
    expect(shouldPersist(q(['practices'], 'error'))).toBe(false)
    expect(shouldPersist(q(['practices'], 'pending'))).toBe(false)
  })
})

describe('persister', () => {
  beforeEach(() => { data.clear(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('saves after a pause and restores', async () => {
    persister.persistClient(client)
    await vi.runAllTimersAsync()
    const restored = persister.restoreClient()
    await vi.runAllTimersAsync()
    expect(await restored).toEqual(client)
  })

  it('removeClient cancels a save still waiting, so a logged-out cache is not written back', async () => {
    persister.persistClient(client)
    const removed = persister.removeClient()
    await vi.runAllTimersAsync()
    await removed
    expect(data.size).toBe(0)
  })

  it('writes a waiting save at once when the app is hidden or the page goes away', async () => {
    persister.persistClient(client)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(10)
    expect(data.get('client')).toEqual(client)

    data.clear()
    persister.persistClient(client)
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(10)
    expect(data.get('client')).toEqual(client)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })

  it('removeClient also cancels a save the app would write on hide', async () => {
    persister.persistClient(client)
    const removed = persister.removeClient()
    window.dispatchEvent(new Event('pagehide'))
    await vi.runAllTimersAsync()
    await removed
    expect(data.size).toBe(0)
  })
})
