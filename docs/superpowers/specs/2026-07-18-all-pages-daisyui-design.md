# Sadhana Pro — All Pages + DaisyUI Light Theme Design Spec

**Date:** 2026-07-18
**Scope:** Replace dark navy design system with DaisyUI v5 light theme; build all remaining pages (Phases 2–6) across Home, Charts, Yatras, Settings, and Help tabs; add Apple/Google login UI stubs to the Login page.

---

## 1. Design System Migration

### From → To

The existing Tailwind v4 `@theme` dark tokens (`--color-surface-0`, `--color-gold`, etc.) are **removed entirely** and replaced with DaisyUI v5's CSS variable system.

### Installation

```bash
npm install daisyui@5
```

Add to `index.css`:
```css
@import "tailwindcss";
@plugin "daisyui";
```

### Light Theme

Applied via `[data-theme="light"]` on `<html>` (set in `main.tsx`). The exact decoded theme from the user-supplied URL:

```json
{
  "name": "light",
  "color-scheme": "light",
  "--color-base-100": "oklch(100% 0 0)",
  "--color-base-200": "oklch(98% 0 0)",
  "--color-base-300": "oklch(95% 0 0)",
  "--color-base-content": "oklch(21% 0.006 285.885)",
  "--color-primary": "oklch(45% 0.24 277.023)",
  "--color-primary-content": "oklch(93% 0.034 272.788)",
  "--color-secondary": "oklch(65% 0.241 354.308)",
  "--color-secondary-content": "oklch(94% 0.028 342.258)",
  "--color-accent": "oklch(77% 0.152 181.912)",
  "--color-accent-content": "oklch(38% 0.063 188.416)",
  "--color-neutral": "oklch(14% 0.005 285.823)",
  "--color-neutral-content": "oklch(92% 0.004 286.32)",
  "--color-info": "oklch(74% 0.16 232.661)",
  "--color-success": "oklch(76% 0.177 163.223)",
  "--color-warning": "oklch(82% 0.189 84.429)",
  "--color-error": "oklch(71% 0.194 13.428)",
  "--radius-selector": "0.5rem",
  "--radius-field": "0.25rem",
  "--radius-box": "0.5rem",
  "--border": "1px",
  "--depth": "1",
  "--noise": "0"
}
```

In CSS:

```css
@import "tailwindcss";
@plugin "daisyui";

[data-theme="light"] {
  --color-base-100: oklch(100% 0 0);
  --color-base-200: oklch(98% 0 0);
  --color-base-300: oklch(95% 0 0);
  --color-base-content: oklch(21% 0.006 285.885);
  --color-primary: oklch(45% 0.24 277.023);
  --color-primary-content: oklch(93% 0.034 272.788);
  --color-secondary: oklch(65% 0.241 354.308);
  --color-secondary-content: oklch(94% 0.028 342.258);
  --color-accent: oklch(77% 0.152 181.912);
  --color-accent-content: oklch(38% 0.063 188.416);
  --color-neutral: oklch(14% 0.005 285.823);
  --color-neutral-content: oklch(92% 0.004 286.32);
  --color-info: oklch(74% 0.16 232.661);
  --color-success: oklch(76% 0.177 163.223);
  --color-warning: oklch(82% 0.189 84.429);
  --color-error: oklch(71% 0.194 13.428);
  --radius-selector: 0.5rem;
  --radius-field: 0.25rem;
  --radius-box: 0.5rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}

html, body, #root {
  height: 100%;
}
```

`<html data-theme="light">` set in `index.html`.

### Component Refactor (Phase 1 components)

All existing UI primitives are rebuilt using DaisyUI classes:

| Component | Old classes | New classes |
|---|---|---|
| `Button` primary | `bg-gold text-surface-0 rounded-full` | `btn btn-primary` |
| `Button` secondary | `border-teal text-teal rounded-full` | `btn btn-outline` |
| `Input` | `bg-surface-2 border-white/8` | `fieldset` + `input input-bordered w-full` |
| `Card` | `bg-surface-1 border-white/10 rounded-2xl` | `card bg-base-100 shadow-sm` |
| `Spinner` | custom SVG animate-spin | `span class="loading loading-spinner loading-md"` |
| `ErrorBanner` | `bg-danger/15 border-danger/30` | `alert alert-error` |

