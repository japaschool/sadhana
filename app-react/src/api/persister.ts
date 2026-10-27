import type { Query } from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

/** Bump only when an API response changes shape (saved data then starts over). Never per release. */
export const CACHE_VERSION = '1'
export const CACHE_MAX_AGE = 30 * 24 * 60 * 60_000

const SAVED = new Set(['practices', 'diary', 'incomplete-days', 'reports', 'report-data', 'yatras', 'yatra-data'])

/** Only the user's own data, once loaded. Shared reports ('shared', …) and one-off lookups aren't saved.
 *  A failed refetch (offline) keeps its data and is saved too: dropping it left the next launch with nothing. */
export const shouldPersist = (q: Query) => q.state.data !== undefined && SAVED.has(String(q.queryKey[0]))

/** Saved as loaded data: the error (an AxiosError holds functions IndexedDB can't store) isn't kept. */
const asLoaded = (client: PersistedClient): PersistedClient => ({
  ...client,
  clientState: {
    ...client.clientState,
    queries: client.clientState.queries.map((q) => q.state.status !== 'error' ? q
      : { ...q, state: { ...q.state, status: 'success', error: null, fetchFailureReason: null } }),
  },
})

const KEY = 'client'
let dbp: Promise<IDBDatabase> | undefined

function db() {
  return dbp ??= new Promise((resolve, reject) => {
    const open = indexedDB.open('sadhana-query', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('kv')
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => { dbp = undefined; reject(open.error) }
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const r = fn((await db()).transaction('kv', mode).objectStore('kv'))
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
}

let pendingWrite: ReturnType<typeof setTimeout> | undefined
let pendingClient: PersistedClient | undefined

function writeNow() {
  clearTimeout(pendingWrite)
  const client = pendingClient
  pendingWrite = pendingClient = undefined
  if (client) run('readwrite', (s) => s.put(client, KEY)).catch(() => {})
}

// A hidden app may be reloaded (an update) or frozen (iOS stops timers): don't leave the last change in the debounce.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') writeNow() })
window.addEventListener('pagehide', writeNow)

// IndexedDB can be missing (private mode, blocked storage): the app then just runs without a saved cache.
export const persister: Persister = {
  // ponytail: trailing 1 s debounce, like the library's own persisters. Unsynced values live in the worker's outbox, not here.
  persistClient: (client: PersistedClient) => {
    clearTimeout(pendingWrite)
    pendingClient = asLoaded(client)
    pendingWrite = setTimeout(writeNow, 1000)
  },
  restoreClient: () => run<PersistedClient | undefined>('readonly', (s) => s.get(KEY)).catch(() => undefined),
  removeClient: async () => {
    clearTimeout(pendingWrite)
    pendingWrite = pendingClient = undefined
    await run('readwrite', (s) => s.delete(KEY)).catch(() => {})
  },
}
