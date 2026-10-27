# Home Header Actions + Curtain Scroll Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home curtain scroll (so yatras is reachable) and replace the floating home FABs with header actions — a `Practices ▾` dropdown and a `New report` button.

**Architecture:** Remove the `overscroll-contain` that traps the page scroll in `CurtainReveal`, and drop its now-unused `fab` slot. Delete the FABs from `HomePage`. Add a small controlled-dropdown `HomeHeaderActions` component and render it in `TopBar` only on the home route.

**Tech Stack:** React 19, framer-motion, react-router v7, Tailwind v4, i18next (JSON locale files), Vitest + React Testing Library.

## Global Constraints

- App is in `app-react/`; run all commands from there. Tests: `npx vitest run <path>` (or `npm run test`). Build: `npm run build`. Lint: `npm run lint` (`oxlint`).
- framer-motion is aliased to a mock in tests (`vitest.config.ts` → `src/test/mocks/framer-motion.tsx`); it already exports `motion`, `useScroll`, `useTransform`, `useReducedMotion`, `__setReducedMotion`.
- JSX auto-runtime — no `import React`. `oxlint` fails on unused imports.
- i18n discipline: any new string key must be added to ALL three production locales (`public/locales/{en,ru,uk}/translation.json`) AND the inline resources in `src/test/setup.ts`.
- Reuse the existing `charts.newReport` key ("New report" / "Новый отчёт" / "Новий звіт") for the report button — do NOT add a new key for it.
- The header (`TopBar`) is `hidden sm:flex`, so anything rendered in it is desktop-only. Home actions must be desktop-only (matching the FABs they replace); mobile is unchanged.
- Existing routes to reuse: add practice `/user/practice/new`, edit practices `/user/practices`, new report `/charts/new`.
- The standalone `/charts` page keeps its own `!embedded` new-report FAB — do not touch it.

---

### Task 1: Fix the scroll + remove the FABs

**Files:**
- Modify: `app-react/src/components/layout/CurtainReveal.tsx` (remove `overscroll-contain`; remove the `fab` prop, `fabOpacity`, and fab rendering)
- Modify: `app-react/src/components/layout/CurtainReveal.test.tsx` (remove the fab-slot test)
- Modify: `app-react/src/pages/home/HomePage.tsx` (remove the `fab={…}` block + now-unused imports)

**Interfaces:**
- Produces: `CurtainReveal` now has API `{ base: ReactNode; overlay: ReactNode; className?: string }` (no `fab`).

- [ ] **Step 1: Update the CurtainReveal test (remove the fab-slot case)**

In `CurtainReveal.test.tsx`, delete this entire `it(...)` block:

```tsx
  it('renders the optional fab slot', () => {
    render(
      <CurtainReveal base={<div>BASE</div>} overlay={<div>OVER</div>} fab={<button>FAB</button>} />,
    )
    expect(screen.getByRole('button', { name: 'FAB' })).toBeInTheDocument()
  })
```

Leave the other four tests (`renders both…`, `pins the base…`, `gives the overlay…`, `still renders both panels under reduced motion`) unchanged.

- [ ] **Step 2: Rewrite `CurtainReveal.tsx`**

Replace the whole file with:

```tsx
import { useRef, type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'

interface CurtainRevealProps {
  /** Pinned one-screen base panel; recedes (scales + dims) as the curtain rises. */
  base: ReactNode
  /** Panel that rises up and covers the base like a curtain. */
  overlay: ReactNode
  className?: string
}

export function CurtainReveal({ base, overlay, className }: CurtainRevealProps) {
  const reduce = useReducedMotion()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Progress 0 → 1 as the overlay rises across exactly one viewport:
  //   0 = overlay top at viewport bottom (curtain about to rise)
  //   1 = overlay top at viewport top   (base fully covered)
  const { scrollYProgress } = useScroll({
    target: overlayRef,
    offset: ['start end', 'start start'],
  })
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.94])
  const filter = useTransform(scrollYProgress, [0, 1], ['brightness(1)', 'brightness(0.55)'])

  return (
    <div className={'relative' + (className ? ' ' + className : '')}>
      {/* Base — pinned one-screen panel. The inner area scrolls when the dashboard
          is taller than one screen, and chains to the window at its boundary so the
          page keeps scrolling and the curtain can rise (no overscroll-contain). */}
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <motion.div
          className="h-full"
          style={reduce ? undefined : { scale, filter, transformOrigin: 'center 40%' }}
        >
          <div className="h-full overflow-y-auto">{base}</div>
        </motion.div>
      </div>

      {/* Overlay — the rising curtain, with its own opaque surface so it truly covers the base */}
      <div ref={overlayRef} className="relative z-10">
        <div
          className="rounded-t-3xl px-4 pb-14 pt-8 lg:pt-16 lg:px-6"
          style={{
            background: 'rgba(20,28,45,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 -24px 60px rgba(0,0,0,0.45)',
          }}
        >
          <div className="max-w-lg lg:max-w-[1400px] mx-auto w-full">{overlay}</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `HomePage.tsx` (drop the FABs + unused imports)**

Replace the whole file with (note: `SectionLabel`, `DateContextLabel`, `toDateStr` are unchanged; only the imports and `HomePage` body change):

```tsx
import { useTranslation } from 'react-i18next'
import { CurtainReveal } from '../../components/layout/CurtainReveal'
import { DashboardPanel } from './DashboardPanel'
import { YatrasPage } from '../yatras/YatrasPage'

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
    <CurtainReveal base={<DashboardPanel />} overlay={<YatrasPage embedded />} />
  )
}
```

- [ ] **Step 4: Run the affected tests**

Run: `cd app-react && npx vitest run src/components/layout/CurtainReveal.test.tsx src/pages/home/HomePage.test.tsx`
Expected: PASS. `CurtainReveal` = 4 tests; `HomePage` tests still green (they assert dashboard content + the `.rounded-t-3xl` overlay, both unaffected).

- [ ] **Step 5: Build + lint (catches any leftover unused import)**

Run: `cd app-react && npm run build && npm run lint`
Expected: clean. (Confirms `Link`, `FaPlus`, `FaSlidersH`, `ACCENT`, `ACCENT_GRADIENT` are no longer imported anywhere they're unused.)

- [ ] **Step 6: Commit**

```bash
cd app-react && git add src/components/layout/CurtainReveal.tsx src/components/layout/CurtainReveal.test.tsx src/pages/home/HomePage.tsx
git commit -m "fix(app-react): home curtain scrolls (drop overscroll-contain) + remove home FABs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `HomeHeaderActions` component + i18n keys

**Files:**
- Create: `app-react/src/components/layout/HomeHeaderActions.tsx`
- Create: `app-react/src/components/layout/HomeHeaderActions.test.tsx`
- Modify: `app-react/public/locales/en/translation.json`, `.../ru/translation.json`, `.../uk/translation.json`
- Modify: `app-react/src/test/setup.ts`

**Interfaces:**
- Consumes: i18n keys `home.practicesMenu`, `home.addPractice`, `home.editPractices` (added here) and existing `charts.newReport`.
- Produces: `export function HomeHeaderActions(): JSX.Element` — a `Practices ▾` dropdown (Add new practice → `/user/practice/new`, Edit practices → `/user/practices`) + a `New report` link → `/charts/new`.

- [ ] **Step 1: Add the i18n keys to all three locale files**

In each `public/locales/<lng>/translation.json`, insert three keys as the first entries of the `"home"` object. The anchor `  "home": {` (two-space indent, brace) is identical in all three files.

`en` — replace `  "home": {\n` with:
```
  "home": {
    "practicesMenu": "Practices",
    "addPractice": "Add new practice",
    "editPractices": "Edit practices",
```

`ru` — replace `  "home": {\n` with:
```
  "home": {
    "practicesMenu": "Практики",
    "addPractice": "Добавить практику",
    "editPractices": "Изменить практики",
```

