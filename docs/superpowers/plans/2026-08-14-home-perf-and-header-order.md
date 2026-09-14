# Home Performance + Header Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get recharts off the home critical path, defer the below-the-fold yatras, shrink the LCP background image, and apply two header tweaks (Home first, Settings as text).

**Architecture:** Code-split the embedded `ChartsPage` (recharts) with `React.lazy`+`Suspense` in `DashboardPanel`; defer the embedded `YatrasPage` with a new `DeferUntilVisible` (IntersectionObserver) wrapper in `HomePage`; re-encode `bg.jpg` smaller; reorder the `TopBar` cluster and revert Settings to a text label.

**Tech Stack:** React 19 (`lazy`/`Suspense`/`IntersectionObserver`), react-router v7, Tailwind v4, Vitest + RTL.

## Global Constraints

- App in `app-react/`; run all commands there. Tests: `npx vitest run <path>` (or `npm run test`). Build: `npm run build`. Lint: `npm run lint` (`oxlint`, fails on unused imports).
- JSX auto-runtime — no `import React` in files that don't already have it (`TopBar.tsx` already imports `React`; keep it).
- Reuse the existing `Spinner` (`src/components/ui/Spinner.tsx`, default-styled loading spinner) for all `Suspense` fallbacks.
- jsdom has NO `IntersectionObserver` — `DeferUntilVisible` must render its children immediately when `IntersectionObserver` is unavailable, so tests and non-IO environments still render.
- No dependency changes (recharts stays; it is only code-split). No routing changes. Mobile `BottomNav`/`navItems` order unchanged.
- The 42s/111s Lighthouse numbers are Vite-dev-server artifacts — do not chase them; the work is the code-splitting + asset size.

---

### Task 1: Header order + Settings as text (`TopBar.tsx`)

**Files:**
- Modify: `app-react/src/components/layout/TopBar.tsx`
- Modify: `app-react/src/components/layout/TopBar.test.tsx`

**Interfaces:**
- Produces: the desktop header cluster renders in order `Home · HomeHeaderActions (Practices ▾, Yatras ▾) · Charts(lg:hidden) · Settings`; the Settings nav item shows its text label again.

- [ ] **Step 1: Rewrite the `TopBar` test**

Replace the whole contents of `app-react/src/components/layout/TopBar.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from './TopBar'

function wrapAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar />
    </MemoryRouter>,
  )
}

describe('TopBar', () => {
  it('shows Home, the home actions, and Settings-as-text on the home route; no Yatras nav link', () => {
    wrapAt('/')
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Practices/ })).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument() // reverted to a text label
    expect(screen.queryByRole('link', { name: 'Yatras' })).not.toBeInTheDocument()
  })

  it('hides the home actions on other routes', () => {
    wrapAt('/yatras')
    expect(screen.queryByRole('button', { name: /Practices/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app-react && npx vitest run src/components/layout/TopBar.test.tsx`
Expected: FAIL — currently Settings renders as an icon (no "Settings" text).

- [ ] **Step 3: Rewrite `TopBar.tsx`**

Replace the whole file with:

```tsx
import React from 'react'
import { useNavigate, useLocation, NavLink, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FaChevronLeft } from 'react-icons/fa'
import { LuX } from 'react-icons/lu'
import { navItems } from './navItems'
import { HomeHeaderActions } from './HomeHeaderActions'
import { ACCENT } from '../../theme/tokens'
import { useUiStore } from '../../store/uiStore'

interface TopBarProps {
  title?: string
  showBack?: boolean
  showClose?: boolean
  right?: React.ReactNode
}

export const TopBar = React.memo(function TopBar({ title, showBack, showClose, right }: TopBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const openSettings = useUiStore((s) => s.openSettings)

  const renderNavItem = ({ to, navKey, icon: Icon, exact }: (typeof navItems)[number]) => (
    <NavLink
      key={to}
      to={to}
      end={exact}
      onClick={navKey === 'settings' ? (e) => { e.preventDefault(); openSettings() } : undefined}
      aria-label={t(`nav.${navKey}`)}
      className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg transition-colors text-sm font-medium ${navKey === 'charts' ? 'lg:hidden' : ''}`}
    >
      {({ isActive }) => (
        <>
          {/* Below sm: icon only */}
          <Icon
            className="w-4 h-4 sm:hidden transition-colors"
            style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.75)' }}
          />
          {/* sm and above: text label */}
          <span
            className="hidden sm:inline transition-colors"
            style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.75)', fontWeight: isActive ? 600 : 500 }}
          >
            {t(`nav.${navKey}`)}
          </span>
          {/* Active dot */}
          <span
            className="w-1 h-1 rounded-full transition-all"
            style={{ background: isActive ? ACCENT : 'transparent' }}
          />
        </>
      )}
    </NavLink>
  )

  // Desktop nav: Yatras is reachable via the Yatras ▾ menu, so drop it here.
  const desktopNav = navItems.filter(({ navKey }) => navKey !== 'yatras')
  const homeItem = desktopNav.find(({ navKey }) => navKey === 'home')
  const restItems = desktopNav.filter(({ navKey }) => navKey !== 'home')

  return (
    <header
      className={`fixed top-0 left-0 right-0 h-14 items-center px-4 z-40 gap-3 ${showBack || showClose ? 'flex' : 'hidden sm:flex'}`}
      style={{
        // Transparent over the backdrop (Giga-style) — a faint top scrim keeps
        // the nav/logo legible over the photo.
        background: 'linear-gradient(180deg, rgba(30,43,69,0.55) 0%, rgba(30,43,69,0) 100%)',
      }}
    >
      {showClose ? (
        <button onClick={() => navigate(-1)} aria-label="Close" className="btn btn-ghost btn-sm btn-circle text-base-content/70">
          <LuX className="w-5 h-5" />
        </button>
      ) : showBack ? (
        <button onClick={() => navigate(-1)} aria-label="Go back" className="btn btn-ghost btn-sm btn-circle text-base-content/80">
          <FaChevronLeft className="w-4 h-4" />
        </button>
      ) : (
        <Link to="/" className="flex items-center no-underline">
          <img src="/logo.png" className="h-[35px] w-[35px] object-contain" style={{ filter: 'brightness(0) invert(1)' }} alt="Sadhana" />
        </Link>
      )}

      {(showBack || showClose) && title && (
        <h1 className="font-serif font-semibold text-base text-base-content flex-1">{title}</h1>
      )}

      {!showBack && !showClose && (
        <nav className="ml-auto hidden sm:flex items-center gap-2" aria-label="Main navigation">
          {homeItem && renderNavItem(homeItem)}
          {location.pathname === '/' && <HomeHeaderActions />}
          {restItems.map(renderNavItem)}
        </nav>
      )}

      {right && (
        <div className={(showBack || showClose) ? 'ml-auto' : 'ml-2'}>
          {right}
        </div>
      )}
    </header>
  )
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app-react && npx vitest run src/components/layout/TopBar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Build + lint**

Run: `cd app-react && npm run build && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd app-react && git add src/components/layout/TopBar.tsx src/components/layout/TopBar.test.tsx
git commit -m "feat(app-react): header — Home first, Settings back to text"
```

---

### Task 2: Code-split the embedded `ChartsPage` (`DashboardPanel.tsx`)

**Files:**
- Modify: `app-react/src/pages/home/DashboardPanel.tsx`

**Interfaces:**
- Produces: `DashboardPanel` renders the desktop charts column as a lazily-loaded `ChartsPage` behind a `Suspense` fallback, so recharts is no longer on the home route's static import graph.

- [ ] **Step 1: Replace the static ChartsPage import with a lazy one**

In `app-react/src/pages/home/DashboardPanel.tsx`:

(a) Change the React import line
```tsx
import { useState, useEffect } from 'react'
```
to
```tsx
import { useState, useEffect, lazy, Suspense } from 'react'
```

