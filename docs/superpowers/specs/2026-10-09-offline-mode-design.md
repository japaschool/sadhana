# Offline mode for the React UI — design

**Date:** 2026-10-09
**Branch:** `redesign`
**Task:** P1 "offline mode" in `docs/redesign-to-main-tasks.md`

## Goal

The installed app opens and works on a terrible or absent connection: the first screen never waits on the network, diary entries made offline are never lost, and the user can see when they are offline and how many changes are waiting to sync.

Agreed scope:
- **Offline writes: diary entries only** (as on main). Every other write (practices, charts, settings, yatras) fails with the normal error when offline.
- **Offline reads:** Today, Insights and yatra standings show the last-known data.

## Review of main's offline mode (Rust UI)

Main's worker (`frontend/service_worker.js` + `idb.js` on `main`):

- Precaches everything `/precache-manifest.js` lists (built from `dist/`) into `static-v<sha>`. `index.html` is stored as `/`. Every navigation is served cache-first from `/`.
- Third-party files (plotly, DragDropTouch, Google Fonts) are cached only when first requested, into the same per-release cache.
- API GETs with `X-Cache-Key` are cached in `api-v<sha>`. Each GET returns the cached copy and refreshes it in the background, then posts `API_UPDATED` if the SHA-256 of the body changed. A cache miss goes to the network with a 30 s timeout. Offline, a missing diary day gets a synthetic blank day and incomplete-days gets `[]`.
- The diary entry PUT tries the network (10 s). On failure it is saved to IndexedDB `SadhanaProPostDB/postrequest`, patched into the cached GET and answered `200 null`. The queue is resent before **every** API GET.
- Online and offline status comes from whether real requests fail. Updates go through `CHECK_UPDATE` → `/api/version` → `registration.update()` → `UPDATE_READY`. `#reset` clears everything.

### Why opening the app on a bad connection was slow

`index.html` *was* cached and served cache-first. The delay came from:

1. **Third-party scripts that block the page in `<head>`.** Plotly (~4.5 MB) and DragDropTouch are synchronous `<script>` tags, and a cache miss fetches them with no timeout. They are never precached, and the per-release static cache is deleted when a new release activates. So after every release, the page sat blank until plotly downloaded or failed.
2. **The API cache is per release too** (`api-v<sha>`). The first open after an update finds nothing for `/api/user` and waits up to 30 s on the network before failing.
3. **Every GET first waits for the outbox to resend**, up to 10 s per queued record, before it even looks at the cache.

### Defects not to carry over

- Concurrent GETs start concurrent resend loops with no lock. Two loops can deliver an older value after a newer one for the same practice, and the server keeps the stale value.
- A write is saved only after the network has failed. If iOS kills the app during the request, the value is lost.
- `200 null` for a queued write looks like a real save, so the UI cannot show "pending sync".
- Every response that comes back is hashed with SHA-256, and the cache is kept in step with React's own data by sending messages between page and worker.

## Design principles

1. Nothing on the path to the first screen waits on the network: shell, fonts, locales, user and last-known data are all local.
2. Saved data does not depend on the release. Only the shell cache is per release.
3. A diary value is written to IndexedDB before the network is tried.
4. One pending value per (user, date, practice). Resending runs one at a time, under a lock. Reads never wait for resending.
5. The page reads its cache through React Query, persisted to disk. The worker only does the shell and the outbox.

## 1. Service worker (`app-react/public/service_worker.js`)

Plain JS, a classic worker, so the Docker `sed` of `__GIT_SHA__` keeps working. Pure logic lives in `app-react/public/sw-lib.js`. The worker loads it with `importScripts`, and Vitest imports it too (it assigns its functions to `self.swLib`).

### Shell precache

