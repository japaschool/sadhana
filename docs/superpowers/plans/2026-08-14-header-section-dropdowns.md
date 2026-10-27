# Home Header Section Dropdowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the home header's actions into three consistent dropdowns — `Practices ▾`, `Yatras ▾`, `Reports ▾` — via a reusable `HeaderMenu`.

**Architecture:** Extract a reusable controlled-dropdown `HeaderMenu` (label + items; each item is a route `Link` or an `onClick` button). Rewrite `HomeHeaderActions` to render three `HeaderMenu`s. "Create new yatra" reuses the existing `useUiStore().requestYatraCreate()` signal (the embedded home `YatrasPage` opens its create modal on the nonce bump).

**Tech Stack:** React 19, framer-motion (unaffected), react-router v7, Tailwind v4, zustand, i18next (JSON locales), Vitest + React Testing Library.

## Global Constraints

- App in `app-react/`; run all commands there. Tests: `npx vitest run <path>` (or `npm run test`). Build: `npm run build`. Lint: `npm run lint` (`oxlint`, fails on unused imports).
- JSX auto-runtime — no `import React`.
- i18n discipline: new keys go in ALL of `public/locales/{en,ru,uk}/translation.json` AND `src/test/setup.ts`. Reuse existing keys where they exist (do not duplicate): `home.practicesMenu`, `home.addPractice`, `home.editPractices`, `nav.yatras`, `yatras.createNewYatra`, `charts.newReport`, `charts.manage`.
- Locale JSON is not build-validated (static assets); after editing, run
  `node -e "for (const l of ['en','ru','uk']) JSON.parse(require('fs').readFileSync('public/locales/'+l+'/translation.json','utf8')); console.log('locales OK')"` and confirm it prints `locales OK`.
- `useUiStore` (`src/store/uiStore.ts`) exposes `requestYatraCreate: () => void` (bumps `yatraCreateNonce`).

---

### Task 1: `HeaderMenu` reusable dropdown

**Files:**
- Create: `app-react/src/components/layout/HeaderMenu.tsx`
- Test: `app-react/src/components/layout/HeaderMenu.test.tsx`

**Interfaces:**
- Produces:
  - `export type HeaderMenuItem = { label: string; to: string } | { label: string; onClick: () => void }`
  - `export function HeaderMenu({ label, items }: { label: string; items: HeaderMenuItem[] }): JSX.Element` — a glass pill trigger (`role="button"` implicit) that toggles a `role="menu"` panel; each item is a `role="menuitem"` (a `Link` when it has `to`, a `button` when it has `onClick`); both close the menu on activate; outside-click closes via a `mousedown` listener attached only while open and cleaned up.

- [ ] **Step 1: Write the failing test**

Create `app-react/src/components/layout/HeaderMenu.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { HeaderMenu } from './HeaderMenu'

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('HeaderMenu', () => {
  it('is closed until the trigger is clicked, then shows a link item', () => {
    wrap(<HeaderMenu label="Practices" items={[{ label: 'Add', to: '/add' }]} />)
    expect(screen.queryByRole('menuitem', { name: 'Add' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Practices/ }))
    expect(screen.getByRole('menuitem', { name: 'Add' })).toHaveAttribute('href', '/add')
  })

  it('renders an onClick item as a button that fires its handler and closes the menu', () => {
    const onClick = vi.fn()
    wrap(<HeaderMenu label="Yatras" items={[{ label: 'Create', onClick }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Yatras/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menuitem', { name: 'Create' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app-react && npx vitest run src/components/layout/HeaderMenu.test.tsx`
Expected: FAIL — `Failed to resolve import './HeaderMenu'`.

- [ ] **Step 3: Implement `HeaderMenu.tsx`**

