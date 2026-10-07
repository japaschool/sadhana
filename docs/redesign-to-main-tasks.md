# `redesign` → new `main`: task list

Compared `tala/redesign` @ `75bf423` against the project main `sadhana/main` @ `bce00c6` (japaschool/sadhana).
`redesign` is 301 commits ahead, 0 behind. Review was static (code reading); the React app was not built and its tests were not run as part of this review.

**Summary:** the React app covers every route main has (except `/user/practice/new/:practice`, used only by Import), but it isn't deployable yet:
- it is never built into the Docker image;
- there is no service worker, so no offline mode or PWA install;
- 4 API calls fail against the real server;
- several bugs write wrong data or lose it;
- the new OAuth endpoints have security holes.

Paths below refer to the `redesign` branch.

---

## P0: security (server changes on this branch)

- [ ] **Apple sign-in accepts tokens issued to any app.** `server/src/app/oauth.rs` sets `validate_aud = false`, and `User::signin_oauth` links to an existing account by email. Together that allows account takeover. No UI uses Apple yet, so the simplest fix is to delete the endpoint until it's needed. If kept: validate `aud` against our Services ID and check `email_verified`.
- [ ] **Google sign-in doesn't check the token was issued to our client.** It passes any access token to `userinfo`. Verify `aud`/`azp` (tokeninfo endpoint, or switch to the Google Identity Services (GIS) ID-token credential) and `email_verified`.
- [ ] Delete `server/src/bin/gen_hash.rs` (scratch code with a hard-coded default password and hash).

## P0: bugs that write wrong or lost data

- [ ] **Dates are calculated in UTC.** Replace every `toISOString()` date with one local `yyyy-mm-dd` helper: `DashboardPanel.tsx:22`, `HomePage.tsx:12`, `MonthCalendar.tsx:22`, `YatrasPage.tsx:24`, `ChartsPage.tsx:132`, `HomeHeaderActions.tsx:17`.
  - The month picker builds local-midnight dates, so for users in UTC+2/+3 (Ukraine/Russia) picking a day opens and saves to the previous day.
  - The incomplete-day markers are one day off.
  - Near midnight, "today" is wrong for users in other time zones.
- [ ] **Saving a yatra practice deletes its daily score.** The TypeScript type uses `daily_score_config`, but the server field is `daily_score` (`types/api.ts:115`, `YatraPracticeEditPage.tsx:180,191`). Every save sends null and the server overwrites it.
- [ ] **Diary inputs save values the user didn't enter** (`pages/home/PracticeCard.tsx`).
  - Leaving an empty Int or Duration field saves `0`, and Text saves `""`.
  - Nothing can be cleared back to empty; main sends `null`.
  - As a result, required practices look done and averages are wrong. Fix: save only on change, and send `null` for empty.
- [ ] **Dropdown options don't match existing data.**
  - Main stores them comma-separated and shows dropdowns for Int and Text.
  - React splits on newlines and only renders them for Int (`PracticeCard.tsx`).
  - The React form only lets you set options on Text practices (`components/PracticeForm.tsx`).
  - Existing users' dropdowns show as a single option.
- [ ] **iOS home-screen app: a value is lost if the app is swiped away right after entering it** (new mobile Today, `features/today/`). Sending the app to the background is fine; swiping it away from the app switcher isn't. The server never gets the `PUT /api/diary/…/entry`. The Rust UI doesn't have this problem, and it doesn't use offline storage.
  - Already tried, and it didn't help on its own:
    - flushing unsaved input on `visibilitychange` → hidden (`useOnAppHidden`, `8ba4150`; this fixed the background case);
    - sending the save with `fetch(…, { keepalive: true })` instead of axios (`96a416d`).
  - Ruled out: both apps listen to the same `visibilitychange` event; there are no timers between that event and the network call; there's no service worker and no cached API reads.
  - Next ideas:
    - Save Int/Time/Duration as you type (debounced), so nothing is unsent when the app is killed.
    - Attach Safari Web Inspector (Mac → Develop → iPhone) to the home-screen app and check whether the hidden handler runs and the request starts.
    - Compare with the Rust flow in `frontend/src/routes/home.rs`: it blurs the field on hidden, and the save is `reqwest`, i.e. `fetch`.
- [ ] **Logout doesn't clear the React Query cache** (`SettingsPage.tsx:170`). The next user in the same tab sees the previous user's practices and diary. Call `queryClient.clear()` on logout and login.

