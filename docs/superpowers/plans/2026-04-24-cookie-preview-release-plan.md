# Cookie Preview Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cookie-routed parallel release flow so `app.sadhana.pro` can run `stable` and `preview` containers at the same time, let selected users opt into preview, and make preview promotion to stable operationally simple.

**Architecture:** Nginx remains the only traffic-splitting layer and chooses the upstream from a release-channel cookie. Each release keeps the existing shape of one Docker image containing both Actix and the built Yew app, while the frontend adds a release toggle and release-aware cache invalidation, and deployment automation gains explicit preview, promote, and rollback flows.

**Tech Stack:** Rust, Actix Web, Diesel, Yew, service worker JavaScript, Docker, GitHub Actions, Nginx, remote shell deploy scripts.

---

## File Map

### In repo

- Modify: `server/src/main.rs`
  - Remove unconditional startup migration execution and move migration policy behind an explicit runtime flag or separate entrypoint.
- Modify: `server/src/routes.rs`
  - Add cache-control behavior for `index.html`, `service_worker.js`, and version metadata responses.
- Modify: `server/src/vars.rs`
  - Add environment accessors for release channel and migration mode.
- Create: `server/src/app/shared/version.rs`
  - Keep version/release metadata response logic out of `routes.rs` if the route gets more complex.
- Modify: `frontend/src/model/mod.rs`
  - Extend `ApiVersion` with release-channel metadata if the backend exposes it.
- Create: `frontend/src/utils/release_channel.rs`
  - Centralize cookie read/write/delete logic and reload behavior.
- Modify: `frontend/src/utils/mod.rs`
  - Export the new release-channel helper module.
- Modify: `frontend/src/routes/settings/mod.rs`
  - Add a preview toggle for authenticated testers.
- Modify: `frontend/src/routes/settings/help.rs`
  - Show release SHA and active channel clearly.
- Modify: `frontend/src/services/mod.rs`
  - Add any helper call for richer version metadata if needed.
- Modify: `frontend/index.html`
  - Tighten service-worker registration/update behavior for channel switching.
- Modify: `frontend/service_worker.js`
  - Ensure cache names are release-specific and old caches are cleaned on activation.
- Modify: `Dockerfile`
  - If needed, inject release-channel metadata into the runtime environment or build labels.
- Modify: `.github/workflows/build_dockerhub.yml`
  - Split “build image” from “deploy preview” and stop assuming every build replaces stable.
- Modify: `.github/workflows/run_latest.yml`
  - Convert the workflow into an explicit “promote/deploy” action or replace it with channel-aware workflows.
- Create or modify: `.github/workflows/deploy_preview.yml`
  - Optional dedicated workflow if keeping preview deploy separate is clearer than overloading the current workflow.
- Create or modify: `.github/workflows/promote_preview.yml`
  - Optional dedicated workflow for preview-to-stable promotion.
- Create: `docs/operations/cookie-preview-release.md`
  - Human runbook for deploy, promote, rollback, and tester enablement.

### Outside repo but required for rollout

- Modify: Nginx site config for `app.sadhana.pro`
  - Add `stable` and `preview` upstreams and cookie-based `map` routing.
- Modify: `/home/sadhana/scripts/sadhana_reload.sh`
  - Stop treating deploy as “replace the only container”; add channel-aware deploy/promote operations.
- Create if needed: `/home/sadhana/scripts/sadhana_promote.sh`
  - Optional explicit promotion script if reusing `sadhana_reload.sh` becomes too opaque.

## Task 1: Baseline Deployment And Routing Inventory

**Files:**
- Review: `.github/workflows/build_dockerhub.yml`
- Review: `.github/workflows/run_latest.yml`
- Review: `Dockerfile`
- Review: `server/src/main.rs`
- Review: `server/src/routes.rs`
- External review: `/home/sadhana/scripts/sadhana_reload.sh`
- External review: Nginx config for `app.sadhana.pro`

- [ ] **Step 1: Confirm current container lifecycle assumptions**

Run:
```bash
sed -n '1,220p' .github/workflows/build_dockerhub.yml
sed -n '1,220p' .github/workflows/run_latest.yml
sed -n '1,220p' Dockerfile
```
Expected: one image build path and one deployment path that assume a single live container.

- [ ] **Step 2: Inspect remote deploy script and Nginx config on the server**

Run:
```bash
ssh sadhana 'sed -n "1,240p" /home/sadhana/scripts/sadhana_reload.sh'
ssh sadhana 'sudo sed -n "1,260p" /etc/nginx/sites-enabled/app.sadhana.pro'
```
Expected: confirmation of container names, ports, and current proxy behavior.