(b) Replace the line
```tsx
import { ChartsPage } from '../charts/ChartsPage'
```
with
```tsx
import { Spinner } from '../../components/ui/Spinner'
```

(c) Immediately after the import block (just before `function toDateStr(d: Date) {`), add:
```tsx
// Charts pull in recharts (~116 KB gzip). Lazy-load them so the practices
// column paints without waiting on that chunk.
const ChartsPage = lazy(() =>
  import('../charts/ChartsPage').then((m) => ({ default: m.ChartsPage })),
)
```

- [ ] **Step 2: Wrap the charts column in Suspense**

Replace
```tsx
      {/* Charts (2/3) — desktop only; top-aligned with the practices column */}
      <div className="hidden lg:block lg:col-span-2">
        <ChartsPage embedded />
      </div>
```
with
```tsx
      {/* Charts (2/3) — desktop only; top-aligned with the practices column.
          Lazy so recharts stays off the initial home critical path. */}
      <div className="hidden lg:block lg:col-span-2">
        <Suspense fallback={<Spinner />}>
          <ChartsPage embedded />
        </Suspense>
      </div>
```

- [ ] **Step 3: Run the home tests (the practices content is above the lazy boundary)**

Run: `cd app-react && npx vitest run src/pages/home/HomePage.test.tsx`
Expected: PASS — the practices content (`Meditation`, Optional divider, etc.) renders without waiting on the charts chunk; the tests already `await screen.findByText('Meditation')`.

- [ ] **Step 4: Verify the split with a production build**

Run: `cd app-react && npm run build 2>&1 | grep -E "ChartsPage|HomePage"`
Expected: `ChartsPage-*.js` is still its own (large) chunk, and the build succeeds. The point is that `HomePage`'s chunk no longer statically depends on it (it now loads on demand). Then `npm run test && npm run lint` — all green.

- [ ] **Step 5: Commit**

```bash
cd app-react && git add src/pages/home/DashboardPanel.tsx
git commit -m "perf(app-react): lazy-load embedded charts (recharts off the home critical path)"
```

---

### Task 3: `DeferUntilVisible` + defer the embedded yatras (`HomePage.tsx`)

**Files:**
- Create: `app-react/src/components/util/DeferUntilVisible.tsx`
- Test: `app-react/src/components/util/DeferUntilVisible.test.tsx`
- Modify: `app-react/src/pages/home/HomePage.tsx`

**Interfaces:**
- Consumes: `Spinner`.
- Produces: `export function DeferUntilVisible({ children, rootMargin?, className? }: { children: ReactNode; rootMargin?: string; className?: string })` — renders `children` once the placeholder scrolls within `rootMargin` of the viewport; renders `children` immediately when `IntersectionObserver` is unavailable.

- [ ] **Step 1: Write the failing test**

Create `app-react/src/components/util/DeferUntilVisible.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { DeferUntilVisible } from './DeferUntilVisible'

afterEach(() => {
  // @ts-expect-error test cleanup of the global we may have set
  delete globalThis.IntersectionObserver
})

describe('DeferUntilVisible', () => {
  it('renders children immediately when IntersectionObserver is unavailable', () => {
    expect(typeof IntersectionObserver).toBe('undefined') // jsdom default
    render(
      <DeferUntilVisible>
        <div>DEFERRED_CONTENT</div>
      </DeferUntilVisible>,
    )
    expect(screen.getByText('DEFERRED_CONTENT')).toBeInTheDocument()
  })

  it('renders a placeholder first, then children after intersection', () => {
    const observe = vi.fn()
    let cb: (entries: { isIntersecting: boolean }[]) => void = () => {}
    // @ts-expect-error minimal IntersectionObserver mock
    globalThis.IntersectionObserver = class {
      constructor(handler: (entries: { isIntersecting: boolean }[]) => void) { cb = handler }
      observe = observe
      disconnect = vi.fn()
    }
    render(
      <DeferUntilVisible>
        <div>LATER</div>
      </DeferUntilVisible>,
    )
    expect(screen.queryByText('LATER')).not.toBeInTheDocument()
    expect(observe).toHaveBeenCalled()
    act(() => cb([{ isIntersecting: true }]))
    expect(screen.getByText('LATER')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app-react && npx vitest run src/components/util/DeferUntilVisible.test.tsx`
