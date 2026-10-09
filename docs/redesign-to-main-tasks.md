# `redesign` → new `main`: task list

Status as of `redesign` @ `2ea6e9f` (2026-10-09), checked by reading the code against the previous version of this list. The React app was not built and its tests were not run for this review.

**Summary:** the Docker build, service worker takeover, token/language compatibility, preview toggle, CI and the API mismatches are done. Still open before merge: the OAuth security holes, the logout cache leak, offline mode/PWA, and cleanup.

Paths below refer to the `redesign` branch.

---

## P0: security

- [ ] **Apple sign-in accepts tokens issued to any app.** `server/src/app/oauth.rs:109` sets `validate_aud = false`, and `User::signin_oauth` links to an existing account by email. Together that allows account takeover. No UI uses Apple, so the simplest fix is to delete the endpoint (`routes.rs:118`) until it's needed. If kept: validate `aud` against our Services ID and check `email_verified`.
- [ ] **Google sign-in doesn't check the token was issued to our client.** `oauth.rs:30` passes any access token to `userinfo`. Verify `aud`/`azp` (tokeninfo endpoint, or the GIS ID-token credential) and `email_verified`.
- [ ] Delete `server/src/bin/gen_hash.rs` (scratch code with a hard-coded default password and hash).

## P0: bugs

- [ ] **Logout doesn't clear the React Query cache** (`features/settings/mobile/LogoutSheet.tsx`, and the desktop/tablet logout). The next user in the same tab sees the previous user's practices and diary. Call `queryClient.clear()` on logout and login.
- [ ] **iOS home-screen app: a value may be lost if the app is swiped away right after entering it** (`features/today/`). Int/Time/Duration now save while typing (debounced, `PracticeRow.tsx:79`), on top of the hidden-flush (`useOnAppHidden`) and `keepalive` attempts. Text still saves on blur/hide only. Verify on a device; if still lost, attach Safari Web Inspector to the home-screen app.
- [ ] **Import doesn't offer to create missing practices.** Unmatched CSV columns are only listed (`features/settings/ImportCsv.tsx:128`). Main offered to create them (route `/user/practice/new/:practice`).
- [ ] Add a smoke test that runs every function in `src/api/*.ts` against a real dev server. The mocked handlers in `src/test` copy the React side's assumptions, which is why tests didn't catch the earlier API mismatches.

## P1: offline mode

Main's service worker (`frontend/service_worker.js` + `idb.js` on `main`) precaches the app shell, serves API GETs from cache and refreshes them in the background (`API_UPDATED`), queues diary writes in IndexedDB, returns a blank diary day / `[]` incomplete-days offline, reports online/offline from real request failures, and has a `#reset` switch.

The React worker (`app-react/public/service_worker.js`) only takes over from the Rust one; it has no fetch handler. The React Query cache is in memory only, and offline writes are lost on reload.

- [ ] **Recommended:** reuse main's `service_worker.js` + `idb.js` almost unchanged (same cache and IndexedDB names). On the React side:
  - add an `X-Cache-Key` header to GET requests that should be cached (one axios interceptor);
  - on `API_UPDATED`, invalidate the matching queries;
  - drive online/offline from the worker's `ONLINE`/`OFFLINE` messages (`hooks/useNetworkStatus.ts` uses `navigator.onLine`).
- [ ] The takeover worker retries the Rust worker's queued writes only on the next release (see its `ponytail:` note). Offline mode should read that queue again.
- [ ] `/precache-manifest.js` (`server/src/routes.rs:24`) is unused by the React worker, and its extension list still has `wasm` but not `json`. Either delete it, or use it for offline mode and add `json` (translations are fetched from `/locales/*.json`). Cache or self-host the Google Fonts.
- [ ] Opening the app offline leaves `user` empty (`hydrateAuth` fails). Cache `/api/user` or save the user locally.
- [ ] `hooks/useServiceWorkerUpdate.ts` listens for `controllerchange`. Port main's handshake: `CHECK_UPDATE` against `/api/version` on app open, then `UPDATE_READY`, then `SKIP_WAITING`.
- [ ] Add the `#reset` switch to `index.html`.

## P1: loading and app open

- [ ] `index.html` has an empty `<div id="root">` until JS loads; users see a blank screen on slow connections. Put a static spinner inside `#root`.
- [ ] axios has no `timeout` (`api/client.ts`), so the startup `hydrateAuth` → `ProtectedRoute` spinner can hang. Main used 30 s / 5 s / 3 s.
- [ ] **"Today" doesn't roll over.** `useLogDate` stores `null` for today, but nothing re-renders on wake if the data hasn't changed, so an app left open overnight still shows yesterday. Bump a `today` state on `visibilitychange` → visible (`useToday.ts:98` already listens there).
- [ ] Check that every submit button is disabled while its request runs (main used a 600 ms delayed full-screen overlay instead).

