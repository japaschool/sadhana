---
name: ui-polish
description: Design spec for 11 UX/UI polish improvements to the React app — visual fixes, navigation consistency, structural improvements, drag-to-reorder
metadata:
  type: project
---

# UI Polish — Design Spec

**Date:** 2026-07-26
**Branch:** redesign
**Scope:** `app-react/` only

---

## Background

11 improvements identified after feature-parity work with the Rust frontend. Grouped into 4 sections by complexity.

---

## Section 1 — Quick Visual Fixes

### 1.1 Text Practice Save Flash

**File:** `app-react/src/pages/home/PracticeCard.tsx`

The `flash` state and `setFlash(true)` + 1200ms timeout pattern already exists for Bool, Int, Duration, and Time types. The Text branch (both `<select>` dropdown and free `<input>`) doesn't trigger it.

**Fix:** Call `save()` through a wrapper that also triggers the flash, or call `setFlash(true)` directly after `save()` in both Text branches' onChange/onBlur handlers.

### 1.2 Duration Quick-Add Loading State

**File:** `app-react/src/pages/home/PracticeCard.tsx`

`DurationQuickAddModal` receives an `onAdd` callback but has no way to know if the save is in flight. The parent's `mutation.isPending` is available in `PracticeCard`.

**Fix:** Add `isPending?: boolean` prop to `DurationQuickAddModal`. While `isPending` is true: disable the Add button and show a small spinner (`loading loading-spinner loading-xs`) inside it. Pass `mutation.isPending` from `PracticeCard`.

### 1.3 Charts Empty State

**File:** `app-react/src/pages/charts/ChartsPage.tsx`

When `reports.length === 0` (after loading completes), the page shows nothing below the duration strip.

**Fix:** Add a conditional render: when `reportsQuery.data` is defined and empty, show a glass card:
```
No reports yet. Tap + to create your first one.
```
Same `glass` style as other cards on the page. No new component needed.

### 1.4 Diary API Error State

**File:** `app-react/src/pages/home/HomePage.tsx`

`diaryQuery.isError` is available but unused. When the diary fails to load, the page silently shows nothing.

**Fix:** Below the `isLoading` spinner check, add:
```tsx
{(diaryQuery.isError || practicesQuery.isError) && (
  <ErrorBanner message={t('common.error')} />
)}
```
`ErrorBanner` is already imported/available in the codebase.

### 1.5 Auth Page Background Consistency

**Files:** `app-react/src/components/layout/AppShell.tsx`, all 5 auth pages

Each auth page sets its own inline `backgroundImage` + no overlay. `AppShell` has its own background + overlay div. Changing the overlay value in AppShell doesn't affect auth pages.

**Fix:** Extract into a shared `AuthBackground` component at `app-react/src/components/layout/AuthBackground.tsx`:

```tsx
export function AuthBackground() {
  return (
    <>
      <div className="fixed inset-0 -z-10" style={{
        backgroundImage: 'url(/login-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />
      <div className="fixed inset-0 -z-10 pointer-events-none"
           style={{ background: 'rgba(255,255,255,0.25)' }} />
    </>
  )
}
```

- `AppShell` replaces its two background divs with `<AuthBackground />`
- Each auth page removes its inline `backgroundImage` style and renders `<AuthBackground />` at the top of its return
- Single source of truth: overlay value lives only in `AuthBackground`

---

## Section 2 — Navigation Consistency

### 2.1 TopBar Back vs Close X

**Rule:** pages that are dead ends in a flow (edit, new, settings) get `showClose` (X button). Pages in a browsing stack get `showBack` (← arrow). Pages with a glass header card + their own X button need no TopBar navigation at all.

**Audit and changes:**

| Page | Current | Fix |
|------|---------|-----|
| `YatraAdminSettingsPage` | `showBack` | `showClose` → navigates to `/yatra/${id}/settings` |
| `YatraPracticeEditPage` | `showBack` | `showClose` → navigates to `/yatra/${id}/admin/settings` |
| `YatraPracticeNewPage` | `showBack` | `showClose` → navigates to `/yatra/${id}/admin/settings` |
| `PracticeEditPage` | glass header with X | no change |
| `YatraSettingsPage` | glass header with X | no change |

**TopBar `showClose` behaviour:** navigates via `useNavigate(-1)` (go back in history) — already implemented in TopBar for `showClose`.

### 2.2 Yatra Settings Save Navigation

**File:** `app-react/src/pages/yatras/YatraSettingsPage.tsx`

After saving practice mappings, `saveMutation.onSuccess` navigates to `/yatras`, losing the user's yatra context.

**Fix:** Remove the `navigate('/yatras')` call from `onSuccess`. Instead, show a brief success state on the Save button (change label to ✓ for 1.5s using a `useState` flag). The X button in the glass header already handles closing to `/yatras`.

---

## Section 3 — UX Structure

### 3.1 Practice Card Required/Optional Grouping

**File:** `app-react/src/pages/home/HomePage.tsx`

All active practices render in a flat list. Required practices should appear first with a clear visual separation.

