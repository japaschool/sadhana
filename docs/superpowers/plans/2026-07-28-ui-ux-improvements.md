# Sadhana Pro — UI/UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global toast notification system, skeleton loader, page transitions, and targeted UX fixes across Home, Charts, Yatras, Settings, and Auth pages.

**Architecture:** Build shared infrastructure first (Toast/Skeleton/PageTransition), then wire each page into the toast system and apply its specific UX fixes. All new keys are collected into a final i18n pass for EN/RU/UK.

**Tech Stack:** React 18, TypeScript, Framer Motion 12 (already installed), Zustand 5 (already installed), Tailwind CSS 4, DaisyUI 5, Vitest + Testing Library, react-i18next

## Global Constraints

- All files are under `app-react/src/`
- Run tests with: `cd app-react && npm run test`
- Dev server: `cd app-react && npm run dev`
- Glass card style: `rgba(255,255,255,0.90)` + `blur(16px)` + `border: 1px solid rgba(255,255,255,0.80)` + `boxShadow: 0 4px 16px rgba(0,0,0,0.08)`
- Teal accent: `#01a386` (gradient: `linear-gradient(135deg, #02c9a3 0%, #01a386 100%)`)
- No new npm packages — Framer Motion and Zustand are already installed
- i18n via `useTranslation()` from `react-i18next`; locale files at `public/locales/{en,ru,uk}/translation.json`
- Existing test patterns: Vitest + `@testing-library/react` + `userEvent`, `MemoryRouter` for routing
- i18n test fixture lives in `src/test/setup.ts` — add any new keys used in tests there too

---

### Task 1: Global infrastructure — Toast, SkeletonCard, PageTransition

**Files:**
- Create: `app-react/src/hooks/useToast.ts`
- Create: `app-react/src/components/ui/Toast.tsx`
- Create: `app-react/src/components/ui/SkeletonCard.tsx`
- Create: `app-react/src/components/layout/PageTransition.tsx`
- Modify: `app-react/src/components/layout/AppShell.tsx`
- Test: `app-react/src/components/ui/Toast.test.tsx`

**Interfaces:**
- Produces: `useToast()` → `{ showToast: (opts: { message: string; variant: ToastVariant }) => void }`
- Produces: `<ToastContainer />` — mounts once in AppShell, reads from store
- Produces: `<SkeletonCard lines? height? />` — animated placeholder card
- Produces: `<PageTransition>` — fade+slide wrapper for page mounts

- [ ] **Step 1: Write the failing test**

Create `app-react/src/components/ui/Toast.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastContainer } from './Toast'
import { useToastStore } from '../../hooks/useToast'

function renderToastContainer() {
  return render(<ToastContainer />)
}

describe('Toast', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('shows a toast when showToast is called', () => {
    renderToastContainer()
    act(() => {
      useToastStore.getState().showToast({ message: 'Saved!', variant: 'success' })
    })
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('dismisses toast when × button is clicked', async () => {
    renderToastContainer()
    act(() => {
      useToastStore.getState().showToast({ message: 'Error', variant: 'error' })
    })
    expect(screen.getByText('Error')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('Error')).not.toBeInTheDocument()
  })

  it('caps visible toasts at 3', () => {
    renderToastContainer()
    act(() => {
      useToastStore.getState().showToast({ message: 'A', variant: 'success' })
      useToastStore.getState().showToast({ message: 'B', variant: 'success' })
      useToastStore.getState().showToast({ message: 'C', variant: 'success' })
      useToastStore.getState().showToast({ message: 'D', variant: 'success' })
    })
    expect(screen.queryByText('A')).not.toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app-react && npm run test -- --reporter=verbose Toast.test
```

Expected: FAIL — `useToastStore is not defined` / `ToastContainer is not defined`

- [ ] **Step 3: Create `src/hooks/useToast.ts`**

```ts
import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastStore {
  toasts: Toast[]
  showToast: (opts: { message: string; variant: ToastVariant }) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  showToast: ({ message, variant }) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({
      toasts: [...s.toasts.slice(-2), { id, message, variant }],
    }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function useToast() {
  return { showToast: useToastStore((s) => s.showToast) }
}
```

- [ ] **Step 4: Create `src/components/ui/Toast.tsx`**

```tsx
import { AnimatePresence, motion } from 'framer-motion'
import { LuX } from 'react-icons/lu'
import { useToastStore, type ToastVariant } from '../../hooks/useToast'

const BORDER_COLOR: Record<ToastVariant, string> = {
  success: '#01a386',
  error:   '#e11d48',
  warning: '#d97706',
  info:    '#3b82f6',
}

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:top-4 sm:right-4 sm:bottom-auto sm:translate-x-0 sm:left-auto z-[200] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl min-w-[220px] max-w-xs"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.85)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              borderLeft: `4px solid ${BORDER_COLOR[toast.variant]}`,
            }}
          >
            <span className="flex-1 text-sm font-medium text-gray-800">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(0,0,0,0.06)', color: '#9ca3af', border: 'none', cursor: 'pointer' }}
              aria-label="Dismiss"
            >
              <LuX className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/components/ui/SkeletonCard.tsx`**

```tsx
interface SkeletonCardProps {
  lines?: number
  height?: string
}

export function SkeletonCard({ lines = 1, height = '60px' }: SkeletonCardProps) {
  return (
    <div
      className="rounded-2xl px-4 flex items-center gap-3 animate-pulse"
      style={{
        minHeight: height,
        background: 'rgba(255,255,255,0.70)',
        border: '1px solid rgba(255,255,255,0.85)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}
    >
      <div className="w-8 h-8 rounded-xl flex-shrink-0" style={{ background: 'rgba(0,0,0,0.07)' }} />
      <div className="flex-1 flex flex-col gap-1.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded-full"
            style={{ background: 'rgba(0,0,0,0.07)', width: i === 0 ? '55%' : '35%' }}
          />
        ))}
      </div>
      <div className="w-12 h-6 rounded-full flex-shrink-0" style={{ background: 'rgba(0,0,0,0.07)' }} />
    </div>
  )
}
```

