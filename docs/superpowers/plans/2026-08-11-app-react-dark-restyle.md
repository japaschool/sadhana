# app-react Dark Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the `app-react` dashboard to the landing's dark, warm-amber aesthetic (near-black surfaces, off-white text, amber accent, Playfair titles + Inter body) without changing any screen's layout or behavior.

**Architecture:** `app-react` themes through DaisyUI semantic tokens set by `data-theme` in `index.html` + `src/index.css`. Redefine those tokens to a dark+amber palette and flip the app to the dark theme (restyles most screens uniformly), then convert the ~282 hardcoded inline color literals (mostly teal `#01a386`) to a shared dark/amber constants module, then dark-tune chart chrome and apply serif titles. No re-layout, no new deps, DaisyUI kept.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind 4 + DaisyUI, recharts, react-i18next, Zustand, TanStack Query; Vitest + Testing Library.

## Verification model (read first)

A restyle is not unit-testable by asserting colors. Do **not** invent color unit tests. Each task's verification cycle is:
1. `npm run test` — the existing Vitest suite must stay **green** (run from `app-react/`).
2. `npm run build` — tsc + vite must pass clean.
3. **Visual check** — headless Chrome screenshot of the affected screen(s) at mobile (~390px) and/or desktop (~1440px); confirm the intended dark/amber result and legible text. (A dev server + `puppeteer-core` driving `/Applications/Google Chrome.app` is already available in this repo's workflow; the controller will run the visual pass.)

The only task that *edits* tests is Task 6 (updating assertions that pin a removed color class).

## Global Constraints

- Do **not** modify `static-react/`, `server/`, the `frontend/` (Yew) crate, or the API. `app-react` only.
- Keep every screen's existing **layout and density**. No re-layout, no new screens, no copy changes, no new features.
- No new dependencies. Do **not** remove DaisyUI. No chart-logic changes (only chart chrome colors).
- **Palette (exact):** surfaces `#0b0b0d` / `#141416` / `#1e1e21`; primary text `#f5f4f2`; muted text = `#f5f4f2` at 55–70% opacity; **primary/accent = amber `#c8724a`** (lighter accent tint `#d68a63`); borders `rgba(255,255,255,0.10)`. Amber is the action color everywhere (primary buttons, active nav, checkmarks, center FAB). No teal or purple remains.
- **Preserve (never recolor):** `GoogleLoginButton.tsx` SVG path fills (`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`); semantic status intent (success=green-family, error=red-family, warning=amber/orange, info=blue) — may be dark-tuned but keep meaning; the recharts **data-series** colors (series lines/bars/dots + average ReferenceLine).
- **Typography:** Playfair Display on page titles / section headers only; Inter for body, controls, tables, chart labels.
- Each task: `npm run test` green + `npm run build` clean + visual pass, then commit with trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Dark theme tokens + fonts (Stage A foundation)

**Files:**
- Modify: `app-react/src/index.css` (replace the `[data-theme="light"]` token block; add `@theme` fonts)
- Modify: `app-react/index.html` (`data-theme` value + Google Fonts link)

**Interfaces:**
- Produces: the active dark DaisyUI theme (`data-theme="dark"`) and the `--font-serif` / `--font-sans` theme vars that later tasks rely on. Shared color constants come in Task 2.

- [ ] **Step 1: Replace the theme token block in `src/index.css`.** Replace the entire `[data-theme="light"] { … }` block with this dark block (keep the file's other rules — the `@import`, `@plugin`, `html,body,#root` height, tap-highlight, number-input rules — unchanged), and add the `@theme` fonts block directly after `@plugin "daisyui";`:

```css
@theme {
  --font-serif: 'Playfair Display', ui-serif, Georgia, serif;
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-base-100: #0b0b0d;
  --color-base-200: #141416;
  --color-base-300: #1e1e21;
  --color-base-content: #f5f4f2;
  --color-primary: #c8724a;
  --color-primary-content: #0b0b0d;
  --color-secondary: #a8b0bf;
  --color-secondary-content: #0b0b0d;
  --color-accent: #d68a63;
  --color-accent-content: #0b0b0d;
  --color-neutral: #1e1e21;
  --color-neutral-content: #f5f4f2;
  --color-info: #5aa9e6;
  --color-info-content: #0b0b0d;
  --color-success: #3fb98f;
  --color-success-content: #0b0b0d;
  --color-warning: #e0a336;
  --color-warning-content: #0b0b0d;
  --color-error: #f2607b;
  --color-error-content: #0b0b0d;
  --radius-selector: 0.5rem;
  --radius-field: 0.25rem;
  --radius-box: 0.5rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}
```

- [ ] **Step 2: Flip the app to the dark theme and load fonts in `index.html`.** Change the opening tag `<html lang="en" data-theme="light">` → `<html lang="en" data-theme="dark">`. In `<head>`, add (after the viewport meta) the same font links the landing uses:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Playfair+Display:wght@500;700&display=swap"
      rel="stylesheet"
    />
```

Leave the `bg.webp` preload line in place for now (Task 3 handles `AuthBackground`).

- [ ] **Step 3: Run the test suite.** Run `npm run test` in `app-react/`. Expected: green (no assertions depend on theme values yet). If a test fails on a removed teal/purple class, note it for Task 6 — do not edit tests here unless it blocks the run.

- [ ] **Step 4: Build.** Run `npm run build`. Expected: tsc + vite clean; the built CSS contains `Playfair Display` and `#0b0b0d`.

- [ ] **Step 5: Visual check.** Load the app (dev server + headless Chrome). Expected: Home renders on a near-black background with off-white text; residual teal remains only in the hardcoded chrome (nav, cards) — that's fine, later tasks fix it.

- [ ] **Step 6: Commit.**

```bash
git add app-react/src/index.css app-react/index.html
git commit -m "feat(app-react): dark DaisyUI theme tokens + Playfair/Inter fonts"
```

---

### Task 2: Shared dark/amber color constants + AuthBackground (Stage A)

**Files:**
- Create: `app-react/src/theme/tokens.ts`
- Modify: `app-react/src/components/layout/AuthBackground.tsx`

**Interfaces:**
- Produces: `tokens.ts` exports consumed by Tasks 3–4 for inline styles:
  - `ACCENT = '#c8724a'`, `ACCENT_LIGHT = '#d68a63'`
  - `ACCENT_GRADIENT = 'linear-gradient(135deg, #d68a63 0%, #c8724a 100%)'`
  - `ACCENT_SHADOW = 'rgba(200,114,74,0.40)'`, `ACCENT_SOFT = 'rgba(200,114,74,0.12)'`, `ACCENT_RING = 'rgba(200,114,74,0.15)'`
  - `SURFACE_1 = '#0b0b0d'`, `SURFACE_2 = '#141416'`, `SURFACE_3 = '#1e1e21'`
  - `TEXT = '#f5f4f2'`, `TEXT_MUTED = 'rgba(245,244,242,0.55)'`, `TEXT_FAINT = 'rgba(245,244,242,0.40)'`
  - `BORDER = 'rgba(255,255,255,0.10)'`, `SURFACE_GLASS = 'rgba(11,11,13,0.80)'`

- [ ] **Step 1: Create `src/theme/tokens.ts`** with exactly these constants:

```ts
// Shared dark/amber palette for inline styles (mirrors the DaisyUI theme in
// index.css). Prefer DaisyUI classes (bg-base-100, text-primary, …) where a
// className is used; use these constants where a raw inline-style value is
// required. Amber replaces the old teal (#01a386 / #02c9a3).
export const ACCENT = '#c8724a'
export const ACCENT_LIGHT = '#d68a63'
export const ACCENT_GRADIENT = 'linear-gradient(135deg, #d68a63 0%, #c8724a 100%)'
export const ACCENT_SHADOW = 'rgba(200,114,74,0.40)'
export const ACCENT_SOFT = 'rgba(200,114,74,0.12)'
export const ACCENT_RING = 'rgba(200,114,74,0.15)'

export const SURFACE_1 = '#0b0b0d'
export const SURFACE_2 = '#141416'
export const SURFACE_3 = '#1e1e21'
export const SURFACE_GLASS = 'rgba(11,11,13,0.80)'

export const TEXT = '#f5f4f2'
export const TEXT_MUTED = 'rgba(245,244,242,0.55)'
export const TEXT_FAINT = 'rgba(245,244,242,0.40)'
export const BORDER = 'rgba(255,255,255,0.10)'
```

- [ ] **Step 2: Dark-treat `AuthBackground.tsx`.** The auth screens currently show the green landscape `bg.webp`. Keep the image but lay a strong dark gradient over it so auth reads as dark and the amber button/off-white text pop. Replace the component body with:

```tsx
export function AuthBackground() {
  return (
    <div className="fixed inset-0 -z-10" style={{ background: '#0b0b0d' }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "image-set(url('/bg.webp') type('image/webp'), url('/bg.jpg') type('image/jpeg'))",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.28,
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(11,11,13,0.55) 0%, rgba(11,11,13,0.88) 100%)' }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Test.** `npm run test` → green.
- [ ] **Step 4: Build.** `npm run build` → clean.
- [ ] **Step 5: Visual check.** Login screen: dark backdrop (image faintly visible), off-white heading, readable inputs. (Button/input teal is fixed in Tasks 3–4.)
- [ ] **Step 6: Commit.**

```bash
git add app-react/src/theme/tokens.ts app-react/src/components/layout/AuthBackground.tsx
git commit -m "feat(app-react): shared dark/amber tokens + dark auth background"
```

---

### Task 3: Convert nav chrome — TopBar, BottomNav, Toast (Stage B)

**Files:**
- Modify: `app-react/src/components/layout/TopBar.tsx`
- Modify: `app-react/src/components/layout/BottomNav.tsx`
- Modify: `app-react/src/components/ui/Toast.tsx`

**Interfaces:**
- Consumes: constants from `src/theme/tokens.ts` (Task 2). Import what each file needs.

- [ ] **Step 1: BottomNav.tsx.** Import `import { ACCENT, ACCENT_GRADIENT, ACCENT_SHADOW, SURFACE_GLASS, TEXT_FAINT, BORDER } from '../../theme/tokens'`. Apply these exact swaps:
  - `CENTER_STYLE.background`: `'linear-gradient(135deg, #02c9a3 0%, #01a386 100%)'` → `ACCENT_GRADIENT`
  - `CENTER_STYLE.boxShadow`: `'0 4px 20px rgba(1,163,134,0.40)'` → `` `0 4px 20px ${ACCENT_SHADOW}` ``
  - In `Tab`, the icon color: `isActive ? '#01a386' : 'rgba(0,0,0,0.40)'` → `isActive ? ACCENT : TEXT_FAINT`
  - Center-button icons currently `className="w-5 h-5 text-white"` → `className="w-5 h-5 text-[#0b0b0d]"` (near-black reads better on amber). Apply to all three `<FaSignOutAlt/> <FaPlus/> <FaSlidersH/>` inside the center button/link.
  - The `<nav>` inline style: `background: 'rgba(255, 255, 255, 0.70)'` → `SURFACE_GLASS`; `borderTop: '1px solid rgba(0, 0, 0, 0.08)'` → `` `1px solid ${BORDER}` ``.

- [ ] **Step 2: TopBar.tsx.** Import `import { ACCENT, SURFACE_GLASS, TEXT_FAINT, BORDER } from '../../theme/tokens'`. Swaps:
  - `<header>` style: `background: 'rgba(255, 255, 255, 0.70)'` → `SURFACE_GLASS`; `borderBottom: '1px solid rgba(0, 0, 0, 0.08)'` → `` `1px solid ${BORDER}` ``.
  - Close button `className="btn btn-ghost btn-sm btn-circle text-gray-500"` → `…text-base-content/70`; back button `text-gray-700` → `text-base-content/80`.
  - Title `<h1 … text-gray-800 …>` → `className="font-serif font-semibold text-base text-base-content flex-1"` (adds serif per typography rule).
  - Nav active/inactive colors (three occurrences of `#01a386` / `rgba(0,0,0,0.40)`): `isActive ? '#01a386' : 'rgba(0,0,0,0.40)'` → `isActive ? ACCENT : TEXT_FAINT`; the active dot `background: isActive ? '#01a386' : 'transparent'` → `isActive ? ACCENT : 'transparent'`.
  - Logo `style={{ filter: 'brightness(0)' }}` (forces black for light bg) → `style={{ filter: 'brightness(0) invert(1)' }}` (white on dark).

- [ ] **Step 3: Toast.tsx.** Import `import { TEXT, TEXT_MUTED, BORDER } from '../../theme/tokens'`. Swaps:
  - `BORDER_COLOR.success`: `'#01a386'` → `'#3fb98f'` (dark-tuned success; error/warning/info unchanged).
  - Toast card style: `background: 'rgba(255,255,255,0.92)'` → `'rgba(20,20,22,0.95)'`; `border: '1px solid rgba(255,255,255,0.85)'` → `` `1px solid ${BORDER}` ``; `boxShadow: '0 4px 16px rgba(0,0,0,0.12)'` → `'0 8px 24px rgba(0,0,0,0.5)'`.
  - Message span `className="… text-gray-800"` → `style={{ color: TEXT }}` (drop the `text-gray-800` class).
  - Dismiss button style: `background: 'rgba(0,0,0,0.06)'` → `'rgba(255,255,255,0.08)'`; `color: '#9ca3af'` → `TEXT_MUTED`.

- [ ] **Step 4: Test / Build / Visual.** `npm run test` green; `npm run build` clean; visual check Home (bottom nav dark with amber center FAB + amber active tab; top bar dark on desktop) and trigger a toast if easily reachable.
- [ ] **Step 5: Commit.**

```bash
git add app-react/src/components/layout/TopBar.tsx app-react/src/components/layout/BottomNav.tsx app-react/src/components/ui/Toast.tsx
git commit -m "feat(app-react): dark+amber nav chrome (TopBar, BottomNav, Toast)"
```

---

### Task 4: Convert PracticeForm + remaining hardcoded-color sweep (Stage B)

**Files:**
- Modify: `app-react/src/components/PracticeForm.tsx`
- Modify: any remaining `.tsx`/`.ts` under `app-react/src` (excluding tests) still holding teal/light literals after Tasks 1–3.

**Interfaces:**
- Consumes: `src/theme/tokens.ts`.

- [ ] **Step 1: PracticeForm.tsx.** Import `import { ACCENT, ACCENT_SOFT, ACCENT_RING, SURFACE_2, TEXT, TEXT_MUTED, BORDER } from '../theme/tokens'`. Apply:
  - input base style: `background: 'rgba(255,255,255,0.80)'` → `SURFACE_2`; `border: '1px solid rgba(0,0,0,0.10)'` → `` `1px solid ${BORDER}` ``; `color: '#1f2937'` → `TEXT`.
  - focus handlers: `e.target.style.borderColor = '#01a386'` → `= ACCENT`; `e.target.style.boxShadow = '0 0 0 3px rgba(1,163,134,0.12)'` → `` = `0 0 0 3px ${ACCENT_RING}` ``; blur reset `e.target.style.borderColor = 'rgba(0,0,0,0.10)'` → `= BORDER`.
  - "card" style `background: 'rgba(255,255,255,0.90)'` → `SURFACE_2`; its `boxShadow: '0 4px 16px rgba(0,0,0,0.08)'` → `'0 8px 24px rgba(0,0,0,0.4)'`.
  - active data-type tile: `{ background: 'rgba(1,163,134,0.10)', border: '1.5px solid #01a386', boxShadow: '0 0 0 3px rgba(1,163,134,0.08)' }` → `{ background: ACCENT_SOFT, border: `1.5px solid ${ACCENT}`, boxShadow: `0 0 0 3px ${ACCENT_RING}` }`; inactive tile `{ background: 'rgba(0,0,0,0.03)', border: '1.5px solid rgba(0,0,0,0.07)' }` → `{ background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${BORDER}` }`.
  - tile icon `color: active ? '#01a386' : '#9ca3af'` → `active ? ACCENT : TEXT_MUTED`; tile label `color: active ? '#01a386' : '#6b7280'` → `active ? ACCENT : TEXT_MUTED`.
  - required toggle track `backgroundColor: isRequired ? '#01a386' : 'rgba(0,0,0,0.15)'` → `isRequired ? ACCENT : 'rgba(255,255,255,0.15)'`; knob `backgroundColor: 'white'` stays.
  - submit button `background: 'linear-gradient(135deg, #02c9a3 0%, #01a386 100%)'` → import and use `ACCENT_GRADIENT`; if the submit label is white on the gradient, set its text color to `#0b0b0d` for contrast.

- [ ] **Step 2: Find every remaining teal/light literal.** From `app-react/`, run:

```bash
grep -rnE "#01a386|#02c9a3|rgba\(1,163,134|rgba\(2,201,163" src --include='*.tsx' --include='*.ts' | grep -v "\.test\."
```

For each hit, apply the mapping: `#01a386` → `#c8724a` (`ACCENT`); `#02c9a3` → `#d68a63` (`ACCENT_LIGHT`); `rgba(1,163,134,α)` → `rgba(200,114,74,α)` (same α); teal gradients → `ACCENT_GRADIENT`. Prefer importing the `tokens.ts` constant over inlining a raw hex.

- [ ] **Step 3: Convert light-surface literals that now read wrong on dark.** Run:

```bash
grep -rnE "rgba\(255,255,255,0\.[0-9]+\)|#1f2937|#111827|#374151|text-gray-[5-9]00|bg-white|from-white|rgba\(0,0,0,0\.0[0-9]\)" src --include='*.tsx' --include='*.ts' | grep -v "\.test\."
```

Convert light card/text literals to dark equivalents: white glass `rgba(255,255,255,0.8+)` backgrounds → `SURFACE_2`/`SURFACE_3`; dark text hexes (`#1f2937`/`#111827`/`#374151`) and `text-gray-700/800/900` used as primary copy → `TEXT` / `text-base-content`; faint black overlays used as borders → `BORDER`. **Do not** touch: `GoogleLoginButton.tsx` fills; `Toast` error/warning/info; recharts series colors (handled in Task 5); the `bg-black/30` modal backdrop (valid on dark). Use judgment — a black modal-scrim overlay stays; a white *card surface* becomes dark.

- [ ] **Step 4: Confirm no teal remains.** Re-run the Step 2 grep. Expected: zero matches outside tests.

- [ ] **Step 5: Test / Build / Visual.** `npm run test` green; `npm run build` clean; visual check the practice new/edit form (dark inputs, amber active type tile + required toggle + submit) and a couple of settings screens.
- [ ] **Step 6: Commit.**

```bash
git add -A app-react/src
git commit -m "feat(app-react): convert PracticeForm + sweep remaining teal to dark/amber"
```

---

### Task 5: Dark-tune chart chrome (Stage C)

**Files:**
- Modify: `app-react/src/pages/charts/ChartsPage.tsx` (and `NewChartPage.tsx` / `SharedChartPage.tsx` if they render recharts chrome)

**Interfaces:**
- Consumes: nothing new. Keep all series colors and the average `ReferenceLine` from the existing chart logic untouched.

- [ ] **Step 1: Locate chart chrome props.** In `ChartsPage.tsx`, grep for the recharts chrome elements:

```bash
grep -nE "CartesianGrid|XAxis|YAxis|Legend|<Tooltip|tick=|stroke=|fill=" src/pages/charts/ChartsPage.tsx
```

- [ ] **Step 2: Apply dark chrome.** Set these on the chart's chrome elements (leave `<Line>/<Bar>/<Scatter>/<ReferenceLine>` series props alone):
  - `<CartesianGrid stroke="rgba(255,255,255,0.10)" />` (grid lines).
  - `<XAxis … stroke="rgba(255,255,255,0.20)" tick={{ fill: 'rgba(245,244,242,0.55)' }} />` and the same `stroke` + `tick` fill on every `<YAxis>` (there may be multiple y-axes — number left, time right, unit hidden; apply to the visible ones).
  - `<Legend />` text to off-white: wrap labels with `wrapperStyle={{ color: '#f5f4f2' }}` (or set `formatter` text color).
  - If a `<Tooltip>` is present, give it a dark surface: `contentStyle={{ background: '#141416', border: '1px solid rgba(255,255,255,0.10)', color: '#f5f4f2' }}` and `labelStyle={{ color: '#f5f4f2' }}`.
  - Ensure the chart's container/card uses a dark surface (`bg-base-200`/`bg-base-300`), not a white card.
  - If `NewChartPage.tsx` or `SharedChartPage.tsx` render their own recharts chrome or a white chart card, apply the same treatment there.

- [ ] **Step 3: Test / Build / Visual.** `npm run test` green (`ChartsPage.test.tsx` asserts data/roles, not chrome colors — should pass); `npm run build` clean; visual check a rendered graph — dark plot, muted grid/axis, off-white legend, **series colors unchanged**, average lines still visible.
- [ ] **Step 4: Commit.**

```bash
git add app-react/src/pages/charts
git commit -m "feat(app-react): dark chart chrome, keep series palette"
```

---

### Task 6: Serif titles, contrast polish, test fixes, final pass (Stage C)

**Files:**
- Modify: page title/header elements across `app-react/src/pages/**` (auth, home, settings, yatras) and shared headers — className-only edits.
- Modify: any `*.test.tsx` asserting a removed color class.

**Interfaces:**
- Consumes: `--font-serif` (Task 1). No new exports.

- [ ] **Step 1: Apply serif to page titles / section headers.** Add the `font-serif` class to the primary heading of each area (do not change the text, size, or element — only add the class). Targets:
  - Home: the "Today"/date header in `src/pages/home/HomePage.tsx`.
  - Charts: the page title in `src/pages/charts/ChartsPage.tsx`.
  - Auth: the heading ("Welcome to your daily practice") in `src/pages/auth/LoginPage.tsx`, `RegisterPage.tsx`, `PwdResetPage.tsx`, `PwdResetRequestPage.tsx`.
  - Settings: the page/section title(s) in `src/pages/settings/SettingsPage.tsx` (and the section group headers if present).
  - Yatras: the page title in `src/pages/yatras/YatrasPage.tsx`.
  Find each with e.g. `grep -nE "<h1|<h2|text-xl|text-2xl|font-bold" <file>` and add `font-serif` to that heading's className. (TopBar's `<h1>` already got serif in Task 3.)

