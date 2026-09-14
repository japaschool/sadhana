# Sadhana Pro — UI/UX Improvements Design Spec

**Date:** 2026-07-28  
**Approach:** Page-by-page holistic improvement (Option B)  
**Scope:** Visual polish + UX consistency + page-specific improvements across all key pages

---

## Context

The React app (`app-react/`) has a strong visual foundation (glass morphism, teal gradient accent, DaisyUI + Tailwind) but inconsistent UX patterns across pages: some failures are silent, loading states vary between skeleton and spinner, success feedback differs per page, and several interactions lack confirmation or real-time feedback. This design addresses all high-traffic pages in one comprehensive pass.

---

## Global Infrastructure (extracted as shared components)

### 1. Toast Notification System

**Files:**
- Create: `app-react/src/components/ui/Toast.tsx` — `ToastContainer` + `Toast` item component
- Create: `app-react/src/hooks/useToast.ts` — hook returning `{ showToast }` with `success | error | info | warning` variants
- Modify: `app-react/src/components/layout/AppShell.tsx` — mount `<ToastContainer />` once at app root

**Spec:**
- Fixed position: top-right on desktop, bottom-center on mobile (`fixed bottom-4 left-1/2 -translate-x-1/2 sm:top-4 sm:right-4 sm:bottom-auto sm:translate-x-0 sm:left-auto`)
- Glass card style matching existing design: `rgba(255,255,255,0.90)` + `blur(16px)` + border
- Left colored border accent per variant: success=#01a386, error=#e11d48, warning=#d97706, info=#3b82f6
- Auto-dismiss: 3 seconds. Manual dismiss: × button.
- Framer Motion `AnimatePresence` — slide in from right on desktop, slide up from bottom on mobile, fade out on dismiss
- Max 3 toasts visible at once; oldest auto-dismissed when 4th arrives
- API: `showToast({ message: string, variant: 'success' | 'error' | 'info' | 'warning' })`

### 2. Unified Skeleton Card

**Files:**
- Create: `app-react/src/components/ui/SkeletonCard.tsx`

**Spec:**
- Glass style (`rgba(255,255,255,0.70)`, border, shadow) with `animate-pulse` shimmer
- Props: `lines?: number` (default 1), `height?: string` (default `60px`)
- Used as drop-in replacement for current per-page inline skeletons and bare `<Spinner />`

### 3. Page Transition

**Files:**
- Modify: `app-react/src/components/layout/AppShell.tsx` (wrap `<Outlet />` in `AnimatePresence`)
- Create: `app-react/src/components/layout/PageTransition.tsx` — `motion.div` with `initial={{ opacity: 0, y: 6 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0 }}`, duration 150ms

**Usage:** Wrap each page's root element in `<PageTransition>`.

---

## Home Page

**Files:** `app-react/src/pages/home/HomePage.tsx`, `PracticeCard.tsx`, `WeekCalendar.tsx`

### Changes

**1. Save-fail error feedback (PracticeCard)**
- On mutation error: fire `showToast({ message: t('home.saveFailed'), variant: 'error' })`
- Add red border flash animation (mirror existing green success flash): `border-color: rgba(225,29,72,0.6)` for 600ms

**2. Duration input hint**
- Below the duration input field, render: `<p className="text-[10px] text-base-content/40 mt-0.5">{t('home.durationHint')}</p>` — "Enter total minutes (e.g. 90 for 1h 30m)"
- Visible only when input is focused (use `useState` for focus tracking on the field)

**3. Required / Optional section labels**
- Between required and optional groups, render a section label only when both groups are non-empty:
  ```tsx
  {required.length > 0 && <SectionLabel label={t('home.required')} />}
  {/* required cards */}
  {optional.length > 0 && <SectionLabel label={t('home.optional')} />}
  {/* optional cards */}
  ```
- `SectionLabel`: `<p className="text-[10px] font-semibold uppercase tracking-widest text-base-content/40 px-1">`

**4. "Today" jump button in WeekCalendar**
- When `date` is not today, show a small pill button top-right of the calendar: `t('home.today')` label, teal text, taps back to `new Date()`
- Hidden when already on today's date

**5. Offline banner upgrade**
- Replace plain text card with amber-tinted banner:
  ```tsx
  background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)'
  ```
- Add `LuWifiOff` icon (Lucide, already installed) left of text

**i18n keys to add:** `home.saveFailed`, `home.durationHint`, `home.required`, `home.optional`, `home.today`

---

## Charts Page

**Files:** `app-react/src/pages/charts/ChartsPage.tsx`, `NewChartPage.tsx`

### Changes

**1. Loading overlay on duration filter change**
- TanStack Query exposes `isFetching` on the chart data query. When `isFetching && !isLoading`, render a semi-transparent overlay on the chart container: `absolute inset-0 bg-white/40 rounded-2xl flex items-center justify-center` with a small spinner.

**2. Empty state card**
- When no reports exist (`reports.length === 0`), replace bare link with a centered card:
  - Chart bar icon, headline "No reports yet", subtext "Create your first report to track progress over time"
  - Teal gradient button linking to `/charts/new`
  - Same pattern as home page empty state

**3. "Select all / Clear" in NewChartPage step 2**
- Above the practice checkbox list, add two small teal text-link buttons: "Select all" / "Clear"
- `selectAll`: sets all practice IDs into selected set; `clearAll`: empties the set