- `importScripts('/precache-manifest.js')`, the existing endpoint in `server/src/routes.rs`. Add `json` (for `/locales/*/translation.json`) and `woff2` to `collect_precache_assets`. `woff2` isn't matched today because the list only has `woff`. Remove `wasm`.
- Install: fetch each listed URL with `cache: 'no-store'` into `static-vr-<sha>`, storing `/index.html` as `/`. Skip precaching when `GIT_SHA` is still `__GIT_SHA__` (dev).
- **Cache naming is deliberate:** the `static-v` prefix means the Rust worker's activate deletes our shell caches. The takeover check below relies on that.
- Fonts are self-hosted under `public/fonts/`: Manrope (variable, weights 400–800) and IBM Plex Mono (400/500/600), in Latin and Cyrillic subsets, with `@font-face` in `src/index.css`. The Google Fonts `<link>` tags are removed from `index.html`, so nothing on the page is fetched from a third party.

### Fetch rules (first match wins; anything else is not handled)

1. `request.mode === 'navigate'` → `caches.match('/')` from the current shell cache, otherwise the network.
2. Same-origin GET whose path is in the manifest → the current shell cache (`ignoreSearch`), otherwise the network. Lazy route chunks (`router.tsx`) are in the manifest. A page never runs one release's JS under another release's worker, because every page reloads on `controllerchange` (2.6).
3. `PUT /api/diary/{yyyy-mm-dd}/entry` → the outbox (below).
4. `GET /api/diary/{yyyy-mm-dd}` → the network, then `swLib.overlay(body, pending)`. That replaces or adds the entries still pending in the outbox for that date **and that Authorization header**. A network failure is passed through as a failure, because the page handles a missing day (see 2.4).

Every API request the worker handles updates its online flag: any HTTP response means online, a network error or timeout means offline. After each such request the worker posts `{ type: 'NET', online, pending }` to all its pages. `pending` is the outbox record count.

### Outbox

- **IndexedDB `sadhana-outbox`, store `entries`.** It is not `SadhanaProPostDB`: bumping that DB's version would break the Rust UI's worker when a user switches back.
- **Record:** `{ key, url, auth, body, seq }`.
  - `key = auth + '|' + date + '|' + practice`, so only the latest value is kept, and two accounts on one device don't collide.
  - `seq` is a counter that increases on every write.
- **On PUT:**
  1. `put` the record (replacing any older value for that key).
  2. Call `flush()` and wait for this key's attempt, which has a 10 s timeout.
  3. The result:
     - **sent, 2xx** → return the server response;
     - **4xx** → the record has been dropped; return the response;
     - **network error, timeout or 5xx** → return `202` with body `null` and the header `X-Queued: 1`.
- **`flush()`:** a single in-flight promise, so callers share one run. It goes through the records in `seq` order.
  - 2xx → delete the record, but only if its `seq` is still the one that was sent. A newer value written meanwhile stays.
  - 4xx → delete it. This matches the takeover worker's rule: a 4xx won't succeed on retry.
  - Network error, timeout or 5xx → stop and keep the rest.
- **`flush()` runs:**
  - after each save;
  - when the worker activates;
  - after any successful API response;
  - on a `{ type: 'FLUSH' }` message from the page.
- **Legacy queue:** when the worker activates, the records in `SadhanaProPostDB/postrequest` are moved into the outbox (same URL, auth and body), then deleted. Keep the current open-without-creating guard from the takeover worker. This also covers the takeover worker's "only retried on the next release" note.

### Updates and takeover

- **Install:**
  - If there is no `static-vr-*` cache, call `skipWaiting()` immediately. The active worker is then the Rust worker or the takeover worker, which delete `static-v*` caches, or there is no worker at all.
  - Otherwise the new worker waits.
- **Activate:**
  - Move over the legacy queue and `flush()`.
  - Delete every `static-v*` and `api-v*` cache except the current shell.
  - Call `clients.claim()`.
  - If this was a takeover, post `'UPDATE_READY'` (a plain string, which the Rust UI listens for), as the takeover worker does today.