- [ ] **Step 2: Contrast / state polish sweep.** Scan the affected screens for dark-legibility issues introduced by the theme flip and fix className-only:
  - Placeholder text invisible on dark → ensure inputs use `placeholder:text-base-content/40` (or equivalent) rather than a near-black placeholder.
  - Disabled buttons / muted labels rendered near-invisible → use `text-base-content/50`.
  - Any leftover `text-gray-400/500` used as body copy → `text-base-content/60`.
  - Focus rings present and amber/white-visible on interactive controls.
  Keep changes minimal and class-only; do not alter layout.

- [ ] **Step 3: Fix color-pinned tests.** Run `npm run test`. If any test fails on a removed teal/purple class, update the assertion to the new class/value:
  - `src/pages/settings/Settings.test.tsx` — the "counter turns amber at 45 chars" test should already match the amber accent; confirm it passes and, if it pins an old hex, update to `#c8724a`.
  - `src/pages/home/MonthCalendar.test.tsx` — the `.fixed.inset-0.bg-black/30` backdrop selector stays valid on dark; leave unless it fails.
  - Any other failure: update the assertion to reflect the new dark/amber class. Do **not** weaken a test to a no-op.

- [ ] **Step 4: Full verification.** `npm run test` → all green; `npm run build` → clean.

