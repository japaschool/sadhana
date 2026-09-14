# Sadhana Pro — React App Rewrite Design Spec

**Date:** 2026-07-17
**Scope:** Full rewrite of the Rust/Yew WebAssembly frontend (`/frontend/`) into a new React + TypeScript + Tailwind CSS v4 app (`/app-react/`). The marketing lander (`/static-react/`) is out of scope and must not be touched.

---

## 1. Project Structure & Stack

### New directory: `/app-react/`

Same toolchain as the lander: Vite + React 19 + TypeScript + Tailwind CSS v4.

**Added dependencies:**
| Package | Purpose |
|---|---|
| `react-router-dom` v7 | Client-side routing |
| `@tanstack/react-query` | Server state, API caching, loading/error states |
| `zustand` | Client state (auth user, UI flags) |
| `axios` | Typed HTTP client for the Rust API |
| `framer-motion` | Page transitions and micro-animations |
| `react-i18next` + `i18next` | i18n (EN / RU / UK), same setup as lander |
| `react-icons` | Icon set |
| `recharts` | Chart rendering (line / bar / grid — lightweight, Tailwind-friendly) |

**Folder structure:**
```
src/
  api/          # typed API functions — one file per resource
    client.ts   # axios instance, auth header injection, 401 → /login
    auth.ts
    practices.ts
    charts.ts
    yatras.ts
  components/   # shared UI primitives
    Button.tsx
    Input.tsx
    Modal.tsx
    Card.tsx
    BottomNav.tsx
    TopBar.tsx
    Spinner.tsx
    SkeletonCard.tsx
    ErrorBanner.tsx
    ConfirmModal.tsx
    PracticeForm.tsx   # shared by user practices AND yatra practices (mode prop)
  hooks/
    useAuth.ts
    useNetworkStatus.ts
  pages/        # one folder per route
    home/
    auth/
    charts/
    yatras/
    settings/
    shared/     # public shared chart view
  store/
    authStore.ts
    uiStore.ts
  router.tsx    # all routes in one place
  main.tsx
```

Sub-components used only by a single page live inside that page's folder. A component moves to `components/` only when genuinely shared by two or more pages.

---

## 2. Design System

### Color Palette (Tailwind `@theme` custom tokens)

```css
/* Surfaces */
--color-surface-0: #0d1b2a;   /* deepest background */
--color-surface-1: #1a2d42;   /* cards, panels */
--color-surface-2: #243d57;   /* elevated surfaces, inputs */

/* Accents */
--color-teal:      #2dd4bf;   /* active states, links */
--color-gold:      #f59e0b;   /* primary CTA, highlights */
--color-gold-light:#fbbf24;   /* gold hover */

/* Text */
--color-text-primary:   #f1f5f9;
--color-text-secondary: #94a3b8;
--color-text-muted:     #475569;

/* Status */
--color-danger:  #ef4444;
--color-success: #22c55e;
```

### Typography
- **Headings:** `font-serif` (warm, spiritual feel — matches lander)
- **Body:** `font-sans` (Inter or system-ui)
- **Base size:** 16px
- **Scale:** xs / sm / base / lg / xl / 2xl / 3xl

### Shape & Spacing
- Cards: `rounded-2xl`, `border border-white/10`
- Inputs: `rounded-xl bg-surface-2 border border-white/8 focus:border-teal`
- Primary button: gold filled, `rounded-full`
- Secondary button: ghost with teal border
- Bottom nav: 64px fixed height + iOS safe area inset
- Top bar: 56px fixed height

### Motion
Framer Motion for all animations. Page transitions: fade + slight Y slide (same pattern as lander). Micro-interactions: button press scale, card hover lift.

---

## 3. Layout Shell

Two fixed chrome elements wrap all authenticated pages:

**TopBar (56px, fixed top)**
- Sub-pages: back arrow left + page title center
- Home: logo left + date navigator center (← today →) + sync icon right

**BottomNav (64px, fixed bottom)**
- 4 tabs: Home / Charts / Yatras / Settings
- Active tab: gold icon + gold label
- Inactive: muted icon, no label
- Tab press: subtle scale animation

All page content has `pt-14 pb-16` (top bar + bottom nav clearance).

Guest pages (auth screens) render with no nav chrome — centered card on full navy background.

---

## 4. Screen Inventory

### Auth (no nav chrome)

| Route | Screen | Key elements |
|---|---|---|
| `/login` | Login | Email + password inputs, "Forgot password?" link, gold submit, link to register |
| `/register` | Register | Name + email + password, submit sends confirmation email |
| `/register/:id` | Email confirmed | Success state, redirect to login |
| `/reset` | Request reset | Email input, submit sends reset link |
| `/reset/:id` | New password | New password + confirm, submit → login |

### Tab: Home

| Route | Screen | Key elements |
|---|---|---|
| `/` | Daily log | Date navigator, scrollable practice cards, gold FAB (→ new practice), offline banner |

