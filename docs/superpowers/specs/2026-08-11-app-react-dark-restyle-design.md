# app-react Dark Restyle — Design

**Date:** 2026-08-11
**Scope:** Restyle the `app-react` dashboard (the React SPA that runs on the Rust backend) to the dark, warm-amber aesthetic of the new `static-react` landing. **Keep every screen's existing layout and information density** — this is a palette + typography change, not a re-layout. No backend/API changes; `static-react`, `server`, and the `frontend` (Yew) crate are untouched.

## Context

`app-react` is a React 19 + TypeScript + Vite app using **DaisyUI** (Tailwind 4) for theming, plus TanStack Query, Zustand, recharts, react-i18next. Nearly all screens render through DaisyUI semantic tokens (`base-100/200/300`, `base-content`, `primary`, `secondary`, `accent`, `neutral`, `info/success/warning/error`) defined in `src/index.css` under `[data-theme="light"]`, with `data-theme="light"` set on `<html>` in `index.html`. Today's palette is **purple primary + teal accent** on light surfaces.

However, a meaningful amount of styling is **hardcoded** in inline styles / literal Tailwind classes — ~282 color literals across components (excluding tests), dominated by teal `#01a386` / `#02c9a3` gradients and glass `rgba(...)` effects (e.g. `PracticeForm.tsx`, `TopBar.tsx`, `BottomNav.tsx`, `Toast.tsx`). These do not follow the theme tokens and must be converted by hand.

The target look is defined by the landing (`static-react`): near-black surfaces, off-white text, warm amber accent, Playfair Display display headings + Inter body.

### Decisions (from brainstorming)
- **Fidelity:** dark theme, **keep all layouts and density**. No cinematic photo backdrops on data screens; no per-screen re-layout.
- **Accent:** **warm amber `#c8724a`** is the primary/action color — primary buttons, active nav tab, checkmarks, the bottom-nav center `+`. Teal and purple are removed entirely.
- **Approach:** redefine DaisyUI theme tokens to dark + convert hardcoded literals (not a per-screen rewrite, not a DaisyUI removal).

## Design tokens (dark)

Defined in `src/index.css` as the active DaisyUI theme; `<html>` switches to it. Values (oklch or hex; implementer may express hex as oklch for DaisyUI consistency):

| Role | Value | Usage |
|---|---|---|
| `base-100` | `#0b0b0d` | app background |
| `base-200` | `#141416` | secondary surfaces, inputs |
| `base-300` | `#1e1e21` | raised cards, popovers |
| `base-content` | `#f5f4f2` | primary text |
| muted text | `base-content` at `55–70%` opacity | secondary text, labels |
| `primary` | `#c8724a` (amber) | primary buttons, active states, checkmarks, center FAB |
| `primary-content` | `#0b0b0d` | text/icon on amber |
| `accent` | `#c8724a` (same amber) or a slightly lighter tint | small accents, focus rings |
| `neutral` | `#1e1e21` | neutral surfaces |
| borders | `rgba(255,255,255,0.10)` | dividers, card borders, input outlines |
| `success` | dark-tuned green (keep meaning) | toasts, "done" confirmations |
| `warning` | dark-tuned amber/orange | warnings (distinct from primary amber) |
| `error` | `#e11d48`-family, dark-legible | errors, destructive |
| `info` | dark-legible blue | info |
| radii / border / depth | keep current `--radius-*`, `--border`, set `--depth`/`--noise` as needed for flat dark | — |

Exactly one theme (dark). No user-facing light/dark toggle in this scope.

## Typography

- Load **Playfair Display** (500,700) + **Inter** (300,400,600) via the same Google Fonts `<link>` used by the landing, added to `app-react/index.html`.
- Register `--font-serif: 'Playfair Display', ui-serif, Georgia, serif` and `--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif` (Tailwind 4 `@theme`) so `font-serif`/`font-sans` resolve correctly.
- Apply **Playfair (`font-serif`) to page titles and section headers** — e.g. "Today" / date header on Home, "Charts", auth screen headings ("Welcome to your daily practice"), settings group titles, "Yatras". Body, controls, table data, inputs stay **Inter**. Do not put serif on dense data (practice rows, chart labels, tables).

## Hardcoded-color conversion sweep

