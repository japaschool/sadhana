# Deep Ink — Visual Polish Pass (app-react)

**Date:** 2026-08-18
**Status:** Approved (design), pending implementation plan
**Scope:** `app-react` frontend. Visual/aesthetic polish of the authenticated app (Home first), plus a folded-in charts readability fix.

## Goal

Make Sadhana Pro feel **premium and legible** while keeping its calm, meditative character. The current build layers frosted-glass panels over a full-bleed photo (green hills), which fights text contrast on the working screens. This pass moves the working app to a controlled dark surface, tightens typography and components, and fixes the tangled Charts panel.

This is a **restyle**, not a feature or IA change. No new sections, no re-layout of the Home two-column split.

## Direction (decided via visual brainstorm)

Each was chosen from rendered mockups (`.superpowers/brainstorm/…`):

1. **Surface: Calm Dark Surface — "Deep Ink + Glow" (B3).** Retire the photographic backdrop from the authenticated app; keep it for the login/landing moment only. Working screens sit on a near-black surface with a soft teal aurora glow behind content. Highest contrast, most premium.
2. **Typography: Serif headings + sans body (T1).** Serif (logo, page/section titles, large numerics) + Inter for controls and data. Calm/editorial without hurting the crisp functional feel.
3. **Accent: teal**, brightened from the current muted `#3aa6a0` toward a luminous `#5eead4` for highlights/lines/glow, with a slightly deeper teal for large fills.
4. **Charts: folded in.** Fix the dual-scale spaghetti (minutes + clock-times on one Y-axis) as part of this pass, not later.

## Where this lives in the code

- **Global backdrop:** `src/components/layout/AppShell.tsx` renders `<AuthBackground/>` (the `/bg.webp` photo) **app-wide** plus a `rgba(20,28,38,0.15)` tint. This is what puts the photo behind every screen today.
- **Design tokens:** `src/theme/tokens.ts` (inline-style constants, imported by ~30 files) and the `@theme` + `[data-theme="dark"]` / `[data-theme="light"]` blocks in `src/index.css` (DaisyUI variables). Retuning here cascades app-wide.
- **Header:** `src/components/layout/TopBar.tsx` (serif logo already present; desktop nav Home/Practices/Yatras/Charts/Settings).
- **Calendar:** `src/pages/home/WeekCalendar.tsx`, `src/pages/home/MonthCalendar.tsx`.
- **Practice rows:** `src/pages/home/PracticeCard.tsx`.
- **Charts:** `src/pages/home/DashboardPanel.tsx` and `src/pages/charts/ChartsPage.tsx` (Recharts). Also `NewChartPage.tsx`, `SharedChartPage.tsx` consume the same chart rendering.

## The visual system (target tokens)

Concrete values from the approved mockups. Final constants land in `tokens.ts` + `index.css`.

**Backdrop (new, replaces the photo on the authenticated shell):**
```
radial-gradient(70% 55% at 84% -5%,  rgba(45,212,191,.16), transparent 50%),
radial-gradient(60% 45% at 8% 108%,  rgba(56,189,248,.09), transparent 55%),
linear-gradient(160deg, #0b0f14 0%, #070a0e 100%)
```
Applied as a `fixed inset-0 -z-10` layer (a new `AppBackground` component), replacing `<AuthBackground/>` + tint inside `AppShell`.

**Surfaces & lines:**
- Panel (cards, charts): `rgba(20,28,38,.72)`
- Elevated row (practice rows): `rgba(26,35,47,.80)`
- Hairline border: `rgba(255,255,255,.07)`
- Card radius: `14px`; chip radius: `8px`

**Text:**
- Primary `#eef3f8` · Muted `#8fa1b0` · Faint `rgba(238,243,248,.45)`

**Teal ramp (accent):**
- Glow / lines / highlights: `#5eead4`
- Primary fill (buttons): `#2dd4bf` (content on it stays dark, e.g. `#04201b`)
- Deep: `#0d9488`
- Soft wash: `rgba(94,234,212,.14)`; ring: `rgba(94,234,212,.30)`

**Fonts:**
- Serif: switch display serif toward a softer editorial face — **Newsreader** (or Fraunces) — replacing `Playfair Display` in `--font-serif`. Low-stakes; Playfair may stay if preferred. Sans: **Inter** (unchanged).

## Component-level changes

### 1. Authenticated backdrop (`AppShell.tsx`)
Replace the app-wide photo with `AppBackground` (Deep Ink + Glow layer). **Preserve `AuthBackground` (photo) for guest/auth routes** (Login, Register, Confirmation, PwdReset) so the photo still greets users at sign-in. Verify auth pages still render the photo after `AuthBackground` is no longer mounted by `AppShell`.

### 2. Tokens (`tokens.ts` + `index.css`)
Apply the target values above. Brightening the accent cascades to every consumer (buttons, toasts, gradients, focus rings) — intended; spot-check primary buttons, `ACCENT_GRADIENT`, toasts, and focus rings after the change.