New shared components added:
- `ConfirmModal` — daisyUI `modal` wrapper with confirm/cancel slots
- `PracticeForm` — shared by user and yatra practice routes (see Section 7)

### Layout Shell Updates

- `TopBar` background: `bg-base-100 border-b border-base-300` (was dark navy)
- `BottomNav` background: `bg-base-100 border-t border-base-300`
- Active tab: `text-primary` (was gold)
- Page backgrounds: `bg-base-200` (was `bg-surface-0`)

---

## 2. New Packages

```bash
npm install daisyui@5 @dnd-kit/core @dnd-kit/sortable react-dropzone
```

---

## 3. Auth Pages

All auth pages: `bg-base-200` page, `card bg-base-100 shadow-sm w-full max-w-sm` centered card.

### Login (`/login`) — additions

Below the email/password form, a daisyUI `divider` ("or"), then two social login buttons:

```tsx
<div className="divider">or</div>
<button className="btn btn-outline w-full gap-2" onClick={handleAppleLogin}>
  <FaApple className="w-5 h-5" /> Continue with Apple
</button>
<button className="btn btn-outline w-full gap-2" onClick={handleGoogleLogin}>
  <FaGoogle className="w-5 h-5" /> Continue with Google
</button>
```

`handleAppleLogin` and `handleGoogleLogin` are no-op stubs with `// TODO: wire OAuth` comment.

No changes to Register, Confirmation, PwdResetRequest, or PwdResetPage beyond color/component swap.

---

## 4. Home Tab (`/`)

### Route: `/`

**Component:** `HomePage`

**TopBar variant:** date navigator — `← {date} →` centered, with a sync icon (`FaSync`) on the right that triggers `refetch()` on the diary query.

**Data:** `GET /api/diary?date=YYYY-MM-DD` → array of `DiaryEntry` with optional current `value`. Also `GET /api/user/practices` for the full practice list (to show cards even with no entry yet).

**Layout:**
- `bg-base-200` page, `pt-14 pb-20` (TopBar + BottomNav + FAB clearance)
- Scrollable list of `PracticeCard` sub-components (one per active `UserPractice`)
- Fixed FAB: `btn btn-primary btn-circle btn-lg` bottom-right → `/user/practice/new`
- Offline banner: `alert alert-warning` pinned below TopBar when offline

**`PracticeCard`** sub-component (`src/pages/home/PracticeCard.tsx`):
- `card bg-base-100 shadow-sm p-4`
- Practice name as `card-title`
- Input control by `data_type`:
  - `Int`: `<input type="number" className="input input-bordered w-24">` with `−` / `+` `btn btn-sm btn-ghost` buttons
  - `Bool`: `<input type="checkbox" className="toggle toggle-primary">`
  - `Text`: `<input type="text" className="input input-bordered w-full">`
  - `Time`: two `<input type="number" className="input input-bordered w-16">` joined with `:`
  - `Duration`: `<input type="number" className="input input-bordered w-24">` + "min" badge
  - Dropdown: `<select className="select select-bordered w-full">` with `dropdown_variants` options
- Completion indicator: filled `badge badge-success badge-xs` top-right when value saved
- Value changes debounced 600ms → `PUT /api/diary` mutation via TanStack Query

**Date navigation:** `useState` for selected date (default today). `←` / `→` buttons decrement/increment by one day. Date displayed as `"MMM D"` (e.g. "Jul 18").

---

## 5. Charts Tab

### Route: `/charts`

**Component:** `ChartsPage`

**Data:** `GET /api/charts` → array of saved reports

**Layout:**
- Grid of `card bg-base-100 shadow-sm` cards
- Each card: report name, date range subtitle, small 50px-tall Recharts `LineChart` thumbnail (no axes, no tooltip)
- Tap card → full-page `dialog` modal showing the full Recharts chart + "Share" button that copies `/shared/:id` URL to clipboard
- Empty state: centered text "No reports yet" + `btn btn-primary` "Create report"
- FAB → `/charts/new`