- [ ] **Step 3: Write down the exact live topology before editing anything**

Capture in notes:
```text
stable container name:
published port:
nginx upstream target:
preview container name to add:
preview local port to add:
```
Expected: no ambiguity about which scripts and ports the plan will change.

- [ ] **Step 4: Commit discovery-only notes if you create a tracked runbook stub**

```bash
git add docs/operations/cookie-preview-release.md
git commit -m "docs: capture preview release deployment topology"
```

## Task 2: Make Backend Runtime Metadata Explicit

**Files:**
- Modify: `server/src/routes.rs`
- Modify: `server/src/vars.rs`
- Create or modify: `server/src/app/shared/version.rs`
- Test: `server/src/app/shared/version.rs` or `server/src/routes.rs`

- [ ] **Step 1: Write a failing backend test for version metadata**

Add a unit or route test that expects:
```json
{"git_sha":"deadbeef","release_channel":"preview"}
```
Run:
```bash
cargo test -p server version -- --nocapture
```
Expected: FAIL because the response currently only includes `git_sha`.

- [ ] **Step 2: Add environment accessors for release metadata**

Implement in `server/src/vars.rs`:
```rust
pub fn release_channel() -> String {
    var("RELEASE_CHANNEL").unwrap_or_else(|_| "stable".to_string())
}
```
Expected: the server can report channel without hardcoding it into route handlers.

- [ ] **Step 3: Implement the richer version response**

Refactor the route to return a typed JSON body instead of a string-built payload.
Suggested response shape:
```rust
#[derive(Serialize)]
struct VersionResponse {
    git_sha: String,
    release_channel: String,
}
```
Expected: `/api/version` and `/version` expose both SHA and channel if both endpoints are retained.

- [ ] **Step 4: Run the focused backend test**

Run:
```bash
cargo test -p server version -- --nocapture
```
Expected: PASS.

- [ ] **Step 5: Commit the metadata route work**

```bash
git add server/src/routes.rs server/src/vars.rs server/src/app/shared/version.rs
git commit -m "feat: expose release channel in version metadata"
```

## Task 3: Stop Running Migrations Implicitly On Server Startup

**Files:**
- Modify: `server/src/main.rs`
- Modify: `server/src/vars.rs`
- Test: `server/src/main.rs` or a new helper module extracted from it

- [ ] **Step 1: Write a failing test around migration mode selection**

If `main.rs` is too awkward to test directly, first extract startup policy into a helper that can be unit tested. Target behavior:
```rust
assert!(!should_run_migrations("stable"));
assert!(!should_run_migrations("preview"));
assert!(should_run_migrations("migrate"));
```
Run:
```bash
cargo test -p server migration -- --nocapture
```
Expected: FAIL because migration execution is currently unconditional.

- [ ] **Step 2: Extract migration behavior behind explicit mode**

Introduce one of these minimal interfaces:
```rust
pub fn run_migrations_on_startup() -> bool {
    var("RUN_DB_MIGRATIONS").map(|v| v == "1").unwrap_or(false)
}
```
or a dedicated `SERVER_ROLE` enum if that is cleaner for deploy scripts.

- [ ] **Step 3: Update `main.rs` to skip migrations by default**

Minimal target shape:
```rust
if vars::run_db_migrations_on_startup() {
    app_state.get_conn().unwrap().run_pending_migrations(MIGRATIONS).unwrap();
}
```
Expected: stable and preview app containers do not mutate schema on boot.

- [ ] **Step 4: Run focused tests and the full server test suite**

Run:
```bash
cargo test -p server migration -- --nocapture
cargo test -p server
```
Expected: PASS.

- [ ] **Step 5: Commit the startup policy change**

```bash
git add server/src/main.rs server/src/vars.rs
git commit -m "feat: gate database migrations behind explicit startup mode"
```

## Task 4: Add Cache-Control For Cookie-Based Channel Switching

**Files:**
- Modify: `server/src/routes.rs`
- Test: `server/src/routes.rs`

- [ ] **Step 1: Write a failing route test for HTML and service worker headers**

Target expectations:
```text
/index.html => Cache-Control: no-cache, must-revalidate
/service_worker.js => Cache-Control: no-cache, must-revalidate
```
Run:
```bash
cargo test -p server cache_control -- --nocapture
```
Expected: FAIL because static files currently only rely on ETag/last-modified behavior.

- [ ] **Step 2: Implement explicit cache headers for volatile assets**

