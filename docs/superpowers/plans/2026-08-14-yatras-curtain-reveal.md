# Yatras Curtain Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the yatras home section's fade-in with a Giga-style sticky-curtain reveal where the dashboard pins as a one-screen panel and the yatras section rises up over it, dimming and shrinking the covered dashboard.

**Architecture:** A new presentational `CurtainReveal` layout component owns the scroll mechanics (sticky one-screen base, a rising overlay with its own opaque surface, scroll-progress → scale/dim of the base, and a fade-out fab slot). The dashboard grid is extracted from `HomePage` into a `DashboardPanel` so it can serve as the pinned base, and `HomePage` becomes a thin composition of `CurtainReveal` + `DashboardPanel` + `YatrasPage`.

**Tech Stack:** React 19, framer-motion (`useScroll`/`useTransform`/`useReducedMotion`), Tailwind v4, Vitest + React Testing Library.

## Global Constraints

- App lives in `app-react/`. Run all commands from that directory.
- Tests: `npx vitest run <path>` (or `npm run test` for all). Build/type-check: `npm run build` (`tsc -b && vite build`). Lint: `npm run lint` (`oxlint`).
- framer-motion is **aliased to a mock** in tests (`vitest.config.ts` → `src/test/mocks/framer-motion.tsx`). Any framer-motion API a component imports MUST also be exported by that mock or tests fail on undefined imports.
- No `tailwind-merge`/`clsx`/`cn` helper exists in this project — merge optional `className` with plain string concatenation.
- Follow the codebase convention of inline `style` with `rgba(...)` values for colors/shadows (see `theme/tokens.ts`; navy base is `#1e2b45`).
- JSX uses the automatic runtime — do not add `import React`. For React types, import them by name (e.g. `import { type ReactNode } from 'react'`).
- Keep `SectionLabel` and `DateContextLabel` exported from `HomePage.tsx` (imported by `HomePage.test.tsx`). Do not remove them.
- No new i18n strings. No changes to `YatrasPage`/`ChartsPage` internals, `AppShell`, or the background.
- Approved visual values: base `scale` 1 → 0.94, `filter` `brightness(1)` → `brightness(0.55)`, fab opacity fades between 40%–60% coverage. Overlay surface: `rgba(20,28,45,0.92)` + `blur(20px)`, `rounded-t-3xl`, top hairline `rgba(255,255,255,0.10)`, lift shadow `0 -24px 60px rgba(0,0,0,0.45)`.

---

### Task 1: `CurtainReveal` component (+ framer-motion mock extension)

**Files:**
- Modify: `app-react/src/test/mocks/framer-motion.tsx` (add `useScroll`, `useReducedMotion`, `__setReducedMotion`)
- Create: `app-react/src/components/layout/CurtainReveal.tsx`
- Test: `app-react/src/components/layout/CurtainReveal.test.tsx`

**Interfaces:**
- Consumes: framer-motion mock exports `motion`, `useTransform`, `useMotionValue` (existing) plus new `useScroll`, `useReducedMotion`, `__setReducedMotion`.
- Produces: `export function CurtainReveal(props: { base: ReactNode; overlay: ReactNode; fab?: ReactNode; className?: string }): JSX.Element`. Renders `base` inside a `sticky top-0 h-[100svh]` wrapper, `overlay` inside a `rounded-t-3xl` curtain surface, and optional `fab` verbatim.

- [ ] **Step 1: Extend the framer-motion test mock**

Append to `app-react/src/test/mocks/framer-motion.tsx` (after the existing `useTransform` export). `useMotionValue` is already defined above in the same file.

```tsx
export const useScroll = () => ({ scrollYProgress: useMotionValue(0) })

// Reduced-motion is toggled from tests via __setReducedMotion; default is off.
let __reducedMotion = false
export const __setReducedMotion = (v: boolean) => {
  __reducedMotion = v
}
export const useReducedMotion = () => __reducedMotion
```

- [ ] **Step 2: Write the failing test**