### Route: `/charts/new`

**Component:** `NewChartPage`

daisyUI `steps` at top (3 steps).

- **Step 1 — Pick metrics:** checkbox list of active `UserPractice` names; at least one required
- **Step 2 — Date range:** two `<input type="date">` (from/to); quick-select chips: "Last 7 days" / "Last 30 days" / "Last 90 days"
- **Step 3 — Chart type:** three `card` radio options with icons: Line / Bar / Grid; live preview Recharts chart below using mock data shaped like the real data
- Footer: `btn btn-ghost` "Back" + `btn btn-primary` "Next" / "Save"
- Save → `POST /api/charts` → redirect to `/charts`

### Route: `/shared/:id`

**Component:** `SharedChartPage`

- No TopBar or BottomNav (standalone layout)
- `bg-base-200` full page
- Centered `card bg-base-100 shadow-sm p-6`: chart title, date range, full Recharts chart, "Made with Sadhana Pro" footer
- Fetches `GET /api/charts/shared/:id` (no auth token sent)

---

## 6. Yatras Tab

### Route: `/yatras`

**Component:** `YatrasPage`

**Data:** `GET /api/yatras`

- List of `card bg-base-100 shadow-sm` cards
- Each: yatra name, member count badge, practice count badge, `badge badge-success` "Member" if joined
- Member card tap → `/yatra/:id/settings`; non-member → `/yatra/:id/join`
- Empty state: "No yatras found"

### Route: `/yatra/:id/join`

**Component:** `YatraJoinPage`

- Card: yatra name, description, member count, list of practices (read-only)
- `btn btn-primary w-full` "Join" → `POST /api/yatras/:id/join` → redirect to `/yatra/:id/settings`
- `btn btn-ghost w-full` "Back"

### Route: `/yatra/:id/settings` (member view)

**Component:** `YatraSettingsPage`

- Yatra name header
- `tabs tabs-bordered`: Members tab / Practices tab
- Members tab: avatar list (`avatar placeholder`) with names
- Practices tab: read-only practice cards (name + type badge)
- Bottom: `btn btn-error btn-outline w-full` "Leave yatra" → `ConfirmModal` → `DELETE /api/yatras/:id/members/me` → redirect to `/yatras`
- Admin users see an "Admin settings" link → `/yatra/:id/admin/settings`

### Route: `/yatra/:id/admin/settings`

**Component:** `YatraAdminSettingsPage`

- Editable yatra name (inline `input` with save icon)
- "Copy invite link" `btn btn-outline` (copies join URL to clipboard)
- Members tab: each member row has a `btn btn-ghost btn-xs` remove button → `ConfirmModal` → `DELETE /api/yatras/:id/members/:memberId`
- Practices tab: each practice row has edit icon → `/yatra/:id/practice/:practice_id/edit` and delete icon → `ConfirmModal` → `DELETE /api/yatras/:id/practices/:practiceId`
- FAB → `/yatra/:id/practice/new`

### Routes: `/yatra/:id/practice/new` and `/yatra/:id/practice/:practice_id/edit`

Use shared `PracticeForm` with `mode={{ type: 'yatra', yatraId: id }}`.

---

## 7. Shared Component: `PracticeForm`

**File:** `src/components/PracticeForm.tsx`

**Props:**
```ts
type PracticeFormMode =
  | { type: 'user' }
  | { type: 'yatra'; yatraId: string }

interface PracticeFormProps {
  mode: PracticeFormMode
  initialValues?: { name: string; dataType: PracticeDataType; dropdownVariants?: string }
  onSuccess: () => void
}
```

**Fields:**
- Practice name: `input input-bordered w-full`
- Data type: `select select-bordered w-full` (Int / Bool / Text / Time / Duration / Dropdown)
- Dropdown variants textarea: shown only when type is Dropdown; one variant per line
- `btn btn-primary w-full` "Save"

**Submit logic:**
- New user practice: `POST /api/user/practices`
- Edit user practice: `PUT /api/user/practices/:id`
- New yatra practice: `POST /api/yatras/:yatraId/practices`
- Edit yatra practice: `PUT /api/yatras/:yatraId/practices/:id`

