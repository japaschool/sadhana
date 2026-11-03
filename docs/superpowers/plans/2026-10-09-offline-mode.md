# Offline Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The installed React app opens instantly from local data on a bad or absent connection, never loses a diary entry made offline, and shows when it's offline and how many changes are waiting.

**Architecture:** The service worker serves the app shell from a per-release cache and puts each diary entry PUT in an IndexedDB outbox *before* it tries the network. Resends run one at a time under a single lock. The page keeps its own data in React Query, saved to IndexedDB through a persister, so reads never go through the worker's cache. Small zustand stores carry online/pending state and the waiting worker to the UI.

**Tech Stack:** Plain-JS classic service worker (+ `sw-lib.js`), React 19, TanStack Query v5 + `@tanstack/react-query-persist-client`, zustand, axios, Vitest (jsdom), actix-web (precache manifest).

**Spec:** `docs/superpowers/specs/2026-10-09-offline-mode-design.md`. Read it before starting. This plan says *how*; the spec says *why*.

## Global Constraints

- Node 22 for `npm test` (the host's Node 26 breaks jsdom `localStorage`). Run tooling **inside the dev container**: `C=$(docker ps --format '{{.Names}}' | head -1)`, then `docker exec $C bash -lc 'cd /workspaces/sadhana-pro/app-react && <cmd>'`. Every `Run:` line below is meant to be run that way. The `app-react` cwd is the default; Rust commands use `/workspaces/sadhana-pro`.
- Offline writes: **diary entries only** (`PUT /api/diary/{yyyy-mm-dd}/entry`). Every other write fails with the normal error when offline.
- Shell cache name `static-vr-<sha>`. Keep the `static-v` prefix, because takeover depends on the Rust worker deleting these caches.
- Outbox: IndexedDB `sadhana-outbox`, store `entries`, keyPath `key`. **Never** open or bump `SadhanaProPostDB` except through the existing open-without-creating guard.
- Query cache: IndexedDB `sadhana-query`. `maxAge` 30 days. `buster` = `CACHE_VERSION` constant, never per release.
- Worker files stay plain JS, classic scripts, so the Docker `sed` of `__GIT_SHA__` in `dist/service_worker.js` keeps working.
- All new strings in en/ru/uk (ru/uk plurals: `_one/_few/_many/_other`).
- Local `yyyy-mm-dd` dates only; never `toISOString()`.
- Do not hand-edit `server/src/schema.rs`. `make lint` treats clippy warnings as errors.
- Commit after each task with a `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.

## Review Focus

The spec doesn't spell these out, but each one would bite a real user. Each has a test in the task named.

1. **A failed refetch must not hide cached data.** In TanStack v5 a failed refetch sets `status: 'error'` and keeps `data`, so `isError` alone turns Today/Insights/Yatras into "Something went wrong" on a bad connection, even with 30 days of cached data. Error = *no data* and (error or paused). → Task 8 (`failedWithoutData`).
2. **When the browser reports offline, mutations are paused, not sent.** v5's default mutation `networkMode: 'online'` holds the save in memory, the worker never sees it, and a reload loses it. Set `mutations.networkMode: 'always'`. → Task 5.
3. **A cancelled request isn't "offline".** `cancelQueries` in `onMutate` aborts the diary fetch (axios `CanceledError`, no response). Treating that as offline would flash the banner on every save. → Task 7.
4. **Logging out must not resurrect the last user's data.** A debounced cache write still pending at logout would write the old user's cache back after `removeClient()`. A `/api/user` refresh in flight at logout would sign them back in. → Tasks 5 and 6.
5. **A sent record is deleted only if it wasn't replaced meanwhile, and a PUT is answered for *its* value.** If the user types "4" then "45" while "4" is being sent, "45" must stay queued and the second PUT must not get "4"'s 200. → Task 2 (`isUnchanged`, `flushRecords` returns `seq`) and Task 3 (the seq check in `saveEntry`).

Also: TanStack restores and garbage-collects by `gcTime`. With the current 5 min, anything not on screen is dropped from the next save, so `gcTime` must be ≥ `maxAge` (Task 5).

## File Structure

| File | Responsibility |
|---|---|
| `server/src/routes.rs` | precache manifest extensions (+`json`, `woff2`, −`wasm`) |
| `app-react/public/fonts/*.woff2`, `src/index.css`, `index.html` | self-hosted fonts; Google links removed; `#reset` script |
| `app-react/public/sw-lib.js` (new) | pure worker logic: path parsing, outbox key, overlay, flush loop, seq check |
| `app-react/src/sw-lib.test.js` (new) | Vitest for `sw-lib.js` |
| `app-react/public/service_worker.js` | shell precache, fetch rules, outbox IDB, legacy move, takeover/update |
| `app-react/src/api/persister.ts` (new) | IndexedDB persister, allowlist, `CACHE_VERSION`/`CACHE_MAX_AGE` |
| `app-react/src/api/queryState.ts` (new) | `failedWithoutData(q)` |
| `app-react/src/store/authStore.ts`, `src/store/hydrateAuth.ts` (new) | saved user, offline-first hydrate |
| `app-react/src/api/client.ts`, `src/api/practices.ts` | timeouts, online flag from axios, 202 handling |
| `app-react/src/hooks/useNetworkStatus.ts` | `{ online, pending }` store + watchers |
| `app-react/src/features/today/SyncBanner.tsx` (new) | offline/syncing banner + day-failed note |
| `app-react/src/features/today/useToday.ts` + layouts, `insights/mobile/DaySheet.tsx` | practices-only gating, `dayLoading`/`dayFailed` |
| `app-react/src/features/insights/useInsights.ts`, `yatras/useYatras.ts` | cached data survives a failed refetch |
| `app-react/src/hooks/useServiceWorkerUpdate.ts` | waiting-worker store, auto-update on hide |
| `app-react/src/features/settings/releaseChannel.ts`, `sections.tsx` | preview toggle waits for the other channel's worker |
| `app-react/src/main.tsx` | wiring |

---

### Task 1: Precache manifest and self-hosted fonts

**Files:**
- Modify: `server/src/routes.rs:78-91` (`collect_precache_assets` extension list)
- Create: `app-react/public/fonts/*.woff2` (8 files)
- Modify: `app-react/src/index.css` (top), `app-react/index.html` (remove Google Fonts)

**Interfaces:**
- Produces: `/precache-manifest.js` lists `/locales/*/translation.json` and `/fonts/*.woff2`. Fonts are served at `/fonts/<family>-<weight>-<subset>.woff2`.

- [ ] **Step 1: Change the extension list** in `server/src/routes.rs`: remove `| "wasm"`, add `| "json"` and `| "woff2"`:

```rust
            if matches!(
                ext,
                "html"
                    | "js"
                    | "css"
                    | "json"
                    | "webmanifest"
                    | "jpg"
                    | "png"
                    | "ttf"
                    | "svg"
                    | "eot"
                    | "woff"
                    | "woff2"
                    | "webp"
            ) {
```

- [ ] **Step 2: Download the fonts** (on the host, which has Node and network access). Keep only the `latin` and `cyrillic` subsets. Google's cyrillic subset includes Ukrainian ґ (U+0490–0491).

```bash
cd app-react && node --input-type=module -e '
import fs from "node:fs"
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
const css = await (await fetch("https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&family=IBM+Plex+Mono:wght@400;500;600&display=swap", { headers: { "User-Agent": UA } })).text()
fs.mkdirSync("public/fonts", { recursive: true })
let out = ""
for (const [, subset, block] of css.matchAll(/\/\* ([\w-]+) \*\/\s*(@font-face \{[^}]+\})/g)) {
  if (subset !== "latin" && subset !== "cyrillic") continue
  const family = /font-family: '\''([^'\'']+)'\''/.exec(block)[1]
  const weight = /font-weight: ([\d ]+);/.exec(block)[1].replace(" ", "-")
  const url = /url\(([^)]+)\)/.exec(block)[1]
  const name = `${family.toLowerCase().replace(/ /g, "-")}-${weight}-${subset}.woff2`
  fs.writeFileSync(`public/fonts/${name}`, Buffer.from(await (await fetch(url)).arrayBuffer()))
  out += `/* ${family} ${weight} ${subset} */\n` + block.replace(url, `/fonts/${name}`) + "\n"
}
fs.writeFileSync("/tmp/fonts.css", out)
console.log(out)
'
ls public/fonts
```

Expected: 8 files: `manrope-400-800-{latin,cyrillic}.woff2`, `ibm-plex-mono-{400,500,600}-{latin,cyrillic}.woff2`.

- [ ] **Step 3: Paste the printed `@font-face` blocks into `app-react/src/index.css`** directly after the two `@import` lines (`@import` must stay first). Each block keeps its `unicode-range` and `font-display: swap`.

- [ ] **Step 4: Remove from `app-react/index.html`** the two `preconnect` links, the `preload`/`onload` stylesheet link and the `<noscript>` block (everything from `<link rel="preconnect" href="https://fonts.googleapis.com" />` to `</noscript>`, with the comment above the preload).

- [ ] **Step 5: Verify build and manifest**

Run: `npm run build && cd /workspaces/sadhana-pro && (make run_server &) ; sleep 8; curl -s localhost:8080/precache-manifest.js | tr ',' '\n' | grep -E 'json|woff2|wasm'`
Expected: the three `/locales/*/translation.json` and eight `/fonts/*.woff2` lines, no `wasm`. Stop the server afterwards (`pkill -f target/debug/server` or similar).

Run: `cd /workspaces/sadhana-pro && cargo clippy --all-targets --all-features -- -D warnings`
Expected: no warnings.

Then open `localhost:8080` (with `make run_server` running) and check in DevTools → Network that no request goes to `fonts.googleapis.com`/`gstatic.com`, and that Russian text is in Manrope.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes.rs app-react/public/fonts app-react/src/index.css app-react/index.html
git commit -m "feat(offline): self-host fonts; precache json and woff2"
```

---

### Task 2: `sw-lib.js`, the worker's pure logic

**Files:**
- Create: `app-react/public/sw-lib.js`
- Test: `app-react/src/sw-lib.test.js` (plain JS: `tsconfig` doesn't type-check `public/`, and Vite won't `import` from `public/`, so the test evaluates the file)

**Interfaces:**
- Produces `self.swLib`:
  - `entryDate(path: string): string | null`: date of `/api/diary/{d}/entry`
  - `dayDate(path: string): string | null`: date of `/api/diary/{d}`
  - `outboxKey(auth: string|null, url: string, body: string): string`: `auth|date|practice`, or `auth|url` if the body isn't an entry
  - `overlay(body: {diary_day: DiaryEntry[]}, pending: Record[], date: string, auth: string|null)`: the same shape with pending values applied
  - `flushRecords(records, send: (r) => Promise<Response>, settle: (r) => Promise<void>): Promise<Map<key, {seq, res}>>`
  - `isUnchanged(stored: Record|undefined, sent: Record): boolean`
  - Record = `{ key, url, auth, body, seq }`

- [ ] **Step 1: Write the failing tests**: `app-react/src/sw-lib.test.js`

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// The worker loads sw-lib.js with importScripts; run it the same way against a fake `self`.
const scope = {}
new Function('self', readFileSync(new URL('../public/sw-lib.js', import.meta.url), 'utf8'))(scope)
const { entryDate, dayDate, outboxKey, overlay, flushRecords, isUnchanged } = scope.swLib

const entry = (auth, date, practice, value, seq = 1) => {
  const url = `https://app.sadhana.pro/api/diary/${date}/entry`
  const body = JSON.stringify({ entry: { practice, value } })
  return { key: outboxKey(auth, url, body), url, auth, body, seq }
}

