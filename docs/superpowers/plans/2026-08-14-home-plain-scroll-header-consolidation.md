# Home Plain-Scroll + Header Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home page a normal scrolling page (drop the curtain), keep "View yatras" on the same page, and consolidate the header (remove Reports ▾, move actions right, remove Yatras from the desktop nav, Settings→icon, bigger logo).

**Architecture:** Delete `CurtainReveal`; `HomePage` renders `DashboardPanel` then a plain `<section id="home-yatras">` with the embedded yatras. The header's `Yatras ▾` "View yatras" becomes a smooth-scroll to `#home-yatras`. `TopBar` consolidates the actions + nav into one right-aligned cluster, drops the Yatras nav item (desktop only), and renders Settings as an icon.

**Tech Stack:** React 19, react-router v7, Tailwind v4, zustand, i18next, Vitest + React Testing Library.

## Global Constraints

- App in `app-react/`; run all commands there. Tests: `npx vitest run <path>` (or `npm run test`). Build: `npm run build`. Lint: `npm run lint` (`oxlint`, fails on unused imports).
- JSX auto-runtime — no `import React` in files that don't already have it. (`TopBar.tsx` already imports `React` for `React.ReactNode`/`React.memo` — keep it.)
- No new i18n keys. Reuse existing (`home.practicesMenu`, `home.addPractice`, `home.editPractices`, `nav.yatras`, `yatras.createNewYatra`). `home.reportsMenu` becomes unused but stays in the locale files (harmless; not worth the churn to remove).
- The shared `navItems` list must NOT change (the mobile `BottomNav` uses it) — filter Yatras out only where `TopBar` renders the desktop nav.
- The on-page yatras section anchor id is exactly `home-yatras`.

---

### Task 1: Plain-scroll `HomePage` (delete `CurtainReveal`)

**Files:**
- Modify: `app-react/src/pages/home/HomePage.tsx`
- Modify: `app-react/src/pages/home/HomePage.test.tsx` (update the overlay assertion)
- Delete: `app-react/src/components/layout/CurtainReveal.tsx`
- Delete: `app-react/src/components/layout/CurtainReveal.test.tsx`

**Interfaces:**
- Produces: the home page renders a `<section id="home-yatras">` wrapping `<YatrasPage embedded />`, directly after `<DashboardPanel />`, in normal document flow (no sticky/overflow).

- [ ] **Step 1: Update the HomePage test assertion**

In `app-react/src/pages/home/HomePage.test.tsx`, replace the test that asserts the curtain overlay (`.rounded-t-3xl`) with one asserting the on-page section. Find the test titled "renders the yatras section as the curtain overlay below the dashboard" and replace that whole `it(...)` block with:

```tsx
  it('renders the yatras section below the dashboard on the same page', async () => {
    const { container } = wrap(<HomePage />)
    await screen.findByText('Meditation')
    expect(container.querySelector('#home-yatras')).not.toBeNull()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app-react && npx vitest run src/pages/home/HomePage.test.tsx`
Expected: FAIL — there is no `#home-yatras` element yet (HomePage still renders `CurtainReveal`).

- [ ] **Step 3: Rewrite `HomePage.tsx`**

Replace the whole file with (only the imports and `HomePage` body change; `SectionLabel`, `DateContextLabel`, `toDateStr` stay verbatim):

```tsx
import { useTranslation } from 'react-i18next'
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
    <>
      <DashboardPanel />
      <section
        id="home-yatras"
        className="px-4 pb-14 pt-8 lg:pt-12 lg:px-6 max-w-lg lg:max-w-[1400px] mx-auto w-full"
      >
        <YatrasPage embedded />
      </section>
    </>
  )
}
```

- [ ] **Step 4: Delete the `CurtainReveal` files**

```bash
cd app-react && git rm src/components/layout/CurtainReveal.tsx src/components/layout/CurtainReveal.test.tsx
```

- [ ] **Step 5: Run the home tests to verify they pass**

Run: `cd app-react && npx vitest run src/pages/home/HomePage.test.tsx`
Expected: PASS — dashboard content still renders (via `DashboardPanel`) and `#home-yatras` is present.

- [ ] **Step 6: Full suite, build, lint**

Run: `cd app-react && npm run test && npm run build && npm run lint`
Expected: all green. (Confirms nothing else imported `CurtainReveal` and there are no unused imports/dangling references.)

- [ ] **Step 7: Commit**

