# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Sadhana Pro is a PWA for tracking spiritual practice: a **Rust** API and a **React** (Vite + TypeScript) frontend in `app-react/`. The Cargo workspace holds:

- `server` — actix-web REST API + static file host (Diesel/Postgres). Default workspace member.
- `common` — types used by the server (`backend` feature).

The Rust/Yew UI (`frontend/`) was removed on this branch; it still lives on `main`, and is deployed only from there. Both UIs share the prod DB.

The compiled frontend lands in `dist/`, which the server serves directly (see `server/src/routes.rs`).

## Commands

All common workflows go through the `Makefile`. It hardcodes a `db_url`; override `DATABASE_URL` in your env or edit the Makefile for local dev.

- `make run` — build the React app into `dist/`, then run the server. App at `localhost:8080`.
- `make frontend-build` — `npm ci && npm run build` in `app-react/`, output to `dist/`.
- In `app-react/`: `npm run dev` (Vite, proxies `/api` to `localhost:8080`), `npm test`, `npm run lint`.
- `make run_server` — server only (assumes `dist/` already built).
- `make test T=<name>` — run tests. **Tests hit a real Postgres DB** and require `--test-threads=1` (already in the target); `T` filters by name. `make test` runs all.
- `make lint` — `cargo clippy --all-targets --all-features -D warnings` (warnings are errors), then `npm run lint`.
- `make migrate` / `make undo_migrate` / `make redo_migrate` / `make reset_db` — Diesel migrations in `migrations/`.
- `make create_migration name=<x>` — new migration.
- `make gen_schema` — regenerate `server/src/schema.rs` from the live DB. **Do not hand-edit `schema.rs`.**

First-time setup (from README): Node 22, `cargo install diesel_cli --no-default-features --features postgres` (needs `libpq`).

Docker: `docker build -t sadhanapro .` (multi-stage: a Node stage builds `app-react`, cargo-chef caches Rust deps). Requires env vars `SERVER_ADDRESS`, `JWT_KEY`, `DATABASE_URL`.

CI (`.github/workflows/ci.yml`) runs React lint/test/build and clippy + `cargo test` against a Postgres service. Deploy: `build_dockerhub.yml` with `deploy_channel=preview`; testers opt in with the `sadhana_release_channel=preview` cookie (Settings → preview toggle), which nginx routes on.

## Architecture notes

**Auth** is a global actix middleware (`server/src/middleware/auth.rs`, wired in `main.rs`). It validates a JWT and injects the `User` into request extensions; handlers read the authenticated user from there rather than re-checking tokens. Config/secrets are read via `server/src/vars.rs` from env / `.env`.

**Server request flow:** `main.rs` → `routes::routes` (`routes.rs`, defines the `/api` scope) → per-feature module under `server/src/app/`. Two module conventions coexist:
- Older modules (`user`, `diary`) use `api.rs` / `model.rs` / `request.rs` / `response.rs`.
- `yatras` is the newer layered style: `handlers.rs` (HTTP) → `service.rs` (logic) → `domain/` + `dto.rs`. Prefer this layout for new features.

**DB migrations are embedded** in the server binary (`embed_migrations!`) and run on startup when enabled via `vars::run_db_migrations_on_startup()`.

**Compatibility with the Rust UI** (users switch between the two via the preview cookie): the JWT stays in `yew.token`, JSON-quoted as gloo wrote it (`readToken`/`writeToken` in `store/authStore.ts`); the old `user_language` key is migrated once to `i18nextLng` (`legacyLanguage.ts`).

**Service worker:** `app-react/public/service_worker.js` is served at the same path as the Rust UI's worker, with no-cache headers, and `__GIT_SHA__` is substituted at Docker build so each release is a new worker. For now it only takes over: sends the Rust worker's queued offline writes (IndexedDB `SadhanaProPostDB`/`postrequest`), deletes its `static-v*`/`api-v*` caches and claims the clients. It has no fetch handler, so no offline mode yet. Touch this area carefully — it governs what installed clients run.

## Local dev environment

On this machine the dev environment runs inside a VS Code dev container(`.devcontainer/devcontainer.json`). The Rust toolchain and Node live inside the container, not on the host — the host has no cargo. (The host does have Node, but its v26 breaks jsdom's `localStorage` in tests; run `npm test` with Node 22.) The repo is mounted in the container at `/workspaces/sadhana-pro`.

To build/test/run, exec into the running dev container rather than invoking tooling on the host, e.g.:

`docker exec <container> bash -lc 'cd /workspaces/sadhana-pro && cargo test ...'`
## UI redesign (`redesign` branch, `app-react/`)

`app-react/` is the React rewrite of the frontend. It is being redesigned again, screen by screen, from the claude.ai/design project "Sadhana Redesign" (`Sadhana Redesign.dc.html`): https://claude.ai/design/p/cccefa4d-5554-41b1-be47-2704b1233b68?file=Sadhana+Redesign.dc.html. Read the mockups through the `claude_design` MCP (`https://api.anthropic.com/v1/design/mcp`, auth via `/design-login`). Screens with no mockup (e.g. Settings) are derived from the Today screen's design language. Spec and plan: `docs/superpowers/specs/2026-10-06-mobile-today-redesign-design.md`, `docs/superpowers/plans/2026-10-06-mobile-today-redesign.md`.

- **Three real layouts (mobile / tablet / desktop)**, each with its own component tree, not one layout with media queries. `useLayout()` + `<ByLayout mobile tablet desktop legacy>` pick per route. A layout with no new version yet falls back to the legacy page in the old dark `AppShell`.
- **New code lives in** `src/ui` (tokens, primitives), `src/layouts` (shells) and `src/features/<screen>` (logic in hooks; components per layout). Don't extend legacy `pages/`, `components/layout/` or `theme/tokens.ts`; delete them as screens are replaced.
- **Theme:** the design's palette replaces the old one. Light is the default; dark follows `prefers-color-scheme` and uses only the "1a · dark" colours (plus `#C2412D` danger). Tokens are CSS vars scoped to `.ui-root` (`src/ui/theme.css`), used as `ui-*` Tailwind colours. No DaisyUI in new code, and portals go through `UiPortal`.
- **Fonts:** Manrope + IBM Plex Mono (both have Cyrillic, so they cover ru/uk). All strings are in en/ru/uk.
- **Practice groups are out of scope for now.** One hardcoded "Practices" group.
- **Data rules:** local `yyyy-mm-dd` dates (never `toISOString()`); an empty input saves `null`; dropdown options are comma- or newline-separated.