Create `app-react/src/components/layout/CurtainReveal.test.tsx`. It imports `__setReducedMotion` directly from the mock file path (the real `framer-motion` types don't declare it); the alias makes it the same module instance the component sees.

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { __setReducedMotion } from '../../test/mocks/framer-motion'
import { CurtainReveal } from './CurtainReveal'

afterEach(() => __setReducedMotion(false))

describe('CurtainReveal', () => {
  it('renders both the base and overlay content', () => {
    render(<CurtainReveal base={<div>BASE_CONTENT</div>} overlay={<div>OVERLAY_CONTENT</div>} />)
    expect(screen.getByText('BASE_CONTENT')).toBeInTheDocument()
    expect(screen.getByText('OVERLAY_CONTENT')).toBeInTheDocument()
  })

  it('pins the base as a one-screen sticky panel', () => {
    const { container } = render(<CurtainReveal base={<div>BASE</div>} overlay={<div>OVER</div>} />)
    const sticky = container.querySelector('.sticky')
    expect(sticky).not.toBeNull()
    expect(sticky?.className).toContain('top-0')
    expect(sticky?.className).toContain('h-[100svh]')
  })

  it('gives the overlay a rounded-top curtain surface', () => {
    const { container } = render(<CurtainReveal base={<div>BASE</div>} overlay={<div>OVER</div>} />)
    expect(container.querySelector('.rounded-t-3xl')).not.toBeNull()
  })

  it('renders the optional fab slot', () => {
    render(
      <CurtainReveal base={<div>BASE</div>} overlay={<div>OVER</div>} fab={<button>FAB</button>} />,
    )
    expect(screen.getByRole('button', { name: 'FAB' })).toBeInTheDocument()
  })

  it('still renders both panels under reduced motion', () => {
    __setReducedMotion(true)
    render(<CurtainReveal base={<div>BASE_RM</div>} overlay={<div>OVER_RM</div>} />)
    expect(screen.getByText('BASE_RM')).toBeInTheDocument()
    expect(screen.getByText('OVER_RM')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd app-react && npx vitest run src/components/layout/CurtainReveal.test.tsx`
Expected: FAIL — `Failed to resolve import './CurtainReveal'` (component does not exist yet).

- [ ] **Step 4: Implement `CurtainReveal`**

Create `app-react/src/components/layout/CurtainReveal.tsx`:

```tsx
import { useRef, type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'

interface CurtainRevealProps {
  /** Pinned one-screen base panel; recedes (scales + dims) as the curtain rises. */
  base: ReactNode
  /** Panel that rises up and covers the base like a curtain. */
  overlay: ReactNode
  /** Optional fixed-position controls (e.g. FABs) that fade out as the curtain covers the base. */
  fab?: ReactNode
  className?: string
}

export function CurtainReveal({ base, overlay, fab, className }: CurtainRevealProps) {
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
  const fabOpacity = useTransform(scrollYProgress, [0.4, 0.6], [1, 0])

  return (
    <div className={'relative' + (className ? ' ' + className : '')}>
      {/* Base — pinned one-screen panel */}
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <motion.div
          className="h-full"
          style={reduce ? undefined : { scale, filter, transformOrigin: 'center 40%' }}
        >
          <div className="h-full overflow-y-auto overscroll-contain">{base}</div>
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

      {/* FABs — fade out as the curtain covers the base (they act on the now-hidden dashboard) */}
      {fab && (
        <motion.div style={reduce ? undefined : { opacity: fabOpacity }}>{fab}</motion.div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd app-react && npx vitest run src/components/layout/CurtainReveal.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Type-check and lint**

Run: `cd app-react && npm run build && npm run lint`
Expected: build succeeds, lint clean.

- [ ] **Step 7: Commit**

```bash
cd app-react && git add src/components/layout/CurtainReveal.tsx src/components/layout/CurtainReveal.test.tsx src/test/mocks/framer-motion.tsx
git commit -m "feat(app-react): CurtainReveal — Giga-style sticky-curtain reveal primitive

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Extract `DashboardPanel` and rewire `HomePage`

**Files:**
- Create: `app-react/src/pages/home/DashboardPanel.tsx`
- Modify: `app-react/src/pages/home/HomePage.tsx` (replace the render body; keep `SectionLabel`, `DateContextLabel`, `toDateStr`)
- Test: `app-react/src/pages/home/HomePage.test.tsx` (should stay green unmodified; add one composition assertion)

**Interfaces:**
- Consumes: `CurtainReveal` from Task 1 (`{ base, overlay, fab }`); `YatrasPage` (`embedded` prop); `ChartsPage` (`embedded` prop).
- Produces: `export function DashboardPanel(): JSX.Element` — the practices column + desktop-only charts grid (the current `HomePage` grid, verbatim, minus the yatras section and FABs). `HomePage` still exports `HomePage`, `SectionLabel`, `DateContextLabel`.

- [ ] **Step 1: Write the failing test**

Add this test to the existing `describe('HomePage', ...)` block in `app-react/src/pages/home/HomePage.test.tsx` (the `wrap`, mocks, and `beforeEach` already exist in that file):

```tsx
  it('renders the yatras section as the curtain overlay below the dashboard', async () => {
    wrap(<HomePage />)
    // Dashboard (base) content renders…
    await screen.findByText('Meditation')
    // …and the yatras overlay surface is present (rounded-top curtain).
    const { container } = wrap(<HomePage />)
    expect(container.querySelector('.rounded-t-3xl')).not.toBeNull()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app-react && npx vitest run src/pages/home/HomePage.test.tsx`
Expected: FAIL — no `.rounded-t-3xl` element yet (HomePage still uses the old `motion.section`).

- [ ] **Step 3: Create `DashboardPanel`**

Create `app-react/src/pages/home/DashboardPanel.tsx` (this is the current `HomePage` grid + its data hooks, moved verbatim):

```tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { LuWifiOff } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { practicesApi } from '../../api/practices'
import { ACCENT, ACCENT_GRADIENT } from '../../theme/tokens'
import { PracticeCard } from './PracticeCard'
import { ChartsPage } from '../charts/ChartsPage'
import { WeekCalendar, getWeekDays } from './WeekCalendar'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import useNetworkStatus from '../../hooks/useNetworkStatus'
import type { PracticeDataType } from '../../types/api'

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

const STARTER_PRACTICES: { practice: string; data_type: PracticeDataType }[] = [
  { practice: 'Wake up time',     data_type: 'Time'     },
  { practice: 'Go to sleep time', data_type: 'Time'     },
  { practice: 'Reading',          data_type: 'Bool'     },
  { practice: 'Meditation',       data_type: 'Duration' },
  { practice: 'Yoga',             data_type: 'Duration' },
]

export function DashboardPanel() {
  const { t } = useTranslation()
  const [date, setDate] = useState(new Date())
  const isOnline = useNetworkStatus()
  const qc = useQueryClient()

  const dateStr = toDateStr(date)

  const practicesQuery = useQuery({
    queryKey: ['practices'],
    queryFn: practicesApi.getUserPractices,
  })
  const diaryQuery = useQuery({
    queryKey: ['diary', dateStr],
    queryFn: () => practicesApi.getDiaryEntries(dateStr),
  })

  const seedMutation = useMutation({
    mutationFn: async () => {
      for (const p of STARTER_PRACTICES) {
        await practicesApi.createUserPractice(p).catch(() => {})
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practices'] }),
  })

  const activePractices = (practicesQuery.data ?? []).filter((p) => p.is_active)
  const valueMap = Object.fromEntries(
    (diaryQuery.data ?? []).map((e) => [e.practice, e.value]),
  )

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        qc.invalidateQueries({ queryKey: ['diary', dateStr] })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [qc, dateStr])

  useEffect(() => {
    const week = getWeekDays(date)
    for (const day of week) {
      const ds = toDateStr(day)
      if (ds !== dateStr) {
        qc.prefetchQuery({
          queryKey: ['diary', ds],
          queryFn: () => practicesApi.getDiaryEntries(ds),
          staleTime: 60_000,
        })
      }
    }
  }, [date, qc, dateStr])

  const required = activePractices.filter((p) => p.is_required)
  const optional = activePractices.filter((p) => !p.is_required)

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start lg:max-w-[1400px] lg:mx-auto lg:px-6 lg:py-4">
      <div className="px-4 py-4 max-w-lg mx-auto w-full lg:max-w-none lg:mx-0 lg:px-0 lg:py-0 lg:col-span-1 flex flex-col gap-3">
        {/* Offline banner */}
        {!isOnline && (
          <div
            className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
            style={{
              background: 'rgba(251,191,36,0.10)',
              border: '1px solid rgba(251,191,36,0.25)',
              color: '#fbbf24',
            }}
          >
            <LuWifiOff className="w-4 h-4 flex-shrink-0" style={{ color: '#fbbf24' }} />
            {t('home.offline')}
          </div>
        )}

        {/* Week calendar */}
        <WeekCalendar date={date} onDateChange={setDate} />

        {/* Practice cards — skeletons hold layout while loading to prevent jump */}
        <div className="flex flex-col gap-3">
          {(practicesQuery.isLoading || diaryQuery.isLoading) ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl px-4 min-h-[60px] flex items-center gap-3 animate-pulse"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                }}
              >
                <div className="w-8 h-8 rounded-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="h-3.5 rounded-full flex-1" style={{ background: 'rgba(255,255,255,0.08)', maxWidth: '55%' }} />
                <div className="w-12 h-6 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
              </div>
            ))
          ) : (diaryQuery.isError || practicesQuery.isError) ? (
            <ErrorBanner message={t('common.error')} />
          ) : (
            <>
              {required.map((p) => (
                <PracticeCard key={p.id + '-' + dateStr} practice={p} date={dateStr} currentValue={valueMap[p.practice]} />
              ))}
              {optional.map((p) => (
                <PracticeCard key={p.id + '-' + dateStr} practice={p} date={dateStr} currentValue={valueMap[p.practice]} />
              ))}
            </>
          )}

          {/* Empty state */}
          {!practicesQuery.isLoading && !practicesQuery.isError && activePractices.length === 0 && (
            <div className="text-center py-12 flex flex-col items-center gap-4">
              <p className="text-base-content/60 text-sm">{t('home.noPractices')}</p>

              {/* Seed defaults */}
              <button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="px-6 h-11 rounded-full text-sm font-semibold flex items-center gap-2"
                style={{
                  background: ACCENT_GRADIENT,
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(200,114,74,0.35)',
                }}
              >
                {seedMutation.isPending && <span className="loading loading-spinner loading-xs" />}
                {t('home.addStarters')}
              </button>

              <Link to="/user/practice/new" className="text-sm font-medium" style={{ color: ACCENT }}>
                {t('home.addCustom')}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Charts (2/3) — desktop only; top-aligned with the practices column */}
      <div className="hidden lg:block lg:col-span-2">
        <ChartsPage embedded />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rewrite `HomePage` as a `CurtainReveal` composition**

Replace the entire contents of `app-react/src/pages/home/HomePage.tsx` with the following. `SectionLabel`, `DateContextLabel`, and `toDateStr` are preserved verbatim (only the imports and the `HomePage` function body change):

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FaPlus, FaSlidersH } from 'react-icons/fa'
import { ACCENT, ACCENT_GRADIENT } from '../../theme/tokens'
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
  const { t } = useTranslation()

  return (
    <CurtainReveal
      base={<DashboardPanel />}
      overlay={<YatrasPage embedded />}
      fab={
        <div className="fixed left-4 bottom-6 z-30 hidden sm:flex flex-col gap-3">
          <Link
            to="/user/practices"
            aria-label={t('settings.myPractices')}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            <FaSlidersH className="w-5 h-5" style={{ color: ACCENT }} />
          </Link>
          <Link
            to="/user/practice/new"
            aria-label={t('practice.new')}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: ACCENT_GRADIENT, boxShadow: '0 4px 24px rgba(200,114,74,0.45)' }}
          >
            <FaPlus className="w-5 h-5 text-white" />
          </Link>
        </div>
      }
    />
  )
}
```

- [ ] **Step 5: Run the home tests to verify they pass**

Run: `cd app-react && npx vitest run src/pages/home/HomePage.test.tsx`
Expected: PASS — the pre-existing tests (Optional divider, 7-day diary fetch, nothing-logged, SectionLabel, DateContextLabel) plus the new overlay assertion all pass. The dashboard content still renders (as the `CurtainReveal` base) and the yatras overlay now provides the `.rounded-t-3xl` surface.

- [ ] **Step 6: Run the full suite, type-check, and lint**

Run: `cd app-react && npm run test && npm run build && npm run lint`
Expected: all tests pass, build succeeds, lint clean. (Confirms no other importer of `HomePage` broke and there are no unused imports.)

- [ ] **Step 7: Commit**

```bash
cd app-react && git add src/pages/home/DashboardPanel.tsx src/pages/home/HomePage.tsx src/pages/home/HomePage.test.tsx
git commit -m "feat(app-react): yatras home section — sticky-curtain reveal over pinned dashboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Manual verification (after both tasks)

Run the app (`cd app-react && npm run dev`) and on the home screen:
1. Scroll down — the dashboard should stay pinned for one screen while the yatras panel rises up over it with a rounded top edge and lift shadow.
2. The pinned dashboard should visibly shrink slightly and dim as it's covered.
3. The bottom-left practice FABs should fade out as the curtain covers the dashboard.
4. With OS "Reduce motion" enabled, the yatras panel should simply sit below the dashboard with no scale/dim (no broken layout).

## Self-Review Notes

- **Spec coverage:** sticky one-screen base (Task 1 `CurtainReveal` + Task 2 base) ✓; rising curtain with opaque rounded surface (Task 1) ✓; scale+dim of covered base (Task 1, values from Global Constraints) ✓; overlay-anchored scroll progress `['start end','start start']` (Task 1) ✓; inner `overflow-y-auto overscroll-contain` for tall content (Task 1) ✓; reduced-motion static fallback (Task 1) ✓; FAB fade at ~40–60% (Task 1 + Task 2 fab slot) ✓; `DashboardPanel` extraction (Task 2) ✓; tests via existing mock + i18n setup, extended for `useScroll`/`useReducedMotion` (Task 1) ✓; no new i18n strings ✓.
- **Placeholders:** none — all code blocks are complete and copy-paste ready.
- **Type consistency:** `CurtainReveal` prop names (`base`, `overlay`, `fab`, `className`) match their usage in `HomePage`; `DashboardPanel` and `YatrasPage`/`ChartsPage embedded` signatures match; mock export names (`useScroll`, `useReducedMotion`, `__setReducedMotion`) match component and test imports.
