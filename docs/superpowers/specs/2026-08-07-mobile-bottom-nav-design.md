# Sadhana Pro — Mobile Bottom Navigation

**Date:** 2026-08-07
**Scope:** On mobile (`< sm`), move the primary nav (Home / Charts / Yatras / Settings) from the top header to a bottom bar. **No visual re-skin** — the existing app design (teal `#01a386`, glass/blur) is unchanged everywhere, including Home. Desktop (`sm+`) is unchanged.

> An earlier draft explored re-skinning Home to a habit-tracker aesthetic; that was dropped per user feedback. Only the bottom-nav idea shipped.

## Context

`AppShell` (`app-react/src/components/layout/`) wraps all authenticated routes and renders a fixed `TopBar` holding the 4-item nav. On mobile the nav was icon-only in the top bar. Users wanted the destinations at the bottom (thumb-reachable) on phones.

## Changes

- **`navItems.ts`** *(new)* — shared nav config (Home/Charts/Yatras/Settings + icons), imported by both `TopBar` and `BottomNav` (single source of truth).
- **`BottomNav.tsx`** *(new)* — fixed bottom bar, `sm:hidden`, matching the app's glass/blur aesthetic with teal active state. 4 tabs (`NavLink`, `aria-current`), `env(safe-area-inset-bottom)` for iOS. No center button — just the four destinations.
- **`TopBar.tsx`** — its `<nav>` is now `hidden sm:flex` (mobile drops the top nav; desktop unchanged).
- **`AppShell.tsx`** — renders `<BottomNav>` only on the 4 top-level routes; adds `pb-[calc(64px+env(safe-area-inset-bottom))] sm:pb-0` to `<main>` when shown (sub-pages with back/close don't get the bar).
- **Collision fixes (mobile):** corner FABs on Home/Charts/Yatras lifted `bottom-6` → `bottom-24 sm:bottom-6`; mobile toasts lifted to `bottom-24` — so nothing hides behind the bar. Desktop positions unchanged. (`MyPractices` FAB untouched — its route isn't top-level, so no bar.)

## Files

`navItems.ts` (new), `BottomNav.tsx` (new), `BottomNav.test.tsx` (new), `TopBar.tsx`, `AppShell.tsx`, `Toast.tsx`, `HomePage.tsx` (FAB lift only), `ChartsPage.tsx` (FAB lift), `YatrasPage.tsx` (FAB lift).

## Testing

- `BottomNav.test.tsx`: renders 4 tabs with correct hrefs; active tab has `aria-current="page"` at `/charts`.
- Full Vitest suite green (62 tests / 15 files).
- Manual: on a mobile viewport the bar shows on Home/Charts/Yatras/Settings, hides on sub-pages; desktop keeps the top nav.

## Non-goals

No visual re-skin (colors/font/cards unchanged); no desktop changes; no backend changes.
