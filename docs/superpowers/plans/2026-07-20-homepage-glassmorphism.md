# Home Page Glassmorphism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the home page (daily practice tracker) with a full-bleed photo background, frosted glass practice cards, and glass TopBar/BottomNav — visually matching the auth screens.

**Architecture:** The background photo is applied as a fixed layer inside `AppShell` so the glass `TopBar` and `BottomNav` (both `position: fixed`) show it behind them. `PracticeCard` and `HomePage` are restyled with glassmorphism tokens; all behavior/data flow is unchanged.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, DaisyUI v5, React Query, React Router v6, Vitest + Testing Library

## Global Constraints

- Background image: `/login-bg.jpg` (already in `app-react/public/`)
- Dark overlay: `rgba(0,0,0,0.30)` — identical to auth pages
- Glass card token: `background: rgba(255,255,255,0.55)`, `backdropFilter: blur(32px)`, `border: 1px solid rgba(255,255,255,0.75)`, `boxShadow: 0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9)`, `borderRadius: 1.25rem`
- Glass bar token: `background: rgba(255,255,255,0.45)`, `backdropFilter: blur(24px)`, `WebkitBackdropFilter: blur(24px)`
- Glass input token: `background: rgba(255,255,255,0.6)`, `border: 1px solid rgba(0,0,0,0.10)`, `borderRadius: 0.75rem`
- Teal gradient: `linear-gradient(135deg, #02c9a3 0%, #01a386 100%)`, text `#134e4a`, shadow `0 4px 20px rgba(45,212,191,0.35)`
- Teal accent: `#01a386`
- No new npm packages; no API changes; no behavior changes

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/layout/AppShell.tsx` | Modify | Fixed photo background layer |
| `src/components/layout/TopBar.tsx` | Modify | Glass bar styling |
| `src/components/layout/BottomNav.tsx` | Modify | Glass bar + teal active color |
| `src/pages/home/HomePage.tsx` | Modify | Date nav, offline banner, empty state, FAB |
| `src/pages/home/PracticeCard.tsx` | Modify | Glass card + glass inputs per data type |
| `src/pages/auth/LoginPage.tsx` | Modify | Add `id`/`htmlFor` to fix `getByLabelText` in tests |
| `src/pages/auth/RegisterPage.tsx` | Modify | Add `id`/`htmlFor` to fix `getByLabelText` in tests |
| `src/components/layout/BottomNav.test.tsx` | Modify | Fix stale `text-gold` assertion → `aria-current` |
| `src/components/ui/Button.test.tsx` | Modify | Fix spinner assertion (DaisyUI uses `<span>`, not `<svg>`) |

---

## Task 1: Fix pre-existing test regressions

Seven tests currently fail due to regressions from the auth page redesign. Fix them before touching any visual code so the baseline is green.

**Files:**
- Modify: `src/pages/auth/LoginPage.tsx`
- Modify: `src/pages/auth/RegisterPage.tsx`
- Modify: `src/components/layout/BottomNav.test.tsx`
- Modify: `src/components/ui/Button.test.tsx`

**Root causes:**
1. `LoginPage` / `RegisterPage`: custom `<label>` elements have no `htmlFor`, inputs have no `id` → `getByLabelText` can't find them.
2. `BottomNav.test`: asserts `toHaveClass('text-gold')` but the component uses `text-primary`. Fix the test to assert `aria-current="page"` (NavLink sets this automatically on active links).
3. `Button.test`: asserts `querySelector('svg')` but DaisyUI's `loading-spinner` is a `<span>`. Fix to check for the loading `<span>`.

- [ ] **Step 1: Add `id`/`htmlFor` to LoginPage inputs**

In `src/pages/auth/LoginPage.tsx`, change the email label + input:

```tsx
// Email label — add htmlFor
<label htmlFor="email" className="text-xs font-medium text-base-content/50 uppercase tracking-wider">
  {t('auth.email')}
</label>
<input
  id="email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  autoComplete="email"
  placeholder="you@example.com"
  className="w-full h-12 px-4 rounded-xl text-base-content placeholder:text-base-content/30 text-sm focus:outline-none transition-colors"
  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.10)' }}
  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
  onBlur={e => (e.target.style.borderColor = 'rgba(0,0,0,0.10)')}