Prefer a narrow override rather than disabling caching globally. Two viable approaches:
```rust
NamedFile::open_async("./dist/index.html").await?.use_etag(true)
```
with header injection, or a small custom handler for `index.html`, `service_worker.js`, and `/version` before `Files::new("/", "./dist/")`.

Expected: channel switch reloads revalidate HTML and service worker immediately.

- [ ] **Step 3: Preserve immutable caching for hashed static assets**

Do not regress JS/CSS/WASM asset caching if Trunk is already producing release-unique filenames. If filenames are not release-unique, add that work to Task 7 before relying on long-lived caching.

- [ ] **Step 4: Run focused and full server tests**

Run:
```bash
cargo test -p server cache_control -- --nocapture
cargo test -p server
```
Expected: PASS.

- [ ] **Step 5: Commit the response-header change**

```bash
git add server/src/routes.rs
git commit -m "feat: add cache controls for channel switching"
```

## Task 5: Add Frontend Release-Channel Toggle And Visibility

**Files:**
- Create: `frontend/src/utils/release_channel.rs`
- Modify: `frontend/src/utils/mod.rs`
- Modify: `frontend/src/routes/settings/mod.rs`
- Modify: `frontend/src/routes/settings/help.rs`
- Modify: `frontend/src/model/mod.rs`
- Modify: `frontend/src/services/mod.rs`
- Test: `frontend/src/utils/release_channel.rs` and `frontend/src/routes/settings/mod.rs` where practical

- [ ] **Step 1: Write a failing frontend unit test for cookie parsing/writing**

Extract cookie logic into pure helpers that can be tested without DOM-heavy setup. Example target:
```rust
assert_eq!(parse_release_channel_cookie("foo=1; sadhana_release_channel=preview"), Some("preview".into()));
```
Run:
```bash
cargo test -p frontend release_channel -- --nocapture
```
Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 2: Implement release-channel cookie helpers**

Create `frontend/src/utils/release_channel.rs` with focused API:
```rust
pub enum ReleaseChannel { Stable, Preview }
pub fn current_release_channel() -> ReleaseChannel
pub fn set_release_channel(channel: ReleaseChannel)
pub fn clear_release_channel()
```
Use `document.cookie`; keep the cookie attributes fixed in one place.

- [ ] **Step 3: Extend version metadata model if backend response changed**

Target type:
```rust
#[derive(Debug, Deserialize, Clone)]
pub struct ApiVersion {
    pub git_sha: String,
    pub release_channel: String,
}
```
Expected: help/settings UI can display both values without manual string parsing.

- [ ] **Step 4: Add the preview toggle in settings**

Modify `frontend/src/routes/settings/mod.rs` to add a switch or menu item that:
- reads current channel from cookie
- toggles between `stable` and `preview`
- writes the cookie with `path=/; Secure; SameSite=Lax`
- forces a full reload with `window.location.reload()`

Keep the first implementation simple. Do not add role-based UI gating unless there is already a server-side tester role.

- [ ] **Step 5: Show version and channel in help/settings**

Modify `frontend/src/routes/settings/help.rs` to render something equivalent to:
```text
44b1fcb (Git hash) · preview
```
Expected: testers can confirm channel selection immediately.

- [ ] **Step 6: Run focused and full frontend unit tests**

Run:
```bash
cargo test -p frontend release_channel -- --nocapture
cargo test -p frontend
```
Expected: PASS.

- [ ] **Step 7: Commit the frontend channel UI work**

```bash
git add frontend/src/utils/release_channel.rs frontend/src/utils/mod.rs frontend/src/routes/settings/mod.rs frontend/src/routes/settings/help.rs frontend/src/model/mod.rs frontend/src/services/mod.rs
git commit -m "feat: add preview channel toggle in settings"
```

## Task 6: Make Service Worker Caches Release-Aware

**Files:**
- Modify: `frontend/service_worker.js`
- Modify: `frontend/index.html`
- Test: manual browser verification plus `trunk build`

- [ ] **Step 1: Write down the expected cache invariants before changing code**

Add comments or notes describing the target behavior:
```text
one release channel per browser at a time
cache names include GIT_SHA
activation deletes stale static caches and old API caches
switching cookie + hard reload fetches the selected channel's service worker
```
Expected: implementation choices stay aligned with the spec.

- [ ] **Step 2: Make all cache names release-specific**

Current code already uses `STATIC_VERSION = 'static-v' + GIT_SHA`; keep that and align API cache naming too.
Target:
```javascript
const CACHE_API = `api-${GIT_SHA}`;
```
If retaining a separate semantic API version is important, compose both values instead of using a global `api-v1` key.