## P1: PWA and install

- [ ] `index.html` needs: `<link rel="manifest">` + `site.webmanifest`, apple-touch-icon, iOS splash screens, `apple-mobile-web-app-status-bar-style`, `mobile-web-app-capable`, theme-color, `robots noindex`, and the Yandex verification meta. Reuse main's `frontend/site.webmanifest` and `frontend/images/*`.
- [ ] Add `viewport-fit=cover`, or `env(safe-area-inset-*)` is 0 on iOS.

## P1: features and polish

**Charts**
- [ ] **CSV export** writes `date,practice,value` with numbers only (`features/insights/csv.ts:23`). Main writes one column per practice in the app's value format, which re-imports cleanly.
- [ ] Check on real data that chart rendering matches main: time/duration axes, stacked/overlaid bars, `show_average`, grid reports.

**Today**
- [ ] Main marks missing required entries on past days; check that React's incomplete-day markers cover the same.
- [ ] Starter practices have hard-coded English names (`STARTERS` in `features/today/useToday.ts:12`). The server already adds language-specific defaults at signup. Drop it or translate the names.

**Auth**
- [ ] Google sign-in needs `VITE_GOOGLE_CLIENT_ID` as a Docker build arg (plus a GitHub secret) and a Google OAuth client for app.sadhana.pro. The button hides itself when the ID isn't set.
- [ ] OAuth signup always adds English default practices (`WHERE lang = 'en'`, `server/src/app/user/model.rs:123`). Pass the UI language.

**Settings / Help**
- [ ] `/help` and `/help/support-form` require login in React; on main `/help` is public. Decide.
- [ ] Translate "Something went wrong" and "Go home" in the router error page (`router.tsx:57-63`).

**Out of scope for now, confirm before merge**
- [ ] Practice groups: one hardcoded "Practices" group. If main users rely on groups, this is a regression.

## P2: cleanup before merge

- [ ] Drop the unused `frontend` feature from `common/Cargo.toml`.
- [ ] Split the landing page (`static-react/`, 54 files, including a 5.4 MB `src/assets/2-2.jpg`) into its own PR; it deploys separately (`build_static_site.yml`). Compress its images.
- [ ] Decide whether `docs/superpowers/` (55 files) stays. Replace the Vite template `app-react/README.md` with run/build notes.
- [ ] Remove `problem.md` (a prod-hang write-up) from the repo, or move it under `docs/`.
- [ ] Server OAuth: reuse one `reqwest::Client` and cache Apple's JWKS instead of fetching them per request (moot if Apple is deleted).
- [ ] Serve Vite's hashed `/assets/*` with `Cache-Control: public, max-age=31536000, immutable`.
- [ ] Two older issues, already on main: confirmation email links are built from the `server_address` the client sends (`server/src/app/user/api.rs:73`), which could be used for phishing; and email subjects are Russian only while the app defaults to English.

---

## Done

- Dates: one local `yyyy-mm-dd` helper (`features/today/date.ts`); no `toISOString()` dates left.
- Yatra practice save uses `daily_score` (`types/api.ts:115`).
- Diary inputs send `null` when empty; dropdown options are comma- or newline-separated, for Int and Text, in the form and on Today.
- API: reorder sends `{practices}`, admin toggle uses `is_admin`, support form sends `{subject, message}`, import reads the CSV in the browser and sends `PUT /diary/{cob}`.
- Blur/flush on hide (`useOnAppHidden`); the selected date persists for the session (`useLogDate`).
- Duration input plus add-time sheet (`AddTimeSheet`); `00:00` shows; inputs are controlled, so refetches show.
- Practice type is locked on edit (`FixedType`).
- Shared charts render on `/shared/:id`.
- Help: videos, yatra-mapping guide with screenshots, Telegram link.
- No iOS zoom on inputs (`user-scalable=no`).
- Theme: light by default, dark follows the system (supersedes the "dark only" decision).
- Yatra colour zones have tests (`zones.test.ts`, `yatrasLogic.test.ts`).
- Docker builds `app-react`; `.dockerignore`; gzip/brotli step removed.
- Service worker takeover; `yew.token` read with quotes stripped; `user_language` migrated.
- Preview-channel toggle in Settings; CI runs React lint/test/build plus clippy/`cargo test`.
- Node in the devcontainer, Makefile targets, README and `CLAUDE.md` updated.
- The Rust `frontend` crate is removed from the workspace (so the "revert unrelated Rust frontend edits" item no longer applies).
