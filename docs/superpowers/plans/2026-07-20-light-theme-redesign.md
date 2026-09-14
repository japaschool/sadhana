# Light Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the app from dark-photo glassmorphism to a light airy theme — white overlay over the background photo, all navigation in the TopBar, BottomNav removed.

**Architecture:** Four focused file edits + two file deletions. AppShell swaps its overlay from `rgba(0,0,0,0.30)` to `rgba(255,255,255,0.55)` and removes BottomNav. TopBar gains a responsive nav bar (text links on `sm:` and above, icons only below `sm:`). BottomNav and its test are deleted. HomePage and PracticeCard get updated color/shadow tokens only — no behavior changes.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, DaisyUI v5, React Router v6, Vitest + Testing Library

## Global Constraints

- Background image: `/login-bg.jpg` (already in `app-react/public/`) — unchanged
- Light overlay token: `rgba(255,255,255,0.55)` — replaces the previous `bg-black/30`
- TopBar glass bg: `rgba(255,255,255,0.70)` + `blur(24px)`
- Card glass bg: `rgba(255,255,255,0.90)` + `blur(16px)`, shadow `0 4px 16px rgba(0,0,0,0.08)`
- Teal accent: `#01a386` — unchanged throughout
- Responsive breakpoint for nav labels: `sm:` (640px) — below = icons only, above = text labels
- No new npm packages; no API changes; no behavior changes
- Auth pages (login, register, confirmation) are untouched
- Run tests from the `app-react/` directory: `cd app-react && npm test -- --run --reporter=verbose`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/layout/AppShell.tsx` | Modify | White overlay; remove BottomNav import and usage; remove `pb-16` |
| `src/components/layout/BottomNav.tsx` | **Delete** | Navigation moves to TopBar |
| `src/components/layout/BottomNav.test.tsx` | **Delete** | Test for deleted component |
| `src/components/layout/TopBar.tsx` | Modify | Add responsive NavLink items on the right; lighter glass bg |
| `src/pages/home/HomePage.tsx` | Modify | Date nav text → dark gray; empty state text → dark gray; FAB `bottom-20` → `bottom-6` |
| `src/pages/home/PracticeCard.tsx` | Modify | Lighter glass tokens on card container only |

---

## Task 1: AppShell — white overlay + remove BottomNav

These two changes must happen atomically: deleting BottomNav while AppShell still imports it breaks the build; updating AppShell first and leaving the file removes the import safely before deletion.

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Delete: `src/components/layout/BottomNav.tsx`
- Delete: `src/components/layout/BottomNav.test.tsx`

- [ ] **Step 1: Rewrite AppShell.tsx**

Replace the entire contents of `src/components/layout/AppShell.tsx`:

```tsx
import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'