Expected: FAIL — `Failed to resolve import './DeferUntilVisible'`.

- [ ] **Step 3: Implement `DeferUntilVisible.tsx`**

Create `app-react/src/components/util/DeferUntilVisible.tsx`:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Renders `children` only once the placeholder scrolls within `rootMargin` of
 * the viewport. Falls back to rendering immediately when IntersectionObserver
 * is unavailable (jsdom / SSR), so tests and non-IO environments still render.
 */
export function DeferUntilVisible({
  children,
  rootMargin = '400px',
  className,
}: {
  children: ReactNode
  rootMargin?: string
  className?: string
}) {
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible, rootMargin])

  if (visible) return <>{children}</>
  return <div ref={ref} className={className} aria-hidden />
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app-react && npx vitest run src/components/util/DeferUntilVisible.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Defer the embedded yatras in `HomePage.tsx`**

Replace the whole file with (only the imports and `HomePage` body change; `SectionLabel`/`DateContextLabel`/`toDateStr` stay verbatim):

```tsx
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardPanel } from './DashboardPanel'
import { DeferUntilVisible } from '../../components/util/DeferUntilVisible'
import { Spinner } from '../../components/ui/Spinner'

const YatrasPage = lazy(() =>
  import('../yatras/YatrasPage').then((m) => ({ default: m.YatrasPage })),
)

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <p className="text-xs font-semibold uppercase tracking-widest flex-shrink-0"
         style={{ color: '#fbbf24' }}>
        {label}
      </p>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.20)' }} />
    </div>
  )
}

export function DateContextLabel({ dateStr }: { dateStr: string }) {
  const todayStr = toDateStr(new Date())
  const yesterday = toDateStr(new Date(Date.now() - 86_400_000))
  const tomorrow  = toDateStr(new Date(Date.now() + 86_400_000))
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'

  let label: string
  if (dateStr === todayStr)        label = t('home.today')
  else if (dateStr === yesterday)  label = t('home.yesterday')
  else if (dateStr === tomorrow)   label = t('home.tomorrow')
  else {
    const d = new Date(dateStr + 'T00:00:00')
    label = d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <p className="text-[11px] font-semibold font-serif uppercase tracking-widest px-1"
       style={{ color: '#fbbf24' }}>
      {label}
    </p>
  )
}

export function HomePage() {
  return (
    <>
      <DashboardPanel />
      <section
        id="home-yatras"
        className="px-4 pb-14 pt-8 lg:pt-12 lg:px-6 max-w-lg lg:max-w-[1400px] mx-auto w-full"
      >
        <DeferUntilVisible>
          <Suspense fallback={<Spinner />}>
            <YatrasPage embedded />
          </Suspense>
        </DeferUntilVisible>
      </section>
    </>
  )
}
```

- [ ] **Step 6: Run the home + full tests**

Run: `cd app-react && npx vitest run src/pages/home/HomePage.test.tsx && npm run test`
Expected: PASS. The `#home-yatras` section still renders; in jsdom `DeferUntilVisible` mounts children immediately (no IntersectionObserver), so the lazy yatras still loads there; the practices assertions are unaffected.

- [ ] **Step 7: Build + lint**

Run: `cd app-react && npm run build && npm run lint`
Expected: clean; a separate `YatrasPage` chunk (already lazy as a route) is loaded on demand rather than statically by `HomePage`.

- [ ] **Step 8: Commit**

```bash
cd app-react && git add src/components/util/DeferUntilVisible.tsx src/components/util/DeferUntilVisible.test.tsx src/pages/home/HomePage.tsx
git commit -m "perf(app-react): defer below-the-fold yatras until scrolled into view"
```

---

### Task 4: Shrink the LCP background image (`bg.jpg`)

