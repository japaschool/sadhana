# Performance Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut startup latency (FCP, LCP) and eliminate perceived lag on diary saves and day navigation.

**Architecture:** Five independent changes — image cleanup, HTML preload hint, async auth hydration, React Query optimistic writes for diary saves, and week-day prefetching. No new files, no new dependencies.

**Tech Stack:** React 19, Vite 8, React Query (`@tanstack/react-query` v5), TypeScript, Vitest + React Testing Library

## Global Constraints

- All code lives under `app-react/` unless stated otherwise
- Run tests with `cd app-react && npm test` (Vitest, jsdom environment)
- Do not add npm dependencies
- Follow existing patterns: `vi.mock` at module level, `wrap()` helper in tests, i18n keys already defined in `src/test/setup.ts`
- `DiaryEntry` type from `src/types/api.ts` has required fields: `practice: string`, `data_type: PracticeDataType`, `value?: PracticeValue`

---

### Task 1: Delete unused oversized images

**Files:**
- Delete: `app-react/public/bg1.png` (3.6 MB)
- Delete: `app-react/public/bg2.png` (3.7 MB)
- Delete: `frontend/images/bg1.png` (3.6 MB)
- Delete: `frontend/images/bg2.png` (3.7 MB)

**Interfaces:**
- Consumes: nothing
- Produces: nothing (pure cleanup)

- [ ] **Step 1: Verify no source file references these images**

```bash
grep -r "bg1\|bg2" app-react/src frontend/src --include="*.ts" --include="*.tsx" --include="*.rs"
```

Expected: no output. If any reference is found, stop and investigate before deleting.

- [ ] **Step 2: Delete the files**

```bash
rm app-react/public/bg1.png app-react/public/bg2.png
rm frontend/images/bg1.png frontend/images/bg2.png
```

- [ ] **Step 3: Verify they are gone**

```bash
ls app-react/public/bg*.png 2>&1; ls frontend/images/bg*.png 2>&1
```

Expected: `No such file or directory` for both.

- [ ] **Step 4: Commit**

```bash
git add -u app-react/public/bg1.png app-react/public/bg2.png frontend/images/bg1.png frontend/images/bg2.png
git commit -m "chore: delete unused bg1/bg2 images (7.3 MB)"
```

---

### Task 2: Preload background image

**Files:**
- Modify: `app-react/index.html`

**Interfaces:**
- Consumes: nothing
- Produces: nothing (HTML metadata)

- [ ] **Step 1: Add preload link to `<head>`**

Open `app-react/index.html`. The current `<head>` is:

```html
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/png" href="/logo.png?v=2" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sadhana Pro</title>
</head>
```

Add the preload link immediately after the viewport meta:

```html
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/png" href="/logo.png?v=2" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preload" as="image" href="/bg.jpg" />
  <title>Sadhana Pro</title>
</head>
```

- [ ] **Step 2: Verify the dev server starts without error**

```bash
cd app-react && npm run dev
```

Open `http://localhost:5173` in a browser. In DevTools → Network tab, filter by `bg.jpg` — it should appear with `Initiator: preload scanner` (not `css`). Ctrl+C to stop the server.

- [ ] **Step 3: Commit**

```bash
git add app-react/index.html
git commit -m "perf: preload bg.jpg to eliminate CSS-discovery delay"
```

---

### Task 3: Unblock React mount from auth hydration

**Files:**
- Modify: `app-react/src/main.tsx`

**Interfaces:**
- Consumes: `useAuthStore` — `isLoading` initial state is `true` (set in `store/authStore.ts`)
- Produces: nothing (startup ordering change)

**How it works:** `ProtectedRoute` reads `isLoading` from `useAuthStore` and renders `<Spinner />` while true. The store initialises with `isLoading: true`. Currently `ReactDOM.createRoot().render()` only fires after `hydrateAuth()` resolves — so nothing paints until the `/api/users/me` round-trip completes. Flipping the order lets React mount immediately (showing the spinner) while hydration runs concurrently.

- [ ] **Step 1: Reorder `main.tsx`**

Current code (bottom of `app-react/src/main.tsx`):

```ts
hydrateAuth().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<Spinner />}><RouterProvider router={router} /></Suspense>
      </QueryClientProvider>
    </React.StrictMode>
  )
})
```

Replace with:

```ts
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<Spinner />}><RouterProvider router={router} /></Suspense>
    </QueryClientProvider>
  </React.StrictMode>
)
hydrateAuth()
```

- [ ] **Step 2: Verify manually**

```bash
cd app-react && npm run dev
```