- [ ] **Step 5: Final visual pass.** Headless Chrome at mobile (~390px) and desktop (~1440px) across: Login/Register/Reset, Home (cards + week + month calendar), Charts (list + a graph + grid), Settings (+ My Practices, Practice edit/new, Language, Import), Yatras (list + a yatra). Confirm: dark surfaces, amber accents, serif titles, legible text/placeholders, **no leftover teal/purple**, charts series colors intact. Capture screenshots for the controller's review.

- [ ] **Step 6: Commit.**

```bash
git add -A app-react/src
git commit -m "feat(app-react): serif titles, dark contrast polish, test fixes"
```

---

## Self-review

**Spec coverage:** tokens → Task 1; fonts → Task 1 (registration) + Task 6 (title application) + Task 3 (TopBar title); hardcoded sweep → Tasks 3–4 (chrome + broad grep); preserve-list → Global Constraints + Task 4 Step 3 + Task 5; AuthBackground → Task 2; TopBar/BottomNav → Task 3; charts chrome → Task 5; contrast/placeholder/focus edge cases → Task 6 Step 2; testing/build/visual gates → Verification model + every task; staged rollout A/B/C → Tasks 1–2 (A), 3–4 (B), 5–6 (C). No spec requirement left unmapped.

**Placeholder scan:** every code step carries exact hex mappings, exact constant names, and exact file paths; greps are concrete. No "TBD"/"handle appropriately"/"similar to". The two inherently-broad steps (Task 4 Steps 2–3) are bounded by an explicit mapping table, a preserve-list, and a confirming re-grep.

**Type/name consistency:** `tokens.ts` export names (`ACCENT`, `ACCENT_GRADIENT`, `ACCENT_SHADOW`, `ACCENT_SOFT`, `ACCENT_RING`, `ACCENT_LIGHT`, `SURFACE_1/2/3`, `SURFACE_GLASS`, `TEXT`, `TEXT_MUTED`, `TEXT_FAINT`, `BORDER`) are defined in Task 2 and used verbatim in Tasks 3–4. Palette hexes match the spec's token table. `data-theme="dark"` set in Task 1 matches the `[data-theme="dark"]` selector.