- [ ] **Step 3: Make stale-cache cleanup precise**

Update `clearStaleCaches()` so it removes:
- all prior `static-*`
- all prior `api-*` not matching the active release/version pair

Expected: switching channels in the same browser cannot reuse stale API payloads from the old release.

- [ ] **Step 4: Confirm registration does not cache-hop across channel switches**

Keep in `frontend/index.html`:
```javascript
navigator.serviceWorker.register('/service_worker.js', { updateViaCache: 'none' });
```
If needed, add an explicit `navigator.serviceWorker.ready.then(reg => reg.update())` on page load after a channel switch marker is set in session storage.

- [ ] **Step 5: Build the frontend and manually verify cache behavior**

Run:
```bash
cd frontend && trunk build --release
```
Expected: PASS.

Manual browser verification:
```text
1. Load stable and note version.
2. Toggle preview and reload.
3. Confirm /api/version returns preview SHA/channel.
4. Inspect Cache Storage and confirm old cache names are gone.
5. Toggle back to stable and repeat.
```

- [ ] **Step 6: Commit the service worker changes**

```bash
git add frontend/index.html frontend/service_worker.js
git commit -m "feat: isolate service worker caches by release"
```

## Task 7: Verify Static Asset Identity And Cacheability

**Files:**
- Review: `frontend/index.html`
- Review: built `dist/` output after `trunk build`
- Modify if needed: `frontend/Trunk.toml`, `frontend/index.html`, `Dockerfile`, `server/src/routes.rs`

- [ ] **Step 1: Inspect the production build output for release-unique asset names**

Run:
```bash
cd frontend && trunk build --release
find ../dist -maxdepth 2 -type f | sort | sed -n '1,120p'
```
Expected: Rust-generated JS/WASM assets have content-based names. If copied assets like `service_worker.js` or `site.webmanifest` are fixed-name files, that is acceptable only if they are served with revalidation headers.

- [ ] **Step 2: If asset names are not unique enough, add the smallest possible fix**

Preferred order:
1. rely on Trunk-generated hashed filenames where already available
2. add stronger revalidation headers for fixed-name files
3. only introduce custom build-time filename rewriting if the first two are insufficient

- [ ] **Step 3: Rebuild and verify browser cache semantics**

Run:
```bash
docker build --build-arg GIT_SHA=testsha -t sadhana-preview-test .
```
Expected: PASS and generated `dist/service_worker.js` contains the substituted SHA.

- [ ] **Step 4: Commit any asset-caching follow-up**

```bash
git add frontend/Trunk.toml frontend/index.html Dockerfile server/src/routes.rs
git commit -m "chore: harden asset versioning for dual-release deploys"
```

## Task 8: Add Channel-Aware Deploy Automation In GitHub Actions

**Files:**
- Modify: `.github/workflows/build_dockerhub.yml`
- Modify: `.github/workflows/run_latest.yml`
- Create or modify: `.github/workflows/deploy_preview.yml`
- Create or modify: `.github/workflows/promote_preview.yml`
- External modify: `/home/sadhana/scripts/sadhana_reload.sh`
- External create if needed: `/home/sadhana/scripts/sadhana_promote.sh`

- [ ] **Step 1: Write the desired deployment interface before editing YAML**

Target operations:
```text
deploy-preview <git-tag>
promote-preview <git-tag>
rollback-stable <git-tag>
```
Expected: workflows call a small, stable shell interface instead of embedding server orchestration details in YAML.

- [ ] **Step 2: Refactor the remote deploy script to be channel-aware**

Target shell usage:
```bash
/home/sadhana/scripts/sadhana_reload.sh preview git-deadbee
/home/sadhana/scripts/sadhana_reload.sh stable git-deadbee
```
Behavior:
- preview deploy starts/replaces only preview container
- stable deploy starts/replaces stable container
- no automatic stable cutover when deploying preview

- [ ] **Step 3: Update the DockerHub build workflow to stop auto-promoting**

Minimal target behavior for `.github/workflows/build_dockerhub.yml`:
- build and push `latest` and `git-<sha>` tags
- optionally deploy to preview only when an input such as `deploy_channel=preview` is selected
- never overwrite stable implicitly as part of image build

- [ ] **Step 4: Add an explicit preview promotion workflow**

Either repurpose `run_latest.yml` or create `promote_preview.yml` with inputs:
```yaml
inputs:
  image_tag:
  promote_from:
```
Expected behavior:
- repoint or restart the stable container to the chosen image tag
- leave preview intact unless the workflow explicitly cleans it up