- **Message handling:** on `{ type: 'SKIP_WAITING' }`, call `skipWaiting()`. On `{ type: 'FLUSH' }`, call `flush()`.

## 2. Page side (`app-react/src`)

### 2.1 Persisted query cache (`main.tsx`)

- Replace `QueryClientProvider` with `PersistQueryClientProvider` from `@tanstack/react-query-persist-client` (new dependency).
- The persister is ours, about 15 lines in `src/api/persister.ts`, storing one key in IndexedDB `sadhana-query`.
- `maxAge`: 30 days. `buster`: a constant `CACHE_VERSION`, bumped only when the shape of an API response changes, never per release.
- `dehydrateOptions.shouldDehydrateQuery` saves only successful queries whose first key is in the allowlist: `practices`, `diary`, `incomplete-days`, `reports`, `report-data`, `yatras`, `yatra-data`. Not saved: shared reports (`[...src.key, …]` with a share id), `confirmation`, `version`, `yatra-users`, `yatra-user-practices`, `yatra`.
- The existing token-change subscription that calls `queryClient.clear()` also calls `persister.removeClient()`.

### 2.2 Auth when opening offline (`store/authStore.ts`, `main.tsx`)

- `setAuth` saves the `UserInfo` (as JSON) under `sadhana.user` in localStorage. `logout` removes it. The token stays in `yew.token`, unchanged.
- The store's initial state reads `user` from `sadhana.user` when a token is present.
- `hydrateAuth`: if a saved user exists, `setLoading(false)` immediately and refresh `/api/user` in the background. A 401 still logs out through the interceptor. A network failure is ignored.

### 2.3 Timeouts (`api/client.ts`, `api/practices.ts`)

- `apiClient` gets `timeout: 10_000`.
- `saveDiaryEntry`'s `keepalive` fetch gets `signal: AbortSignal.timeout(15_000)`.
- `saveDiaryEntry` treats `202` as success (it is `res.ok`). It returns `{ queued: res.headers.get('X-Queued') === '1' }` for callers that care.

### 2.4 Today (`features/today/useToday.ts` and the three layouts)

- `isLoading` = `practicesQ.isLoading`, and `isError` = `practicesQ.isError`. The diary query no longer gates the screen.
- New return fields:
  - `dayLoading` = `diaryQ.isLoading`, shown as a subtle hint in the day header (no spinner);
  - `dayFailed` = `diaryQ.isError && !diaryQ.data`, shown as a note above the rows: "Couldn't load this day — what you enter will sync when you're back online." New string in en/ru/uk.
- The rows always render from `practices`, with values from `diaryQ.data ?? []`.
- **A blank day is safe:** the PUT updates one practice at a time, so entering a value never touches the other practices on the server.
- A queued save counts as success: the optimistic value stays, and there is no error toast. `onSettled` still invalidates. When the refetch succeeds, the worker overlays the pending values onto it; when it fails, React Query keeps the optimistic data.

### 2.5 Online indicator (`hooks/useNetworkStatus.ts`)

- A small zustand store `{ online, pending }`. It is set by:
  - the worker's `NET` messages;
  - the axios response interceptor (any response → online; network error or `ECONNABORTED` → offline);
  - the window `offline` event (offline) and `online` event (sends `FLUSH`).
- The hook returns `{ online, pending }`. The three Today layouts change from `isOnline` to this. Banner text:
  - offline → "Offline — {{n}} changes will sync" (or the existing `home.offline` when `n = 0`);
  - online with `pending > 0` → "Syncing {{n}}…".
- The page sends `FLUSH` when it loads and when `visibilitychange` makes it visible.

### 2.6 Updates (`hooks/useServiceWorkerUpdate.ts`)

