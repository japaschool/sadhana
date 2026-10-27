# Home performance + header order

**Date:** 2026-08-14
**App:** `app-react`
**Status:** Approved (design)

## Goal

Cut the home route's initial load (get recharts off the critical path, defer the
below-the-fold yatras, shrink the LCP background image) and apply two small
header tweaks.

## Context / measurement reality

The reported Lighthouse numbers (FCP 42.7s, LCP 111.9s, TBT 2.66s) are from the
**Vite dev server**, which serves the app as hundreds of unbundled ES modules in
React dev mode — not representative of production. The production build compiles
in ~1s and ships ~300 KB gzip of JS. The genuine bottleneck: the home route
eagerly pulls in a **408 KB (116 KB gzip) `ChartsPage` chunk** (recharts) because
`DashboardPanel` statically imports `ChartsPage`, and it also eagerly mounts the
below-the-fold `YatrasPage`. Both load before the user needs them.

## A. Header tweaks (`TopBar.tsx`)

- **Order:** the right-aligned cluster becomes `Home · Practices ▾ · Yatras ▾ ·
  Settings` (Charts nav stays `lg:hidden`). Home leads, then the action
  dropdowns, then Settings. `HomeHeaderActions` (Practices ▾, Yatras ▾) renders
  between the Home nav item and the rest.
- **Settings as text on desktop:** revert the icon-only change — the Settings nav
  item shows its "Settings" text label again on desktop (still `onClick`
  `openSettings()`).

Implementation note: the simplest structure is to render the nav items and the
`HomeHeaderActions` in one flex cluster with the desired order. Home is the first
nav item; render `HomeHeaderActions` right after Home, then the remaining nav
items (Charts `lg:hidden`, Settings). Yatras stays filtered out of the desktop
nav (unchanged). `navItems` order is `home, charts, yatras, settings` — split the
rendered list so Home comes first and the rest follow the actions.

## B. Performance

### B1. Lazy-load the embedded `ChartsPage` (`DashboardPanel.tsx`)
Replace the static `import { ChartsPage }` with
`const ChartsPage = lazy(() => import('../charts/ChartsPage').then(m => ({ default: m.ChartsPage })))`
and wrap the desktop `<ChartsPage embedded />` in `<Suspense fallback={<Spinner />}>`.
This moves recharts off the home route's static critical path — the practices
column paints immediately and the recharts chunk streams in behind a spinner.

### B2. Defer the below-the-fold `YatrasPage` (`HomePage.tsx`)
Lazy-load `YatrasPage` and mount it only when the `#home-yatras` section scrolls
near the viewport, via a small reusable wrapper:

- **New `DeferUntilVisible` (`components/util/DeferUntilVisible.tsx`)**: renders a
  placeholder element with a ref; uses `IntersectionObserver` (with a
  `rootMargin` so it triggers slightly before entering view) to flip to rendering
  `children` once. **If `IntersectionObserver` is unavailable (jsdom / SSR), it
  renders `children` immediately** so tests and non-IO environments still work.
- `HomePage` wraps the lazy `YatrasPage` in `DeferUntilVisible` + `Suspense`
  inside the `#home-yatras` section. The yatras chunk and its API calls fire on
  scroll, not on initial load.

### B3. Optimize the LCP background (`bg.jpg`)
`public/bg.jpg` (344 KB) is `<link rel="preload" as="image">`ed and used as the
full-viewport backdrop (`AuthBackground.tsx`) — the likely LCP element. Re-encode
to a resized WebP (`bg.webp`), update the `AuthBackground` `backgroundImage` and
the `index.html` preload to point at it. **During implementation, verify a WebP
encoder is available (`cwebp`, or `sips` on macOS); if none is, fall back to a
resized/re-compressed JPEG** so the size still drops. Keep the original as a
fallback only if needed; otherwise replace.

## Testing

- **`DeferUntilVisible`**: renders children immediately when `IntersectionObserver`
  is absent (jsdom default); when present (mock it), renders the placeholder first
  and children after an intersection callback.
- **`DashboardPanel`/`HomePage`**: existing tests keep asserting the practices
  content (above the lazy `ChartsPage` boundary) — they must still pass with the
  lazy `Suspense` boundaries (use `findBy*`/`await` as already done). Add a check
  that the `#home-yatras` section still renders (its content via `DeferUntilVisible`
  immediate-mount path in jsdom).
- **`TopBar`**: assert the desktop nav shows the "Settings" text again, still no
  Yatras link, and the Home item renders; the Practices trigger is present on `/`.

## Out of scope

- No changes to `YatrasPage`/`ChartsPage` internals, mobile `BottomNav`, or
  routing. No dependency swaps (recharts stays; it's just code-split).
