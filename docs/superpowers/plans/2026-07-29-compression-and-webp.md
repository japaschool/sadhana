# Compression + WebP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HTTP response compression to the Actix server and convert the background image to WebP to cut total wire size by ~75%.

**Architecture:** Two independent changes. Task 1 adds a single middleware wrap to `main.rs` and a test in `routes.rs`. Task 2 converts `bg.jpg` to `bg.webp` with `sips` (macOS built-in), updates the CSS to use `image-set()` for WebP+JPEG fallback, updates the HTML preload hint, and registers the `.webp` extension in the service-worker precache manifest builder.

**Tech Stack:** Rust / actix-web 4 (server), TypeScript / React 19 / Vite 8 (frontend), `sips` (macOS image tool)

## Global Constraints

- `actix-web = "4"` already enables `compress-gzip` and `compress-brotli` by default — no `Cargo.toml` change needed
- Run Rust tests with `cargo test -p server <filter>` (cargo is on the host PATH at `~/.cargo/bin/cargo`)
- Run React tests with `cd app-react && npm test`
- Do not add npm or Cargo dependencies
- Keep `bg.jpg` — do not delete it; it is the fallback for browsers that do not support WebP

---

### Task 1: Server compression middleware

**Files:**
- Modify: `server/src/main.rs`
- Modify: `server/src/routes.rs` (add test to existing `#[cfg(test)]` block)

**Interfaces:**
- Consumes: `actix_web::middleware::Compress` — already available via default actix-web 4 features
- Produces: all HTTP responses are compressed when the client sends `Accept-Encoding: gzip` or `br`

- [ ] **Step 1: Write the failing test**

Open `server/src/routes.rs`. Find the `#[cfg(test)]` block at the bottom (around line 253). Add this test inside the existing `mod tests { ... }`:

```rust
#[actix_rt::test]
async fn compress_middleware_encodes_gzip_response() {
    use actix_web::middleware::Compress;

    #[get("/echo")]
    async fn big_text() -> HttpResponse {
        HttpResponse::Ok()
            .content_type("text/plain")
            .body("x".repeat(1024))
    }

    let app = test::init_service(
        App::new()
            .wrap(Compress::default())
            .service(big_text),
    )
    .await;

    let req = test::TestRequest::get()
        .uri("/echo")
        .insert_header(("Accept-Encoding", "gzip"))
        .to_request();

    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(
        resp.headers()
            .get("content-encoding")
            .and_then(|v| v.to_str().ok()),
        Some("gzip")
    );
}
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cargo test -p server compress_middleware_encodes_gzip_response
```

Expected: FAIL — `Content-Encoding` header is absent because `Compress` is not yet in the real app (but this test builds its own app, so it may actually pass if `Compress::default()` is available). If it passes here already, that's fine — it is validating the middleware works in isolation. Proceed to Step 3.

- [ ] **Step 3: Add `Compress::default()` to `main.rs`**

Open `server/src/main.rs`. Find the `App::new()` block inside `HttpServer::new(move || { ... })`. Add the middleware line immediately after `Logger::default()`:

```rust
App::new()
    .wrap(Logger::default())
    .wrap(actix_web::middleware::Compress::default())
    .app_data(Data::new(app_state))
    .wrap(middleware::cors::cors())
    .wrap(middleware::auth::Authentication)
    .configure(routes::routes)
```

- [ ] **Step 4: Run all server tests**

```bash
cargo test -p server
```

Expected: all tests pass. (Server tests do not require a running database — they only test HTTP handlers in isolation.)

- [ ] **Step 5: Commit**

```bash
git add server/src/main.rs server/src/routes.rs
git commit -m "perf: add Compress middleware — gzip/brotli for all responses"
```

---

### Task 2: WebP background image

**Files:**
- Create: `app-react/public/bg.webp`
- Modify: `app-react/src/components/layout/AuthBackground.tsx`
- Modify: `app-react/index.html`
- Modify: `server/src/routes.rs`

**Interfaces:**
- Consumes: `sips` — macOS built-in image tool at `/usr/bin/sips`
- Produces: `bg.webp` served at `/bg.webp`; CSS `image-set()` picks it over `bg.jpg` on supporting browsers

- [ ] **Step 1: Convert `bg.jpg` to `bg.webp`**

```bash
sips -s format webp app-react/public/bg.jpg --out app-react/public/bg.webp
```

- [ ] **Step 2: Verify the output size**

```bash
ls -lh app-react/public/bg.jpg app-react/public/bg.webp
```

Expected: `bg.webp` is roughly 150–220 KB (compared to 636 KB for `bg.jpg`). If `bg.webp` is larger than `bg.jpg`, something went wrong — delete it and stop.

- [ ] **Step 3: Update `AuthBackground.tsx` to use `image-set()`**

Open `app-react/src/components/layout/AuthBackground.tsx`. The current file is:

```tsx
export function AuthBackground() {
  return (
    <div
      className="fixed inset-0 -z-10"
      style={{
        backgroundImage: 'url(/bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  )
}
```

Replace the `backgroundImage` value:

```tsx
export function AuthBackground() {
  return (
    <div
      className="fixed inset-0 -z-10"
      style={{
        backgroundImage: "image-set(url('/bg.webp') type('image/webp'), url('/bg.jpg') type('image/jpeg'))",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  )
}
```

- [ ] **Step 4: Update the preload hint in `index.html`**

Open `app-react/index.html`. Find the existing preload line:

```html
<link rel="preload" as="image" href="/bg.jpg" />
```

Replace it with:

```html
<link rel="preload" as="image" href="/bg.webp" type="image/webp" />
```

The `type="image/webp"` attribute tells browsers that do not support WebP to skip this preload (they will fall back to `bg.jpg` via the `image-set()` CSS).

- [ ] **Step 5: Add `"webp"` to the precache manifest builder in `routes.rs`**

Open `server/src/routes.rs`. Find `collect_precache_assets` (around line 69). The current `matches!` block is:

```rust
if matches!(
    ext,
    "html"
        | "js"
        | "css"
        | "wasm"
        | "webmanifest"
        | "jpg"
        | "png"
        | "ttf"
        | "svg"
        | "eot"
        | "woff"
) {
```

Add `"webp"` at the end:

```rust
if matches!(
    ext,
    "html"
        | "js"
        | "css"
        | "wasm"
        | "webmanifest"
        | "jpg"
        | "png"
        | "ttf"
        | "svg"
        | "eot"
        | "woff"
        | "webp"
) {
```

- [ ] **Step 6: Run tests**

```bash
cargo test -p server
cd app-react && npm test
```

Expected: all tests pass. (No new tests are needed for the `routes.rs` one-liner or the CSS/HTML changes — the sips output and browser rendering are the verification.)

- [ ] **Step 7: Commit**

```bash
git add app-react/public/bg.webp \
        app-react/src/components/layout/AuthBackground.tsx \
        app-react/index.html \
        server/src/routes.rs
git commit -m "perf: serve bg.webp (~160 KB) with JPEG fallback, precache webp assets"
```
