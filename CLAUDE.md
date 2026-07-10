# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Sadhana Pro is a full-stack **Rust** PWA for tracking spiritual practice. A single Cargo workspace holds three crates:

- `server` — actix-web REST API + static file host (Diesel/Postgres). Default workspace member.
- `frontend` — Yew (WASM) SPA compiled with Trunk, served as an installable iOS/Android PWA.
- `common` — types shared by both, gated behind mutually exclusive `frontend` / `backend` cargo features (the backend feature pulls in actix/diesel/etc.; frontend stays dependency-light).

The compiled frontend lands in `dist/`, which the server serves directly (see `server/src/routes.rs`).

## Commands

All common workflows go through the `Makefile`. It hardcodes a `db_url`; override `DATABASE_URL` in your env or edit the Makefile for local dev.

- `make run` — build frontend (`trunk build`) then run the server. App at `localhost:8080`.
- `make frontend-build` — `trunk build` only (writes to `dist/`).
- `make run_server` — server only (assumes `dist/` already built).
- `make test T=<name>` — run tests. **Tests hit a real Postgres DB** and require `--test-threads=1` (already in the target); `T` filters by name. `make test` runs all.
- `make lint` — `cargo clippy --all-targets --all-features -D warnings`. Warnings are errors.
- `make migrate` / `make undo_migrate` / `make redo_migrate` / `make reset_db` — Diesel migrations in `migrations/`.
- `make create_migration name=<x>` — new migration.
- `make gen_schema` — regenerate `server/src/schema.rs` from the live DB. **Do not hand-edit `schema.rs`.**

First-time setup (from README): `cargo install trunk`, `rustup target add wasm32-unknown-unknown`, `cargo install diesel_cli --no-default-features --features postgres` (needs `libpq`).

Docker: `docker build -t sadhanapro .` (multi-stage, uses cargo-chef for dep caching; builds frontend inside). Requires env vars `SERVER_ADDRESS`, `JWT_KEY`, `DATABASE_URL`.

## Architecture notes

**Auth** is a global actix middleware (`server/src/middleware/auth.rs`, wired in `main.rs`). It validates a JWT and injects the `User` into request extensions; handlers read the authenticated user from there rather than re-checking tokens. Config/secrets are read via `server/src/vars.rs` from env / `.env`.

**Server request flow:** `main.rs` → `routes::routes` (`routes.rs`, defines the `/api` scope) → per-feature module under `server/src/app/`. Two module conventions coexist:
- Older modules (`user`, `diary`) use `api.rs` / `model.rs` / `request.rs` / `response.rs`.
- `yatras` is the newer layered style: `handlers.rs` (HTTP) → `service.rs` (logic) → `domain/` + `dto.rs`. Prefer this layout for new features.

**DB migrations are embedded** in the server binary (`embed_migrations!`) and run on startup when enabled via `vars::run_db_migrations_on_startup()`.

**Frontend** (`frontend/src/`) is Yew function components + hooks. `main.rs` nests context providers (network status, app-update, user, session) around a `yew-router` switch. Routes live in `routes/`, shared UI in `components/`, cross-cutting state in `hooks/`. All API calls go through `services/requests.rs`, which handles the JWT (`yew.token` in LocalStorage) and an optional response cache. i18n strings are generated at build time via `i18n_codegen` (`i18n.rs`). Styling uses Tailwind classes merged with `tw_merge`.

**PWA / service worker:** the server generates a precache manifest and serves `service_worker.js` with no-cache headers; the SW cache is scoped by release SHA (`GIT_SHA` build arg → `frontend/src/utils/release_channel.rs`) so a new deploy invalidates stale assets. Touch this area carefully — it governs what clients cache across releases.

Trunk proxies `/api/` to the running server during dev (`frontend/Trunk.toml`).

## Local dev environment

On this machine the dev environment runs inside a VS Code dev container(`.devcontainer/devcontainer.json`). The Rust toolchain (`cargo`, `trunk`, `rustc`, the `wasm32-unknown-unknown` target) lives inside the container, not on the host — the host has no cargo/trunk. The repo is mounted in the container at `/workspaces/sadhana-pro`.

To build/test/run, exec into the running dev container rather than invoking tooling on the host, e.g.:

`docker exec <container> bash -lc 'cd /workspaces/sadhana-pro && cargo test ...'`