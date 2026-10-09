// The app's service worker. It serves the shell from a per-release cache, keeps diary entries in an
// outbox until the server has them, and takes over from the Rust UI's worker at this path.
// Pure logic is in sw-lib.js. Design: docs/superpowers/specs/2026-10-09-offline-mode-design.md

// Substituted at Docker build, so every release is a byte-different worker.
const GIT_SHA = '__GIT_SHA__'
// Not compared with the literal: the Docker sed would rewrite both sides and make this always true.
const DEV = GIT_SHA.startsWith('__GIT')
// The `static-v` prefix is deliberate: the Rust worker's activate deletes these, and isTakeover relies on it.
const SHELL = `static-vr-${GIT_SHA}`
const ENTRY_TIMEOUT_MS = 10_000

self.importScripts('/sw-lib.js', '/precache-manifest.js')
const { entryDate, dayDate, outboxKey, overlay, flushRecords, isUnchanged } = self.swLib
const MANIFEST = new Set(self.__PRECACHE_MANIFEST__ ?? [])

let online = true

// ---- lifecycle ----

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const takeover = await isTakeover()
    if (!DEV) {
      const cache = await caches.open(SHELL)
      try {
        await Promise.all([...MANIFEST].map(async (url) => {
          const res = await fetch(url, { cache: 'no-store' })
          if (!res.ok) throw new Error(`Precache ${url}: HTTP ${res.status}`)
          await cache.put(url === '/index.html' ? '/' : url, res)
        }))
      } catch (err) {
        // A partial shell would make isTakeover() false for every later release.
        await caches.delete(SHELL)
        throw err
      }
    }
    // Replacing our own previous release waits until the page sends SKIP_WAITING.
    if (takeover) await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    console.log(`Activating service worker ${GIT_SHA}`)
    const takeover = await isTakeover()
    await moveLegacyQueue().catch((err) => console.warn('Legacy queue not moved', err))
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => (k.startsWith('static-v') || k.startsWith('api-v')) && k !== SHELL).map((k) => caches.delete(k)))
    await self.clients.claim()
    // The Rust UI shows its "update ready" prompt on this; reloading it loads the React app from our shell.
    if (takeover) (await self.clients.matchAll({ type: 'window' })).forEach((c) => c.postMessage('UPDATE_READY'))
    void flush().then(report)
  })())
})

/** No shell of ours from another release. The active worker is then the Rust one or the takeover
 *  one (both delete `static-v*` caches), or there is none, so there is nothing to wait for. */
async function isTakeover() {
  return !(await caches.keys()).some((k) => k.startsWith('static-vr-') && k !== SHELL)
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(skipWaitingIfUnseen(event.source))
  else if (event.data?.type === 'FLUSH') event.waitUntil(flush().then(report))
})

/** Activating reloads every page, so only when no other window is on screen: an automatic update from a hidden tab
 *  must not reload a visible one mid-form. The sender counts as hidden (it asked, by hiding or from Settings). */
async function skipWaitingIfUnseen(sender) {
  const windows = await self.clients.matchAll({ type: 'window' })
  if (windows.every((c) => c.id === sender?.id || c.visibilityState === 'hidden')) await self.skipWaiting()
}

// ---- fetch rules: first match wins; anything else goes to the network untouched ----

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.mode === 'navigate') return event.respondWith(fromShell('/', req))
  if (url.origin !== self.location.origin) return
  if (req.method === 'GET' && MANIFEST.has(url.pathname)) return event.respondWith(fromShell(url.pathname, req))
  if (req.method === 'PUT' && entryDate(url.pathname)) return event.respondWith(saveEntry(req, event))
  const day = req.method === 'GET' && dayDate(url.pathname)
  if (day) return event.respondWith(diaryDay(req, day, event))
})

async function fromShell(path, req) {
  return (await caches.match(path, { cacheName: SHELL, ignoreSearch: true })) ?? fetch(req)
}

/** Writes the value to the outbox first, then gives the network up to 10 s to take it. */
let lastSeq = 0

async function saveEntry(req, event) {
  // Taken before any await, so it follows the order the requests arrived in; strictly increasing.
  const seq = lastSeq = Math.max(Date.now(), lastSeq + 1)
  const auth = req.headers.get('Authorization')
  const body = await req.clone().text()
  const record = { key: outboxKey(auth, req.url, body), url: req.url, auth, body, seq }
  try {
    await idb('readwrite', (s) => s.put(record))
  } catch (err) {
    console.warn('Outbox unavailable, sending directly', err)
    return fetch(req)
  }
  const attempt = (async () => {
    // A run already in flight may have read the outbox before this put; the next run includes it.
    for (let i = 0; i < 2; i++) {
      const sent = (await flush()).get(record.key)
      if (sent?.seq === record.seq) return sent.res
    }
    return null
  })()
  event.waitUntil(attempt.then(report))
  const res = await Promise.race([attempt, new Promise((r) => setTimeout(() => r(null), ENTRY_TIMEOUT_MS))])
  return res?.clone() ?? new Response('null', { status: 202, headers: { 'Content-Type': 'application/json', 'X-Queued': '1' } })
}