On success: calls `onSuccess()` which navigates back.

---

## 8. Settings Tab

### Route: `/settings`

**Component:** `SettingsPage`

daisyUI `menu bg-base-100 rounded-box shadow-sm` grouped list:

```
Account
  → Edit profile          /settings/edit-user
  → Change password       /settings/edit-password

Practices
  → My practices          /user/practices

Data
  → Import data           /settings/import

App
  → Language              /settings/language
  → Help & FAQ            /help
```

Bottom: `btn btn-error btn-outline w-full` "Log out" → clears auth store + navigates to `/login`

### Route: `/settings/edit-user`

- Name `input input-bordered`, email `input input-bordered` (disabled/read-only)
- `btn btn-primary` "Save" → `PUT /api/user` → success toast (`alert alert-success` auto-dismiss)

### Route: `/settings/edit-password`

- Current password, new password, confirm new password inputs
- Client-side: new ≠ confirm → inline error before submitting
- `btn btn-primary` "Save" → `PUT /api/user/password`

### Route: `/user/practices`

**Component:** `MyPracticesPage`

- `@dnd-kit/sortable` drag-to-reorder list
- Each row: drag handle icon, practice name, `badge` showing data type, `toggle toggle-xs` for active/inactive, edit icon → `/user/practice/:id/edit`, trash icon → `ConfirmModal` → `DELETE /api/user/practices/:id`
- On drag end: `PUT /api/user/practices/reorder` with new ordered array of IDs
- FAB → `/user/practice/new`

### Routes: `/user/practice/new` and `/user/practice/:id/edit`

Use shared `PracticeForm` with `mode={{ type: 'user' }}`.

### Route: `/settings/import`

**Component:** `ImportPage`

daisyUI `steps` (3 steps):

- **Step 1 — Upload:** `react-dropzone` drop zone + file browse; accepts `.csv` only; shows file name on select
- **Step 2 — Column mapping:** table where each row is a CSV column; right side is a `select` to map to a practice or "ignore"; fetched from `POST /api/import/preview` which returns column names + sample rows
- **Step 3 — Confirm:** row count preview, `btn btn-primary` "Import" → `POST /api/import` → success state with count

### Route: `/settings/language`

- Three `card` radio options: English / Русский / Українська
- Selecting one: calls `i18n.changeLanguage(code)` + stores in localStorage
- Active card highlighted with `border-primary`

### Route: `/help`

**Component:** `HelpPage`

- 6–8 FAQ items as daisyUI `collapse collapse-arrow bg-base-100 shadow-sm` accordion
- Example questions: "How do I log a practice?", "What is a Yatra?", "How do I share a chart?", "Can I use the app offline?", "How do I import data?", "How do I change my language?"
- Link at bottom → `/help/support-form`

### Route: `/help/support-form`

**Component:** `SupportPage`

- Name `input`, email `input`, message `textarea textarea-bordered h-32`
- `btn btn-primary w-full` "Send" → `POST /api/support` (if endpoint exists) or `mailto:` fallback
- Success state: "Thank you — we'll be in touch"

---

## 9. New API Modules

`src/api/practices.ts`:
- `getUserPractices(): Promise<UserPractice[]>` — `GET /api/user/practices`
- `createUserPractice(data): Promise<UserPractice>` — `POST /api/user/practices`
- `updateUserPractice(id, data): Promise<void>` — `PUT /api/user/practices/:id`
- `deleteUserPractice(id): Promise<void>` — `DELETE /api/user/practices/:id`
- `reorderUserPractices(ids: string[]): Promise<void>` — `PUT /api/user/practices/reorder`
- `getDiaryEntries(date: string): Promise<DiaryEntry[]>` — `GET /api/diary?date=`
- `saveDiaryEntry(date, practice, value): Promise<void>` — `PUT /api/diary`

`src/api/charts.ts`:
- `getCharts(): Promise<ChartReport[]>` — `GET /api/charts`
- `createChart(data): Promise<ChartReport>` — `POST /api/charts`
- `getSharedChart(id): Promise<SharedChart>` — `GET /api/charts/shared/:id`

