# Sadhana Pro — Performance Improvements Design Spec

**Date:** 2026-07-29
**Approach:** Option B — Targeted fixes + week prefetching
**Scope:** Startup time, background image delivery, diary save perceived latency, week-day navigation latency

---

## Context

Lighthouse measured against the Vite dev server showed FCP 7.0s, LCP 14.4s, TBT 320ms — mostly explained by the dev server serving unminified JS. However, four real issues persist even in a production build:

1. `hydrateAuth()` blocks `ReactDOM.createRoot` behind a network round-trip
2. `bg.jpg` (636KB) has no preload hint — discovered late via CSS
3. `bg1.png` / `bg2.png` (3.6MB / 3.7MB) are sitting in `app-react/public/` and `frontend/images/` untracked and unreferenced
4. Diary saves have no optimistic updates — card border lag, plus tapping a new week day always triggers a fresh fetch with loading skeletons

---

## Section 1 — Startup & Initial Render

### 1a. Unblock React mount from auth hydration

**File:** `app-react/src/main.tsx`

**Current behavior:** `hydrateAuth()` calls `/api/users/me` and only resolves after the response arrives. `ReactDOM.createRoot().render()` is called inside `.then()` — the entire React tree is blocked behind that network round-trip on every authenticated page load.

**Change:** Flip order — mount React immediately, fire `hydrateAuth()` concurrently.

```ts
// Before
hydrateAuth().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
})

// After
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
hydrateAuth()
```

`ProtectedRoute` already renders `<Spinner />` while `isLoading: true` (the store's initial state), so the visible experience is identical — only the clock start changes. FCP moves from "after auth API" to "after JS parse".

### 1b. Preload background image

**File:** `app-react/index.html`

`bg.jpg` is referenced via `background-image: url(/bg.jpg)` in `AuthBackground.tsx`. The browser discovers it only after downloading and parsing the CSS bundle — typically 200–400ms into load.

Add to `<head>`:

```html
<link rel="preload" as="image" href="/bg.jpg" />
```

### 1c. Delete oversized unused images

**Files to delete:**
- `app-react/public/bg1.png` (3.6MB)
- `app-react/public/bg2.png` (3.7MB)
- `frontend/images/bg1.png` (3.6MB)
- `frontend/images/bg2.png` (3.7MB)

These were created during the background image selection experiments (commits `adc433e`, `db5892d`). Neither is referenced by any source file. Both locations must be removed — `app-react/public/` is included in the Vite production build; `frontend/images/` would be included in a Trunk/Yew build.

---

## Section 2 — Diary Save Optimistic Updates

**File:** `app-react/src/pages/home/PracticeCard.tsx`

### Current behavior

`mutation.onSuccess` calls `qc.invalidateQueries({ queryKey: ['diary', date] })`, triggering a full refetch. The card's `hasValue`-based green border and `currentValue` prop only update after the server round-trip + refetch completes.

### Change

Add `onMutate` to write the new value into the React Query cache immediately. Roll back on error. Move invalidation + flash to `onSettled` (fires on both success and error).

```ts
onMutate: async (newValue) => {
  await qc.cancelQueries({ queryKey: ['diary', date] })
  const prev = qc.getQueryData<DiaryEntry[]>(['diary', date])
  qc.setQueryData<DiaryEntry[]>(['diary', date], (old = []) => {
    const idx = old.findIndex(e => e.practice === practice.practice)
    const entry = { practice: practice.practice, value: newValue }
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
```

`onSuccess` handles the green flash (only fires on actual success). `onSettled` handles invalidation on both success and error paths, syncing the cache with the server after the optimistic update settles. The existing `onSuccess` is replaced by this split.

The `DiaryEntry` type is already defined in `app-react/src/types/api.ts` and used in `practicesApi.getDiaryEntries`.

---

## Section 3 — Prefetch Visible Week Days

**Files:** `app-react/src/pages/home/WeekCalendar.tsx`, `app-react/src/pages/home/HomePage.tsx`

### Current behavior

Tapping a new day in the WeekCalendar changes `dateStr`, which changes the `['diary', dateStr]` query key, triggering a fresh fetch. Loading skeletons flash on every day tap.

### Change

**WeekCalendar.tsx:** Export `getWeekDays` (currently module-private):

```ts
export function getWeekDays(date: Date): Date[] { ... }
```

**HomePage.tsx:** Add a prefetch effect that fires on mount and whenever the week changes:

```ts
import { getWeekDays } from './WeekCalendar'

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

This fires 6 parallel requests on mount (the 7th day is the current `dateStr` already being fetched by `diaryQuery`). Each request is small. React Query deduplicates concurrent calls and respects `staleTime`, so navigating back to a cached day within 60 seconds costs nothing.

---

## Files Changed

| File | Change |
|---|---|
| `app-react/src/main.tsx` | Flip render/hydrate order |
| `app-react/index.html` | Add `<link rel="preload">` for `bg.jpg` |
| `app-react/public/bg1.png` | Delete |
| `app-react/public/bg2.png` | Delete |
| `frontend/images/bg1.png` | Delete |
| `frontend/images/bg2.png` | Delete |
| `app-react/src/pages/home/PracticeCard.tsx` | Add `onMutate`, `onError` rollback, replace `onSuccess` with `onSettled` |
| `app-react/src/pages/home/WeekCalendar.tsx` | Export `getWeekDays` |
| `app-react/src/pages/home/HomePage.tsx` | Import `getWeekDays`, add week prefetch effect |

---

## Expected Impact

| Metric | Before | After (production build) |
|---|---|---|
| FCP | 7.0s (dev) / ~1.5s (prod) | ~0.8–1.0s |
| LCP | 14.4s (dev) / ~3–4s (prod) | ~1.5–2.5s |
| Diary save visual feedback | After server + refetch | Instant |
| Day navigation | Fresh fetch + skeletons | Instant (cached) |