Create `app-react/src/components/layout/HeaderMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaChevronDown } from 'react-icons/fa'

export type HeaderMenuItem =
  | { label: string; to: string }
  | { label: string; onClick: () => void }

const pill =
  'h-9 px-3 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors no-underline'
const glassPill = {
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.85)',
} as const
const itemClass = 'px-4 py-2.5 text-sm text-left no-underline hover:bg-white/10 w-full'
const itemStyle = { color: 'rgba(255,255,255,0.85)' } as const

export function HeaderMenu({ label, items }: { label: string; items: HeaderMenuItem[] }) {
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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={pill}
        style={glassPill}
      >
        {label}
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
          {items.map((item) =>
            'to' in item ? (
              <Link
                key={item.label}
                role="menuitem"
                to={item.to}
                onClick={() => setOpen(false)}
                className={itemClass}
                style={itemStyle}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onClick()
                  setOpen(false)
                }}
                className={itemClass}
                style={itemStyle}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app-react && npx vitest run src/components/layout/HeaderMenu.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Build + lint**

Run: `cd app-react && npm run build && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd app-react && git add src/components/layout/HeaderMenu.tsx src/components/layout/HeaderMenu.test.tsx
git commit -m "feat(app-react): HeaderMenu — reusable header dropdown

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Three menus in `HomeHeaderActions` (+ i18n, tests)

**Files:**
- Modify: `app-react/public/locales/{en,ru,uk}/translation.json` (add `home.reportsMenu`, `home.viewYatras`)
- Modify: `app-react/src/test/setup.ts` (add the two keys; fix `charts.manage` → `Manage reports`)
- Modify: `app-react/src/components/layout/HomeHeaderActions.tsx` (rewrite to three `HeaderMenu`s)
- Modify: `app-react/src/components/layout/HomeHeaderActions.test.tsx` (rewrite)
- Modify: `app-react/src/components/layout/TopBar.test.tsx` (drop the now-invalid "New report" link assertions)

**Interfaces:**
- Consumes: `HeaderMenu` + `HeaderMenuItem` from Task 1; `useUiStore().requestYatraCreate`.

- [ ] **Step 1: Add the two new i18n keys to the three locale files**

Insert the two keys as the first entries of the `"home"` object (anchor `  "home": {` is identical across all three files).

`en` — replace `  "home": {\n` with:
```
  "home": {
    "reportsMenu": "Reports",
    "viewYatras": "View yatras",
```
`ru` — replace `  "home": {\n` with:
```
  "home": {
    "reportsMenu": "Отчёты",
    "viewYatras": "Просмотр ятр",
```
`uk` — replace `  "home": {\n` with:
```
  "home": {
    "reportsMenu": "Звіти",
    "viewYatras": "Перегляд ятр",
```

- [ ] **Step 2: Validate the locale JSON**

Run: `cd app-react && node -e "for (const l of ['en','ru','uk']) JSON.parse(require('fs').readFileSync('public/locales/'+l+'/translation.json','utf8')); console.log('locales OK')"`
Expected: prints `locales OK`.

- [ ] **Step 3: Update `src/test/setup.ts`**

(a) In the `home: { … }` block, after the line `editPractices: 'Edit practices',` add:
```
            reportsMenu: 'Reports',
            viewYatras: 'View yatras',
```
(b) In the `charts: { … }` block, change the line `manage: 'Manage',` to:
```
            manage: 'Manage reports',
```
(This aligns the test resource with the production value so the "Manage reports" menu-item test matches.)

- [ ] **Step 4: Rewrite the `HomeHeaderActions` test**