- [ ] **Step 5: Add rollback support to the workflow surface**

At minimum, permit stable deployment of a prior `git-<sha>` image tag from GitHub Actions without editing YAML.

- [ ] **Step 6: Validate workflow syntax and remote script behavior**

Run:
```bash
sed -n '1,240p' .github/workflows/build_dockerhub.yml
sed -n '1,240p' .github/workflows/run_latest.yml
ssh sadhana 'bash -n /home/sadhana/scripts/sadhana_reload.sh'
```
Expected: YAML is coherent and the shell script parses cleanly.

- [ ] **Step 7: Commit workflow and deploy-script changes**

```bash
git add .github/workflows/build_dockerhub.yml .github/workflows/run_latest.yml .github/workflows/deploy_preview.yml .github/workflows/promote_preview.yml
git commit -m "ci: add preview and promote deployment workflows"
```

## Task 9: Add Nginx Cookie Routing And Preview Failure Behavior

**Files:**
- External modify: Nginx site config for `app.sadhana.pro`
- External optional file: custom 503 error page for preview-only failure

- [ ] **Step 1: Add stable and preview upstream blocks**

Target shape:
```nginx
upstream app_stable { server 127.0.0.1:9001; }
upstream app_preview { server 127.0.0.1:9002; }
```
Expected: both versions can be healthy simultaneously.

- [ ] **Step 2: Add cookie-based upstream selection**

Target shape:
```nginx
map $cookie_sadhana_release_channel $release_upstream {
    default app_stable;
    preview app_preview;
}
```
Expected: no app-layer routing logic is needed.

- [ ] **Step 3: Fail closed for preview users when preview is unavailable**

Implement either:
- a dedicated internal location that returns preview-only 503, or
- upstream health handling that avoids silent fallback to stable for preview users

Expected: testers do not accidentally hit stable while believing they are on preview.

- [ ] **Step 4: Validate and reload Nginx**

Run:
```bash
ssh sadhana 'sudo nginx -t'
ssh sadhana 'sudo systemctl reload nginx'
```
Expected: syntax test passes and config reloads.

- [ ] **Step 5: Verify routing manually**

Run:
```bash
curl -I https://app.sadhana.pro/api/version
curl -I --cookie 'sadhana_release_channel=preview' https://app.sadhana.pro/api/version
```
Expected: both paths return 200 and the response body or headers identify different channels when different images are deployed.

## Task 10: End-To-End Verification And Runbook

**Files:**
- Create: `docs/operations/cookie-preview-release.md`
- Review: all files touched in Tasks 2-9

- [ ] **Step 1: Write the operator runbook**

Include:
- build image
- deploy preview
- enable tester cookie
- verify preview
- promote preview to stable
- rollback stable to prior image
- migrate schema explicitly when needed

- [ ] **Step 2: Run the complete verification matrix**

Run:
```bash
cargo test -p server
cargo test -p frontend
cargo test
cd frontend && trunk build --release
cargo build --release
```
Expected: PASS.

Manual verification matrix:
```text
1. Logged-out stable browser loads stable version.
2. Logged-in tester toggles preview and reloads into preview version.
3. API requests from preview browser hit preview container.
4. Toggling back to stable returns to stable version without stale data.
5. Deploying a new preview image changes only preview traffic.
6. Promoting preview to stable changes default traffic without breaking preview testers.
7. Rolling back stable to prior image is possible using a git-tagged image.
```

- [ ] **Step 3: Capture residual risks explicitly**

Document:
- same-browser single-channel limitation due to shared service-worker scope
- requirement for backward-compatible schema changes during dual-run
- need to keep remote deploy scripts and Nginx config in sync

- [ ] **Step 4: Commit the runbook and final verification fixes**

```bash
git add docs/operations/cookie-preview-release.md
git commit -m "docs: add cookie preview release runbook"
```

## Notes For The Implementer

- Prefer keeping the first backend change small. Do not build a full channel-aware server abstraction when Nginx is already the correct routing layer.
- Treat service-worker cache invalidation and startup migration gating as mandatory, not polish.
- If route tests around `actix_files::Files` become awkward, extract small helpers rather than skipping coverage entirely.
- If the remote deployment logic is too large for one script, split into `deploy_preview`, `promote_preview`, and `rollback_stable` scripts and keep GitHub Actions thin.
- The remote script and Nginx config are outside this repository. Do not claim the rollout is complete until those changes are also applied and verified.

## Review Status

Plan review by subagent was not run in this session because delegation was not explicitly requested. If you want strict plan-review workflow, request it and I can run a dedicated reviewer next.