describe('paths', () => {
  it('reads the date of entry PUTs and day GETs only', () => {
    expect(entryDate('/api/diary/2026-10-09/entry')).toBe('2026-10-09')
    expect(entryDate('/api/diary/2026-10-09')).toBeNull()
    expect(dayDate('/api/diary/2026-10-09')).toBe('2026-10-09')
    expect(dayDate('/api/diary/incomplete-days')).toBeNull()
  })
})

describe('outboxKey', () => {
  it('is one key per account, date and practice', () => {
    expect(entry('Token a', '2026-10-09', 'Japa', { Int: 1 }).key).toBe('Token a|2026-10-09|Japa')
    expect(entry('Token a', '2026-10-09', 'Japa', { Int: 2 }).key).toBe(entry('Token a', '2026-10-09', 'Japa', null).key)
    expect(entry('Token b', '2026-10-09', 'Japa', null).key).not.toBe(entry('Token a', '2026-10-09', 'Japa', null).key)
  })

  it('falls back to the url for a body that is not an entry', () => {
    expect(outboxKey('Token a', '/api/x', 'not json')).toBe('Token a|/api/x')
  })
})

describe('overlay', () => {
  const day = { diary_day: [
    { practice: 'Japa', data_type: 'Int', value: { Int: 4 } },
    { practice: 'Reading', data_type: 'Bool' },
  ] }

  it('replaces and adds pending values for that date and account', () => {
    const out = overlay(day, [
      entry('Token a', '2026-10-09', 'Japa', { Int: 16 }),
      entry('Token a', '2026-10-09', 'Yoga', { Duration: 30 }),
    ], '2026-10-09', 'Token a')
    expect(out.diary_day).toEqual([
      { practice: 'Japa', data_type: 'Int', value: { Int: 16 } },
      { practice: 'Reading', data_type: 'Bool' },
      { practice: 'Yoga', value: { Duration: 30 } },
    ])
  })

  it('applies a pending clear (null)', () => {
    const out = overlay(day, [entry('Token a', '2026-10-09', 'Japa', null)], '2026-10-09', 'Token a')
    expect(out.diary_day[0].value).toBeNull()
  })

  it('ignores other dates and other accounts', () => {
    const out = overlay(day, [
      entry('Token a', '2026-10-08', 'Japa', { Int: 1 }),
      entry('Token b', '2026-10-09', 'Japa', { Int: 2 }),
    ], '2026-10-09', 'Token a')
    expect(out).toEqual(day)
  })
})

describe('flushRecords', () => {
  const ok = (status) => async () => new Response(null, { status })

  it('sends oldest first and settles 2xx and 4xx', async () => {
    const sent = [], settled = []
    const recs = [entry('a', '2026-10-09', 'B', null, 2), entry('a', '2026-10-09', 'A', null, 1)]
    const out = await flushRecords(recs, async (r) => { sent.push(r.seq); return new Response(null, { status: r.seq === 1 ? 200 : 400 }) },
      async (r) => { settled.push(r.seq) })
    expect(sent).toEqual([1, 2])
    expect(settled).toEqual([1, 2])
    expect(out.get(recs[1].key)).toMatchObject({ seq: 1 })
    expect(out.get(recs[0].key).res.status).toBe(400)
  })

  it('stops at a network error and keeps the rest', async () => {
    const settled = []
    const recs = [entry('a', '2026-10-09', 'A', null, 1), entry('a', '2026-10-09', 'B', null, 2)]
    const out = await flushRecords(recs, async () => { throw new TypeError('offline') }, async (r) => { settled.push(r) })
    expect(settled).toEqual([])
    expect(out.size).toBe(0)
  })

  it('stops at a 5xx without settling it', async () => {
    const settled = []
    const recs = [entry('a', '2026-10-09', 'A', null, 1), entry('a', '2026-10-09', 'B', null, 2)]
    const out = await flushRecords(recs, ok(503), async (r) => { settled.push(r) })
    expect(settled).toEqual([])
    expect(out.size).toBe(0)
  })
})

