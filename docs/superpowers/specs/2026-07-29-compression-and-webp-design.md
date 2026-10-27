# Sadhana Pro — Server Compression + WebP Background Image Design Spec

**Date:** 2026-07-29
**Scope:** Two independent network-layer optimisations: HTTP response compression and WebP background image

---

## Context

After the previous performance improvements (optimistic updates, auth hydration, week prefetch), the remaining high-impact wins are network-level:

- The Actix server has no compression middleware — JS bundles (~700 KB total), CSS (~77 KB), and JSON API responses are sent uncompressed.
- `bg.jpg` (636 KB, 1920×1280) is the likely LCP element. Converting to WebP would cut it to ~150–200 KB.
- `login-bg.jpg` (636 KB) is present in `app-react/public/` but not referenced in any source file — excluded from this change.

---

## Change 1 — Server Compression

**File:** `server/src/main.rs`

`actix-web = "4"` uses default features, which already include `compress-gzip` and `compress-brotli`. No `Cargo.toml` change is needed.

Add `actix_web::middleware::Compress::default()` to the `App` middleware chain immediately after `Logger`:

```rust
App::new()
    .wrap(Logger::default())
    .wrap(actix_web::middleware::Compress::default())
    .app_data(Data::new(app_state))
    .wrap(middleware::cors::cors())
    .wrap(middleware::auth::Authentication)
    .configure(routes::routes)
```

`Compress::default()` negotiates encoding via `Accept-Encoding`: brotli preferred over gzip, identity as fallback. All responses are eligible — static files, API JSON, and the precache manifest.

**Expected savings:** JS bundles ~700 KB → ~180 KB on the wire; JSON API responses ~60–70% smaller.

**Testing:** Existing `routes.rs` tests cover response structure. Add one integration test asserting that a static file response includes a `Content-Encoding` header when the request sends `Accept-Encoding: gzip`.

---

## Change 2 — WebP Background Image

**Files:**
- Create: `app-react/public/bg.webp` (converted from `bg.jpg` via `sips`)
- Modify: `app-react/src/components/layout/AuthBackground.tsx`
- Modify: `app-react/index.html`
- Modify: `server/src/routes.rs`

### Conversion

```bash
sips -s format webp app-react/public/bg.jpg --out app-react/public/bg.webp
```

`sips` is macOS's built-in image tool. Estimated output: ~150–200 KB (75–80% reduction from 636 KB). Keep `bg.jpg` as fallback — do not delete it.

### AuthBackground.tsx

Switch `backgroundImage` from plain `url()` to `image-set()` so modern browsers receive WebP and older browsers fall back to JPEG:

```ts
// Before
backgroundImage: 'url(/bg.jpg)',

// After
backgroundImage: "image-set(url('/bg.webp') type('image/webp'), url('/bg.jpg') type('image/jpeg'))",
```

`image-set()` is supported in Safari 15+, Chrome 113+, Firefox 113+. All current mobile browsers used with this PWA support it.

### index.html

Update the existing preload hint to target WebP. The `type` attribute tells the browser to skip the preload if it does not support WebP, so JPEG users are not penalised:

```html
<!-- Before -->
<link rel="preload" as="image" href="/bg.jpg" />

<!-- After -->
<link rel="preload" as="image" href="/bg.webp" type="image/webp" />
```

### routes.rs — precache manifest

Add `"webp"` to the extension list in `collect_precache_assets` so the service worker precaches `bg.webp`:

```rust
if matches!(
    ext,
    "html" | "js" | "css" | "wasm" | "webmanifest"
        | "jpg" | "png" | "ttf" | "svg" | "eot" | "woff" | "webp"
) {
```

---

## Files Changed

| File | Change |
|---|---|
| `server/src/main.rs` | Add `Compress::default()` middleware |
| `server/src/routes.rs` | Add `"webp"` to precache asset extensions; add compression integration test |
| `app-react/public/bg.webp` | New file — WebP version of bg.jpg |
| `app-react/src/components/layout/AuthBackground.tsx` | Use `image-set()` for WebP + JPEG fallback |
| `app-react/index.html` | Update preload hint to target bg.webp with type attribute |

---

## Expected Impact

| Metric | Before | After |
|---|---|---|
| JS bundle wire size | ~700 KB | ~180 KB (brotli) |
| bg image wire size | 636 KB | ~160 KB (WebP) |
| LCP (production) | ~3–4 s | ~1.5–2 s |