/** The network's diary day with the values still waiting in the outbox laid over it. A failure stays a failure. */
async function diaryDay(req, date, event) {
  // Read before the request: a flush meanwhile may delete a record whose value then isn't in the answer either.
  // A record settled meanwhile is in the server's answer, so laying it over again is harmless.
  const pending = idb('readonly', (s) => s.getAll()).catch(() => [])
  let res
  try {
    res = await fetch(req)
    online = true
  } catch (err) {
    online = false
    event.waitUntil(report())
    throw err
  }
  event.waitUntil(report())
  if (!res.ok) return res
  event.waitUntil(flush().then(report))
  const body = overlay(await res.json(), await pending, date, req.headers.get('Authorization'))
  return new Response(JSON.stringify(body), { status: res.status, headers: { 'Content-Type': 'application/json' } })
}

// ---- outbox ----

let flushing = null

/** One run at a time; concurrent callers share it. Resolves key → { seq, res } for what it settled. */
function flush() {
  return flushing ??= (async () => {
    try {
      return await flushRecords(await idb('readonly', (s) => s.getAll()), send, settle)
    } catch (err) {
      console.warn('Outbox flush failed', err)
      return new Map()
    } finally {
      flushing = null
    }
  })()
}

function send(r) {
  return fetch(r.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(r.auth ? { Authorization: r.auth } : {}) },
    body: r.body,
    signal: AbortSignal.timeout(ENTRY_TIMEOUT_MS),
  }).then((res) => { online = true; return res }, (err) => { online = false; throw err })
}

/** Deletes a sent record, unless a newer value for the same key was written while it was in flight. */
async function settle(r) {
  const tx = (await outbox()).transaction('entries', 'readwrite')
  const store = tx.objectStore('entries')
  if (isUnchanged(await req(store.get(r.key)), r)) store.delete(r.key)
  await done(tx)
}

async function report() {
  const pending = await idb('readonly', (s) => s.count()).catch(() => 0)
  for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'NET', online, pending })
}

let outboxDb
function outbox() {
  return outboxDb ??= new Promise((resolve, reject) => {
    const open = indexedDB.open('sadhana-outbox', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('entries', { keyPath: 'key' })
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => { outboxDb = undefined; reject(open.error) }
  })
}

async function idb(mode, fn) {
  const tx = (await outbox()).transaction('entries', mode)
  const result = await req(fn(tx.objectStore('entries')))
  await done(tx)
  return result
}

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(tx.error)
  })
}

// ---- the Rust worker's queue (SadhanaProPostDB/postrequest) ----

const LEGACY_DB = 'SadhanaProPostDB'
const LEGACY_STORE = 'postrequest'

/** Moves the Rust worker's offline queue into the outbox, oldest first, deleting each record once moved. */
async function moveLegacyQueue() {
  const db = await openLegacyDb()
  if (!db) return
  try {
    const records = await req(db.transaction(LEGACY_STORE).objectStore(LEGACY_STORE).getAll())
    // Newest first: the Rust worker adds a record per failed PUT, so the newest value for a key must win.
    for (const r of [...records].reverse()) {
      const auth = r.authHeader ?? null
      // seq = the legacy id: small integers, so they are sent before anything written here.
      const rec = { key: outboxKey(auth, r.url, r.payload), url: r.url, auth, body: r.payload, seq: r.id }
      // ponytail: a value already in the outbox for the same key (or moved earlier in this loop) is newer; keep it.
      await idb('readwrite', (s) => s.add(rec)).catch((err) => { if (err?.name !== 'ConstraintError') throw err })
      await req(db.transaction(LEGACY_STORE, 'readwrite').objectStore(LEGACY_STORE).delete(r.id))
    }
  } finally {
    db.close()
  }
}

/** Opens the queue DB if the Rust worker ever created it; resolves null otherwise (never creates or bumps it). */
function openLegacyDb() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(LEGACY_DB)
    let created = false
    open.onupgradeneeded = () => { created = true; open.transaction.abort() }
    open.onsuccess = () => {
      const db = open.result
      if (db.objectStoreNames.contains(LEGACY_STORE)) resolve(db)
      else { db.close(); resolve(null) }
    }
    open.onerror = () => (created ? resolve(null) : reject(open.error))
  })
}