export function AppShell() {
  return (
    <div className="relative">
      {/* Fixed photo background — avoids iOS background-attachment:fixed bug */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: 'url(/login-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Light white overlay — airy watercolor wash over the photo */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.55)' }}
      />
      <TopBar />
      <main className="pt-14">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Delete BottomNav.tsx**

```bash
git rm app-react/src/components/layout/BottomNav.tsx
```

- [ ] **Step 3: Delete BottomNav.test.tsx**

```bash
git rm app-react/src/components/layout/BottomNav.test.tsx
```

- [ ] **Step 4: Run tests — expect 17 to pass (was 19; 2 BottomNav tests removed)**

```bash
cd app-react && npm test -- --run --reporter=verbose
```

Expected: `Tests 17 passed (17)`

- [ ] **Step 5: Commit**

```bash
git add app-react/src/components/layout/AppShell.tsx
git commit -m "feat(appshell): light white overlay, remove BottomNav"
```

---

## Task 2: TopBar — responsive nav links

Replace the name-only header with a full navigation bar. On `sm:` (≥640px): show text labels. Below `sm:` (<640px): show icons only. When `showBack={true}`, the nav links hide and the back chevron shows instead (existing behavior preserved).

**Files:**
- Modify: `src/components/layout/TopBar.tsx`

- [ ] **Step 1: Rewrite TopBar.tsx**

Replace the entire contents of `src/components/layout/TopBar.tsx`:

```tsx
import React from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { FaChevronLeft, FaHome, FaChartBar, FaUsers, FaCog } from 'react-icons/fa'

interface TopBarProps {
  title?: string
  showBack?: boolean
  right?: React.ReactNode
}

const navItems = [
  { to: '/', label: 'Home', icon: FaHome, exact: true },
  { to: '/charts', label: 'Charts', icon: FaChartBar, exact: false },
  { to: '/yatras', label: 'Yatras', icon: FaUsers, exact: false },
  { to: '/settings', label: 'Settings', icon: FaCog, exact: false },
]

export const TopBar = React.memo(function TopBar({ title, showBack, right }: TopBarProps) {
  const navigate = useNavigate()

  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40 gap-3"
      style={{
        background: 'rgba(255, 255, 255, 0.70)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.50)',
      }}
    >
      {showBack ? (
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="btn btn-ghost btn-sm btn-circle text-gray-700"
        >
          <FaChevronLeft className="w-4 h-4" />
        </button>
      ) : (
        <span className="font-serif text-lg text-gray-800 font-bold">Sadhana Pro</span>
      )}

      {title && (
        <h1 className="font-semibold text-base text-gray-800 flex-1">{title}</h1>
      )}

      {!showBack && (
        <nav className="ml-auto flex items-center gap-1" aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              aria-label={label}
              style={({ isActive }) => ({
                color: isActive ? '#01a386' : 'rgba(0,0,0,0.40)',
                textDecoration: isActive ? 'underline' : 'none',
                textUnderlineOffset: '3px',
              })}
              className="flex items-center px-2 py-1 rounded transition-colors text-sm font-medium"
            >
              {/* Below sm: icon only */}
              <Icon className="w-4 h-4 sm:hidden" />
              {/* sm and above: text label */}
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
      )}

      {right && (
        <div className={showBack ? 'ml-auto' : 'ml-2'}>
          {right}
        </div>
      )}
    </header>
  )
})
```

- [ ] **Step 2: Run tests — expect 17 to pass**

```bash
cd app-react && npm test -- --run --reporter=verbose
```

Expected: `Tests 17 passed (17)`

- [ ] **Step 3: Commit**

```bash
git add app-react/src/components/layout/TopBar.tsx
git commit -m "feat(topbar): responsive nav links — text on sm+, icons on mobile"
```

---

## Task 3: PracticeCard — lighter glass tokens

Update the card container's three style values. No changes to logic, input controls, or teal accents.

**Files:**
- Modify: `src/pages/home/PracticeCard.tsx`

- [ ] **Step 1: Update card container style**

In `src/pages/home/PracticeCard.tsx`, find the outer `<div>` (around line 54) and replace its `style` prop:

Old:
```tsx
      style={{
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid rgba(255, 255, 255, 0.75)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
```

New:
```tsx
      style={{
        background: 'rgba(255, 255, 255, 0.90)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.80)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
```

- [ ] **Step 2: Run tests — expect 17 to pass**

```bash
cd app-react && npm test -- --run --reporter=verbose
```

Expected: `Tests 17 passed (17)`

- [ ] **Step 3: Commit**

```bash
git add app-react/src/pages/home/PracticeCard.tsx
git commit -m "feat(practicecard): lighter glass tokens for light theme"
```

---

## Task 4: HomePage — dark text + FAB position

Three text color updates and one position class change. No behavior changes.

**Files:**
- Modify: `src/pages/home/HomePage.tsx`

- [ ] **Step 1: Update date navigator — prev arrow button**

Find (around line 83):
```tsx
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors text-lg"
```
Replace with:
```tsx
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors text-lg"
```

- [ ] **Step 2: Update date navigator — date label**

Find (around line 90):
```tsx
          <span className="font-serif font-extralight text-white text-base tracking-wide min-w-[80px] text-center">
```
Replace with:
```tsx
          <span className="font-serif font-extralight text-gray-700 text-base tracking-wide min-w-[80px] text-center">
```

- [ ] **Step 3: Update date navigator — next arrow button**

Find (around line 93):
```tsx
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors text-lg"
```
Replace with:
```tsx
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors text-lg"
```

- [ ] **Step 4: Update empty state text color**

Find (around line 124):
```tsx
              <p className="text-white/70 text-sm">{t('home.noPractices')}</p>
```
Replace with:
```tsx
              <p className="text-gray-500 text-sm">{t('home.noPractices')}</p>
```

- [ ] **Step 5: Update FAB bottom position**

Find (around line 141):
```tsx
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full flex items-center justify-center"
```
Replace with:
```tsx
        className="fixed bottom-6 right-4 z-30 w-14 h-14 rounded-full flex items-center justify-center"
```

- [ ] **Step 6: Run tests — expect 17 to pass**

```bash
cd app-react && npm test -- --run --reporter=verbose
```

Expected: `Tests 17 passed (17)`

- [ ] **Step 7: Commit**

```bash
git add app-react/src/pages/home/HomePage.tsx
git commit -m "feat(homepage): dark text for light theme, FAB to bottom-6"
```