**Practice card input types:** number stepper, text field, boolean toggle, time-of-day picker, duration picker. Each card shows a subtle completion ring when a value is logged for today.

### Tab: Charts

| Route | Screen | Key elements |
|---|---|---|
| `/charts` | Reports list | Cards with chart preview, name, date range; gold FAB |
| `/charts/new` | Report builder | Step-by-step: pick metrics → date range → chart type (line / bar / grid) |
| `/shared/:id` | Shared chart | Public, no nav chrome, minimal branding |

### Tab: Yatras

| Route | Screen | Key elements |
|---|---|---|
| `/yatras` | Groups list | Yatra cards with name, member count, active indicator |
| `/yatra/:id/join` | Join confirmation | Yatra info + confirm button |
| `/yatra/:id/settings` | Member view | Name, members list, practice list (read-only) |
| `/yatra/:id/admin/settings` | Admin view | Same + edit/delete controls + invite link copy |
| `/yatra/:id/practice/new` | New yatra practice | `PracticeForm` in yatra mode |
| `/yatra/:id/practice/:practice_id/edit` | Edit yatra practice | `PracticeForm` in yatra mode |

### Tab: Settings

| Route | Screen | Key elements |
|---|---|---|
| `/settings` | Settings menu | Card-style menu list |
| `/settings/edit-user` | Edit profile | Name + email form |
| `/settings/edit-password` | Change password | Current + new password form |
| `/user/practices` | My practices | List with drag-to-reorder, edit/delete actions |
| `/user/practice/new` | New practice | `PracticeForm` in user mode |
| `/user/practice/:id/edit` | Edit practice | `PracticeForm` in user mode |
| `/settings/import` | Import data | Upload CSV → auto-detect columns → mapping table (user matches CSV columns to practice fields) → import |
| `/settings/language` | Language | Picker: EN / RU / UK |
| `/help` | Help | FAQ accordion + video links |
| `/help/support-form` | Support | Contact form |

### Shared component: `PracticeForm`
Used by both user practice routes and yatra practice routes. Controlled by a `mode` prop: `{ type: 'user' }` or `{ type: 'yatra', yatraId: string }`. Renders: name input, type selector (number / text / boolean / duration / time), type-specific option fields.

---

## 5. Data Flow & API Integration

### Auth
- **Zustand `authStore`:** `{ user, token, isLoading }` — hydrated on app start via `GET /api/user`
- Token stored in `localStorage`, injected as `Authorization: Bearer <token>` by the Axios instance in `src/api/client.ts`
- `<ProtectedRoute>` wrapper: redirects to `/login` if no token
- `<GuestRoute>` wrapper: redirects authenticated users away from auth pages
- 401 response interceptor in `client.ts` → clears token + redirects to `/login`

### TanStack Query
- Single `QueryClient` at root with defaults: `staleTime: 60_000`, `retry: 1`, `refetchOnWindowFocus: true`
- Query key namespaces: `['practices']`, `['charts']`, `['yatras', yatraId]`, `['user']`
- Mutations use optimistic updates where latency matters (logging a practice value); fall back to refetch on error
- `networkMode: 'offlineFirst'` so cached data is served without network

### Offline
- Service worker adapted from existing `frontend/service_worker.js`
- `useNetworkStatus` hook drives the offline banner on the Home screen
- Mutations queue automatically via TanStack Query's offline support; fire when connectivity returns

### i18n
- Reuse `public/locales/` JSON structure from the lander
- Same `i18next` + `react-i18next` + `i18next-browser-languagedetector` setup
- Language preference stored in `localStorage` (existing behaviour)
- Language route (`/uk` prefix for Ukrainian) handled in the router

---

## 6. Migration Strategy & Phases

The Rust/Yew app stays live throughout. The React app is built in `/app-react/` and deployed to replace it once each phase is verified. The lander is never touched.

| Phase | Scope | Unblocks |
|---|---|---|
| 1 | Core shell: Vite setup, router, `BottomNav`, `TopBar`, `ProtectedRoute`, auth store, Axios client, all auth screens | Everything |
| 2 | Home screen: practice cards (all input types), date navigation, offline banner, FAB | Daily usage |
| 3 | Practices management: list with drag-to-reorder, `PracticeForm` component | Phase 5 (reuses `PracticeForm`) |
| 4 | Charts: report list, report builder wizard, chart rendering, `/shared/:id` public view | — |
| 5 | Yatras: group list, join flow, member/admin views, yatra practice forms | — |
| 6 | Settings, Help, Import: all settings screens, language picker, CSV import, FAQ, support form | — |
| 7 | Polish & cutover: page transitions, skeleton loaders, PWA manifest, service worker, i18n completeness (RU/UK), accessibility pass, production cutover | — |

Each phase ships as a standalone PR. Phases 4–6 can proceed in parallel once Phase 3 is done.