**4. Manage section collapse animation**
- Wrap the manage section body in `<AnimatePresence>` + `motion.div` with height animation
- `initial={{ height: 0, opacity: 0 }}` → `animate={{ height: 'auto', opacity: 1 }}`, duration 200ms

**5. Copy link feedback**
- Increase dismiss timeout from 2s → 3s
- Add `LuCheck` icon left of "Copied!" text

**i18n keys:** `charts.selectAll`, `charts.clearAll`

---

## Yatras Page

**Files:** `app-react/src/pages/yatras/YatrasPage.tsx`

### Changes

**1. Color-zone legend**
- Above the grid table, compact legend: three colored pills labeled Low / Mid / High
- Colors match cell background zones (red/amber/green at 10% alpha)
- Dismiss × button; visibility persisted in `localStorage('yatra-legend-shown')`

**2. Heatmap date header**
- Header row above heatmap grid showing 14 abbreviated dates ("Jul 14")
- Derived from `today - 13 days` to `today`, aligned to each column

**3. Long practice name truncation**
- Grid column headers: `className="max-w-[80px] truncate"` + `title={practiceName}` for native tooltip

**4. Manual refresh button**
- `LuRefreshCw` icon button top-right of grid card header
- On click: `qc.invalidateQueries({ queryKey: ['yatra', id] })`
- Shows `animate-spin` while `isFetching`

**5. Empty grid clarification**
- Cells with no value render `—` (em-dash) in `text-base-content/30` instead of blank

**6. Create modal unsaved-name guard**
- Before closing on backdrop click or Escape: if `newYatraName.trim().length > 0`, call `window.confirm(t('yatra.discardName'))`

**i18n keys:** `yatra.discardName`, `yatra.low`, `yatra.mid`, `yatra.high`, `yatra.refresh`

---

## Settings Pages

**Files:** `app-react/src/pages/settings/SettingsPage.tsx`, `EditPasswordPage.tsx`, `EditUserPage.tsx`, `MyPracticesPage.tsx`

### Changes

**1. Logout confirmation (SettingsPage)**
- Wrap logout `onClick` to open existing `<ConfirmModal>` (`src/components/ui/ConfirmModal.tsx`)
- Title: `t('settings.logoutConfirmTitle')`, message: `t('settings.logoutConfirmMsg')`, confirm button red

**2. Show-password toggle on EditPasswordPage**
- All three password fields (current, new, confirm) get `FaEye`/`FaEyeSlash` toggle
- Copy pattern from `LoginPage.tsx` lines ~103–110

**3. Real-time mismatch on EditPasswordPage**
- `onChange` on confirm field: compare with new-password value; if non-empty and mismatching, show inline error immediately (not only on submit)

**4. Character counter on EditUserPage**
- Below name input: `{name.length}/50` in `text-[10px] text-right`
- Amber when ≥ 45, red when at 50

**5. Drag ghost opacity on MyPracticesPage**
- `useSortable` returns `isDragging`; apply `style={{ opacity: isDragging ? 0.4 : 1, transition: 'opacity 0.15s' }}` to the draggable row

**6. Reorder failure toast**
- On reorder mutation error: `showToast({ message: t('settings.reorderFailed'), variant: 'error' })`

**i18n keys:** `settings.logoutConfirmTitle`, `settings.logoutConfirmMsg`, `settings.reorderFailed`

---

## Auth Pages

**Files:** `app-react/src/pages/auth/LoginPage.tsx`, `RegisterPage.tsx`

### Changes

**1. Error specificity on LoginPage**
- Map HTTP status to specific messages:
  - 401 → `t('auth.wrongCredentials')` ("Incorrect email or password")
  - offline → `t('auth.offline')` ("No internet connection")
  - other → `t('auth.serverError')` ("Server error — please try again")

**2. Password strength indicator on RegisterPage**
- Three-segment bar below password field, visible only when field is focused
- Strength: weak (< 8 chars), fair (≥ 8 + mixed case), strong (≥ 10 + mixed + special char)
- Segment colors: inactive=gray, weak=red, fair=amber, strong=green

**3. Resend confirmation email on RegisterPage**
- After successful submit, below "check inbox": 30-second countdown ("Resend in 28s")
- After countdown expires: teal "Resend email" link button
- On click: call resend endpoint, `showToast({ message: t('auth.resendSent'), variant: 'success' })`

**4. Autofocus on RegisterPage**
- Add `autoFocus` to email input (mirrors LoginPage)

**5. Sign-in button disabled state on LoginPage**
- Add `disabled={loading}` + reduce opacity to 0.6 during loading (already has spinner, missing `disabled` attribute)

**i18n keys:** `auth.wrongCredentials`, `auth.offline`, `auth.serverError`, `auth.resendEmail`, `auth.resendSent`

---

## Implementation Order

1. Global: Toast system + SkeletonCard + PageTransition
2. Home page improvements
3. Charts page improvements
4. Yatras improvements
5. Settings improvements
6. Auth improvements
7. i18n: add all new keys to EN/RU/UK locale files in one final pass

---

## Verification

- `npm run dev` in `app-react/`, test each page manually
- Home: save while offline → red flash + error toast appears
- Charts: click duration filter → loading overlay visible during refetch
- Yatras: hover long practice name column header → truncation tooltip shown
- Settings: click Logout → confirm modal appears before logout fires
- Auth/Login: enter wrong password → specific "Incorrect email or password" message
- Auth/Register: focus password field → strength bar renders; blur → hides
- All pages: navigate between routes → subtle fade+slide transition visible