- When the page becomes visible: `registration.update()`. This replaces main's `CHECK_UPDATE` + `/api/version`.
- `updateReady` = `!!registration.waiting`, kept up to date through `updatefound` / `statechange`.
- `applyUpdate()` posts `SKIP_WAITING` to `registration.waiting`. A `controllerchange` listener reloads the page, but only if the page already had a controller when it loaded (as the hook checks today), so a first install doesn't reload.
- **Automatic update:** when the page becomes hidden and `updateReady` is set, call `applyUpdate()`. A reload doesn't activate a waiting worker, so a desktop tab that is never closed would otherwise stay on the old release forever. The outbox lives in the worker, so the reload can't lose a value.
- Settings keeps showing "Update ready" (`features/settings/sections.tsx`).

### 2.7 Preview toggle (`features/settings/releaseChannel.ts` caller)

Page opens are cache-first, so changing the cookie alone no longer switches UIs. After `setPreview(on)`:
- `await registration.update()`.
- If a new worker installs (the other channel's worker), wait for `controllerchange` and reload. The Rust worker and our takeover path both call `skipWaiting`.
- If nothing new installs within 10 s, reload anyway.

### 2.8 `#reset` (inline script in `index.html`)

When `location.hash === '#reset'`: unregister all workers, delete all caches, delete IndexedDB `sadhana-query`, then remove the hash and reload. It keeps `sadhana-outbox` on purpose, because that holds values not synced yet.

## 3. Testing

**Vitest (Node 22):**
- `sw-lib.js`:
  - `overlay` replaces and adds entries, and ignores other dates and other auth headers;
  - the outbox key;
  - the `seq` check that decides whether a sent record is deleted.
- The persister allowlist (`shouldDehydrateQuery`) for the saved keys and a few that must not be saved.
- `useToday`:
  - a `202` with `X-Queued` keeps the value with no toast;
  - a failing diary query with known practices renders the rows plus the `dayFailed` note;
  - only the practices query gates loading.
- `authStore` saves and restores the user, and `logout` clears it.
- `useServiceWorkerUpdate`: a waiting worker sets `updateReady`, and going hidden calls `SKIP_WAITING`.

**Manual checklist (preview deploy):**
1. Chrome DevTools offline: a cold open shows Today with the last data; enter values; the banner shows the pending count; go online and it syncs; the server has the values.
2. A custom "terrible" throttle profile (e.g. 2 kbps, 5 s latency): the app opens instantly from cache, and entries are queued after 10 s with no error.
3. The app is killed right after entering a value: on the next open the value is in the outbox and syncs.
4. An iOS home-screen app in airplane mode: same as 1 and 3.
5. Takeover: an installed Rust UI with queued offline writes switches to the preview channel. The writes arrive, and the React app takes over after one prompt.
6. Preview toggle to stable and back: each switch lands on the other UI without clearing site data.
7. A new release: Settings shows "Update ready"; putting the app in the background updates it.
8. `/#reset` recovers a broken install, and pending outbox values survive it.

## Out of scope

- Offline writes other than diary entries.
- Background Sync API (no iOS support; resending runs on app open or foreground instead).
- Static spinner in `#root`, PWA manifest/icons, iOS splash screens (separate P1 items).
- Practice groups.

## Files touched

- `server/src/routes.rs` (precache extensions)
- `app-react/public/service_worker.js`, `app-react/public/sw-lib.js` (new), `app-react/public/fonts/*` (new)
- `app-react/index.html`, `app-react/src/index.css`
- `app-react/src/main.tsx`, `src/api/persister.ts` (new), `src/api/client.ts`, `src/api/practices.ts`
- `app-react/src/store/authStore.ts`
- `app-react/src/hooks/useNetworkStatus.ts`, `src/hooks/useServiceWorkerUpdate.ts`
- `app-react/src/features/today/useToday.ts` + mobile/tablet/desktop Today components
- `app-react/src/features/settings/` (preview toggle caller)
- `app-react/public/locales/{en,ru,uk}/translation.json`
- `docs/redesign-to-main-tasks.md` (tick off the P1 offline items)