**Files:**
- Modify/replace: `app-react/public/bg.jpg` (→ `public/bg.webp`, or a resized `bg.jpg`)
- Modify: `app-react/src/components/layout/AuthBackground.tsx`
- Modify: `app-react/index.html` (the preload link)

**Interfaces:**
- Produces: a smaller full-viewport backdrop asset, referenced from `AuthBackground` and preloaded in `index.html`.

- [ ] **Step 1: Re-encode the background smaller (prefer WebP, fall back to resized JPEG)**

`cwebp`/imagemagick are NOT available; macOS `sips` is. Try WebP first; if `sips` doesn't support WebP on this machine, fall back to a resized/re-compressed JPEG. From `app-react/`:

```bash
# Attempt WebP (max 1920px wide):
sips -s format webp -Z 1920 public/bg.jpg --out public/bg.webp && ls -la public/bg.webp
```

If `public/bg.webp` was created and is meaningfully smaller than the 344 KB original, use the WebP path (Step 2a). If the command failed (WebP unsupported), instead produce a resized/re-compressed JPEG and keep the `.jpg` reference (Step 2b):

```bash
sips -Z 1920 -s formatOptions 65 public/bg.jpg --out public/bg-min.jpg && mv public/bg-min.jpg public/bg.jpg && ls -la public/bg.jpg
```

Record which path you took in your report, with the before/after byte sizes.

- [ ] **Step 2a: If WebP — point the references at `bg.webp`**

In `app-react/src/components/layout/AuthBackground.tsx`, change the backgroundImage url:
```tsx
backgroundImage: "url('/bg.jpg')",
```
to
```tsx
backgroundImage: "url('/bg.webp')",
```

In `app-react/index.html`, change the preload:
```html
<link rel="preload" as="image" href="/bg.jpg" type="image/jpeg" />
```
to
```html
<link rel="preload" as="image" href="/bg.webp" type="image/webp" />
```
Then `git rm public/bg.jpg` (the WebP replaces it) and `git add public/bg.webp`.

- [ ] **Step 2b: If resized JPEG — no reference changes needed**

The `.jpg` path is unchanged (you overwrote `public/bg.jpg` with the smaller version). Nothing to edit in `AuthBackground.tsx` / `index.html`.

- [ ] **Step 3: Build and confirm**

Run: `cd app-react && npm run build && npm run test && npm run lint`
Expected: build succeeds (the referenced asset resolves), tests + lint green. Confirm the new background asset is smaller than the original 344 KB.

- [ ] **Step 4: Commit**

```bash
cd app-react && git add -A
git commit -m "perf(app-react): shrink the LCP background image"
```

---

## Manual verification (after all tasks)

1. `cd app-react && npm run dev`, open the home screen (desktop): the header reads `logo … Home Practices ▾ Yatras ▾ Settings` (Settings is a word again), Yatras is not a nav link.
2. The practices column appears immediately; the charts panel shows a brief spinner then renders (recharts loaded lazily).
3. Scroll down — the yatras section loads (spinner then content) as it comes into view.
4. The background still looks right (smaller asset). For real metrics, run Lighthouse against a **production preview** (`npm run build && npm run preview`), not the dev server.

## Self-Review Notes

- **Spec coverage:** header order Home-first + Settings text (Task 1) ✓; lazy `ChartsPage` (Task 2) ✓; `DeferUntilVisible` + deferred lazy `YatrasPage` with IO-absent immediate fallback (Task 3) ✓; bg image shrink with WebP-or-JPEG fallback + reference updates (Task 4) ✓; measurement-reality note (plan Global Constraints) ✓.
- **Placeholders:** none — full code, exact commands, and the WebP/JPEG branch are all concrete.
- **Type consistency:** `DeferUntilVisible` prop shape matches its use in `HomePage`; `Spinner` import path (`../../components/ui/Spinner`) consistent across `DashboardPanel`/`HomePage`; the `#home-yatras` section id is unchanged from the prior feature; lazy default-export mapping (`.then(m => ({ default: m.X }))`) matches the router's existing pattern.