```bash
cd app-react && git add src/pages/home/HomePage.tsx src/pages/home/HomePage.test.tsx
git commit -m "feat(app-react): home is a plain scrolling page (drop CurtainReveal)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Header — remove Reports, scroll-to-yatras, consolidate nav

**Files:**
- Modify: `app-react/src/components/layout/HomeHeaderActions.tsx`
- Modify: `app-react/src/components/layout/HomeHeaderActions.test.tsx`
- Modify: `app-react/src/components/layout/TopBar.tsx`
- Modify: `app-react/src/components/layout/TopBar.test.tsx`

**Interfaces:**
- Consumes: the `#home-yatras` anchor from Task 1; `HeaderMenu`/`HeaderMenuItem`; `useUiStore().requestYatraCreate`.

- [ ] **Step 1: Rewrite the `HomeHeaderActions` test**

Replace the whole contents of `app-react/src/components/layout/HomeHeaderActions.test.tsx` with:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { HomeHeaderActions } from './HomeHeaderActions'
import { useUiStore } from '../../store/uiStore'

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('HomeHeaderActions', () => {
  it('renders Practices and Yatras triggers but not Reports', () => {
    wrap(<HomeHeaderActions />)
    expect(screen.getByRole('button', { name: /Practices/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Yatras/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reports/ })).not.toBeInTheDocument()
  })

  it('Practices menu links to add/edit', () => {
    wrap(<HomeHeaderActions />)
    fireEvent.click(screen.getByRole('button', { name: /Practices/ }))
    expect(screen.getByRole('menuitem', { name: 'Add new practice' })).toHaveAttribute('href', '/user/practice/new')
    expect(screen.getByRole('menuitem', { name: 'Edit practices' })).toHaveAttribute('href', '/user/practices')
  })

  it('Yatras menu: View yatras scrolls to #home-yatras, Create fires requestYatraCreate', () => {
    const scrollSpy = vi.fn()
    // jsdom does not implement scrollIntoView; define it so we can assert the call.
    Element.prototype.scrollIntoView = scrollSpy
    const before = useUiStore.getState().yatraCreateNonce
    render(
      <MemoryRouter>
        <div id="home-yatras" />
        <HomeHeaderActions />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Yatras/ }))
    const view = screen.getByRole('menuitem', { name: 'View yatras' })
    expect(view).not.toHaveAttribute('href') // it's an action button, not a link
    fireEvent.click(view)
    expect(scrollSpy).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Yatras/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create new yatra' }))
    expect(useUiStore.getState().yatraCreateNonce).toBe(before + 1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app-react && npx vitest run src/components/layout/HomeHeaderActions.test.tsx`
Expected: FAIL — the current component still renders a `Reports` trigger and "View yatras" is a link with an `href`.

- [ ] **Step 3: Rewrite `HomeHeaderActions.tsx`**

Replace the whole file with:

```tsx
import { useTranslation } from 'react-i18next'
import { useUiStore } from '../../store/uiStore'
import { HeaderMenu, type HeaderMenuItem } from './HeaderMenu'

export function HomeHeaderActions() {
  const { t } = useTranslation()
  const requestYatraCreate = useUiStore((s) => s.requestYatraCreate)

  const practices: HeaderMenuItem[] = [
    { label: t('home.addPractice'), to: '/user/practice/new' },
    { label: t('home.editPractices'), to: '/user/practices' },
  ]
  const yatras: HeaderMenuItem[] = [
    { label: t('yatras.createNewYatra'), onClick: requestYatraCreate },
    {
      label: t('home.viewYatras'),
      onClick: () =>
        document.getElementById('home-yatras')?.scrollIntoView({ behavior: 'smooth' }),
    },
  ]

  return (
    <div className="flex items-center gap-2">
      <HeaderMenu label={t('home.practicesMenu')} items={practices} />
      <HeaderMenu label={t('nav.yatras')} items={yatras} />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app-react && npx vitest run src/components/layout/HomeHeaderActions.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Rewrite the `TopBar` test**

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
  it('shows the home actions on the home route', () => {
    wrapAt('/')
    expect(screen.getByRole('button', { name: /Practices/ })).toBeInTheDocument()
  })

  it('hides the home actions on other routes', () => {
    wrapAt('/yatras')
    expect(screen.queryByRole('button', { name: /Practices/ })).not.toBeInTheDocument()
  })

  it('does not render a Yatras link in the desktop nav', () => {
    wrapAt('/')
    expect(screen.queryByRole('link', { name: 'Yatras' })).not.toBeInTheDocument()
  })

  it('renders Settings as an icon (aria-label, no visible text)', () => {
    wrapAt('/')
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the TopBar test to verify it fails**

Run: `cd app-react && npx vitest run src/components/layout/TopBar.test.tsx`
Expected: FAIL — the current nav still renders a "Yatras" link and shows the "Settings" text label.

- [ ] **Step 7: Rewrite `TopBar.tsx`**

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

  return (
    <header
      className={`fixed top-0 left-0 right-0 h-14 items-center px-4 z-40 gap-3 ${showBack || showClose ? 'flex' : 'hidden sm:flex'}`}
      style={{
        // Transparent over the backdrop (Giga-style) — no solid bar; a faint
        // top scrim keeps the nav/logo legible over the photo.
        background: 'linear-gradient(180deg, rgba(30,43,69,0.55) 0%, rgba(30,43,69,0) 100%)',
      }}
    >
      {showClose ? (
        <button
          onClick={() => navigate(-1)}
          aria-label="Close"
          className="btn btn-ghost btn-sm btn-circle text-base-content/70"
        >
          <LuX className="w-5 h-5" />
        </button>
      ) : showBack ? (
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="btn btn-ghost btn-sm btn-circle text-base-content/80"
        >
          <FaChevronLeft className="w-4 h-4" />
        </button>
      ) : (
        <Link to="/" className="flex items-center no-underline">
          <img
            src="/logo.png"
            className="h-[35px] w-[35px] object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
            alt="Sadhana"
          />
        </Link>
      )}

      {(showBack || showClose) && title && (
        <h1 className="font-serif font-semibold text-base text-base-content flex-1">{title}</h1>
      )}

      {!showBack && !showClose && (
        <div className="ml-auto hidden sm:flex items-center gap-2">
          {location.pathname === '/' && <HomeHeaderActions />}
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {navItems
              .filter(({ navKey }) => navKey !== 'yatras')
              .map(({ to, navKey, icon: Icon, exact }) => {
                const iconOnly = navKey === 'settings'
                return (
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
                        {/* icon: always for Settings, otherwise only below sm */}
                        <Icon
                          className={`w-4 h-4 transition-colors ${iconOnly ? '' : 'sm:hidden'}`}
                          style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.75)' }}
                        />
                        {/* text label: sm+ for non-Settings items */}
                        {!iconOnly && (
                          <span
                            className="hidden sm:inline transition-colors"
                            style={{
                              color: isActive ? '#ffffff' : 'rgba(255,255,255,0.75)',
                              fontWeight: isActive ? 600 : 500,
                            }}
                          >
                            {t(`nav.${navKey}`)}
                          </span>
                        )}
                        {/* Active dot */}
                        <span
                          className="w-1 h-1 rounded-full transition-all"
                          style={{ background: isActive ? ACCENT : 'transparent' }}
                        />
                      </>
                    )}
                  </NavLink>
                )
              })}
          </nav>
        </div>
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

- [ ] **Step 8: Run the TopBar test to verify it passes**

Run: `cd app-react && npx vitest run src/components/layout/TopBar.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Full suite, build, lint**

Run: `cd app-react && npm run test && npm run build && npm run lint`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
cd app-react && git add src/components/layout/HomeHeaderActions.tsx src/components/layout/HomeHeaderActions.test.tsx src/components/layout/TopBar.tsx src/components/layout/TopBar.test.tsx
git commit -m "feat(app-react): consolidate header — drop Reports, scroll-to-yatras, Settings icon

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Manual verification (after both tasks)

`cd app-react && npm run dev`, home screen (desktop width):
1. **Scroll** — the page scrolls normally; the yatras section is right below the dashboard.
2. **Header** — logo is a touch bigger; on the right: `Practices ▾`, `Yatras ▾`, then `Home`, (Charts hidden on large), and a **gear icon** for Settings (opens the settings modal). No `Yatras` text link in the nav.
3. **Yatras ▾ → View yatras** smooth-scrolls down to the yatras section (stays on the home page). **Create new yatra** opens the create modal.
4. **Mobile** — the bottom nav still has Yatras (unchanged).

## Self-Review Notes

- **Spec coverage:** plain-scroll home + delete CurtainReveal (Task 1) ✓; `#home-yatras` section (Task 1) ✓; View yatras scrolls to it (Task 2) ✓; remove Reports ▾ (Task 2) ✓; consolidate actions+nav on the right (Task 2 TopBar) ✓; remove Yatras from desktop nav only, `navItems`/BottomNav untouched (Task 2) ✓; Settings→icon (Task 2) ✓; logo ~10% bigger `h-[35px]` (Task 2) ✓; tests updated + CurtainReveal test deleted ✓.
- **Placeholders:** none — full file contents and test code provided.
- **Type consistency:** `#home-yatras` id matches between Task 1's section and Task 2's `scrollIntoView` target and both tests; `HeaderMenuItem` onClick form used for View yatras; reused i18n keys verified present; `TopBar` keeps its existing `import React` (needed for `React.memo`/`React.ReactNode`).