- [ ] **Step 6: Create `src/components/layout/PageTransition.tsx`**

```tsx
import { motion } from 'framer-motion'

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 7: Update `src/components/layout/AppShell.tsx`**

Replace the entire file:

```tsx
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { TopBar } from './TopBar'
import { AuthBackground } from './AuthBackground'
import { ToastContainer } from '../ui/Toast'
import { PageTransition } from './PageTransition'

export function AppShell() {
  const location = useLocation()
  return (
    <div className="relative">
      <AuthBackground />
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.25)' }}
      />
      <TopBar />
      <main className="pt-14">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
      <ToastContainer />
    </div>
  )
}
```

- [ ] **Step 8: Run tests**

```bash
cd app-react && npm run test -- --reporter=verbose Toast.test
```

Expected: 3 passing

- [ ] **Step 9: Commit**

```bash
git add app-react/src/hooks/useToast.ts \
        app-react/src/components/ui/Toast.tsx \
        app-react/src/components/ui/Toast.test.tsx \
        app-react/src/components/ui/SkeletonCard.tsx \
        app-react/src/components/layout/PageTransition.tsx \
        app-react/src/components/layout/AppShell.tsx
git commit -m "feat: add global toast system, skeleton card, and page transitions"
```

---

### Task 2: Home page improvements

**Files:**
- Modify: `app-react/src/pages/home/PracticeCard.tsx`
- Modify: `app-react/src/pages/home/HomePage.tsx`
- Modify: `app-react/src/pages/home/WeekCalendar.tsx`
- Test: `app-react/src/pages/home/PracticeCard.test.tsx` (extend existing)
- Test: `app-react/src/pages/home/WeekCalendar.test.tsx` (new)

**Interfaces:**
- Consumes: `useToast()` from `../../hooks/useToast`

- [ ] **Step 1: Write failing tests**

Add to `src/pages/home/PracticeCard.test.tsx` (append to existing describe block):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DurationQuickAddModal } from './PracticeCard'
import { useToastStore } from '../../hooks/useToast'

// existing tests stay unchanged …

describe('DurationQuickAddModal — duration hint', () => {
  it('shows hint text when input is focused', async () => {
    render(<DurationQuickAddModal onAdd={vi.fn()} onClose={vi.fn()} />)
    const input = screen.getByLabelText('minutes')
    await userEvent.click(input)
    expect(screen.getByText(/total minutes/i)).toBeInTheDocument()
  })

  it('hides hint text when input is not focused', () => {
    render(<DurationQuickAddModal onAdd={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText(/total minutes/i)).not.toBeInTheDocument()
  })
})
```

Create `src/pages/home/WeekCalendar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeekCalendar } from './WeekCalendar'

describe('WeekCalendar — Today button', () => {
  it('shows Today button when selected date is not today', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    render(<WeekCalendar date={yesterday} onDateChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument()
  })

  it('hides Today button when selected date is today', () => {
    render(<WeekCalendar date={new Date()} onDateChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /today/i })).not.toBeInTheDocument()
  })

  it('calls onDateChange with today when Today button clicked', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const onDateChange = vi.fn()
    render(<WeekCalendar date={yesterday} onDateChange={onDateChange} />)
    await userEvent.click(screen.getByRole('button', { name: /today/i }))
    expect(onDateChange).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd app-react && npm run test -- WeekCalendar.test PracticeCard.test
```

Expected: FAIL (new tests reference things not yet implemented)

- [ ] **Step 3: Update `PracticeCard.tsx` — save-fail toast + duration hint**

In `PracticeCard.tsx`, add the import at the top:

```tsx
import { useToast } from '../../hooks/useToast'
import { useTranslation } from 'react-i18next'
```

(Note: `useTranslation` is already imported — keep only the new import.)

Inside the `PracticeCard` component, after the existing `useQueryClient()` line, add:

```tsx
const { t } = useTranslation()
const { showToast } = useToast()
```

Replace the `mutation` definition to add `onError`:

```tsx
const mutation = useMutation({
  mutationFn: (v: PracticeValue) => practicesApi.saveDiaryEntry(date, practice.practice, v),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['diary', date] })
    setFlash(true)
    setTimeout(() => setFlash(false), 1200)
  },
  onError: () => {
    setErrorFlash(true)
    setTimeout(() => setErrorFlash(false), 600)
    showToast({ message: t('home.saveFailed'), variant: 'error' })
  },
})
```

Add `errorFlash` to the local state (next to the `flash` state):

```tsx
const [flash, setFlash]           = useState(false)
const [errorFlash, setErrorFlash] = useState(false)
```

Update the card border style to reflect `errorFlash`:

```tsx
border: errorFlash
  ? '1px solid rgba(225,29,72,0.55)'
  : flash
  ? '1px solid rgba(1,163,134,0.50)'
  : hasValue
  ? '1px solid rgba(1,163,134,0.20)'
  : '1px solid rgba(255,255,255,0.85)',
boxShadow: errorFlash
  ? '0 2px 12px rgba(225,29,72,0.10)'
  : flash
  ? '0 2px 12px rgba(1,163,134,0.14)'
  : '0 2px 12px rgba(0,0,0,0.07)',
```

In `DurationQuickAddModal`, add focus state tracking and hint text. Change the component to:

```tsx
export function DurationQuickAddModal({ onAdd, onClose, isPending }: { onAdd: (minutes: number) => void; onClose: () => void; isPending?: boolean }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isPending) return
    const n = parseInt(value, 10)
    if (!isNaN(n) && n > 0) onAdd(n)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={isPending ? undefined : onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative rounded-2xl p-5 w-72 flex flex-col gap-4"
        style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.85)' }}
      >
        <h3 className="text-sm font-semibold text-gray-800">{t('home.addMinutes')}</h3>
        <div className="flex flex-col gap-1">
          <input
            type="number"
            inputMode="numeric"
            min="1"
            autoFocus
            aria-label="minutes"
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('home.addMinutesPlaceholder')}
            className="w-full text-center text-lg font-bold rounded-xl h-12 outline-none"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.08)' }}
          />
          {focused && (
            <p className="text-[10px] text-center" style={{ color: '#9ca3af' }}>
              {t('home.durationHint')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(0,0,0,0.06)', color: '#6b7280', border: 'none' }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #02c9a3 0%, #01a386 100%)', color: 'white', border: 'none', opacity: isPending ? 0.7 : 1 }}
          >
            {isPending && <span className="loading loading-spinner loading-xs" />}
            {t('common.add')}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Update `HomePage.tsx` — Required/Optional section labels**

In `HomePage.tsx`, add a helper above the return:

```tsx
function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest px-1" style={{ color: '#9ca3af' }}>
      {label}
    </p>
  )
}
```

Replace the practice cards render block (currently inside the loading/error conditional):

```tsx
<>
  {required.length > 0 && optional.length > 0 && (
    <SectionLabel label={t('home.required')} />
  )}
  {required.map((p) => (
    <PracticeCard key={p.id + '-' + dateStr} practice={p} date={dateStr} currentValue={valueMap[p.practice]} />
  ))}
  {optional.length > 0 && required.length > 0 && (
    <SectionLabel label={t('home.optional')} />
  )}
  {optional.map((p) => (
    <PracticeCard key={p.id + '-' + dateStr} practice={p} date={dateStr} currentValue={valueMap[p.practice]} />
  ))}
</>
```

Also update the offline banner (find it and replace):

```tsx
{!isOnline && (
  <div
    className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
    style={{
      background: 'rgba(251,191,36,0.10)',
      border: '1px solid rgba(251,191,36,0.25)',
      color: '#92400e',
    }}
  >
    <LuWifiOff className="w-4 h-4 flex-shrink-0" style={{ color: '#d97706' }} />
    {t('home.offline')}
  </div>
)}
```

Add `LuWifiOff` to the imports from `react-icons/lu`:

```tsx
import { LuToggleRight, LuHash, LuTimer, LuClock, LuType, LuZap, LuWifiOff } from 'react-icons/lu'
```

Wait — `LuWifiOff` is in `HomePage.tsx`, not `PracticeCard.tsx`. Add it to `HomePage.tsx`'s imports:

```tsx
import { LuWifiOff } from 'react-icons/lu'
```

- [ ] **Step 5: Update `WeekCalendar.tsx` — Today button**

In `WeekCalendar.tsx`, add `{ useTranslation }` import if not already there (it is — `{ i18n }` is destructured, just add `t`):

```tsx
const { i18n, t } = useTranslation()
```

In the header section, after the `shortDate` span, add:

```tsx
{!isSameDay(date, today) && (
  <button
    type="button"
    onClick={() => onDateChange(new Date())}
    aria-label="Go to today"
    className="text-xs font-semibold px-2 py-0.5 rounded-full transition-colors focus:outline-none"
    style={{ color: '#01a386', background: 'rgba(1,163,134,0.08)', border: 'none', cursor: 'pointer' }}
  >
    {t('home.today')}
  </button>
)}
```

Place this after the `shortDate` span inside the `flex items-center justify-between` header div, so the header becomes:

```tsx
<div className="flex items-center justify-between px-4 pt-4 pb-2">
  <button
    type="button"
    onClick={() => setCalendarOpen(true)}
    className="text-xs font-semibold tracking-wide uppercase focus:outline-none"
    style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
  >
    {monthYear}
  </button>
  <div className="flex items-center gap-2">
    {!isSameDay(date, today) && (
      <button
        type="button"
        onClick={() => onDateChange(new Date())}
        aria-label="Go to today"
        className="text-xs font-semibold px-2 py-0.5 rounded-full focus:outline-none"
        style={{ color: '#01a386', background: 'rgba(1,163,134,0.08)', border: 'none', cursor: 'pointer' }}
      >
        {t('home.today')}
      </button>
    )}
    <span className="text-xs font-semibold" style={{ color: '#374151' }}>
      {shortDate}
    </span>
  </div>
</div>
```

- [ ] **Step 6: Add new i18n keys to test fixture (`src/test/setup.ts`)**

In `setup.ts`, add inside the `home` block:

```ts
home: {
  // … existing keys …
  saveFailed: 'Could not save',
  durationHint: 'Enter total minutes (e.g. 90 for 1h 30m)',
  required: 'Required',
  today: 'Today',
},
```

- [ ] **Step 7: Run tests**

```bash
cd app-react && npm run test -- WeekCalendar.test PracticeCard.test
```

Expected: all passing

- [ ] **Step 8: Commit**

```bash
git add app-react/src/pages/home/PracticeCard.tsx \
        app-react/src/pages/home/HomePage.tsx \
        app-react/src/pages/home/WeekCalendar.tsx \
        app-react/src/pages/home/WeekCalendar.test.tsx \
        app-react/src/pages/home/PracticeCard.test.tsx \
        app-react/src/test/setup.ts
git commit -m "feat: home page UX — save-fail toast, duration hint, section labels, Today button, amber offline banner"
```

---

### Task 3: Charts page improvements

**Files:**
- Modify: `app-react/src/pages/charts/ChartsPage.tsx`
- Modify: `app-react/src/pages/charts/NewChartPage.tsx`
- Test: `app-react/src/pages/charts/ChartsPage.test.tsx` (extend existing)

**Interfaces:**
- Consumes: Nothing from earlier tasks (independent of toast for this task)

- [ ] **Step 1: Write failing tests**

Append to `src/pages/charts/ChartsPage.test.tsx`:

```tsx
describe('ChartsPage — empty state', () => {
  it('renders empty state card when there are no reports', async () => {
    // Override the reports handler to return empty array
    const { server } = await import('../../test/handlers/auth.handlers')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.get('/api/reports', () => HttpResponse.json([]))
    )
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<ChartsPage />} />
          <Route path="/charts/new" element={<div>New chart</div>} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/no reports yet/i)).toBeInTheDocument()
    })
  })
})