## P0: API calls that fail against the real server

- [ ] Reordering practices sends `{ids}`, but the server expects `{practices}`, so it returns 400 (`api/practices.ts` `reorderUserPractices`).
- [ ] Toggling yatra admin calls `/users/{id}/toggle_admin`, but the route is `/users/{id}/is_admin`, so it returns 404 (`api/yatras.ts` `toggleAdmin`).
- [ ] The support form sends `{name, email, message}`, but the server expects `{subject, message}`, so it returns 400 (`api/support.ts`, `pages/help/SupportPage.tsx`).
- [ ] Import calls `/api/import/preview` and `/api/import`, which don't exist. Main reads the CSV in the browser, maps columns to practices, offers to create missing ones (route `/user/practice/new/:practice`), then sends `PUT /diary/{cob}` for each row. Port that (`api/import.ts`, `pages/settings/ImportPage.tsx`).
- [ ] Add a smoke test that runs every function in `src/api/*.ts` against a real dev server. The mocked test handlers in `src/test` copy the React side's wrong assumptions, which is why tests didn't catch the above.

The rest of the API calls match the server: auth, confirmation, password reset, diary, reports, yatra CRUD/data/users/practices/mapping, and the `y_axis` values.

## P0: deployment and switching users over

- [x] **Docker:** the image only builds the Rust/Trunk frontend, so `app-react` is never shipped. Add a Node stage (`npm ci && npm run build`) and copy `app-react/dist` into the `dist/` the server serves. Keep the `GIT_SHA` substitution into the service worker. Remove trunk/wasm-bindgen/`wasm32` once the Rust UI is gone.
- [x] Add `**/node_modules` and `**/dist` to `.Dockerignore`.
- [x] **Service worker takeover:** installed apps are controlled by the Rust service worker, which serves the cached `/` before going to the network.
  - If the new build has no `/service_worker.js`, the update check gets a 404, the old service worker stays, and users keep running the cached Rust UI indefinitely.
  - The new service worker at the same path must first send the offline writes queued in IndexedDB (`SadhanaProPostDB` / `postrequest`), then delete the `static-v*`/`api-v*` caches, then take control (`skipWaiting` + `clients.claim()`).
- [x] **Login token:** main saves `yew.token` through gloo, which stores it as a JSON string with quotes. React reads it raw, so the server gets `Token "eyJ…"`, returns 401, and every existing user is logged out. Strip the quotes when reading.
- [x] **Language setting:** main stores it under `user_language`; React uses i18next's `i18nextLng`. Migrate the old key.
- [x] **Rollout through the preview channel:** deploy the React image to preview (`build_dockerhub.yml` with `deploy_channel=preview`); testers opt in with the `sadhana_release_channel` cookie. React has no preview-channel toggle, so testers can't switch back. Port it from main (`frontend/src/utils/release_channel.rs` + Settings).
- [x] ~~Apply the 2 new `default_user_practices` migrations by hand on deploy.~~ Migrations removed from the branch.
- [x] **CI:** no workflow currently runs lint or tests. Add `npm ci && npm run lint && npm test && npm run build` for `app-react`, plus `cargo test`/clippy.
- [x] Add Node to the devcontainer and `app-react` targets to the `Makefile` (`run` and `frontend-build` still call trunk). Update the README and `CLAUDE.md`.

## P1: offline mode

Main's service worker (`frontend/service_worker.js` + `idb.js`):
- precaches the app shell;
- serves API GETs from cache and refreshes them in the background, telling the page when data changed (`API_UPDATED`);
- queues diary writes in IndexedDB and sends them later;
- returns a blank diary day for dates it hasn't seen, and `[]` for incomplete-days while offline;
- reports online/offline based on real request failures;
- has a `#reset` emergency switch.

React has none of this: the React Query cache is in memory only, and writes made offline are lost on reload. The Help FAQ (`help.faq4a`) even claims writes queue offline.

- [ ] **Recommended:** reuse main's `service_worker.js` + `idb.js` almost unchanged. They don't depend on the UI framework and use the same cache and IndexedDB names, which also handles the takeover above. On the React side:
  - add an `X-Cache-Key` header to GET requests that should be cached (one axios interceptor);
  - on `API_UPDATED`, invalidate the matching queries;
  - drive the online/offline status from the service worker's `ONLINE`/`OFFLINE` messages (instead of `navigator.onLine`).