`src/api/yatras.ts`:
- `getYatras(): Promise<Yatra[]>` — `GET /api/yatras`
- `getYatra(id): Promise<Yatra>` — `GET /api/yatras/:id`
- `joinYatra(id): Promise<void>` — `POST /api/yatras/:id/join`
- `leaveYatra(id): Promise<void>` — `DELETE /api/yatras/:id/members/me`
- `removeMember(yatraId, memberId): Promise<void>` — `DELETE /api/yatras/:id/members/:memberId`
- `updateYatra(id, data): Promise<void>` — `PUT /api/yatras/:id`
- `createYatraPractice(yatraId, data): Promise<void>` — `POST /api/yatras/:id/practices`
- `updateYatraPractice(yatraId, practiceId, data): Promise<void>` — `PUT /api/yatras/:id/practices/:practiceId`
- `deleteYatraPractice(yatraId, practiceId): Promise<void>` — `DELETE /api/yatras/:id/practices/:practiceId`

`src/api/import.ts`:
- `previewImport(file: File): Promise<ImportPreview>` — `POST /api/import/preview`
- `confirmImport(mapping): Promise<ImportResult>` — `POST /api/import`

`src/api/support.ts`:
- `sendSupportMessage(data): Promise<void>` — `POST /api/support`

---

## 10. New TypeScript Types

Added to `src/types/api.ts`:

```ts
export interface ChartReport {
  id: string
  name: string
  practices: string[]
  date_from: string
  date_to: string
  chart_type: 'Line' | 'Bar' | 'Grid'
  share_id?: string
}

export interface SharedChart extends ChartReport {
  entries: DiaryEntry[]
}

export interface Yatra {
  id: string
  name: string
  description?: string
  member_count: number
  is_member: boolean
  is_admin: boolean
  practices: UserPractice[]
  members: YatraMember[]
}

export interface YatraMember {
  id: string
  name: string
}

export interface ImportPreview {
  columns: string[]
  sample_rows: string[][]
}

export interface ImportResult {
  imported_count: number
}
```

---

## 11. Router Additions

All new page components use `React.lazy()`. New routes added to `router.tsx`:

```tsx
// Authenticated routes (inside ProtectedRoute > AppShell)
{ path: '/charts', element: <ChartsPage /> },
{ path: '/charts/new', element: <NewChartPage /> },
{ path: '/yatras', element: <YatrasPage /> },
{ path: '/settings', element: <SettingsPage /> },
{ path: '/settings/edit-user', element: <EditUserPage /> },
{ path: '/settings/edit-password', element: <EditPasswordPage /> },
{ path: '/settings/import', element: <ImportPage /> },
{ path: '/settings/language', element: <LanguagePage /> },
{ path: '/user/practices', element: <MyPracticesPage /> },
{ path: '/user/practice/new', element: <PracticeNewPage /> },
{ path: '/user/practice/:id/edit', element: <PracticeEditPage /> },
{ path: '/help', element: <HelpPage /> },
{ path: '/help/support-form', element: <SupportPage /> },
{ path: '/yatra/:id/join', element: <YatraJoinPage /> },
{ path: '/yatra/:id/settings', element: <YatraSettingsPage /> },
{ path: '/yatra/:id/admin/settings', element: <YatraAdminSettingsPage /> },
{ path: '/yatra/:id/practice/new', element: <YatraPracticeNewPage /> },
{ path: '/yatra/:id/practice/:practice_id/edit', element: <YatraPracticeEditPage /> },

// Public routes (no auth)
{ path: '/shared/:id', element: <SharedChartPage /> },
```

---

## 12. Implementation Order (Phases)

| Phase | Scope |
|---|---|
| A | DaisyUI install + design system migration + Phase 1 component refactor |
| B | Home tab — diary log, practice cards, date navigation, FAB, offline banner |
| C | Settings tab — menu, edit profile, edit password, language picker |
| D | My Practices — list with drag-to-reorder, PracticeForm shared component |
| E | Charts tab — report list, report builder wizard, shared chart view |
| F | Yatras tab — list, join, member/admin settings, yatra practices |
| G | Import wizard, Help/FAQ, Support form |

Each phase ships as a standalone commit. Phases C and D can overlap.