Replace the whole contents of `app-react/src/components/layout/HomeHeaderActions.test.tsx` with:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { HomeHeaderActions } from './HomeHeaderActions'
import { useUiStore } from '../../store/uiStore'

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('HomeHeaderActions', () => {
  it('renders the three menu triggers', () => {
    wrap(<HomeHeaderActions />)
    expect(screen.getByRole('button', { name: /Practices/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Yatras/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reports/ })).toBeInTheDocument()
  })

  it('Practices menu links to add/edit', () => {
    wrap(<HomeHeaderActions />)
    fireEvent.click(screen.getByRole('button', { name: /Practices/ }))
    expect(screen.getByRole('menuitem', { name: 'Add new practice' })).toHaveAttribute('href', '/user/practice/new')
    expect(screen.getByRole('menuitem', { name: 'Edit practices' })).toHaveAttribute('href', '/user/practices')
  })

  it('Reports menu links to new/manage', () => {
    wrap(<HomeHeaderActions />)
    fireEvent.click(screen.getByRole('button', { name: /Reports/ }))
    expect(screen.getByRole('menuitem', { name: 'New report' })).toHaveAttribute('href', '/charts/new')
    expect(screen.getByRole('menuitem', { name: 'Manage reports' })).toHaveAttribute('href', '/charts')
  })

  it('Yatras menu: View links to /yatras, Create fires requestYatraCreate', () => {
    const before = useUiStore.getState().yatraCreateNonce
    wrap(<HomeHeaderActions />)
    fireEvent.click(screen.getByRole('button', { name: /Yatras/ }))
    expect(screen.getByRole('menuitem', { name: 'View yatras' })).toHaveAttribute('href', '/yatras')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create new yatra' }))
    expect(useUiStore.getState().yatraCreateNonce).toBe(before + 1)
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd app-react && npx vitest run src/components/layout/HomeHeaderActions.test.tsx`
Expected: FAIL — the current component has no `Yatras`/`Reports` triggers (only `Practices` + a `New report` link).

- [ ] **Step 6: Rewrite `HomeHeaderActions.tsx`**

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
    { label: t('home.viewYatras'), to: '/yatras' },
  ]
  const reports: HeaderMenuItem[] = [
    { label: t('charts.newReport'), to: '/charts/new' },
    { label: t('charts.manage'), to: '/charts' },
  ]

  return (
    <div className="flex items-center gap-2">
      <HeaderMenu label={t('home.practicesMenu')} items={practices} />
      <HeaderMenu label={t('nav.yatras')} items={yatras} />
      <HeaderMenu label={t('home.reportsMenu')} items={reports} />
    </div>
  )
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd app-react && npx vitest run src/components/layout/HomeHeaderActions.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 8: Update the `TopBar` test (drop the "New report" link assertions)**

In `app-react/src/components/layout/TopBar.test.tsx`, "New report" is now inside a closed dropdown (not an always-visible link). Remove the two `New report` link assertions, keeping the `Practices` trigger assertions:

```tsx
describe('TopBar home actions', () => {
  it('shows the home actions on the home route', () => {
    wrapAt('/')
    expect(screen.getByRole('button', { name: /Practices/ })).toBeInTheDocument()
  })

  it('hides the home actions on other routes', () => {
    wrapAt('/yatras')
    expect(screen.queryByRole('button', { name: /Practices/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 9: Full suite, build, lint**

Run: `cd app-react && npm run test && npm run build && npm run lint`
Expected: all tests pass, build + lint clean. (Confirms `TopBar` still green, `HomeHeaderActions` has no unused imports — `ACCENT`, `Link`, `FaChevronDown`, `useState/useEffect/useRef` all moved to `HeaderMenu`.)

- [ ] **Step 10: Commit**

```bash
cd app-react && git add public/locales/en/translation.json public/locales/ru/translation.json public/locales/uk/translation.json src/test/setup.ts src/components/layout/HomeHeaderActions.tsx src/components/layout/HomeHeaderActions.test.tsx src/components/layout/TopBar.test.tsx
git commit -m "feat(app-react): home header — Practices/Yatras/Reports dropdowns

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Manual verification (after both tasks)

`cd app-react && npm run dev`, home screen (desktop width):
1. The header shows three dropdowns: **Practices ▾**, **Yatras ▾**, **Reports ▾**.
2. **Yatras ▾** → "Create new yatra" opens the create-yatra modal (over the page); "View yatras" → `/yatras`.
3. **Reports ▾** → "New report" → `/charts/new`; "Manage reports" → `/charts`.
4. **Practices ▾** → add/edit as before. Each menu opens on click and closes on outside-click.

## Self-Review Notes

- **Spec coverage:** three dropdowns (Practices/Yatras/Reports) (Task 2) ✓; reusable `HeaderMenu` with link+onClick items and outside-click close (Task 1) ✓; "Create new yatra" via `requestYatraCreate` (Task 2) ✓; View yatras `/yatras`, New report `/charts/new`, Manage reports `/charts` (Task 2) ✓; i18n reuse + new `home.reportsMenu`/`home.viewYatras` in 3 locales + setup.ts (Task 2) ✓; `TopBar` gating unchanged, test updated for the trigger button (Task 2) ✓; nav untouched ✓.
- **Placeholders:** none — all code and i18n values complete.
- **Type consistency:** `HeaderMenuItem` union and `HeaderMenu({ label, items })` match between Task 1 and Task 2's usage; reused i18n keys (`nav.yatras`, `yatras.createNewYatra`, `charts.newReport`, `charts.manage`, `home.practicesMenu/addPractice/editPractices`) verified present in all three locales + setup.ts; `charts.manage` aligned to "Manage reports" in setup.ts so the menu-item test matches.
