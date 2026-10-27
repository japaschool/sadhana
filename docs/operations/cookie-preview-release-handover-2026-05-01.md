# Cookie Preview Release Handover (2026-05-01)

## Scope

This handover covers the implementation plan in:
- `docs/superpowers/plans/2026-04-24-cookie-preview-release-plan.md`

Work has been performed on branch:
- `feature/2-pane-layout`

## Completed Work

### Task 1: Baseline deployment and routing inventory
- Status: completed
- Commit: `f84fc09`
- Artifact:
  - `docs/operations/cookie-preview-release.md`

### Task 2: Backend version metadata (`git_sha` + `release_channel`)
- Status: completed
- Commit: `9e641b0`
- Files:
  - `server/src/routes.rs`
  - `server/src/vars.rs`
  - `server/src/app/shared.rs`
  - `server/src/app/shared/version.rs`

### Task 3: Gate startup DB migrations
- Status: completed
- Commit: `f6e12ad`
- Files:
  - `server/src/main.rs`
  - `server/src/vars.rs`
- Behavior:
  - Migrations now run only when `RUN_DB_MIGRATIONS=1`

### Task 4: Cache-control for channel switching
- Status: completed
- Commit: `b7cee42`
- File:
  - `server/src/routes.rs`
- Behavior:
  - Explicit `no-cache, must-revalidate` applied for `index.html` fallback and `/service_worker.js`

### Task 5: Frontend preview channel toggle + version visibility
- Status: completed
- Commit: `6fb4f87`
- Files:
  - `frontend/src/utils/mod.rs`
  - `frontend/src/utils/release_channel.rs`
  - `frontend/src/model/mod.rs`
  - `frontend/src/pages/settings/mod.rs`
  - `frontend/src/pages/settings/help.rs`
- Behavior:
  - Settings now has a `Preview Channel` toggle
  - Toggle updates `sadhana_release_channel` cookie and forces reload
  - Help page now shows `git_sha` and `release_channel`

### Task 6: Service worker release-aware caching
- Status: completed
- Commit: `fd5be34`
- File:
  - `frontend/service_worker.js`
- Behavior:
  - API cache is now keyed by release SHA
  - stale static/api caches from other SHAs are removed on activation

### Task 8: GitHub Actions channel-aware deployment inputs
- Status: completed
- Commit: `b8e0902`
- Files:
  - `.github/workflows/build_dockerhub.yml`
  - `.github/workflows/run_latest.yml`
- Behavior:
  - Build workflow has `deploy_channel` input (`none|preview|stable`)
  - Deploy workflow supports explicit `deploy_channel` + `image_tag`
  - Both assume remote script signature: `sadhana_reload.sh <channel> <tag>`

### Task 9 + part of Task 10: Operations runbook and manual server steps
- Status: completed (documentation)
- Commit: `1a85cdb`
- Artifact:
  - `docs/operations/cookie-preview-release.md`

## Verification Update (2026-05-01)

The following was executed in this environment on 2026-05-01:

- `cargo test -p server -- --nocapture --test-threads=1`
- `cargo test -p frontend -- --nocapture --test-threads=1`
- `cargo test --workspace -- --nocapture --test-threads=1`
- `cargo build --workspace --release`
- `cd frontend && NO_COLOR=false trunk build --release`

Observed results:

- Release builds: pass
  - `cargo build --workspace --release` passed
  - `trunk build --release` passed and produced hashed app assets in `dist`:
    - `frontend-d322ae830c60131b.js`
    - `frontend-d322ae830c60131b_bg.wasm`
    - `tailwind-4656da114076e71e.css`
    - `style-e57ae70a9fbaa49a.css`
- Static asset identity/caching check: pass
  - release artifacts are content-hashed
  - `index.html` references hashed filenames with integrity attributes
  - non-hashed assets remain only for static copies (`images/*`, `service_worker.js`, `site.webmanifest`, `idb.js`)
- Test runs: blocked by existing environment/test constraints
  - server tests requiring DB fail without `DATABASE_URL`
  - `app::user::api::tests::test_me` is currently `todo!()` and fails
  - frontend chart tests panic on non-wasm target (`js-sys` imported statics)

## Pending Work

### Task 7: Verify static asset identity and caching
- Status: completed
- Validation performed:
  - `trunk build --release` executed successfully
  - generated release assets are content-hashed
  - `index.html` points to hashed assets and keeps SRI metadata
  - no static caching regression observed for hashed bundle strategy

### Task 10: End-to-end verification execution
- Status: in progress / partially executed
- Completed locally:
  - release build checks
  - backend/frontend/workspace test command execution (with failures captured)
- Still pending:
  - cookie routing behavior checks against production nginx + dual-service deployment
  - DB-backed server test execution in an environment with `DATABASE_URL`
  - wasm-targeted frontend test strategy for chart tests

## Blockers Encountered

### Previous toolchain blocker resolved
- `cargo` and `trunk` are available in this environment
- build/test commands are executable

### Remaining blockers
- No configured test database URL for DB-coupled server tests
- Some frontend chart tests are not host-target compatible and need wasm-aware test execution or gating

## Production Manual Changes Still Required

These are documented in `docs/operations/cookie-preview-release.md` and must be executed on server manually:
- Add `sadhana-preview` service in production compose
- Update `/home/sadhana/scripts/sadhana_reload.sh` to accept channel + tag
- Update `~/docker/nginx.conf` for cookie-routed upstream selection
- Add fail-closed behavior for preview traffic when preview is down

## Suggested Pickup Sequence For Next Agent

1. Confirm branch alignment (`main` currently contains these commits in this workspace)
2. Provide test DB (`DATABASE_URL`) and rerun server tests
3. Decide wasm test policy for frontend chart tests (run wasm tests or gate host-only CI tests)
4. Execute production cookie-routing verification from runbook (`/api/version` with/without preview cookie)
5. Prepare integration/merge handoff

## Notes

- Repo has unrelated untracked files in workspace (`.codex`, `*.tif.pdf`, etc.); leave untouched.
- All commits above are intended as incremental checkpoints and are not squashed in this run.