/>
```

And the password label + input:

```tsx
// Password label — add htmlFor
<label htmlFor="password" className="text-xs font-medium text-base-content/50 uppercase tracking-wider">
  {t('auth.password')}
</label>
<input
  id="password"
  type={showPassword ? 'text' : 'password'}
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  autoComplete="current-password"
  className="w-full h-12 px-4 pr-16 rounded-xl text-base-content text-sm focus:outline-none transition-colors"
  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.10)' }}
  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
  onBlur={e => (e.target.style.borderColor = 'rgba(0,0,0,0.10)')}
/>
```

- [ ] **Step 2: Add `id`/`htmlFor` to RegisterPage input**

In `src/pages/auth/RegisterPage.tsx`, add `htmlFor="email"` to the label and `id="email"` to the input:

```tsx
<label htmlFor="email" className="text-xs font-medium text-base-content/50 uppercase tracking-wider">
  {t('auth.email')}
</label>
<input
  id="email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  autoComplete="email"
  placeholder="you@example.com"
  className="w-full h-12 px-4 rounded-xl text-base-content placeholder:text-base-content/30 text-sm focus:outline-none transition-colors"
  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.10)' }}
  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
  onBlur={e => (e.target.style.borderColor = 'rgba(0,0,0,0.10)')}
/>
```

- [ ] **Step 3: Fix BottomNav test**

Replace `src/components/layout/BottomNav.test.tsx` with:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from './BottomNav'

function renderWithRouter(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>
  )
}

describe('BottomNav', () => {
  it('renders all 4 tabs', () => {
    renderWithRouter('/')
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /charts/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /yatras/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  it('marks the active tab with aria-current', () => {
    renderWithRouter('/charts')
    expect(screen.getByRole('link', { name: /charts/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /home/i })).not.toHaveAttribute('aria-current', 'page')
  })
})
```

- [ ] **Step 4: Fix Button test**

Replace the spinner assertion in `src/components/ui/Button.test.tsx`:

```tsx
it('shows loading spinner and disables when loading', () => {
  render(<Button variant="primary" loading>Save</Button>)
  expect(screen.getByRole('button')).toBeDisabled()
  // DaisyUI loading spinner is a <span>, not an <svg>
  expect(screen.getByRole('button').querySelector('span.loading')).toBeInTheDocument()
})
```

- [ ] **Step 5: Run tests — expect all 19 to pass**

```bash
cd app-react && npm test -- --run --reporter=verbose
```

Expected: `Tests 19 passed (19)` — zero failures.

- [ ] **Step 6: Commit**

```bash
git add app-react/src/pages/auth/LoginPage.tsx \
        app-react/src/pages/auth/RegisterPage.tsx \
        app-react/src/components/layout/BottomNav.test.tsx \
        app-react/src/components/ui/Button.test.tsx
git commit -m "fix(tests): restore getByLabelText, aria-current, and spinner assertions"
```

---

## Task 2: AppShell — fixed photo background

Add a fixed background photo layer and dark overlay inside `AppShell`. Using `position: fixed` (not CSS `background-attachment: fixed`) avoids iOS Safari's broken fixed-background behavior.

**Files:**
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Rewrite AppShell**

Replace the entire contents of `src/components/layout/AppShell.tsx`:

```tsx
import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="min-h-screen relative">
      {/* Fixed photo background — avoids iOS background-attachment:fixed bug */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: 'url(/login-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="fixed inset-0 bg-black/30 -z-10 pointer-events-none" />

      <TopBar />
      <main className="pt-14 pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
```

Note: `AppShell` previously accepted `title`, `showBack`, `right` props and forwarded them to `TopBar`. Those are removed here because `TopBar` in the router is rendered without those props (the router uses `<AppShell />` with no props). Verify in `src/router.tsx` that `<AppShell />` is used without props — if any route passes props, move that logic to each page's own `<TopBar>` call instead.

- [ ] **Step 2: Verify in browser**

With the dev server running (`npm run dev` in `app-react/`), open `http://localhost:3001/`. The background photo should fill the screen. The content area may look unstyled but the photo should show through.

- [ ] **Step 3: Commit**