- [ ] Add `json` to the precache extension list in `server/src/routes.rs`. Translations are fetched at runtime (`/locales/*.json`), so opening the app offline shows raw keys. Cache or self-host the Google Fonts.
- [ ] Opening the app offline leaves `user` empty (`hydrateAuth` fails), which breaks pages that use `user.id` (share link). Cache `/api/user` or save the user locally.
- [ ] `useServiceWorkerUpdate` listens for `controllerchange`, which never fires without a service worker. Port main's update handshake: `CHECK_UPDATE` against `/api/version`, then `UPDATE_READY`, then `SKIP_WAITING`.
- [ ] Keep the `#reset` switch in `index.html`, and fix the FAQ text.

## P1: loading spinner and refresh on opening the app

**What main does:**
- `index.html` shows "Loading…" and a spinner overlay until the app boots.
- Every page (`components/blank_page.rs`) shows a dimmed full-screen spinner overlay if a load or save is still running after **600 ms**. Fast calls don't flicker, and slow ones block double-submits. It's wired on login, register, password reset, every settings and practice form, charts, yatras, join and import.
- **On app open** (`visibilitychange` becomes visible), every page:
  - updates "today", for apps left open overnight;
  - asks the service worker to check `/api/version` for a new release (`CHECK_UPDATE`).
- **Home on open:** re-fetches the diary day and required practices.
- **Home on hide:** blurs the focused input, so a value being typed is saved before iOS suspends the app.
- The service worker shows cached data immediately, refreshes in the background, and the UI re-renders on `API_UPDATED`.

**What React has, and what's missing:**
- [ ] `index.html` has an empty `<div id="root">` until JS loads, so users see a blank screen on slow connections. Put a static spinner inside `#root` (React replaces it on mount).
- [ ] `<Spinner />` is inline and shows immediately (`if (isLoading) return <Spinner />` per page, skeletons on Home). There's no overlay for saves; buttons show small inline spinners. Either:
  - port the 600 ms delayed overlay (a `useDelayedFlag(isPending, 600)` hook plus one overlay component), or
  - keep the per-button spinners and make sure every submit button is disabled while its request is running.
- [ ] axios has no timeout, so on a bad connection the startup `hydrateAuth` → `ProtectedRoute` spinner can hang for a long time. Main used 30 s / 5 s / 3 s timeouts. Set an axios `timeout`.
- [ ] Refreshing data on open is covered on Home: React Query's `refetchOnWindowFocus` refetches mounted queries older than 60 s on `visibilitychange`, and `DashboardPanel` also invalidates the diary day. Still missing:
  - [ ] **Blur on hide.** Values only save on blur, so typing a value and switching away on iOS loses it. Add one `visibilitychange` → hidden handler in `AppShell` that calls `document.activeElement.blur()`.
  - [ ] **Update check on open.** There's no `CHECK_UPDATE`, because there's no service worker (see offline section).
  - [ ] **"Today" doesn't roll over.** `today` is only computed when the page re-renders, and nothing re-renders on wake if the data hasn't changed. For an app left open overnight, the week calendar's today highlight and the Today/Yesterday labels stay on the previous day. Re-render (update a `today` state) on wake. Optional improvement over main: if the selected date equals the old today, move it to the new today, so the first entry of the morning doesn't go into yesterday.
  - [ ] Opening the app offline has no cached data to show immediately (see offline section).

## P1: PWA and install

- [ ] `index.html` needs: `<link rel="manifest">` + `site.webmanifest`, apple-touch-icon, iOS splash screens, `apple-mobile-web-app-status-bar-style`, `mobile-web-app-capable`, theme-color, `robots noindex`, and the Yandex verification meta. Reuse main's `frontend/site.webmanifest` and `frontend/images/*`.
- [ ] Add `viewport-fit=cover`. Without it, the `env(safe-area-inset-bottom)` used in `BottomNav`/`AppShell` is 0 on iOS, so the bottom nav overlaps the home indicator.
- [ ] iOS zooms in when you tap inputs smaller than 16px, and the practice inputs are `text-sm`. Main used `user-scalable=no`. Use 16px inputs or restore that setting.

## P1: features main has that React lacks