`uk` — replace `  "home": {\n` with:
```
  "home": {
    "practicesMenu": "Практики",
    "addPractice": "Додати практику",
    "editPractices": "Редагувати практики",
```

- [ ] **Step 2: Add the same keys to the test i18n resources**

In `src/test/setup.ts`, inside the `home: { … }` block, after the line `noPractices: 'No practices yet',` add:
```
            practicesMenu: 'Practices',
            addPractice: 'Add new practice',
            editPractices: 'Edit practices',
```
(`charts.newReport: 'New report'` is already present in this file.)

- [ ] **Step 3: Write the failing test**

Create `app-react/src/components/layout/HomeHeaderActions.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { HomeHeaderActions } from './HomeHeaderActions'

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('HomeHeaderActions', () => {
  it('links "New report" to /charts/new', () => {
    wrap(<HomeHeaderActions />)
    expect(screen.getByRole('link', { name: 'New report' })).toHaveAttribute('href', '/charts/new')
  })

  it('opens the Practices menu to add/edit links', () => {
    wrap(<HomeHeaderActions />)
    // Menu is closed until the trigger is clicked.
    expect(screen.queryByRole('menuitem', { name: 'Add new practice' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Practices/ }))
    expect(screen.getByRole('menuitem', { name: 'Add new practice' })).toHaveAttribute('href', '/user/practice/new')
    expect(screen.getByRole('menuitem', { name: 'Edit practices' })).toHaveAttribute('href', '/user/practices')
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd app-react && npx vitest run src/components/layout/HomeHeaderActions.test.tsx`
Expected: FAIL — `Failed to resolve import './HomeHeaderActions'`.

- [ ] **Step 5: Implement `HomeHeaderActions.tsx`**

Create `app-react/src/components/layout/HomeHeaderActions.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FaChevronDown } from 'react-icons/fa'
import { ACCENT } from '../../theme/tokens'

const pill =
  'h-9 px-3 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors no-underline'
const glassPill = {
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.85)',
} as const
const menuItem = 'px-4 py-2.5 text-sm no-underline hover:bg-white/10'

export function HomeHeaderActions() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={pill}
          style={glassPill}
        >
          {t('home.practicesMenu')}
          <FaChevronDown className="w-3 h-3 opacity-70" />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute left-0 mt-2 min-w-44 rounded-xl overflow-hidden z-50 flex flex-col"
            style={{
              background: 'rgba(20,28,45,0.96)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            }}
          >
            <Link
              role="menuitem"
              to="/user/practice/new"
              onClick={() => setOpen(false)}
              className={menuItem}
              style={{ color: 'rgba(255,255,255,0.85)' }}
            >
              {t('home.addPractice')}
            </Link>
            <Link
              role="menuitem"
              to="/user/practices"
              onClick={() => setOpen(false)}
              className={menuItem}
              style={{ color: 'rgba(255,255,255,0.85)' }}
            >
              {t('home.editPractices')}
            </Link>
          </div>
        )}
      </div>

      <Link
        to="/charts/new"
        className={pill}
        style={{ background: ACCENT, border: '1px solid transparent', color: 'white' }}
      >
        {t('charts.newReport')}
      </Link>
    </div>
  )
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd app-react && npx vitest run src/components/layout/HomeHeaderActions.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Build + lint**

Run: `cd app-react && npm run build && npm run lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
cd app-react && git add src/components/layout/HomeHeaderActions.tsx src/components/layout/HomeHeaderActions.test.tsx public/locales/en/translation.json public/locales/ru/translation.json public/locales/uk/translation.json src/test/setup.ts
git commit -m "feat(app-react): HomeHeaderActions — Practices menu + New report button

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire `HomeHeaderActions` into `TopBar` (home route only)

**Files:**
- Modify: `app-react/src/components/layout/TopBar.tsx`
- Create: `app-react/src/components/layout/TopBar.test.tsx`

**Interfaces:**
- Consumes: `HomeHeaderActions` from Task 2.

- [ ] **Step 1: Write the failing test**

