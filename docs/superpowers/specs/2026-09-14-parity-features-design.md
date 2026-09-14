# Design spec — Parity features (app-react)

**Date:** 2026-09-14  
**Branch:** redesign  
**Scope:** Six features present in the Rust/Yew frontend (`main`) that are missing from the React `app-react` frontend.

---

## Background

A comparison of `main` vs `redesign` identified six missing features in `app-react`. Dark mode toggle was explicitly excluded per user request. The remaining six are addressed here.

---

## Features

### 1. Practice hide/show toggle

**File:** `app-react/src/pages/settings/MyPracticesPage.tsx`

Each row in `SortableRow` gains an eye-icon toggle button alongside the existing Edit and Delete buttons. Tapping it calls `practicesApi.updateUserPractice(id, { is_active: !practice.is_active })` and invalidates the `['practices']` query.

Inactive rows are rendered at 40% opacity with the practice name struck through, so users can see what is hidden without confusion. The home page already filters by `is_active`, so no other files need changing.

The `updateUserPractice` method in `practices.ts` currently hard-codes `is_active: true` — this must be changed to pass the value from the caller.

**New i18n keys:** `practice.hide`, `practice.show`

---

### 2. Per-trace Y-axis selector (Left / Right)

**File:** `app-react/src/pages/charts/ChartsPage.tsx`

**Trace editor:** In the per-trace row inside `ReportCard`, add a two-option `<select>` after the type selector:
- **Auto** (value `null`) — axis is assigned automatically based on data type (existing behaviour)
- **Right axis** (value `'Y2'`) — forces the trace onto a right-side axis

Selecting a value calls `changeTrace(practice, { y_axis: value })`.

**Chart rendering:** When any trace in a Graph report has `y_axis === 'Y2'`, a second `<YAxis yAxisId="right" orientation="right">` is added for numeric values. Trace bars/lines with `y_axis === 'Y2'` are routed to `yAxisId="right"` instead of `"num"`. All other auto-detection by data type remains unchanged for traces with `y_axis === null`.

**New i18n keys:** `charts.yAxis`, `charts.yAxisAuto`, `charts.yAxisRight`

---

### 3. About link + App update notification

**File:** `app-react/src/pages/settings/SettingsPage.tsx`  
**New file:** `app-react/src/hooks/useServiceWorkerUpdate.ts`

**About link:** A new `MenuItem` added to the App section linking to `https://sadhana.pro` with `target="_blank" rel="noopener noreferrer"`. Uses an info icon. Static — no state needed.

**Service worker update hook:** `useServiceWorkerUpdate()` registers a listener on the `navigator.serviceWorker` `controllerchange` event. On fire, it sets `updateReady = true`. `applyUpdate` calls `window.location.reload()`. The hook is safe to call when `navigator.serviceWorker` is undefined (SSR / no-SW environments).

**Settings integration:** When `updateReady` is true, an "Update app" item appears at the top of the App section, visually highlighted with the amber accent. Clicking it calls `applyUpdate`.

**New i18n keys:** `settings.about`, `settings.updateApp`

---

### 4. Yatra practice drag-to-reorder

**File:** `app-react/src/pages/yatras/YatraAdminSettingsPage.tsx`

`@dnd-kit/core` and `@dnd-kit/sortable` are already installed (used in `MyPracticesPage`).

The practices list in the admin settings "Practices" section is refactored:
- The list is wrapped in `<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>` + `<SortableContext items={practiceIds} strategy={verticalListSortingStrategy}>`.
- Each practice row uses `useSortable({ id: p.id })` and applies `transform` / `transition` styles. The existing `FaGripVertical` icon becomes the drag handle via `{...attributes} {...listeners}`.
- `handleDragEnd` reorders the local list with `arrayMove` and calls `yatrasApi.reorderPractices(yatraId, reorderedIds)`, then invalidates `['yatra-practices', id]`.

A local copy of `practices` order is kept in state (initialised from the query data, same pattern as `MyPracticesPage`).

**No new i18n keys needed.**

---

### 5. Native Web Share for yatra invite

**File:** `app-react/src/pages/yatras/YatraAdminSettingsPage.tsx`

The "Copy invite link" button gains conditional native share behaviour:

```
const canNativeShare = typeof navigator.share === 'function' && navigator.canShare?.({ url: inviteUrl })
```

- If `canNativeShare` is true: clicking calls `navigator.share({ title: yatraName, url: inviteUrl })`. Button shows a share icon and label `yatras.shareInvite`. No "copied" toast (the OS handles feedback).
- If false: existing clipboard copy behaviour is unchanged (`yatras.copyInvite` + `yatras.inviteCopied` toast).

**New i18n key:** `yatras.shareInvite`

---

## i18n changes

All three locale files (`en`, `ru`, `uk`) must be updated with the new keys.

| Key | EN value |
|-----|----------|
| `practice.hide` | Hide practice |
| `practice.show` | Show practice |
| `charts.yAxis` | Y-axis |
| `charts.yAxisAuto` | Auto |
| `charts.yAxisRight` | Right axis |
| `settings.about` | About Sadhana |
| `settings.updateApp` | Update app |
| `yatras.shareInvite` | Share invite link |

---

## Files touched

| File | Change |
|------|--------|
| `app-react/src/pages/settings/MyPracticesPage.tsx` | Add hide/show toggle button + dim inactive rows |
| `app-react/src/api/practices.ts` | Fix `updateUserPractice` to pass `is_active` from caller |
| `app-react/src/pages/charts/ChartsPage.tsx` | Y-axis select in trace editor + right-axis rendering |
| `app-react/src/hooks/useServiceWorkerUpdate.ts` | New hook |
| `app-react/src/pages/settings/SettingsPage.tsx` | About link + app update item |
| `app-react/src/pages/yatras/YatraAdminSettingsPage.tsx` | Practice reorder (dnd-kit) + native share |
| `app-react/public/locales/en/translation.json` | New keys |
| `app-react/public/locales/ru/translation.json` | New keys |
| `app-react/public/locales/uk/translation.json` | New keys |

---

## Out of scope

- Dark mode toggle (explicitly excluded)
- Additional Y-axis options beyond Left / Right