Convert the ~282 non-token literals to the dark+amber palette. Rules:
- **Teal → amber:** `#01a386`, `#02c9a3`, and their `rgba(1,163,134,…)` glass/gradient variants → amber `#c8724a` (and `rgba(200,114,74,…)` equivalents). Affects at least: `PracticeForm.tsx` (active-type highlight, required toggle, submit gradient), `TopBar.tsx` (active tab color/underline), `BottomNav.tsx` (center FAB gradient, active tab), `Toast.tsx` success color.
- **Light-surface literals → dark tokens:** hardcoded light backgrounds / dark text (`#1f2937`, `rgba(0,0,0,…)` overlays, white cards) → dark surfaces + off-white text or the corresponding DaisyUI token.
- **Preserve (do NOT change):**
  - Brand/logo hexes — `GoogleLoginButton.tsx` SVG path fills (`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`).
  - Semantic status colors — error/success/warning/info intent (may be *dark-tuned* for legibility, but keep their meaning; success stays green-family, error stays red-family).
  - **Chart data-series palette** — the recharts series colors ported from the Rust/plotly version encode data meaning; keep the series colors. Only the **plot chrome** (background, grid, axis, legend text) goes dark/muted.
- Prefer converting to DaisyUI tokens / shared constants where a literal is repeated, rather than swapping one hex for another inline, so future theme changes stay centralized. Introduce shared color constants (e.g. an amber constant mirroring the old teal constant) where inline styles need a raw value.

## Chrome

- **AuthBackground** (`src/components/layout/AuthBackground.tsx`): the login/register/reset background currently uses the green landscape `bg.webp`/`bg.jpg`. Make auth match the dark theme — either a strong dark overlay/gradient over the existing image or a flat `#0b0b0d` with subtle texture. Result: auth screens read as dark, with the amber primary button and off-white text.
- **TopBar / BottomNav:** dark surfaces (`base-100`/`base-200` with `white/10` border), amber active state, amber center FAB. Preserve existing structure and the mobile/desktop visibility rules already in place.
- **Cards / glass:** dark `base-300` surfaces with `white/10` borders replacing light glass.

## Charts

- Dark plot background (`base-100`/`base-200`), grid lines and axis ticks in muted white (`white/10`–`white/40`), legend/axis text off-white.
- Keep series line/bar/dot colors and the average ReferenceLine behavior from the existing chart logic.

## Error handling / edge cases

- **Contrast:** all text must meet reasonable contrast on dark (off-white on `#0b0b0d`; amber buttons use near-black text). Watch amber `#c8724a` used as text on dark — prefer it for fills/accents, use lighter amber or off-white for text.
- **Disabled/placeholder states:** ensure inputs, disabled buttons, and placeholder text remain visible on dark (muted white, not near-invisible gray).
- **Focus rings:** visible amber/white focus outlines for keyboard/a11y.
- **Loading/empty states:** dark-appropriate skeletons/spinners and empty-state text.

## Testing / verification

`app-react` has a Vitest + Testing Library suite (must stay green):
- The suite mostly asserts text/roles/behavior (color-agnostic) — expected to pass unchanged.
- Known color-touching assertions to check/update: `MonthCalendar.test.tsx` (`bg-black/30` backdrop — still valid on dark), `Settings.test.tsx` ("counter turns amber at 45 chars" — aligns with amber accent). Update any assertion that pins a removed teal/purple class.
- Gate per stage: `npm run test` green + `npm run build` (tsc + vite) clean. (`oxlint` may run but build is the hard gate.)
- Visual pass via headless Chrome at mobile (~390px) + desktop (~1440px) across: Login/Register/Reset, Home (with practice cards + week/month calendar), Charts (list + a rendered graph + grid), Settings (+ My Practices, Practice edit/new, Language, Import), Yatras (list + a yatra + admin). Confirm: dark surfaces, amber accents, serif titles, legible text, no leftover teal/purple, no broken contrast.
- i18n unaffected (no copy changes); all three locales still render.

## Rollout (staged, review between stages)

- **Stage A — Foundation:** dark theme tokens + fonts + `data-theme` flip + `AuthBackground`. After A, the whole app is already dark (token-driven), with residual teal in the hardcoded spots. Review.
- **Stage B — Shared chrome + hardcoded sweep:** convert the ~282 literals; restyle TopBar, BottomNav, PracticeForm, Toast, cards. After B, no teal/purple remains. Review.
- **Stage C — Per-area polish:** auth → home → charts → settings → yatras; fix contrast, serif application, spacing nits, chart chrome; update any color-pinned tests. Final visual + test pass.

## Non-goals

- No layout/IA changes, no new screens, no copy changes, no new features.
- No changes to `static-react`, `server`, `frontend` (Yew), or the API.
- No light/dark theme toggle; no theme persistence.
- No new dependencies; no removal of DaisyUI; no chart-logic changes (only chart chrome colors).
- No cinematic photo backdrops on data screens; no re-layout to match the marketing hero.