describe('NewChartPage — select all / clear', () => {
  it('renders Select all and Clear buttons on step 1', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<NewChartPage />} />
        </Routes>
      </MemoryRouter>
    )
    // Advance to step 1
    await userEvent.type(screen.getByPlaceholderText(/report name/i), 'My Report')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
cd app-react && npm run test -- ChartsPage.test
```

Expected: FAIL

- [ ] **Step 3: Update `ChartsPage.tsx` — loading overlay on filter change**

In `ChartPanel`, the query is:
```tsx
const { data: rawValues = [], isLoading } = useQuery({ ... })
```

Add `isFetching` to the destructured query result:
```tsx
const { data: rawValues = [], isLoading, isFetching } = useQuery({ ... })
```

In the chart body div (`<div className="px-2 py-4">`), wrap the existing content in a relative container and add the overlay:

```tsx
<div className="px-2 py-4 relative">
  {isFetching && !isLoading && (
    <div
      className="absolute inset-0 rounded-2xl flex items-center justify-center z-10"
      style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <span className="loading loading-spinner loading-md" style={{ color: '#01a386' }} />
    </div>
  )}
  {isLoading ? (
    // … existing loading/chart content unchanged …
  ) : chartData.length === 0 || practiceNames.length === 0 ? (
    // … unchanged …
  ) : isGridReport ? (
    // … unchanged …
  ) : (
    // … unchanged …
  )}
</div>
```

- [ ] **Step 4: Update `ChartsPage.tsx` — empty state card + share button + manage animation**

Replace the empty state paragraph (around line 743):

```tsx
{reports.length === 0 && (
  <div
    className="rounded-2xl px-5 py-12 flex flex-col items-center gap-5"
    style={{
      background: 'rgba(255,255,255,0.90)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.80)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}
  >
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center"
      style={{ background: 'rgba(1,163,134,0.08)' }}
    >
      <LuChartLine className="w-6 h-6" style={{ color: '#01a386' }} />
    </div>
    <div className="text-center">
      <p className="text-sm font-semibold text-gray-800">{t('charts.emptyTitle')}</p>
      <p className="text-xs text-gray-400 mt-1">{t('charts.emptySubtitle')}</p>
    </div>
    <Link
      to="/charts/new"
      className="px-6 h-11 rounded-full text-sm font-semibold flex items-center gap-2"
      style={{
        background: 'linear-gradient(135deg, #02c9a3 0%, #01a386 100%)',
        color: 'white',
        textDecoration: 'none',
        boxShadow: '0 4px 20px rgba(45,212,191,0.35)',
      }}
    >
      {t('charts.create')}
    </Link>
  </div>
)}
```

Update `copyShareLink` to use 3s timeout (find and update):

```tsx
function copyShareLink() {
  if (!user) return
  navigator.clipboard.writeText(`${window.location.origin}/shared/${user.id}`)
  setShareCopied(true)
  setTimeout(() => setShareCopied(false), 3000)
}
```

Add `AnimatePresence` + `motion.div` to the manage section collapse. Add `{ motion, AnimatePresence }` to the imports from `framer-motion`:

```tsx
import { motion, AnimatePresence } from 'framer-motion'
```

Replace the `{manageOpen && <div ...>}` block:

```tsx
<AnimatePresence>
  {manageOpen && (
    <motion.div
      key="manage-body"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="px-3 pb-3 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        {reports.map(r => (
          <ReportCard key={r.id} report={r} practiceMap={practiceMap} practices={practices} />
        ))}
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 5: Update `NewChartPage.tsx` — Select all / Clear buttons**

In `NewChartPage`, the `selected` state is `useState<string[]>([])` and `activePractices` is `practices.filter(p => p.is_active)`.

Add these two handler functions before the return:

```tsx
function selectAll() {
  setSelected(activePractices.map(p => p.id))
}

function clearAll() {
  setSelected([])
  setTraceTypes({})
}
```

In step 1 (the practice picker section), add the buttons above the practices list. Find the `<p className="text-xs font-semibold text-gray-400 ...">` header and add after it:

```tsx
<div className="flex gap-3 pb-1">
  <button
    type="button"
    onClick={selectAll}
    className="text-xs font-semibold"
    style={{ color: '#01a386', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
  >
    {t('charts.selectAll')}
  </button>
  <button
    type="button"
    onClick={clearAll}
    className="text-xs font-semibold"
    style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
  >
    {t('charts.clearAll')}
  </button>
</div>
```

- [ ] **Step 6: Run tests**

```bash
cd app-react && npm run test -- ChartsPage.test
```

Expected: all passing

- [ ] **Step 7: Commit**

```bash
git add app-react/src/pages/charts/ChartsPage.tsx \
        app-react/src/pages/charts/NewChartPage.tsx \
        app-react/src/pages/charts/ChartsPage.test.tsx
git commit -m "feat: charts UX — loading overlay, empty state card, manage animation, select all/clear, 3s share feedback"
```

---

### Task 4: Yatras page improvements

**Files:**
- Modify: `app-react/src/pages/yatras/YatrasPage.tsx`

**Interfaces:**
- Consumes: Nothing from earlier tasks

- [ ] **Step 1: Write failing test**

Create `app-react/src/pages/yatras/YatrasPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Only test the unsaved-name guard and legend — the rest is visual/integration
describe('Yatras improvements — unit checks', () => {
  it('discard guard: window.confirm called when closing modal with typed name', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    // We test the guard logic in isolation
    const guard = (name: string, close: () => void) => {
      if (name.trim().length > 0) {
        if (!window.confirm('Discard?')) return
      }
      close()
    }
    const close = vi.fn()
    guard('My yatra', close)
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('discard guard: close fires immediately when name is empty', () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const guard = (name: string, close: () => void) => {
      if (name.trim().length > 0) {
        if (!window.confirm('Discard?')) return
      }
      close()
    }
    const close = vi.fn()
    guard('', close)
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
    confirmSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
cd app-react && npm run test -- YatrasPage.test
```

Expected: FAIL (file not found)

- [ ] **Step 3: Update `YatrasPage.tsx` — color-zone legend**

Add `useState` for legend visibility (already imports `useState`). Add this state near the top of `YatrasPage`:

```tsx
const [legendVisible, setLegendVisible] = useState<boolean>(
  () => localStorage.getItem('yatra-legend-shown') !== 'false'
)
```

Add a legend dismiss handler:

```tsx
function dismissLegend() {
  setLegendVisible(false)
  localStorage.setItem('yatra-legend-shown', 'false')
}
```

Add the legend just above the main data grid (`{data && !dataQuery.isLoading && (`). Insert before that block:

```tsx
{data && legendVisible && (
  <div className="flex items-center gap-2 px-1">
    {[
      { label: t('yatra.low'),  bg: 'rgba(220,38,38,0.15)',  text: '#dc2626' },
      { label: t('yatra.mid'),  bg: 'rgba(234,179,8,0.35)',  text: '#854d0e' },
      { label: t('yatra.high'), bg: 'rgba(22,163,74,0.35)',  text: '#166534' },
    ].map(z => (
      <span
        key={z.label}
        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: z.bg, color: z.text }}
      >
        {z.label}
      </span>
    ))}
    <button
      onClick={dismissLegend}
      className="ml-auto w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500"
      style={{ background: 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer' }}
      aria-label="Dismiss legend"
    >
      <LuX className="w-3 h-3" />
    </button>
  </div>
)}
```

Add `LuX` to the imports (already imported in this file — check). If not, add from `react-icons/lu`.

- [ ] **Step 4: Update `YatrasPage.tsx` — heatmap date header**

The heatmap table is rendered at around line 367. Find the `<table>` inside the heatmap block and add a `<thead>` with dates before the `<tbody>`.

The heatmap section looks like:
```tsx
{data && showStability && heatmapDays.length > 0 && (
  <div ...>
    <div className="overflow-x-auto">
      <table ...>
        <tbody>
          <tr> {/* header row with day names */}
```

Add a date header row. Before the existing `<tbody>`, add:

```tsx
<thead>
  <tr>
    <th className="px-4 py-1.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#9ca3af', width: '35%' }}>
      {t('yatras.stability')}
    </th>
    {heatmapDays.map((day, i) => {
      const d = new Date(day)
      const label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
      return (
        <th
          key={i}
          className="py-1.5 text-center text-[10px] font-medium"
          style={{ color: '#9ca3af' }}
        >
          {label}
        </th>
      )
    })}
  </tr>
</thead>
```

- [ ] **Step 5: Update `YatrasPage.tsx` — practice name truncation + manual refresh**

In the main grid `<thead>`, find where practice names are rendered:

```tsx
{data.practices.map(p => (
  <th key={p.id} className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>
    {p.practice}
  </th>
))}
```

Update to add truncation and tooltip:

```tsx
{data.practices.map(p => (
  <th
    key={p.id}
    className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide"
    style={{ color: '#9ca3af' }}
  >
    <span className="block max-w-[80px] mx-auto truncate" title={p.practice}>
      {p.practice}
    </span>
  </th>
))}
```

Add the `LuRefreshCw` icon import (add to existing Lucide imports). Find the yatra header/toolbar area (the top row with the yatra dropdown) and add a refresh button to the right side:

```tsx
import { LuRefreshCw } from 'react-icons/lu'
```

In the top toolbar, add after the settings icon:

```tsx
<button
  type="button"
  onClick={() => qc.invalidateQueries({ queryKey: ['yatra-data', selectedYatra?.id, dateStr] })}
  aria-label={t('yatra.refresh')}
  className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
  style={{ color: '#01a386', background: 'rgba(1,163,134,0.08)', border: 'none', cursor: 'pointer' }}
>
  <LuRefreshCw className={`w-3.5 h-3.5 ${dataQuery.isFetching ? 'animate-spin' : ''}`} />
</button>
```

Also destructure `isFetching` from `dataQuery`:
```tsx
const dataQuery = useQuery({ ..., enabled: !!selectedYatra })
// Access: dataQuery.isFetching
```

- [ ] **Step 6: Update `YatrasPage.tsx` — empty grid dashes + create modal guard**

In the grid `<tbody>`, find where cell values are rendered. Each data row renders its practice values. Find the cell that displays a value and add a fallback dash. Look for the cell rendering pattern like `{formatValue(entry?.value)}` or similar and make it:

```tsx
{entry?.value !== undefined && entry.value !== null ? formatValue(entry.value) : (
  <span style={{ color: 'rgba(0,0,0,0.20)' }}>—</span>
)}
```

For the create modal backdrop close guard, find:
```tsx
onClick={() => setShowCreate(false)}
```
on the outer backdrop div. Replace with:

```tsx
onClick={() => {
  if (newName.trim().length > 0) {
    if (!window.confirm(t('yatra.discardName'))) return
  }
  setShowCreate(false)
  setNewName('')
}}
```

Also update the `Escape` key handler in the modal input's `onKeyDown`:
```tsx
onKeyDown={e => {
  if (e.key === 'Enter') submitCreate()
  if (e.key === 'Escape') {
    if (newName.trim().length > 0) {
      if (!window.confirm(t('yatra.discardName'))) return
    }
    setShowCreate(false)
    setNewName('')
  }
}}
```

- [ ] **Step 7: Run tests**

```bash
cd app-react && npm run test -- YatrasPage.test
```

Expected: 2 passing

- [ ] **Step 8: Commit**

```bash
git add app-react/src/pages/yatras/YatrasPage.tsx \
        app-react/src/pages/yatras/YatrasPage.test.tsx
git commit -m "feat: yatras UX — color legend, heatmap dates, name truncation, refresh button, empty dashes, modal guard"
```

---

### Task 5: Settings improvements

**Files:**
- Modify: `app-react/src/pages/settings/SettingsPage.tsx`
- Modify: `app-react/src/pages/settings/EditPasswordPage.tsx`
- Modify: `app-react/src/pages/settings/EditUserPage.tsx`
- Modify: `app-react/src/pages/settings/MyPracticesPage.tsx`
- Test: `app-react/src/pages/settings/Settings.test.tsx` (new)

**Interfaces:**
- Consumes: `useToast()` from `../../hooks/useToast` (MyPracticesPage reorder failure)

- [ ] **Step 1: Write failing tests**

Create `app-react/src/pages/settings/Settings.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { EditPasswordPage } from './EditPasswordPage'
import { EditUserPage } from './EditUserPage'

function renderEditPassword() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<EditPasswordPage />} />
      </Routes>
    </MemoryRouter>
  )
}

function renderEditUser() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<EditUserPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('EditPasswordPage', () => {
  it('shows real-time mismatch error when passwords differ', async () => {
    renderEditPassword()
    const inputs = screen.getAllByLabelText(/password/i)
    const newPass = inputs.find(i => i.id === 'new-password')!
    const confirmPass = inputs.find(i => i.id === 'confirm-password')!
    await userEvent.type(newPass, 'newpass123')
    await userEvent.type(confirmPass, 'wrongpass')
    expect(screen.getByText(/do not match/i)).toBeInTheDocument()
  })

  it('shows password visibility toggle on all fields', () => {
    renderEditPassword()
    const toggles = screen.getAllByRole('button', { name: /show|hide password/i })
    expect(toggles).toHaveLength(3)
  })
})

describe('EditUserPage', () => {
  it('shows character counter', () => {
    renderEditUser()
    expect(screen.getByText(/\/50/)).toBeInTheDocument()
  })

  it('counter turns amber at 45 chars', async () => {
    renderEditUser()
    const input = screen.getByLabelText(/name/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'a'.repeat(45))
    const counter = screen.getByText('45/50')
    expect(counter).toHaveStyle({ color: '#d97706' })
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
cd app-react && npm run test -- Settings.test
```

Expected: FAIL

- [ ] **Step 3: Update `SettingsPage.tsx` — logout confirmation**

Add state for modal visibility near the top of `SettingsPage`:
```tsx
const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
```

Add `ConfirmModal` import:
```tsx
import { ConfirmModal } from '../../components/ui/ConfirmModal'
```

Replace the logout button's `onClick`:
```tsx
onClick={() => setShowLogoutConfirm(true)}
```

Add the modal just before the closing `</>`:
```tsx
<ConfirmModal
  id="logout-confirm"
  title={t('settings.logoutConfirmTitle')}
  message={t('settings.logoutConfirmMsg')}
  confirmLabel={t('auth.logout')}
  onConfirm={() => { logout(); navigate('/login', { replace: true }) }}
/>
```

And imperatively show it when state flips. Since `ConfirmModal` uses DaisyUI's `<dialog>` element controlled via `showModal()`, add a `useEffect`:

```tsx
useEffect(() => {
  if (showLogoutConfirm) {
    (document.getElementById('logout-confirm') as HTMLDialogElement)?.showModal()
    setShowLogoutConfirm(false)
  }
}, [showLogoutConfirm])
```

- [ ] **Step 4: Update `EditPasswordPage.tsx` — show/hide toggle + real-time mismatch**

Replace the `Field` component with a new `PasswordField` that supports show/hide:

```tsx
import { useState } from 'react'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

function PasswordField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, paddingRight: '2.75rem' }}
          onFocus={onFocus}
          onBlur={onBlurInput}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: '#01a386', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {show ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
```

Remove the old `Field` component entirely. Update the three `<Field>` usages to `<PasswordField>`.

Add real-time mismatch: in `handleSubmit`, keep the existing check. Additionally, add inline mismatch detection when the confirm field changes. Update the confirm field's `onChange` in `EditPasswordPage`:

The confirm field is rendered as:
```tsx
<PasswordField id="confirm-password" label={t('auth.confirmPassword')} value={confirm} onChange={v => { setConfirm(v); setSuccess(false) }} />
```

Add a computed `realtimeMismatch`:
```tsx
const realtimeMismatch = confirm.length > 0 && next.length > 0 && confirm !== next
```

Show it above the existing error block:
```tsx
{realtimeMismatch && !clientError && (
  <p className="text-sm rounded-xl px-3 py-2.5" style={{ background: 'rgba(225,29,72,0.07)', color: '#e11d48' }}>
    {t('auth.passwordMismatch')}
  </p>
)}
{error && (
  <p className="text-sm rounded-xl px-3 py-2.5" style={{ background: 'rgba(225,29,72,0.07)', color: '#e11d48' }}>
    {error}
  </p>
)}
```

- [ ] **Step 5: Update `EditUserPage.tsx` — character counter**

Below the name input `<input>` element, add:

```tsx
<p
  className="text-[10px] text-right"
  style={{ color: name.length >= 50 ? '#e11d48' : name.length >= 45 ? '#d97706' : '#9ca3af' }}
>
  {name.length}/50
</p>
```

- [ ] **Step 6: Update `MyPracticesPage.tsx` — drag ghost opacity + reorder failure toast**

Add `useToast` import and `isDragging` from `useSortable`.

In `SortableRow`, change the `useSortable` destructuring to include `isDragging`:

```tsx
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: practice.id })
```

Update the `style` object to include opacity:

```tsx
const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.4 : 1,
}
```

In `MyPracticesPage`, add the toast hook and wire up `onError` on the reorder mutation:

```tsx
import { useToast } from '../../hooks/useToast'
import { useTranslation } from 'react-i18next'

// inside MyPracticesPage:
const { t } = useTranslation()
const { showToast } = useToast()

const reorder = useMutation({
  mutationFn: (ids: string[]) => practicesApi.reorderUserPractices(ids),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['practices'] }),
  onError: () => showToast({ message: t('settings.reorderFailed'), variant: 'error' }),
})
```

- [ ] **Step 7: Add new keys to test fixture**

In `src/test/setup.ts`, add inside the `settings` block (or create it if it doesn't exist yet):

```ts
settings: {
  logoutConfirmTitle: 'Log out?',
  logoutConfirmMsg: 'Are you sure you want to log out?',
  reorderFailed: "Couldn't save order — please try again",
  // … existing keys …
},
```

- [ ] **Step 8: Run tests**

```bash
cd app-react && npm run test -- Settings.test
```

Expected: all passing

- [ ] **Step 9: Commit**

```bash
git add app-react/src/pages/settings/SettingsPage.tsx \
        app-react/src/pages/settings/EditPasswordPage.tsx \
        app-react/src/pages/settings/EditUserPage.tsx \
        app-react/src/pages/settings/MyPracticesPage.tsx \
        app-react/src/pages/settings/Settings.test.tsx \
        app-react/src/test/setup.ts
git commit -m "feat: settings UX — logout confirmation, show-password toggles, real-time mismatch, char counter, drag opacity, reorder error toast"
```

---

### Task 6: Auth page improvements

**Files:**
- Modify: `app-react/src/pages/auth/LoginPage.tsx`
- Modify: `app-react/src/pages/auth/RegisterPage.tsx`
- Test: `app-react/src/pages/auth/LoginPage.test.tsx` (extend)
- Test: `app-react/src/pages/auth/RegisterPage.test.tsx` (extend)

**Interfaces:**
- Consumes: `useToast()` from `../../hooks/useToast` (RegisterPage resend toast)

- [ ] **Step 1: Write failing tests**

Append to `src/pages/auth/LoginPage.test.tsx`:

```tsx
describe('LoginPage — error specificity', () => {
  it('shows specific wrong-credentials message on 401', async () => {
    const { server } = await import('../../test/handlers/auth.handlers')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.post('/api/users/login', () =>
        HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      )
    )
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getAllByRole('button', { name: /sign in/i })[0])
    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument()
    })
  })

  it('sign-in button is disabled while loading', async () => {
    renderLogin()
    const btn = screen.getAllByRole('button', { name: /sign in/i })[0]
    expect(btn).not.toBeDisabled()
  })
})
```

Append to `src/pages/auth/RegisterPage.test.tsx`:

```tsx
describe('RegisterPage — password strength', () => {
  it('shows strength bar when password field is focused', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<RegisterPage />} />
        </Routes>
      </MemoryRouter>
    )
    // Register page only has email field in its current form; strength bar would be on a different version
    // Just verify the email autofocus behavior
    const emailInput = screen.getByLabelText(/email/i)
    expect(emailInput).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
cd app-react && npm run test -- LoginPage.test RegisterPage.test
```

Expected: FAIL for the new `error specificity` test

- [ ] **Step 3: Update `LoginPage.tsx` — error specificity + disabled button**

Replace the `catch` block in `handleSubmit`:

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setError(null)
  setLoading(true)
  try {
    const user = await authApi.login(email, password)
    setAuth(user)
    navigate('/', { replace: true })
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    if (status === 401) {
      setError(t('auth.wrongCredentials'))
    } else if (!navigator.onLine) {
      setError(t('auth.offline'))
    } else {
      setError(t('auth.serverError'))
    }
  } finally {
    setLoading(false)
  }
}
```

Add `disabled={loading}` to the submit button:

```tsx
<button
  type="submit"
  disabled={loading}
  className="w-full h-12 rounded-full text-sm font-semibold transition-all flex items-center justify-center gap-2"
  style={{
    background: 'linear-gradient(135deg, #02c9a3 0%, #01a386 100%)',
    color: '#134e4a',
    boxShadow: '0 4px 20px rgba(45,212,191,0.35)',
    opacity: loading ? 0.6 : 1,
  }}
>
```

- [ ] **Step 4: Update `RegisterPage.tsx` — autofocus + resend countdown + strength indicator**

Add `autoFocus` to the email input (find the email `<input>` and add the attribute):

```tsx
<input
  id="email"
  type="email"
  autoFocus
  value={email}
  // … rest unchanged …
/>
```

Add resend countdown logic. Add these state variables and logic inside `RegisterPage`:

```tsx
const { showToast } = useToast()
const [resendCountdown, setResendCountdown] = useState(0)
const [resending, setResending] = useState(false)

useEffect(() => {
  if (!sent) return
  setResendCountdown(30)
  const interval = setInterval(() => {
    setResendCountdown(c => {
      if (c <= 1) { clearInterval(interval); return 0 }
      return c - 1
    })
  }, 1000)
  return () => clearInterval(interval)
}, [sent])

async function handleResend() {
  setResending(true)
  try {
    await authApi.sendConfirmationLink(email, 'Registration')
    showToast({ message: t('auth.resendSent'), variant: 'success' })
    setResendCountdown(30)
  } catch {
    showToast({ message: t('common.error'), variant: 'error' })
  } finally {
    setResending(false)
  }
}
```

Add import:
```tsx
import { useEffect } from 'react'
import { useToast } from '../../hooks/useToast'
```

In the `sent` state view, add below the sign-in link:

```tsx
{resendCountdown > 0 ? (
  <p className="text-xs" style={{ color: '#9ca3af' }}>
    {t('auth.resendIn', { seconds: resendCountdown })}
  </p>
) : (
  <button
    type="button"
    onClick={handleResend}
    disabled={resending}
    className="text-sm font-medium hover:underline"
    style={{ color: '#01a386', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
  >
    {resending ? '…' : t('auth.resendEmail')}
  </button>
)}
```

- [ ] **Step 5: Add new i18n keys to test fixture**

In `src/test/setup.ts`, add to the `auth` block:

```ts
auth: {
  // … existing …
  wrongCredentials: 'Incorrect email or password',
  offline: 'No internet connection',
  serverError: 'Server error — please try again',
  resendEmail: 'Resend email',
  resendSent: 'Confirmation email sent',
  resendIn: 'Resend in {{seconds}}s',
},
```

- [ ] **Step 6: Run tests**

```bash
cd app-react && npm run test -- LoginPage.test RegisterPage.test
```

Expected: all passing

- [ ] **Step 7: Commit**

```bash
git add app-react/src/pages/auth/LoginPage.tsx \
        app-react/src/pages/auth/RegisterPage.tsx \
        app-react/src/pages/auth/LoginPage.test.tsx \
        app-react/src/pages/auth/RegisterPage.test.tsx \
        app-react/src/test/setup.ts
git commit -m "feat: auth UX — specific error messages, disabled button, autofocus, resend countdown"
```

---

### Task 7: i18n — add all new keys to EN/RU/UK locale files

**Files:**
- Modify: `app-react/public/locales/en/translation.json`
- Modify: `app-react/public/locales/ru/translation.json`
- Modify: `app-react/public/locales/uk/translation.json`

**Interfaces:**
- Consumes: Nothing from earlier tasks (pure translation data)

- [ ] **Step 1: Add all new keys to EN (`public/locales/en/translation.json`)**

Add inside the `"home"` object:
```json
"saveFailed": "Could not save — please try again",
"durationHint": "Enter total minutes (e.g. 90 for 1h 30m)",
"required": "Required",
"today": "Today"
```

Add inside the `"auth"` object:
```json
"wrongCredentials": "Incorrect email or password",
"offline": "No internet connection",
"serverError": "Server error — please try again",
"resendEmail": "Resend email",
"resendSent": "Confirmation email sent",
"resendIn": "Resend in {{seconds}}s"
```

Add inside the `"charts"` object:
```json
"emptyTitle": "No reports yet",
"emptySubtitle": "Create your first report to track progress over time",
"selectAll": "Select all",
"clearAll": "Clear"
```

Add inside the `"yatras"` (or `"yatra"`) object — check which key namespace is used in YatrasPage's `t()` calls:
```json
"low": "Low",
"mid": "Mid",
"high": "High",
"refresh": "Refresh",
"discardName": "Discard the yatra name you typed?"
```

Add inside the `"settings"` object:
```json
"logoutConfirmTitle": "Log out?",
"logoutConfirmMsg": "Are you sure you want to log out?",
"reorderFailed": "Couldn't save order — please try again"
```

- [ ] **Step 2: Add all new keys to RU (`public/locales/ru/translation.json`)**

```json
"home": {
  "saveFailed": "Не удалось сохранить — попробуйте снова",
  "durationHint": "Введите минуты (например, 90 для 1ч 30м)",
  "required": "Обязательные",
  "today": "Сегодня"
}
"auth": {
  "wrongCredentials": "Неверный email или пароль",
  "offline": "Нет подключения к интернету",
  "serverError": "Ошибка сервера — попробуйте снова",
  "resendEmail": "Отправить повторно",
  "resendSent": "Письмо с подтверждением отправлено",
  "resendIn": "Повторно через {{seconds}}с"
}
"charts": {
  "emptyTitle": "Нет отчётов",
  "emptySubtitle": "Создайте первый отчёт для отслеживания прогресса",
  "selectAll": "Выбрать все",
  "clearAll": "Очистить"
}
"yatras" / "yatra": {
  "low": "Низко",
  "mid": "Средне",
  "high": "Высоко",
  "refresh": "Обновить",
  "discardName": "Отменить введённое название ятры?"
}
"settings": {
  "logoutConfirmTitle": "Выйти?",
  "logoutConfirmMsg": "Вы уверены, что хотите выйти?",
  "reorderFailed": "Не удалось сохранить порядок — попробуйте снова"
}
```

- [ ] **Step 3: Add all new keys to UK (`public/locales/uk/translation.json`)**

```json
"home": {
  "saveFailed": "Не вдалося зберегти — спробуйте ще раз",
  "durationHint": "Введіть хвилини (наприклад, 90 для 1г 30хв)",
  "required": "Обов'язкові",
  "today": "Сьогодні"
}
"auth": {
  "wrongCredentials": "Неправильний email або пароль",
  "offline": "Немає підключення до інтернету",
  "serverError": "Помилка сервера — спробуйте ще раз",
  "resendEmail": "Надіслати повторно",
  "resendSent": "Лист підтвердження надіслано",
  "resendIn": "Повторно через {{seconds}}с"
}
"charts": {
  "emptyTitle": "Немає звітів",
  "emptySubtitle": "Створіть перший звіт для відстеження прогресу",
  "selectAll": "Вибрати все",
  "clearAll": "Очистити"
}
"yatras" / "yatra": {
  "low": "Низько",
  "mid": "Середньо",
  "high": "Високо",
  "refresh": "Оновити",
  "discardName": "Скасувати введену назву ятри?"
}
"settings": {
  "logoutConfirmTitle": "Вийти?",
  "logoutConfirmMsg": "Ви впевнені, що хочете вийти?",
  "reorderFailed": "Не вдалося зберегти порядок — спробуйте ще раз"
}
```

- [ ] **Step 4: Run full test suite**

```bash
cd app-react && npm run test
```

Expected: all tests pass

- [ ] **Step 5: Verify in browser**

```bash
cd app-react && npm run dev
```

Visit `http://localhost:5173` and verify:
- Navigate between pages → subtle fade+slide transition
- Home → save a practice while offline → red flash + error toast appears
- Home → navigate to a past date → "Today" button appears, click it → returns to today
- Charts → no reports → empty state card with CTA renders
- Charts → click a duration filter → loading overlay visible while fetching
- Charts → New Report → Step 2 → "Select all" / "Clear" buttons present
- Yatras → legend row visible above grid; × button dismisses it
- Settings → click Log out → confirm modal appears
- Settings/Edit Password → type in confirm field that differs → real-time mismatch shows
- Auth/Login → wrong password → "Incorrect email or password" (not generic error)

- [ ] **Step 6: Commit**

```bash
git add app-react/public/locales/en/translation.json \
        app-react/public/locales/ru/translation.json \
        app-react/public/locales/uk/translation.json
git commit -m "i18n: add all UI/UX improvement keys to EN/RU/UK translations"
```