describe('isUnchanged', () => {
  it('is true only when the stored record is the one that was sent', () => {
    const sent = entry('a', '2026-10-09', 'A', { Int: 4 }, 1)
    expect(isUnchanged(sent, sent)).toBe(true)
    expect(isUnchanged({ ...sent, seq: 2 }, sent)).toBe(false)
    expect(isUnchanged(undefined, sent)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/sw-lib.test.js`
Expected: FAIL, `ENOENT ... public/sw-lib.js`.

- [ ] **Step 3: Implement**: `app-react/public/sw-lib.js`

```js
// Pure logic for service_worker.js. A classic script: the worker loads it with importScripts,
// and src/sw-lib.test.js runs it against a fake `self`. Both read self.swLib.
self.swLib = (() => {
  const ENTRY = /^\/api\/diary\/(\d{4}-\d{2}-\d{2})\/entry$/
  const DAY = /^\/api\/diary\/(\d{4}-\d{2}-\d{2})$/

  /** The yyyy-mm-dd of a diary entry PUT path, or null. */
  const entryDate = (path) => ENTRY.exec(path)?.[1] ?? null
  /** The yyyy-mm-dd of a diary day GET path, or null. */
  const dayDate = (path) => DAY.exec(path)?.[1] ?? null
  const pathOf = (url) => new URL(url, 'https://x').pathname

  /** One outbox record per (account, date, practice), so a newer value replaces the older one. */
  function outboxKey(auth, url, body) {
    const date = entryDate(pathOf(url))
    let practice
    try { practice = JSON.parse(body).entry.practice } catch { /* not an entry */ }
    return date && practice !== undefined ? `${auth}|${date}|${practice}` : `${auth}|${url}`
  }

  /** The diary day response with the values still waiting in the outbox for that date and account. */
  function overlay(body, pending, date, auth) {
    const days = [...body.diary_day]
    for (const r of pending) {
      if (r.auth !== auth || entryDate(pathOf(r.url)) !== date) continue
      const { practice, value } = JSON.parse(r.body).entry
      const i = days.findIndex((e) => e.practice === practice)
      if (i >= 0) days[i] = { ...days[i], value }
      else days.push({ practice, value })
    }
    return { ...body, diary_day: days }
  }

  /** Sends records oldest first. Stops at the first network error, timeout or 5xx, keeping the rest.
   *  2xx and 4xx are settled (a 4xx won't succeed on retry). Resolves key → { seq, res } of what was sent. */
  async function flushRecords(records, send, settle) {
    const results = new Map()
    for (const r of [...records].sort((a, b) => a.seq - b.seq)) {
      let res
      try { res = await send(r) } catch { break }
      if (res.status >= 500) break
      results.set(r.key, { seq: r.seq, res })
      await settle(r)
    }
    return results
  }

  /** A sent record may be deleted only if no newer value replaced it while it was in flight. */
  const isUnchanged = (stored, sent) => !!stored && stored.seq === sent.seq

  return { entryDate, dayDate, outboxKey, overlay, flushRecords, isUnchanged }
})()
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/sw-lib.test.js && npm run lint`
Expected: all PASS, lint clean.

- [ ] **Step 5: Commit**

```bash
git add app-react/public/sw-lib.js app-react/src/sw-lib.test.js
git commit -m "feat(offline): pure outbox and overlay logic for the worker"
```

---

### Task 3: The service worker

**Files:**
- Rewrite: `app-react/public/service_worker.js`

**Interfaces:**
- Consumes: `self.swLib` (Task 2), `self.__PRECACHE_MANIFEST__` from `/precache-manifest.js` (Task 1).
- Produces (the page relies on these):
  - `PUT /api/diary/{d}/entry` → the server's response, or `202` with body `null` and the header `X-Queued: 1`;
  - posts `{ type: 'NET', online: boolean, pending: number }` to its window clients;
  - accepts the messages `{ type: 'SKIP_WAITING' }` and `{ type: 'FLUSH' }`;
  - after a takeover activation, posts the plain string `'UPDATE_READY'`.

There is no unit test harness for the worker. Its logic lives in Task 2, and this task is verified by hand in Step 3.

- [ ] **Step 1: Replace `app-react/public/service_worker.js`** with:

```js
// The app's service worker. It serves the shell from a per-release cache, keeps diary entries in an
// outbox until the server has them, and takes over from the Rust UI's worker at this path.
// Pure logic is in sw-lib.js. Design: docs/superpowers/specs/2026-10-09-offline-mode-design.md

// Substituted at Docker build, so every release is a byte-different worker.
const GIT_SHA = '__GIT_SHA__'
const DEV = GIT_SHA === '__GIT_SHA__'
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
      await Promise.all([...MANIFEST].map(async (url) => {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Precache ${url}: HTTP ${res.status}`)
        await cache.put(url === '/index.html' ? '/' : url, res)
      }))
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
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
  else if (event.data?.type === 'FLUSH') event.waitUntil(flush().then(report))
})

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
async function saveEntry(req, event) {
  const auth = req.headers.get('Authorization')
  const body = await req.clone().text()
  const record = { key: outboxKey(auth, req.url, body), url: req.url, auth, body, seq: performance.timeOrigin + performance.now() }
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
  const pending = await idb('readonly', (s) => s.getAll()).catch(() => [])
  const body = overlay(await res.json(), pending, date, req.headers.get('Authorization'))
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
    for (const r of records) {
      const auth = r.authHeader ?? null
      // seq = the legacy id: small integers, so they are sent before anything written here.
      const rec = { key: outboxKey(auth, r.url, r.payload), url: r.url, auth, body: r.payload, seq: r.id }
      // ponytail: a value already in the outbox for the same key was entered later; keep it.
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
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Verify by hand in Chrome.** Build, then stamp a fake SHA so the shell gets precached. `make frontend-build` runs `npm ci`; inside the container use:

```bash
docker exec $C bash -lc 'cd /workspaces/sadhana-pro && make frontend-build && sed -i "s/__GIT_SHA__/local001/g" dist/service_worker.js && make run_server'
```

Open `http://localhost:8080` in Chrome and sign in (localhost counts as a secure context). Then check:
1. DevTools → Application → Service workers: one active worker. Cache storage: `static-vr-local001` holds `/`, the JS/CSS, `/locales/*`, `/fonts/*`.
2. Network → Offline, then reload: the app opens. Toggle a practice. The PUT shows `(ServiceWorker)`, status `202`, `X-Queued: 1`. IndexedDB `sadhana-outbox/entries` has one record.
3. Toggle the same practice again: still one record (same key), `seq` is newer.
4. Go back online, then DevTools → Application → Service workers → "Push"/or simply reload. The record is gone and the server has the value (`curl -H "Authorization: Token <t>" localhost:8080/api/diary/<date>`).
5. Stamp `local002` (`sed -i "s/local001/local002/g" dist/service_worker.js`) and reload: the new worker shows as **waiting** (no takeover because `static-vr-local001` exists).

- [ ] **Step 4: Commit**

```bash
git add app-react/public/service_worker.js
git commit -m "feat(offline): service worker with shell cache, diary outbox and legacy queue move"
```

---

### Task 4: Self-check in a fresh context: takeover from the Rust UI

This verifies Task 3 against the real Rust UI before the page side depends on it. No code unless it fails.

- [ ] **Step 1:** On `main`, build and run the Rust UI (`git worktree add ../sp-main main`, then `make run` in that worktree inside the container). Open it, go offline, enter two diary values, so `SadhanaProPostDB/postrequest` has records. Stop it.
- [ ] **Step 2:** Switch back to the `redesign` build from Task 3 Step 3 (same origin `localhost:8080`) and open the page that is still on the Rust UI. Expected: the new worker installs and activates immediately (takeover). `postrequest` is now empty; `sadhana-outbox` held the records and sent them (check the server). The Rust UI receives `UPDATE_READY` and shows its prompt, and the reload lands on the React app.
- [ ] **Step 3:** If anything differs, fix it in `service_worker.js` and amend the Task 3 commit (`git commit --amend`). Then `git worktree remove ../sp-main`.

---

### Task 5: Persisted query cache

**Files:**
- Create: `app-react/src/api/persister.ts`
- Test: `app-react/src/api/persister.test.ts`
- Modify: `app-react/src/main.tsx`, `app-react/package.json` (dependency)

**Interfaces:**
- Produces: `persister: Persister`, `shouldPersist(q: Query): boolean`, `CACHE_VERSION: string`, `CACHE_MAX_AGE: number` (ms).

- [ ] **Step 1: Add the dependency**

Run: `npm install @tanstack/react-query-persist-client@^5`
Expected: `package.json` and `package-lock.json` updated, and its major version matches `@tanstack/react-query`.

- [ ] **Step 2: Write the failing tests**: `app-react/src/api/persister.test.ts`

```ts
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
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/api/persister.test.ts`
Expected: FAIL, cannot resolve `./persister`.

- [ ] **Step 4: Implement**: `app-react/src/api/persister.ts`

```ts
import type { Query } from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

/** Bump only when an API response changes shape (saved data then starts over). Never per release. */
export const CACHE_VERSION = '1'
export const CACHE_MAX_AGE = 30 * 24 * 60 * 60_000

const SAVED = new Set(['practices', 'diary', 'incomplete-days', 'reports', 'report-data', 'yatras', 'yatra-data'])

/** Only the user's own data, once loaded. Shared reports ('shared', …) and one-off lookups aren't saved. */
export const shouldPersist = (q: Query) => q.state.status === 'success' && SAVED.has(String(q.queryKey[0]))

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

// IndexedDB can be missing (private mode, blocked storage): the app then just runs without a saved cache.
export const persister: Persister = {
  // ponytail: trailing 1 s debounce, like the library's own persisters. Unsynced values live in the worker's outbox, not here.
  persistClient: (client: PersistedClient) => {
    clearTimeout(pendingWrite)
    pendingWrite = setTimeout(() => { run('readwrite', (s) => s.put(client, KEY)).catch(() => {}) }, 1000)
  },
  restoreClient: () => run<PersistedClient | undefined>('readonly', (s) => s.get(KEY)).catch(() => undefined),
  removeClient: async () => {
    clearTimeout(pendingWrite)
    await run('readwrite', (s) => s.delete(KEY)).catch(() => {})
  },
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/api/persister.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire into `app-react/src/main.tsx`.** Replace the `QueryClientProvider` import with `QueryClient` only, and add the provider import plus the persister import:

```tsx
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { CACHE_MAX_AGE, CACHE_VERSION, persister, shouldPersist } from './api/persister'
```

Replace the `queryClient` definition and the subscription:

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // At least the saved cache's maxAge: a query collected from memory is also dropped from the next save.
      gcTime: CACHE_MAX_AGE,
      retry: 1,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
    // Send writes even when the browser says offline: the worker queues diary entries; other writes fail as usual.
    mutations: { networkMode: 'always' },
  },
})

// A different user (or none) must not see the last one's cached practices and diary, in memory or on disk.
useAuthStore.subscribe((s, prev) => {
  if (s.token !== prev.token) { queryClient.clear(); void persister.removeClient() }
})
```

Replace `<QueryClientProvider client={queryClient}>…</QueryClientProvider>` with:

```tsx
    <PersistQueryClientProvider client={queryClient} persistOptions={{
      persister,
      maxAge: CACHE_MAX_AGE,
      buster: CACHE_VERSION,
      dehydrateOptions: { shouldDehydrateQuery: shouldPersist, shouldDehydrateMutation: () => false },
    }}>
      <Suspense fallback={<UiLoading />}><RouterProvider router={router} /></Suspense>
    </PersistQueryClientProvider>
```

- [ ] **Step 7: Full check**

Run: `npm test && npm run lint && npx tsc -b`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add app-react/package.json app-react/package-lock.json app-react/src/api/persister.ts app-react/src/api/persister.test.ts app-react/src/main.tsx
git commit -m "feat(offline): persist the query cache to IndexedDB"
```

---

### Task 6: Open signed-in when offline

**Files:**
- Modify: `app-react/src/store/authStore.ts`, `app-react/src/api/client.ts` (`handleUnauthorized`)
- Create: `app-react/src/store/hydrateAuth.ts` (moved out of `main.tsx` so it can be tested)
- Test: `app-react/src/store/authStore.test.ts` (extend), `app-react/src/store/hydrateAuth.test.ts` (new)

**Interfaces:**
- Produces: `USER_KEY = 'sadhana.user'` (exported from `authStore.ts`) and `hydrateAuth(): Promise<void>`.

- [ ] **Step 1: Write the failing tests.** Append to `app-react/src/store/authStore.test.ts`, inside the `describe`:

```ts
  it('setAuth saves the user and logout removes it', () => {
    act(() => useAuthStore.getState().setAuth({ id: '1', email: 'a@b.com', token: 'tok', name: 'Alice' }))
    expect(JSON.parse(localStorage.getItem('sadhana.user')!).name).toBe('Alice')
    act(() => useAuthStore.getState().logout())
    expect(localStorage.getItem('sadhana.user')).toBeNull()
  })

  it('starts with the saved user when a token is present, and ignores it without one', async () => {
    localStorage.setItem('yew.token', '"tok"')
    localStorage.setItem('sadhana.user', JSON.stringify({ id: '1', email: 'a@b.com', token: 'tok', name: 'Alice' }))
    vi.resetModules()
    expect((await import('./authStore')).useAuthStore.getState().user?.name).toBe('Alice')
    localStorage.removeItem('yew.token')
    vi.resetModules()
    expect((await import('./authStore')).useAuthStore.getState().user).toBeNull()
  })

  it('survives a corrupt saved user', async () => {
    localStorage.setItem('yew.token', '"tok"')
    localStorage.setItem('sadhana.user', '{oops')
    vi.resetModules()
    expect((await import('./authStore')).useAuthStore.getState().user).toBeNull()
  })
```

Add `vi` to the file's `vitest` import.

Create `app-react/src/store/hydrateAuth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'
import { hydrateAuth } from './hydrateAuth'

vi.mock('../api/auth', () => ({ authApi: { getUser: vi.fn() } }))
import { authApi } from '../api/auth'
const getUser = vi.mocked(authApi.getUser)

const alice = { id: '1', email: 'a@b.com', token: 'tok', name: 'Alice' }

describe('hydrateAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useAuthStore.setState({ user: alice, token: 'tok', isLoading: true })
  })

  it('stops loading at once with a saved user, before /api/user answers', async () => {
    getUser.mockReturnValue(new Promise(() => {}))
    void hydrateAuth()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('keeps the saved user when offline', async () => {
    getUser.mockRejectedValue(new Error('Network Error'))
    await hydrateAuth()
    expect(useAuthStore.getState().user).toEqual(alice)
  })

  it('refreshes the user when online', async () => {
    getUser.mockResolvedValue({ ...alice, name: 'Alicia' })
    await hydrateAuth()
    expect(useAuthStore.getState().user?.name).toBe('Alicia')
  })

  it('does not sign back in if the user logged out meanwhile', async () => {
    let answer!: (u: typeof alice) => void
    getUser.mockReturnValue(new Promise((r) => { answer = r }))
    const done = hydrateAuth()
    useAuthStore.getState().logout()
    answer(alice)
    await done
    expect(useAuthStore.getState().token).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/store`
Expected: FAIL (no `sadhana.user`, no `./hydrateAuth`).

- [ ] **Step 3: Implement.** In `app-react/src/store/authStore.ts`, add below `writeToken`:

```ts
export const USER_KEY = 'sadhana.user'

/** The last signed-in user, so the app opens offline without /api/user. */
function readUser(): UserInfo | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') } catch { return null }
}
```

and change the store to:

```ts
export const useAuthStore = create<AuthState>((set) => {
  const token = readToken()
  return {
    user: token ? readUser() : null,
    token,
    isLoading: true,
    setAuth: (user) => {
      writeToken(user.token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      set({ user, token: user.token })
    },
    logout: () => {
      writeToken(null)
      localStorage.removeItem(USER_KEY)
      set({ user: null, token: null })
    },
    setLoading: (isLoading) => set({ isLoading }),
  }
})
```

In `app-react/src/api/client.ts`, change the import to `import { readToken, writeToken, USER_KEY } from '../store/authStore'` and `handleUnauthorized` to:

```ts
export function handleUnauthorized() {
  writeToken(null)
  localStorage.removeItem(USER_KEY)
  window.location.href = '/login'
}
```

Create `app-react/src/store/hydrateAuth.ts`:

```ts
import { authApi } from '../api/auth'
import { useAuthStore } from './authStore'

/** Opens on the saved user straight away and refreshes it in the background. Offline keeps the saved one;
 *  a bad token still logs out through the 401 interceptor. */
export async function hydrateAuth() {
  const { token, user, setLoading } = useAuthStore.getState()
  if (!token || user) setLoading(false)
  if (!token) return
  try {
    const fresh = await authApi.getUser()
    // Signed out (or into another account) while this was in flight: don't bring the old session back.
    if (useAuthStore.getState().token === token) useAuthStore.getState().setAuth(fresh)
  } catch {
    // offline or server down: keep the saved user
  } finally {
    setLoading(false)
  }
}
```

In `app-react/src/main.tsx`, delete the local `hydrateAuth` function and the `authApi` import, and add `import { hydrateAuth } from './store/hydrateAuth'`. The existing `hydrateAuth()` call at the bottom stays; make it `void hydrateAuth()`.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run lint && npx tsc -b`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/store app-react/src/api/client.ts app-react/src/main.tsx
git commit -m "feat(offline): open signed in from the saved user"
```

---

### Task 7: Timeouts, network status store and the sync banner

**Files:**
- Modify: `app-react/src/api/client.ts`, `app-react/src/api/practices.ts`
- Rewrite: `app-react/src/hooks/useNetworkStatus.ts`
- Create: `app-react/src/features/today/SyncBanner.tsx`
- Modify: `app-react/src/features/today/{mobile/TodayMobile,tablet/TodayTablet,desktop/LogPanel}.tsx`, `app-react/src/main.tsx`
- Modify: `app-react/public/locales/{en,ru,uk}/translation.json`
- Test: `app-react/src/api/client.test.ts` (new), `app-react/src/api/practices.test.ts` (extend), `app-react/src/hooks/useNetworkStatus.test.ts` (new), `app-react/src/features/today/SyncBanner.test.tsx` (new); update the `useNetworkStatus` mocks in `TodayMobile.test.tsx` and `TodayTablet.test.tsx`

**Interfaces:**
- Consumes: the worker's `NET` message and `FLUSH` (Task 3).
- Produces:
  - `useNetStore` (zustand `{ online: boolean; pending: number }`), `setOnline(online: boolean)`, `flushOutbox()`, `startNetworkWatch()`;
  - default export `useNetworkStatus(): { online: boolean; pending: number }`;
  - components `<SyncBanner className?>` and `<DayFailedNote />`;
  - strings `today.offlinePending`, `today.syncing` and `today.dayFailed` (`dayFailed` is used by Task 8).

- [ ] **Step 1: Write the failing tests.**

`app-react/src/hooks/useNetworkStatus.test.ts`:

```ts
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
```

`app-react/src/api/client.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { AxiosError, CanceledError } from 'axios'
import { apiClient } from './client'
import { useNetStore } from '../hooks/useNetworkStatus'

describe('apiClient online flag', () => {
  beforeEach(() => useNetStore.setState({ online: true, pending: 0 }))

  it('is offline after a network error and online after any answer', async () => {
    await apiClient.get('/x', { adapter: async (config) => { throw new AxiosError('Network Error', 'ERR_NETWORK', config) } }).catch(() => {})
    expect(useNetStore.getState().online).toBe(false)
    await apiClient.get('/x', { adapter: async (config) => ({ data: null, status: 500, statusText: '', headers: {}, config }) }).catch(() => {})
    expect(useNetStore.getState().online).toBe(true)
  })

  it('treats a timeout as offline', async () => {
    await apiClient.get('/x', { adapter: async (config) => { throw new AxiosError('timeout', 'ECONNABORTED', config) } }).catch(() => {})
    expect(useNetStore.getState().online).toBe(false)
  })

  it('ignores a cancelled request', async () => {
    await apiClient.get('/x', { adapter: async () => { throw new CanceledError() } }).catch(() => {})
    expect(useNetStore.getState().online).toBe(true)
  })

  it('has a 10 s timeout', () => {
    expect(apiClient.defaults.timeout).toBe(10_000)
  })
})
```

Append to `app-react/src/api/practices.test.ts`, inside `describe('practicesApi.saveDiaryEntry', …)`:

```ts
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
```

`app-react/src/features/today/SyncBanner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { SyncBanner } from './SyncBanner'
import { useNetStore } from '../../hooks/useNetworkStatus'

describe('SyncBanner', () => {
  beforeEach(() => useNetStore.setState({ online: true, pending: 0 }))

  it('is hidden online with nothing pending', () => {
    const { container } = render(<SyncBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the plain offline text with nothing pending', () => {
    useNetStore.setState({ online: false, pending: 0 })
    render(<SyncBanner />)
    expect(screen.getByRole('status')).toHaveTextContent("You're offline — changes will sync when reconnected")
  })

  it('counts pending changes offline and while syncing', () => {
    useNetStore.setState({ online: false, pending: 2 })
    const { rerender } = render(<SyncBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Offline — 2 changes will sync')
    useNetStore.setState({ online: true, pending: 2 })
    rerender(<SyncBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Syncing 2…')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/hooks/useNetworkStatus.test.ts src/api/client.test.ts src/api/practices.test.ts src/features/today/SyncBanner.test.tsx`
Expected: FAIL (missing exports and component; the `timeout` and `keepalive` assertions fail).

- [ ] **Step 3: Implement the store**: replace `app-react/src/hooks/useNetworkStatus.ts`:

```ts
import { create } from 'zustand'

interface NetState { online: boolean; pending: number }

/** Online/offline from real requests (the worker's and axios'), and how many diary values wait in the worker's outbox. */
export const useNetStore = create<NetState>(() => ({ online: navigator.onLine, pending: 0 }))

export const setOnline = (online: boolean) => useNetStore.setState({ online })

/** Asks the worker to resend its outbox; it answers with a NET message. */
export function flushOutbox() {
  navigator.serviceWorker?.controller?.postMessage({ type: 'FLUSH' })
}

/** Once, at startup. */
export function startNetworkWatch() {
  const sw = navigator.serviceWorker
  sw?.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'NET') useNetStore.setState({ online: e.data.online, pending: e.data.pending })
  })
  sw?.startMessages()
  window.addEventListener('offline', () => setOnline(false))
  window.addEventListener('online', flushOutbox)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flushOutbox() })
  flushOutbox()
}

export default function useNetworkStatus(): NetState {
  return useNetStore()
}
```

- [ ] **Step 4: Implement the client changes** in `app-react/src/api/client.ts`. Change the import to `import axios from 'axios'` (unchanged) plus `import { setOnline } from '../hooks/useNetworkStatus'`. Add `timeout: 10_000,` to `axios.create({ … })`. Replace the response interceptor with:

```ts
apiClient.interceptors.response.use(
  (res) => { setOnline(true); return res },
  (error) => {
    // Any answer means the server is reachable; none (network error, timeout) means offline. A cancel says nothing.
    if (!axios.isCancel(error)) setOnline(!!error.response)
    // Signing in and changing the password answer 401 for a wrong password, not a lost session.
    const url = error.config?.url ?? ''
    if (error.response?.status === 401 && !url.includes('/users/login') && !url.includes('/user/password')) handleUnauthorized()
    return Promise.reject(error)
  }
)
```

In `app-react/src/api/practices.ts`, replace the `saveDiaryEntry` fetch call and its comment with:

```ts
    // With a worker in control it writes the value to its outbox before trying the network, and answers 202
    // (X-Queued) when it couldn't send it, so keepalive adds nothing. Without one: a home-screen app on iOS that
    // is swiped away is killed before an XHR completes, but a keepalive fetch is still delivered.
    const res = await fetch(`${apiClient.defaults.baseURL}/diary/${date}/entry`, {
      method: 'PUT',
      keepalive: !navigator.serviceWorker?.controller,
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ entry: { practice, value } }),
    })
```

(`if (!res.ok) throw` already treats 202 as success. Deviation from spec 2.3: no `{ queued }` return value, because nothing reads it. Add it when a caller needs it.)

- [ ] **Step 5: Add the strings.** In each `app-react/public/locales/<lang>/translation.json`, add to the `today` object:

en:
```json
    "offlinePending_one": "Offline — {{count}} change will sync",
    "offlinePending_other": "Offline — {{count}} changes will sync",
    "syncing": "Syncing {{count}}…",
    "dayFailed": "Couldn't load this day — what you enter will sync when you're back online."
```
ru:
```json
    "offlinePending_one": "Нет сети — {{count}} изменение синхронизируется",
    "offlinePending_few": "Нет сети — {{count}} изменения синхронизируются",
    "offlinePending_many": "Нет сети — {{count}} изменений синхронизируются",
    "offlinePending_other": "Нет сети — {{count}} изменения синхронизируются",
    "syncing": "Синхронизация: {{count}}…",
    "dayFailed": "Не удалось загрузить этот день — введённое синхронизируется, когда появится сеть."
```
uk:
```json
    "offlinePending_one": "Немає мережі — {{count}} зміна синхронізується",
    "offlinePending_few": "Немає мережі — {{count}} зміни синхронізуються",
    "offlinePending_many": "Немає мережі — {{count}} змін синхронізуються",
    "offlinePending_other": "Немає мережі — {{count}} зміни синхронізуються",
    "syncing": "Синхронізація: {{count}}…",
    "dayFailed": "Не вдалося завантажити цей день — введене синхронізується, коли з'явиться мережа."
```

- [ ] **Step 6: Create `app-react/src/features/today/SyncBanner.tsx`**:

```tsx
import { useTranslation } from 'react-i18next'
import useNetworkStatus from '../../hooks/useNetworkStatus'

/** Offline, or diary values still waiting to sync. Nothing when online and everything is sent. */
export function SyncBanner({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const { online, pending } = useNetworkStatus()
  if (online && pending === 0) return null
  const text = online ? t('today.syncing', { count: pending })
    : pending ? t('today.offlinePending', { count: pending }) : t('home.offline')
  return <p role="status" className={`rounded-xl bg-ui-accent-soft px-3 py-2 text-xs font-semibold text-ui-accent ${className}`}>{text}</p>
}

/** Above the rows when the day couldn't be loaded: entering values still works. */
export function DayFailedNote() {
  const { t } = useTranslation()
  return <p role="status" className="rounded-xl bg-ui-field px-3 py-2 text-xs text-ui-muted">{t('today.dayFailed')}</p>
}
```

- [ ] **Step 7: Use it in the three layouts.** In each of `TodayMobile.tsx`, `TodayTablet.tsx` and `desktop/LogPanel.tsx`: delete the `useNetworkStatus` import and the `const isOnline = useNetworkStatus()` line, and import `{ SyncBanner }` from `'../SyncBanner'`. Then replace the `{!isOnline && ( <p role="status" …>{t('home.offline')}</p> )}` block with:
  - mobile: `<SyncBanner className="mx-4 mb-2" />`
  - tablet and desktop: `<SyncBanner />`

In `TodayMobile.test.tsx` and `TodayTablet.test.tsx`, change the mock to:

```ts
vi.mock('../../../hooks/useNetworkStatus', () => ({ default: () => ({ online: true, pending: 0 }) }))
```

- [ ] **Step 8: Start the watcher** in `app-react/src/main.tsx`: add `import { startNetworkWatch } from './hooks/useNetworkStatus'` and call `startNetworkWatch()` just before `ReactDOM.createRoot(…)`.

- [ ] **Step 9: Run everything**

Run: `npm test && npm run lint && npx tsc -b`
Expected: all green (the `today.*` locale parity test covers the new keys).

- [ ] **Step 10: Commit**

```bash
git add app-react/src app-react/public/locales
git commit -m "feat(offline): online/pending status from the worker and requests; sync banner; timeouts"
```

---

### Task 8: Last-known data stays on screen (Today, Insights, Yatras)

**Files:**
- Create: `app-react/src/api/queryState.ts`
- Modify: `app-react/src/features/today/useToday.ts`, `mobile/DateHeader.tsx`, `mobile/TodayMobile.tsx`, `tablet/TodayTablet.tsx`, `desktop/LogPanel.tsx`, `app-react/src/features/insights/mobile/DaySheet.tsx`, `app-react/src/features/insights/useInsights.ts`, `app-react/src/features/yatras/useYatras.ts`
- Test: `app-react/src/features/today/useToday.test.tsx` (extend + adjust), `app-react/src/features/today/mobile/TodayMobile.test.tsx` (extend)

**Interfaces:**
- Consumes: `DayFailedNote` (Task 7).
- Produces:
  - `failedWithoutData(q: { data: unknown; isError: boolean; isPaused: boolean }): boolean`;
  - `useToday(date)` also returns `dayLoading: boolean` and `dayFailed: boolean`. `isLoading` and `isError` now come from the practices query only.
  - `DateHeader` takes an optional `dayLoading?: boolean`.

- [ ] **Step 1: Adjust the existing `useToday` tests**, which now must wait for the day as well as the practices:

Run: `sed -i 's/expect(result.current.isLoading).toBe(false))/expect(result.current.isLoading || result.current.dayLoading).toBe(false))/' src/features/today/useToday.test.tsx`

- [ ] **Step 2: Write the failing tests.** Append to `useToday.test.tsx`, inside the `describe`:

```tsx
  it('only the practices gate loading; a failed day still renders rows and flags it', async () => {
    api.getDiaryEntries.mockRejectedValue(new Error('offline'))
    const { result } = setup()
    await waitFor(() => expect(result.current.dayFailed).toBe(true))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.practices.map((p) => p.practice)).toEqual(['A', 'B', 'C'])
    expect(result.current.values).toEqual({})
  })

  it('a queued save keeps the value with no error, even when the refetch fails', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading || result.current.dayLoading).toBe(false))
    api.getDiaryEntries.mockRejectedValue(new Error('offline'))
    act(() => result.current.save(B, { Int: 7 }))
    await waitFor(() => expect(api.saveDiaryEntry).toHaveBeenCalled())
    await waitFor(() => expect(result.current.dayLoading).toBe(false))
    expect(result.current.values.B).toEqual({ Int: 7 })
    expect(result.current.failed).toBeNull()
    expect(result.current.dayFailed).toBe(false)
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('keeps cached practices on screen when their refetch fails', async () => {
    const { result, qc } = setup()
    await waitFor(() => expect(result.current.practices).toHaveLength(3))
    api.getUserPractices.mockRejectedValue(new Error('offline'))
    await act(() => qc.refetchQueries({ queryKey: ['practices'] }))
    expect(result.current.isError).toBe(false)
    expect(result.current.practices).toHaveLength(3)
  })
```

Add `import { useToastStore } from '../../hooks/useToast'` at the top of the file and `useToastStore.setState({ toasts: [] })` to its `beforeEach`.

Append to `TodayMobile.test.tsx`, inside the `describe`:

```tsx
  it('shows the rows and a note when the day cannot be loaded', async () => {
    api.getDiaryEntries.mockRejectedValue(new Error('offline'))
    renderScreen()
    expect(await screen.findByText(/Couldn't load this day/)).toBeInTheDocument()
    expect(screen.getByText('Wake up')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Reading' })).toBeInTheDocument()
  })
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/features/today`
Expected: the new tests FAIL (`dayFailed` undefined; `isError` true on the refetch failure).

- [ ] **Step 4: Implement.** Create `app-react/src/api/queryState.ts`:

```ts
/** Nothing to show, and the fetch failed or is waiting for the network. With data, a failed refetch
 *  keeps showing the last-known data (TanStack v5 sets status 'error' but keeps `data`). */
export const failedWithoutData = (q: { data: unknown; isError: boolean; isPaused: boolean }) =>
  q.data === undefined && (q.isError || q.isPaused)
```

In `useToday.ts`, import it (`import { failedWithoutData } from '../../api/queryState'`) and change the return fields:

```ts
    // The day never blocks the screen: rows render from the practices; an unloaded day is blank and still editable
    // (each PUT sets one practice, so entering a value never touches the others on the server).
    isLoading: practicesQ.isLoading,
    isError: failedWithoutData(practicesQ),
    dayLoading: diaryQ.isLoading,
    dayFailed: failedWithoutData(diaryQ),
```

In `mobile/DateHeader.tsx`, add `dayLoading?: boolean` to `DateHeaderProps`, destructure it, and change the summary span to:

```tsx
      <span aria-busy={dayLoading || undefined} className={`text-xs text-ui-muted transition-opacity ${dayLoading ? 'opacity-40' : ''}`}>{line}</span>
```

Pass `dayLoading={today.dayLoading}` to `<DateHeader …>` in `TodayMobile.tsx` and `desktop/LogPanel.tsx`. In `TodayTablet.tsx`, give the `{line}` span the same `aria-busy`/opacity treatment using `today.dayLoading`.

In each of the three layouts, import `{ DayFailedNote }` alongside `SyncBanner` and show the note right before the rows in the final (rows) branch. For example, in mobile and desktop:

```tsx
        ) : (
          <>
            {today.dayFailed && <DayFailedNote />}
            <ListGroup label={t('today.group')}>
              …unchanged rows…
            </ListGroup>
          </>
        )}
```

In tablet, add `{today.dayFailed && <DayFailedNote />}` as the first child of the `<section aria-label={t('today.group')} …>`.

In `insights/mobile/DaySheet.tsx`, which shows one day and should keep waiting for it: add `const loading = today.isLoading || today.dayLoading`, replace both `today.isLoading` with `loading`, and in the list branch render `{today.dayFailed && <DayFailedNote />}` before `<ListGroup>` (wrap both in a fragment). Import `DayFailedNote` from `'../../today/SyncBanner'`.

In `useInsights.ts`: import `failedWithoutData` and change `isError: current.isError,` to `isError: failedWithoutData(current),` and `reportsError: reportsQ.isError,` to `reportsError: failedWithoutData(reportsQ),`.

In `useYatras.ts`: import it and change `isError` to `failedWithoutData(listQ) || (!!yatra && failedWithoutData(dataQ)),`.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run lint && npx tsc -b`
Expected: all green. If an Insights/Yatras/Shared test asserted the old "error even with data" behaviour, it is now wrong. Change its assertion to the cached data being shown, and say so in the commit message.

- [ ] **Step 6: Commit**

```bash
git add app-react/src
git commit -m "feat(offline): last-known data stays on screen; the open day no longer gates Today"
```

---

### Task 9: Updates: waiting worker, update on hide

**Files:**
- Rewrite: `app-react/src/hooks/useServiceWorkerUpdate.ts`, `app-react/src/hooks/useServiceWorkerUpdate.test.ts`
- Modify: `app-react/src/main.tsx`

**Interfaces:**
- Consumes: the worker's `SKIP_WAITING` message (Task 3).
- Produces:
  - `useSwStore` (zustand `{ waiting: ServiceWorker | null }`), `applyUpdate(): void`, `startUpdateWatch(reg: ServiceWorkerRegistration, hadController: boolean): void`;
  - `useServiceWorkerUpdate(): { updateReady: boolean; applyUpdate: () => void }`, with the same signature, so `sections.tsx` and the Settings tests' mocks are unchanged.

- [ ] **Step 1: Write the failing tests**: replace `app-react/src/hooks/useServiceWorkerUpdate.test.ts`:

```ts
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
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/hooks/useServiceWorkerUpdate.test.ts`
Expected: FAIL (no `startUpdateWatch`/`useSwStore`).

- [ ] **Step 3: Implement**: replace `app-react/src/hooks/useServiceWorkerUpdate.ts`:

```ts
import { create } from 'zustand'

/** A new release's worker, installed and waiting for SKIP_WAITING. */
export const useSwStore = create<{ waiting: ServiceWorker | null }>(() => ({ waiting: null }))

export function applyUpdate() {
  useSwStore.getState().waiting?.postMessage({ type: 'SKIP_WAITING' })
}

/** Once, after registering. `hadController`: the page was already controlled when it loaded, so a
 *  takeover is an update (reload); a first install isn't. */
export function startUpdateWatch(reg: ServiceWorkerRegistration, hadController: boolean) {
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) window.location.reload() })
  const track = () => useSwStore.setState({ waiting: reg.waiting })
  track()
  reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', track))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reg.update().catch(() => {})
    // A reload doesn't activate a waiting worker, so a tab that is never closed would stay on the old
    // release forever. Going to the background is the moment nobody is looking; the outbox is in the worker.
    else applyUpdate()
  })
}

export function useServiceWorkerUpdate(): { updateReady: boolean; applyUpdate: () => void } {
  const waiting = useSwStore((s) => s.waiting)
  return { updateReady: !!waiting, applyUpdate }
}
```

- [ ] **Step 4: Wire in `app-react/src/main.tsx`.** Replace the registration block with:

```tsx
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  void navigator.serviceWorker.register('/service_worker.js', { updateViaCache: 'none' })
    .then((reg) => startUpdateWatch(reg, hadController))
}
```

and add `import { startUpdateWatch } from './hooks/useServiceWorkerUpdate'`. Update the comment above it to `// The app's worker: shell cache, diary outbox, takeover from the Rust UI (public/service_worker.js).`

- [ ] **Step 5: Run everything**

Run: `npm test && npm run lint && npx tsc -b`
Expected: all green; the Settings tests still mock `useServiceWorkerUpdate` with the same shape.

- [ ] **Step 6: Commit**

```bash
git add app-react/src/hooks app-react/src/main.tsx
git commit -m "feat(offline): update via the waiting worker; apply it when the app goes to the background"
```

---

### Task 10: Preview toggle with a cache-first shell

**Files:**
- Modify: `app-react/src/features/settings/releaseChannel.ts`, `app-react/src/features/settings/sections.tsx:45-46`
- Test: `app-react/src/features/settings/releaseChannel.test.ts` (extend)

**Interfaces:**
- Produces: `switchChannel(timeoutMs?: number): Promise<void>`. It resolves after calling `location.reload()`.

- [ ] **Step 1: Write the failing tests.** Append to `releaseChannel.test.ts` (add `vi`, `beforeEach`, `afterEach` to its vitest import if missing, and `switchChannel` to the import from `./releaseChannel`):

```ts
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
    onChange!()
    await done
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads anyway after 10 s', async () => {
    const done = switchChannel()
    await vi.advanceTimersByTimeAsync(10_000)
    await done
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads at once without a worker', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })
    await switchChannel()
    expect(reload).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/settings/releaseChannel.test.ts`
Expected: FAIL (`switchChannel` not exported).

- [ ] **Step 3: Implement.** Append to `releaseChannel.ts`:

```ts
/** After setPreview: page opens are served from the worker's cache, so the cookie alone doesn't switch UIs.
 *  Fetch the other channel's worker (it takes over at once) and reload on the takeover, or after 10 s anyway. */
export async function switchChannel(timeoutMs = 10_000): Promise<void> {
  const sw = navigator.serviceWorker
  const reg = await sw?.getRegistration()
  if (reg) {
    await new Promise<void>((resolve) => {
      sw.addEventListener('controllerchange', () => resolve(), { once: true })
      setTimeout(resolve, timeoutMs)
      reg.update().catch(() => resolve())
    })
  }
  window.location.reload()
}
```

In `sections.tsx`, import `switchChannel` and change the toggle's handler to:

```tsx
          onChange={(on) => { setPreview(on); void switchChannel() }} />} />
```

- [ ] **Step 4: Run everything**

Run: `npm test && npm run lint && npx tsc -b`
Expected: all green. If a Settings test asserted `window.location.reload` right after the toggle, update it to `await waitFor(...)`, or mock `switchChannel`.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/settings
git commit -m "feat(offline): preview toggle waits for the other channel's worker"
```

---

### Task 11: `#reset`

**Files:**
- Modify: `app-react/index.html`, `app-react/src/main.tsx`

- [ ] **Step 1: Add to `app-react/index.html`**, at the end of `<head>`:

```html
    <!-- /#reset recovers a broken install: drop the workers, caches and saved query cache, then reload.
         sadhana-outbox stays on purpose: it holds diary values the server doesn't have yet. -->
    <script>
      if (location.hash === '#reset') {
        (async () => {
          try {
            for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister()
            for (const k of await caches.keys()) await caches.delete(k)
            await new Promise((done) => {
              const d = indexedDB.deleteDatabase('sadhana-query')
              d.onsuccess = d.onerror = d.onblocked = done
            })
          } finally {
            location.replace(location.pathname)
          }
        })()
      }
    </script>
```

- [ ] **Step 2: Don't start the app during a reset.** In `app-react/src/main.tsx`, wrap the worker registration, `startNetworkWatch()`, the `ReactDOM.createRoot(…).render(…)` call and `void hydrateAuth()` in:

```tsx
// #reset (inline script in index.html) is wiping caches and will reload: don't start the app or its worker.
if (location.hash !== '#reset') {
  …
}
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm test && npm run lint`
Expected: green. Then by hand (Task 3 Step 3 setup): queue a value offline, open `localhost:8080/#reset` while still offline. Expected: the page reloads without the hash, Cache storage is empty, `sadhana-query` is gone and `sadhana-outbox` still has the record. Go online and reload; the worker reinstalls and the record syncs.

- [ ] **Step 4: Commit**

```bash
git add app-react/index.html app-react/src/main.tsx
git commit -m "feat(offline): #reset switch"
```

---

### Task 12: Docs and the preview-deploy checklist

**Files:**
- Modify: `docs/redesign-to-main-tasks.md` (P1 offline section, and the axios timeout line under "P1: loading and app open")
- Modify: `CLAUDE.md` ("Service worker" paragraph)

- [ ] **Step 1:** In `docs/redesign-to-main-tasks.md`, replace the bullet list under `## P1: offline mode` with one line pointing to the spec. Tick (`[x]`) the takeover-queue, precache-manifest/fonts, offline-user, update-handshake and `#reset` items with a one-line "done: …" each. Delete the "Recommended: reuse main's worker" bullet, since the spec chose another design. Tick the axios `timeout` item (10 s). Leave the device check unticked until Step 3.

- [ ] **Step 2:** In `CLAUDE.md`, replace the "Service worker" paragraph with:

> **Service worker:** `app-react/public/service_worker.js` (+ pure logic in `sw-lib.js`) is served at the Rust UI's worker path with no-cache headers; `__GIT_SHA__` is substituted at Docker build. It serves the shell from `static-vr-<sha>` (precached from `/precache-manifest.js`), queues diary entry PUTs in IndexedDB `sadhana-outbox` before trying the network (`202` + `X-Queued` when not sent), overlays pending values on `GET /api/diary/{date}`, and takes over from the Rust worker (moving its `SadhanaProPostDB` queue). The page's data is React Query persisted to IndexedDB `sadhana-query`. `/#reset` wipes all but the outbox. Touch this area carefully: it governs what installed clients run. Spec: `docs/superpowers/specs/2026-10-09-offline-mode-design.md`.

- [ ] **Step 3: Full verification**

Run: `docker exec $C bash -lc 'cd /workspaces/sadhana-pro && make lint && make test && cd app-react && npm test && npm run build'`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add docs/redesign-to-main-tasks.md CLAUDE.md
git commit -m "docs: offline mode done; worker notes in CLAUDE.md"
```

- [ ] **Step 5: Preview deploy and the manual checklist.** Ask the user before deploying (`build_dockerhub.yml` with `deploy_channel=preview` is outward-facing). Then run spec §3 "Manual checklist" items 1–8 on the preview and report each one's result, including any failures.

---

## Self-review notes

- Spec coverage: §1 shell precache → T1, T3. Fetch rules, outbox, legacy queue, updates/takeover → T3, plus T4 for verification. §2.1 → T5. §2.2 → T6. §2.3 → T7. §2.4 → T8. §2.5 → T7. §2.6 → T9. §2.7 → T10. §2.8 → T11. §3 tests → T2/T5–T10, manual checklist → T12.
- Deliberate deviations from the spec:
  - `saveDiaryEntry` returns `void`, not `{ queued }`, because nothing reads it.
  - `keepalive` is off when a worker controls the page: the outbox already makes the save survive the app being killed, and keepalive requests have not always gone through workers in every browser.
  - `isError` is fixed on Insights/Yatras too (needed for the spec's "offline reads" goal).
  - Mutations use `networkMode: 'always'`, and `gcTime` = `maxAge`.