```bash
git add app-react/src/components/layout/AppShell.tsx
git commit -m "feat(appshell): fixed photo background with dark overlay"
```

---

## Task 3: TopBar — frosted glass

**Files:**
- Modify: `src/components/layout/TopBar.tsx`

- [ ] **Step 1: Rewrite TopBar**

Replace the entire contents of `src/components/layout/TopBar.tsx`:

```tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'

interface TopBarProps {
  title?: string
  showBack?: boolean
  right?: React.ReactNode
}

export const TopBar = React.memo(function TopBar({ title, showBack, right }: TopBarProps) {
  const navigate = useNavigate()

  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40 gap-3"
      style={{
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.35)',
      }}
    >
      {showBack ? (
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="btn btn-ghost btn-sm btn-circle text-base-content/80"
        >
          <FaChevronLeft className="w-4 h-4" />
        </button>
      ) : (
        <span className="font-serif text-lg text-base-content font-bold">Sadhana Pro</span>
      )}
      {title && (
        <h1 className="font-semibold text-base text-base-content flex-1">{title}</h1>
      )}
      {right && <div className="ml-auto">{right}</div>}
    </header>
  )
})
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3001/`. The top bar should appear frosted — the photo visible through a white blur. "Sadhana Pro" text should be readable in dark/base color.

- [ ] **Step 3: Commit**

```bash
git add app-react/src/components/layout/TopBar.tsx
git commit -m "feat(topbar): frosted glass styling"
```

---

## Task 4: BottomNav — frosted glass + teal active

**Files:**
- Modify: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Rewrite BottomNav**

Replace the entire contents of `src/components/layout/BottomNav.tsx`:

```tsx
import React from 'react'
import { NavLink } from 'react-router-dom'
import { FaHome, FaChartBar, FaUsers, FaCog } from 'react-icons/fa'

const tabs = [
  { to: '/', label: 'Home', icon: FaHome, exact: true },
  { to: '/charts', label: 'Charts', icon: FaChartBar, exact: false },
  { to: '/yatras', label: 'Yatras', icon: FaUsers, exact: false },
  { to: '/settings', label: 'Settings', icon: FaCog, exact: false },
]

export const BottomNav = React.memo(function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around z-40 pb-[env(safe-area-inset-bottom)]"
      style={{
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.35)',
      }}
    >
      {tabs.map(({ to, label, icon: Icon, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          aria-label={label}
          className="flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors"
          style={({ isActive }) => ({
            color: isActive ? '#01a386' : 'rgba(0,0,0,0.40)',
          })}
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
})
```

- [ ] **Step 2: Run tests — all 19 should still pass**

```bash
cd app-react && npm test -- --run --reporter=verbose
```

Expected: `Tests 19 passed (19)`

- [ ] **Step 3: Verify in browser**

Bottom nav should show frosted glass. Active tab icon + label should appear teal (`#01a386`). Inactive tabs muted dark.

- [ ] **Step 4: Commit**

```bash
git add app-react/src/components/layout/BottomNav.tsx
git commit -m "feat(bottomnav): frosted glass + teal active color"
```

---

## Task 5: PracticeCard — glass card + glass inputs

Replace the DaisyUI `card` with a frosted glass panel. Each input type gets the glass-input treatment. The Bool data type gets a custom pill toggle (no DaisyUI dependency).

**Files:**
- Modify: `src/pages/home/PracticeCard.tsx`

- [ ] **Step 1: Rewrite PracticeCard**

Replace the entire contents of `src/pages/home/PracticeCard.tsx`:

```tsx
import { useCallback, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { practicesApi } from '../../api/practices'
import type { UserPractice, PracticeValue } from '../../types/api'

interface PracticeCardProps {
  practice: UserPractice
  date: string
  currentValue?: PracticeValue
}

const inputCls = 'h-10 px-3 text-sm rounded-xl text-base-content focus:outline-none transition-colors'
const inputStyle = {
  background: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(0,0,0,0.10)',
}
const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'rgba(99,102,241,0.5)'
}
const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'rgba(0,0,0,0.10)'
}

export function PracticeCard({ practice, date, currentValue }: PracticeCardProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasValue = currentValue !== undefined

  const mutation = useMutation({
    mutationFn: (value: PracticeValue) =>
      practicesApi.saveDiaryEntry(date, practice.practice, value),
  })

  const save = useCallback(
    (value: PracticeValue) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => mutation.mutate(value), 600)
    },
    [mutation],
  )

  const intVal = currentValue && 'Int' in currentValue ? currentValue.Int : 0
  const boolVal = currentValue && 'Bool' in currentValue ? currentValue.Bool : false
  const textVal = currentValue && 'Text' in currentValue ? currentValue.Text : ''
  const durVal = currentValue && 'Duration' in currentValue ? currentValue.Duration : 0
  const timeH =
    currentValue && 'Time' in currentValue
      ? (currentValue as { Time: { h: number; m: number } }).Time.h
      : 0
  const timeM =
    currentValue && 'Time' in currentValue
      ? (currentValue as { Time: { h: number; m: number } }).Time.m
      : 0

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid rgba(255, 255, 255, 0.75)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-base-content">{practice.practice}</h3>
        {hasValue && (
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: '#01a386' }}
          />
        )}
      </div>

      {/* Bool — custom pill toggle */}
      {practice.data_type === 'Bool' && (
        <button
          type="button"
          role="switch"
          aria-checked={boolVal}
          onClick={() => save({ Bool: !boolVal })}
          className="relative w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none self-start"
          style={{ backgroundColor: boolVal ? '#01a386' : 'rgba(0,0,0,0.15)' }}
        >
          <span
            className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: boolVal ? 'translateX(1.25rem)' : 'translateX(0)' }}
          />
        </button>
      )}

      {/* Int — stepper */}
      {practice.data_type === 'Int' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-medium transition-colors"
            style={{ ...inputStyle, color: '#01a386' }}
            onClick={() => save({ Int: intVal - 1 })}
          >
            −
          </button>
          <input
            type="number"
            className={`${inputCls} w-20 text-center`}
            style={inputStyle}
            defaultValue={intVal}
            onChange={(e) => save({ Int: Number(e.target.value) })}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
          <button
            type="button"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-medium transition-colors"
            style={{ ...inputStyle, color: '#01a386' }}
            onClick={() => save({ Int: intVal + 1 })}
          >
            +
          </button>
        </div>
      )}

      {/* Text */}
      {practice.data_type === 'Text' && (
        <input
          type="text"
          className={`${inputCls} w-full`}
          style={inputStyle}
          defaultValue={textVal}
          onChange={(e) => save({ Text: e.target.value })}
          onFocus={inputFocus}
          onBlur={inputBlur}
        />
      )}

      {/* Duration */}
      {practice.data_type === 'Duration' && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            className={`${inputCls} w-24`}
            style={inputStyle}
            defaultValue={durVal}
            onChange={(e) => save({ Duration: Number(e.target.value) })}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
          <span className="text-sm text-base-content/50">min</span>
        </div>
      )}

      {/* Time */}
      {practice.data_type === 'Time' && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={23}
            className={`${inputCls} w-16 text-center`}
            style={inputStyle}
            defaultValue={timeH}
            onChange={(e) => save({ Time: { h: Number(e.target.value), m: timeM } })}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
          <span className="font-bold text-base-content/60">:</span>
          <input
            type="number"
            min={0}
            max={59}
            className={`${inputCls} w-16 text-center`}
            style={inputStyle}
            defaultValue={timeM}
            onChange={(e) => save({ Time: { h: timeH, m: Number(e.target.value) } })}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3001/`. Practice cards should appear as frosted glass panels floating over the photo. Each input type should show the glass-input style. The Bool toggle should be a sliding pill.

- [ ] **Step 3: Commit**

```bash
git add app-react/src/pages/home/PracticeCard.tsx
git commit -m "feat(practicecard): glassmorphism card with glass inputs and custom bool toggle"
```

---

## Task 6: HomePage — date nav, offline banner, empty state, FAB

Style the remaining home page elements: date navigator (white serif text), offline banner (glass), empty state (white text + teal pill), FAB (teal gradient).

**Files:**
- Modify: `src/pages/home/HomePage.tsx`

- [ ] **Step 1: Rewrite HomePage**