Create `app-react/src/components/layout/TopBar.test.tsx`:

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

describe('TopBar home actions', () => {
  it('shows the home actions on the home route', () => {
    wrapAt('/')
    expect(screen.getByRole('link', { name: 'New report' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Practices/ })).toBeInTheDocument()
  })

  it('hides the home actions on other routes', () => {
    wrapAt('/yatras')
    expect(screen.queryByRole('link', { name: 'New report' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Practices/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app-react && npx vitest run src/components/layout/TopBar.test.tsx`
Expected: FAIL — no `New report` link is rendered by `TopBar` yet.

- [ ] **Step 3: Wire `HomeHeaderActions` into `TopBar.tsx`**

Make three edits to `src/components/layout/TopBar.tsx`:

(a) Add `useLocation` to the existing react-router import:
```tsx
import { useNavigate, useLocation, NavLink, Link } from 'react-router-dom'
```

(b) Add the component import (next to the other layout imports, e.g. after the `navItems` import):
```tsx
import { HomeHeaderActions } from './HomeHeaderActions'
```

(c) Inside the component body, read the location:
```tsx
  const navigate = useNavigate()
  const location = useLocation()
```
and render the actions right before the `<nav …>` block. Insert this immediately above the existing `{!showBack && !showClose && (` line that opens the `<nav>`:
```tsx
      {!showBack && !showClose && location.pathname === '/' && (
        <div className="ml-2">
          <HomeHeaderActions />
        </div>
      )}
```

(The header is already `hidden sm:flex`, so these actions are desktop-only. The `<nav>` keeps its `ml-auto`, so it stays right-aligned while the actions sit left.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app-react && npx vitest run src/components/layout/TopBar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Full suite + build + lint**

Run: `cd app-react && npm run test && npm run build && npm run lint`
Expected: all tests pass, build + lint clean.

- [ ] **Step 6: Commit**

```bash
cd app-react && git add src/components/layout/TopBar.tsx src/components/layout/TopBar.test.tsx
git commit -m "feat(app-react): show Practices menu + New report in the home header

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Manual verification (after all tasks)

`cd app-react && npm run dev`, open the home screen (desktop width):
1. **Scroll** — the page now scrolls; the yatras curtain rises over the dashboard (fits → immediate; tall → scroll the dashboard first, then it rises).
2. The old bottom-left/bottom-right FABs are **gone**.
3. The header shows **Practices ▾** (Add new practice / Edit practices) and **New report**; the menu opens on click, closes on outside click, and each item navigates to the right page.
4. The standalone `/charts` page still shows its own bottom-right new-report FAB.

## Self-Review Notes

- **Spec coverage:** scroll fix via removing `overscroll-contain` (Task 1) ✓; remove `CurtainReveal.fab` slot (Task 1) ✓; remove home FABs + unused imports (Task 1) ✓; `HomeHeaderActions` with Practices dropdown (add/edit) + New report (Task 2) ✓; reuse `charts.newReport`, add 3 `home.*` keys to 3 locales + setup.ts (Task 2) ✓; wire into `TopBar` gated to `/`, desktop-only (Task 3) ✓; tests for HomeHeaderActions, TopBar gating, CurtainReveal fab-case removed, HomePage stays green (Tasks 1–3) ✓; standalone `/charts` FAB untouched ✓.
- **Deviation from spec:** the spec suggested "daisyUI dropdown classes," but the app uses no daisyUI dropdowns; Task 2 implements a controlled dropdown (React state + outside-click close), consistent with the app's custom-styled components and directly testable. This is an intentional, minor improvement.
- **Placeholders:** none — all code and i18n values are complete.
- **Type consistency:** `CurtainReveal` prop set `{ base, overlay, className? }` matches its single consumer `HomePage`; `HomeHeaderActions` (no props) matches its `TopBar` usage; i18n key names (`home.practicesMenu`, `home.addPractice`, `home.editPractices`, `charts.newReport`) match between the locale files, `setup.ts`, and the component.
