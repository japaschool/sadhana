// Takeover service worker. Installed apps are still controlled by the Rust UI's
// worker at this path, which serves its cached `/` before the network. This one
// replaces it: sends the diary writes it queued offline, drops its caches and takes
// control, so the next load comes from the network (the React app).
// ponytail: no fetch handler, so no offline mode yet (P1 in docs/redesign-to-main-tasks.md).

// Substituted at Docker build, so every release is a byte-different worker.
const GIT_SHA = '__GIT_SHA__'

const DB_NAME = 'SadhanaProPostDB'
const STORE = 'postrequest'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    console.log(`Activating service worker ${GIT_SHA}`)
    await flushQueuedWrites().catch((err) => console.warn('Queued writes not sent', err))
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k.startsWith('static-v') || k.startsWith('api-v')).map((k) => caches.delete(k)))
    await self.clients.claim()
    // The Rust UI shows its "update ready" prompt on this; reloading it loads the React app.
    const clients = await self.clients.matchAll({ type: 'window' })
    clients.forEach((c) => c.postMessage('UPDATE_READY'))
  })())
})

/** Replays the Rust worker's offline queue in order, deleting each record once sent.
 *  Stops at the first failure; what's left stays in IndexedDB for the next activation
 *  (ponytail: only retried on the next release, until offline mode reads this queue again). */
async function flushQueuedWrites() {
  const db = await openDb()
  if (!db) return
  try {
    const records = await req(db.transaction(STORE).objectStore(STORE).getAll())
    for (const r of records) {
      const resp = await fetch(r.url, {
        method: r.method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(r.authHeader ? { Authorization: r.authHeader } : {}),
        },
        body: r.payload,
      })
      // 4xx won't succeed on retry (e.g. expired token): drop it rather than block the queue forever.
      if (resp.status >= 500) throw new Error(`HTTP ${resp.status}`)
      await req(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(r.id))
    }
  } finally {
    db.close()
  }
}

/** Opens the queue DB if the Rust worker ever created it; resolves null otherwise. */
function openDb() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME)
    let created = false
    open.onupgradeneeded = () => { created = true; open.transaction.abort() }
    open.onsuccess = () => {
      const db = open.result
      if (db.objectStoreNames.contains(STORE)) resolve(db)
      else { db.close(); resolve(null) }
    }
    open.onerror = () => (created ? resolve(null) : reject(open.error))
  })
}

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