Replace the entire contents of `src/pages/home/HomePage.tsx`:

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FaSync, FaPlus } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import { practicesApi } from '../../api/practices'
import { PracticeCard } from './PracticeCard'
import { TopBar } from '../../components/layout/TopBar'
import useNetworkStatus from '../../hooks/useNetworkStatus'

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function displayDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function HomePage() {
  const { t } = useTranslation()
  const [date, setDate] = useState(new Date())
  const isOnline = useNetworkStatus()

  const dateStr = toDateStr(date)

  const practicesQuery = useQuery({
    queryKey: ['practices'],
    queryFn: practicesApi.getUserPractices,
  })
  const diaryQuery = useQuery({
    queryKey: ['diary', dateStr],
    queryFn: () => practicesApi.getDiaryEntries(dateStr),
  })

  const activePractices = (practicesQuery.data ?? []).filter((p) => p.is_active)
  const valueMap = Object.fromEntries(
    (diaryQuery.data ?? []).map((e) => [e.practice, e.value]),
  )

  const prev = () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    setDate(d)
  }
  const next = () => {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    setDate(d)
  }

  return (
    <>
      <TopBar
        right={
          <button
            className="btn btn-ghost btn-sm btn-circle text-base-content/70"
            onClick={() => diaryQuery.refetch()}
            aria-label="Refresh"
          >
            <FaSync className="w-4 h-4" />
          </button>
        }
      />

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Offline banner */}
        {!isOnline && (
          <div
            className="rounded-xl px-4 py-3 text-sm text-base-content"
            style={{
              background: 'rgba(255,255,255,0.40)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.30)',
            }}
          >
            {t('home.offline')}
          </div>
        )}

        {/* Date navigator */}
        <div className="flex items-center justify-center gap-4 py-1">
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors text-lg"
            onClick={prev}
            aria-label="Previous day"
          >
            ←
          </button>
          <span className="font-serif font-extralight text-white text-base tracking-wide min-w-[80px] text-center">
            {displayDate(date)}
          </span>
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors text-lg"
            onClick={next}
            aria-label="Next day"
          >
            →
          </button>
        </div>

        {/* Loading */}
        {(practicesQuery.isLoading || diaryQuery.isLoading) && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md" style={{ color: '#01a386' }} />
          </div>
        )}

        {/* Practice cards */}
        <div className="flex flex-col gap-3">
          {activePractices.map((p) => (
            <PracticeCard
              key={p.id}
              practice={p}
              date={dateStr}
              currentValue={valueMap[p.practice]}
            />
          ))}

          {/* Empty state */}
          {!practicesQuery.isLoading && activePractices.length === 0 && (
            <div className="text-center py-16 flex flex-col gap-5">
              <p className="text-white/70 text-sm">{t('home.noPractices')}</p>
              <Link
                to="/user/practice/new"
                className="mx-auto px-6 h-11 rounded-full text-sm font-semibold flex items-center justify-center transition-all"
                style={{
                  background: 'linear-gradient(135deg, #02c9a3 0%, #01a386 100%)',
                  color: '#134e4a',
                  boxShadow: '0 4px 20px rgba(45,212,191,0.35)',
                }}
              >
                {t('home.addFirst')}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <Link
        to="/user/practice/new"
        aria-label="Add practice"
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #02c9a3 0%, #01a386 100%)',
          boxShadow: '0 4px 24px rgba(45,212,191,0.45)',
        }}
      >
        <FaPlus className="w-5 h-5 text-white" />
      </Link>
    </>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3001/`. Check:
- Date navigator: serif white text, arrow buttons visible
- Practice cards: frosted glass floating over photo
- FAB: teal gradient circle, bottom-right
- Offline (test by disabling network in DevTools → Network → Offline): glass banner appears
- Empty state (if no practices): white text + teal pill button

- [ ] **Step 3: Run full test suite — all 19 pass**

```bash
cd app-react && npm test -- --run --reporter=verbose
```

Expected: `Tests 19 passed (19)`

- [ ] **Step 4: Commit**

```bash
git add app-react/src/pages/home/HomePage.tsx
git commit -m "feat(homepage): glassmorphism date nav, empty state, offline banner, FAB"
```