**Fix:** Split `activePractices` into two arrays:
```ts
const required = activePractices.filter(p => p.is_required)
const optional = activePractices.filter(p => !p.is_required)
```

Render order:
1. Required practices (no label if `optional.length === 0`)
2. Divider + "Optional" label — only when both arrays are non-empty:
   ```tsx
   <div className="flex items-center gap-2 px-1">
     <div className="flex-1 h-px bg-black/8" />
     <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
       {t('home.optional')}
     </span>
     <div className="flex-1 h-px bg-black/8" />
   </div>
   ```
3. Optional practices

Add i18n key `home.optional` to all three locale files.

### 3.2 Tab/Background Diary Refresh

**File:** `app-react/src/pages/home/HomePage.tsx`

When the browser tab is re-focused, stale diary data isn't refreshed.

**Fix:** Add a `useEffect` in `HomePage`:
```ts
useEffect(() => {
  function onVisible() {
    if (document.visibilityState === 'visible') {
      qc.invalidateQueries({ queryKey: ['diary', dateStr] })
    }
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}, [qc, dateStr])
```

Only invalidates diary (not practices — those change rarely and are user-initiated).

---

## Section 4 — Drag-to-Reorder & Heatmap Staleness

### 4.1 Drag-to-Reorder Practices

**File:** `app-react/src/pages/settings/MyPracticesPage.tsx`

`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` are already installed. `practicesApi.reorderUserPractices(ids: string[])` already exists.

**Implementation:**

- Wrap practice list with `<DndContext sensors={sensors} onDragEnd={handleDragEnd}>` and `<SortableContext items={ids} strategy={verticalListSortingStrategy}>`
- Each row uses `useSortable({ id: practice.id })` to get drag props and `transform`
- Add a `<LuGripVertical>` drag handle on the left of each row (already using react-icons/lu)
- `DragOverlay`: renders a copy of the dragged card at 95% opacity while dragging
- `handleDragEnd`: uses `arrayMove` from `@dnd-kit/sortable` to reorder local state, then calls `practicesApi.reorderUserPractices(newIds)` — optimistic, no rollback on error (keep it simple)
- Sensors: `useSensor(PointerSensor)` with a `{ activationConstraint: { distance: 8 } }` to avoid accidental drags on tap

**Local state:** maintain a `localPractices` state initialized from `data` and updated on drag. Use `useEffect` to sync when `data` changes (e.g. after a delete/add).

### 4.2 Yatra Heatmap Cache Staleness

**File:** `app-react/src/pages/yatras/YatraAdminSettingsPage.tsx`

The yatra practices + member data queries don't refetch when the admin returns to the tab, so heatmap scores can show stale data.

**Fix:** Add `refetchOnWindowFocus: true` to the three queries in `YatraAdminSettingsPage`:
- `['yatra-practices', id]`
- `['yatra-members', id]`
- `['yatra-member-diaries', id, ...]`

This is a one-line addition per query. TanStack Query handles the refetch automatically on window focus.

---

## Implementation Order

1. Section 1 quick fixes (5 items — all small, independent)
2. Section 2 navigation (2 items — small, touch TopBar and YatraSettings)
3. Section 3 UX structure (2 items — small-medium, touch HomePage)
4. Section 4 drag-to-reorder (complex, touch MyPracticesPage heavily) + heatmap fix

---

## Files Affected Summary

| File | Changes |
|------|---------|
| `app-react/src/pages/home/PracticeCard.tsx` | Text flash, duration loading state |
| `app-react/src/pages/home/HomePage.tsx` | Error state, grouping, tab refresh |
| `app-react/src/pages/charts/ChartsPage.tsx` | Empty state |
| `app-react/src/components/layout/AuthBackground.tsx` | New shared component |
| `app-react/src/components/layout/AppShell.tsx` | Use AuthBackground |
| `app-react/src/pages/auth/LoginPage.tsx` | Use AuthBackground |
| `app-react/src/pages/auth/RegisterPage.tsx` | Use AuthBackground |
| `app-react/src/pages/auth/ConfirmationPage.tsx` | Use AuthBackground |
| `app-react/src/pages/auth/PwdResetPage.tsx` | Use AuthBackground |
| `app-react/src/pages/auth/PwdResetRequestPage.tsx` | Use AuthBackground |
| `app-react/src/pages/yatras/YatraAdminSettingsPage.tsx` | showClose, heatmap refetch |
| `app-react/src/pages/yatras/YatraPracticeEditPage.tsx` | showClose |
| `app-react/src/pages/yatras/YatraPracticeNewPage.tsx` | showClose |
| `app-react/src/pages/yatras/YatraSettingsPage.tsx` | Save success flash, no navigate |
| `app-react/src/pages/settings/MyPracticesPage.tsx` | Drag-to-reorder |
| `app-react/public/locales/en/translation.json` | `home.optional` |
| `app-react/public/locales/ru/translation.json` | `home.optional` |
| `app-react/public/locales/uk/translation.json` | `home.optional` |