Open `http://localhost:5173`. Open DevTools → Network tab, throttle to "Slow 3G". Hard-reload. Confirm the spinner appears immediately instead of a blank screen while `/api/users/me` is in flight. Ctrl+C to stop.

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
cd app-react && npm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add app-react/src/main.tsx
git commit -m "perf: mount React immediately, run auth hydration concurrently"
```

---

### Task 4: Optimistic updates for diary saves

**Files:**
- Modify: `app-react/src/pages/home/PracticeCard.tsx`
- Modify: `app-react/src/pages/home/PracticeCard.test.tsx`

**Interfaces:**
- Consumes: `DiaryEntry` from `src/types/api.ts` — `{ practice: string, data_type: PracticeDataType, value?: PracticeValue }`
- Consumes: `queryKey: ['diary', date]` — array of `DiaryEntry` stored in React Query cache
- Produces: same mutation API (no interface change for callers)

**How it works:** Add `onMutate` to write the new value into the React Query cache before the server responds. On error, restore the previous cache snapshot. `onSuccess` handles the green flash. `onSettled` (fires on both success and error) invalidates the query so the server value eventually syncs.

- [ ] **Step 1: Write the failing test**

Add to `app-react/src/pages/home/PracticeCard.test.tsx`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DurationQuickAddModal, PracticeCard } from './PracticeCard'
import type { DiaryEntry } from '../../types/api'

vi.mock('../../api/practices', () => ({
  practicesApi: {
    saveDiaryEntry: vi.fn(),
  },
}))

describe('PracticeCard — optimistic update', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates diary cache immediately before server responds', async () => {
    const { practicesApi } = await import('../../api/practices')
    let resolve!: () => void
    vi.mocked(practicesApi.saveDiaryEntry).mockReturnValue(
      new Promise<void>(r => { resolve = r })
    )

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData<DiaryEntry[]>(['diary', '2026-07-29'], [])

    render(
      <QueryClientProvider client={qc}>
        <PracticeCard
          practice={{ id: '1', practice: 'Meditation', data_type: 'Bool', is_active: true, is_required: false }}
          date="2026-07-29"
          currentValue={undefined}
        />
      </QueryClientProvider>
    )

    await userEvent.click(screen.getByRole('switch'))

    // onMutate is async (awaits cancelQueries), so use waitFor
    await waitFor(() => {
      const cached = qc.getQueryData<DiaryEntry[]>(['diary', '2026-07-29'])
      expect(cached).toContainEqual(
        expect.objectContaining({ practice: 'Meditation', data_type: 'Bool' })
      )
    })

    resolve()
  })

  it('rolls back cache on save error', async () => {
    const { practicesApi } = await import('../../api/practices')
    vi.mocked(practicesApi.saveDiaryEntry).mockRejectedValue(new Error('network'))

    const initial: DiaryEntry[] = [{ practice: 'Meditation', data_type: 'Bool', value: { Bool: false } }]
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData<DiaryEntry[]>(['diary', '2026-07-29'], initial)

    render(
      <QueryClientProvider client={qc}>
        <PracticeCard
          practice={{ id: '1', practice: 'Meditation', data_type: 'Bool', is_active: true, is_required: false }}
          date="2026-07-29"
          currentValue={{ Bool: false }}
        />
      </QueryClientProvider>
    )

    await userEvent.click(screen.getByRole('switch'))

    // Wait for onError rollback to complete after rejected promise settles
    await waitFor(() => {
      const cached = qc.getQueryData<DiaryEntry[]>(['diary', '2026-07-29'])
      expect(cached).toEqual(initial)
    })
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd app-react && npm test PracticeCard
```

Expected: FAIL — `practicesApi.saveDiaryEntry` mock not recognised, or cache not updated.

- [ ] **Step 3: Update `mutation` in `PracticeCard.tsx`**

Find the `mutation` declaration in `PracticeCard.tsx` (around line 90). Replace the entire `useMutation({...})` block:

```ts
const mutation = useMutation({
  mutationFn: (v: PracticeValue) => practicesApi.saveDiaryEntry(date, practice.practice, v),
  onMutate: async (newValue) => {
    await qc.cancelQueries({ queryKey: ['diary', date] })
    const prev = qc.getQueryData<DiaryEntry[]>(['diary', date])
    qc.setQueryData<DiaryEntry[]>(['diary', date], (old = []) => {
      const entry: DiaryEntry = { practice: practice.practice, data_type: practice.data_type, value: newValue }
      const idx = old.findIndex(e => e.practice === practice.practice)
      if (idx >= 0) { const next = [...old]; next[idx] = entry; return next }
      return [...old, entry]
    })
    return { prev }
  },
  onSuccess: () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 1200)
  },
  onError: (_err, _val, ctx) => {
    if (ctx?.prev) qc.setQueryData(['diary', date], ctx.prev)
    setErrorFlash(true)
    setTimeout(() => setErrorFlash(false), 600)
    showToast({ message: t('home.saveFailed'), variant: 'error' })
  },
  onSettled: () => {
    qc.invalidateQueries({ queryKey: ['diary', date] })
  },
})
```