### 3. Header (`TopBar.tsx`)
Deep-ink translucent bar with the hairline bottom border; serif logotype (`Sadhana` + teal `Pro` tag). Active nav item = pill with a teal ring; inactive = muted. Maintain existing mobile header behavior.

### 4. Calendar (`WeekCalendar.tsx` / `MonthCalendar.tsx`)
Quiet day-of-week labels (muted, small). Today = a single solid teal marker (dark text) instead of competing highlights. Non-today days in calm light-slate.

### 5. Practice rows (`PracticeCard.tsx`)
Consistent anatomy for every type: **colored icon tile · name · one right-aligned control**. Controls stay type-specific (toggle / time chip / minutes chip / counter / text field) but share one chip style. **Logged** entries get a subtle teal "done" chip (`rgba(94,234,212,.14)` + teal text) so progress is scannable; unlogged use the neutral chip with a clear placeholder (replace the ambiguous bare `—`). Rows sit on the elevated surface with hairline border and `12–14px` radius.

### 6. Charts — restyle + readability fix (`DashboardPanel.tsx`, `ChartsPage.tsx`)

**Restyle:** rounded panel on the panel surface; faint horizontal gridlines; primary series as a smooth teal area; calm, distinct secondary line colors (amber, violet, sky); a real **legend row** naming each series with its unit; a soft glow on the latest data point.

**Readability fix (the core problem):** stop plotting unrelated units on one Y-axis. Practices span value types — boolean (Shower cold), text (Journal, not chartable), time-of-day (Wake/Sleep, HH:MM), duration-minutes (Reading, Do dishes), integer count (Water, Brush hair). Approach:

- **Group series by unit.** Render one chart section per unit type, each with its own correct single-unit Y-axis, stacked vertically as small multiples sharing the x (date) axis:
  - *Duration (min)* — area/line, 0-based minutes axis.
  - *Time of day (HH:MM)* — its own chart with a 00:00–24:00 axis (Wake/Sleep belong here, not mixed with minutes).
  - *Count* — line/bar, integer axis.
  - *Boolean* — shown as done/not-done marks (dot strip), not a numeric line.
- Text-type practices are excluded from charting.
- Keep the existing duration filter (1W/1M/3M/6M/1Y/All), "All practices" selector, Share, and "Manage reports" — restyled, not removed. The selector filters which series/sections show.

Keep this change isolated to the chart components. Match the server's existing chart logic where relevant (see prior `2026-08-08-charts-match-rust-logic-design.md`).

## Non-goals / out of scope

- No new features (no streak hero, no stats cards) — the mockup's stat tiles were illustrative only.
- No change to Home information architecture (the calendar+practices / charts split stays).
- **Light theme** (`[data-theme="light"]`) is not re-themed here; it must keep working. Note: `tokens.ts` inline constants are dark-oriented and shared — this pass targets the dark experience (the shipped default). A matching light treatment is a follow-up, and should be reconciled with the in-flight light-retheme specs (`2026-08-17-light-retheme-stage1-foundation-design.md`).
- No backend/API changes.

## Testing & verification

- **Unit tests (Vitest):** existing suites must pass — `PracticeCard.test`, `WeekCalendar.test`/`MonthCalendar.test`, `HomePage.test`, `TopBar.test`, `HeaderMenu.test`, plus chart-adjacent tests. Update assertions/snapshots where class/style intentionally changed. Follow the project's Vitest + `vi.mock` conventions and the framer-motion mock; keep i18n discipline (prod locales + `test/setup.ts`).
- **Contrast:** verify text on the new surfaces meets WCAG AA (primary text, muted text, chips, nav).
- **Responsive/mobile:** the app is an installable PWA — confirm TopBar mobile variant, BottomNav, and practice rows hold up at small widths.
- **Visual check:** run the dev server (`app-react` on `:5173`) and eyeball Home, Charts, auth pages (photo preserved), and a settings page (token cascade).
- **Lint:** oxlint clean.

## Risks

- **Accent cascade:** brightening teal touches ~30 files via `tokens.ts`. Intended, but review high-visibility surfaces (buttons, toasts, gradients, focus rings).
- **Backdrop swap:** removing the photo from `AppShell` must not strip it from auth pages — verify `AuthBackground` still mounts there.
- **Charts rework** is the largest code change and shared across pages (`DashboardPanel`, `ChartsPage`, `NewChartPage`, `SharedChartPage`); keep the grouping logic in one place to avoid divergence.
- **Light-theme interplay:** an in-flight light-retheme effort exists; this dark polish should not regress it.

## Rollout

Suggested implementation order (each independently verifiable): tokens/backdrop → header → practice rows/calendar → charts. Charts last, as the biggest and most isolated piece.