**Charts**
- [ ] **Shared charts** (`/shared/:id`): React only lists report names, with no data, no charts and no owner name. Main renders the owner's charts using `/share/{id}`, `/share/{id}/practices` and `/share/{id}/user`. This is the page mentors see.
- [ ] **CSV export:** React writes `date,practice,value` with numbers only, dropping Text values and writing time as minutes. Main writes one column per practice in the app's own value format, which re-imports cleanly.
- [ ] Check on real data that chart rendering matches main: time/duration axes, stacked/overlaid bars, `show_average`, grid reports.

**Home / diary**
- [ ] **Add minutes to a duration:** `DurationQuickAddModal` exists but is never shown.
- [ ] The duration field only takes plain minutes (`parseInt("1h 30")` gives 1). Main parses `1h 30m`-style input (`utils/time_dur_input_support.rs`).
- [ ] Main marks missing required entries on past days; React only shows `*`.
- [ ] The selected date resets to today when navigating away. Main keeps it in the session context.
- [ ] Inputs use `defaultValue`, so background refetches and edits from other devices don't show until the page remounts.
- [ ] A time of `00:00` shows as empty (`timeH > 0 || timeM > 0` in `PracticeCard.tsx`).
- [ ] "Add starters" creates practices with hard-coded English names (`STARTER_PRACTICES` in `DashboardPanel.tsx`). The server already adds language-specific defaults at signup. Drop it or translate the names.

**Practices**
- [ ] The edit form lets you change the data type, but the server ignores it (`update_user_practice` doesn't update `data_type`). Lock the type on edit.

**Yatras**
- [ ] Check the TypeScript colour-zone logic (`findZone`) and heatmap thresholds against main's `ColourZonesConfig::find_zone` with a few test cases.

**Auth**
- [ ] Google sign-in needs `VITE_GOOGLE_CLIENT_ID` as a Docker build arg (plus a GitHub secret) and a Google OAuth client configured for app.sadhana.pro. The button hides itself when the ID isn't set.
- [ ] The Apple sign-in endpoint exists but has no UI. Build the UI or drop the endpoint (see P0).
- [ ] OAuth signup always adds English default practices (`WHERE lang = 'en'` in `User::signin_oauth`). Pass the UI language instead.

**Settings / Help**
- [ ] **Decision: dark only.** React hard-codes `data-theme="dark"` and uses inline white-alpha colours; main has automatic light/dark plus a toggle. The redesign's own spec excluded it "per user request". Confirm this is intended.
- [x] Preview-channel toggle (see the deployment section).
- [ ] **FAQ content regressed.** Main covered installing on iOS, registration, renaming practices, graph/table reports, bar layouts, averages, and yatra practice mapping with screenshots (`frontend/images/faq/*`), plus a Telegram link. React has 8 generic answers. Main's text is already translated in `frontend/i18n/*.json`.
- [ ] `/help` is public on main but requires login in React. Decide which it should be.
- [ ] Translate the hard-coded English strings: the error page ("Something went wrong", "Go home"), "report(s)", "Grid/Graph", "practice(s)" on the shared page, and the placeholders ("e.g. Morning run", "you@example.com", "Your name").

## P2: cleanup before merge

- [ ] Remove the Rust `frontend` crate from the workspace, drop the `common` `frontend` feature, and clean up `Cargo.lock`.
- [ ] Revert unrelated edits to the Rust frontend:
  - the `frontend/src/i18n.rs` fallback change from ru to en;
  - new images in `frontend/images` (~2 MB), which the live Rust service worker precaches on every client;
  - the deleted `banner-narrow-01.png`, which main's manifest still references.
- [ ] Split the landing-page redesign (`static-react`, 46 files, including a 5.4 MB `src/assets/2-2.jpg`) into its own PR, since it deploys separately (`build_static_site.yml`). Compress its images.
- [ ] Decide whether `docs/superpowers/` (44 plan/spec files) stays. Replace the Vite template `app-react/README.md` with run/build notes.
- [ ] Server OAuth: reuse one `reqwest::Client` and cache Apple's signing keys (JWKS) instead of fetching them on every request.
- [ ] Serve Vite's hashed `/assets/*` with `Cache-Control: public, max-age=31536000, immutable`. Drop the gzip/brotli step in the Dockerfile: nothing serves those files, and the new `Compress` middleware covers it.
- [ ] Two older issues, already on main: confirmation email links are built from an address the client sends, which could be used for phishing; and emails are only in Russian while the app now defaults to English.