Add the `DiaryEntry` import at the top of `PracticeCard.tsx` (it comes from `../../types/api`):

```ts
import type { UserPractice, PracticeValue, DiaryEntry } from '../../types/api'
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd app-react && npm test PracticeCard
```

Expected: all tests pass including both new ones.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/pages/home/PracticeCard.tsx app-react/src/pages/home/PracticeCard.test.tsx
git commit -m "perf: optimistic diary save — update cache before server responds"
```

---

### Task 5: Export `getWeekDays` and prefetch visible week

**Files:**
- Modify: `app-react/src/pages/home/WeekCalendar.tsx`
- Modify: `app-react/src/pages/home/WeekCalendar.test.tsx`
- Modify: `app-react/src/pages/home/HomePage.tsx`
- Modify: `app-react/src/pages/home/HomePage.test.tsx`

**Interfaces:**
- Produces: `export function getWeekDays(date: Date): Date[]` — returns 7 `Date` objects Mon–Sun for the week containing `date`

- [ ] **Step 1: Write the failing test for `getWeekDays`**

Add to `app-react/src/pages/home/WeekCalendar.test.tsx`:

```ts
import { getWeekDays } from './WeekCalendar'

describe('getWeekDays', () => {
  it('returns 7 days starting on Monday for a Wednesday input', () => {
    const wednesday = new Date(2026, 6, 29) // July 29 2026
    const week = getWeekDays(wednesday)
    expect(week).toHaveLength(7)
    expect(week[0].getDay()).toBe(1) // Monday
    expect(week[6].getDay()).toBe(0) // Sunday
  })

  it('returns same week for any day within it', () => {
    const monday = new Date(2026, 6, 27)
    const sunday = new Date(2026, 6, 26 + 7) // Aug 2
    expect(getWeekDays(monday)[0].toDateString()).toBe(getWeekDays(sunday)[0].toDateString())
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd app-react && npm test WeekCalendar
```

Expected: FAIL — `getWeekDays is not exported`.

- [ ] **Step 3: Export `getWeekDays` from `WeekCalendar.tsx`**

Find the function declaration in `WeekCalendar.tsx`:

```ts
function getWeekDays(date: Date): Date[] {
```

Add the `export` keyword:

```ts
export function getWeekDays(date: Date): Date[] {
```

- [ ] **Step 4: Run the WeekCalendar tests to verify they pass**

```bash
cd app-react && npm test WeekCalendar
```

Expected: all tests pass including both new ones.

- [ ] **Step 5: Write the failing test for week prefetching**

Add to `app-react/src/pages/home/HomePage.test.tsx`:

```ts
it('prefetches diary entries for the other 6 days of the visible week on mount', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const prefetchSpy = vi.spyOn(qc, 'prefetchQuery').mockResolvedValue(undefined)

  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><HomePage /></MemoryRouter>
    </QueryClientProvider>
  )

  await screen.findByText('Meditation')

  const diaryPrefetches = prefetchSpy.mock.calls.filter(
    call => Array.isArray(call[0].queryKey) && call[0].queryKey[0] === 'diary'
  )
  expect(diaryPrefetches).toHaveLength(6)
})
```

- [ ] **Step 6: Run to confirm it fails**

```bash
cd app-react && npm test HomePage
```

Expected: FAIL — `prefetchQuery` not called.

- [ ] **Step 7: Add the prefetch effect to `HomePage.tsx`**

Add the import at the top of `HomePage.tsx`:

```ts
import { getWeekDays } from './WeekCalendar'
```

Add the new `useEffect` after the existing visibility-change effect (around line 70 in `HomePage.tsx`):

```ts
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
```

- [ ] **Step 8: Run all tests to verify everything passes**

```bash
cd app-react && npm test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add app-react/src/pages/home/WeekCalendar.tsx app-react/src/pages/home/WeekCalendar.test.tsx \
        app-react/src/pages/home/HomePage.tsx app-react/src/pages/home/HomePage.test.tsx
git commit -m "perf: prefetch diary entries for visible week — instant day navigation"
```
