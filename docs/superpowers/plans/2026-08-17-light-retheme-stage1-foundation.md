# Light Retheme Stage 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip `app-react` to a cool-grey light theme foundation — light DaisyUI theme + tokens, a light-washed Krishna-painting backdrop, and a light aligned header.

**Architecture:** A light `[data-theme="light"]` DaisyUI theme + a light `theme/tokens.ts` flip re-colour everything driven by theme classes/tokens; `AuthBackground` renders the optimized painting under a light wash; `TopBar`/`HeaderMenu` get light styling + aligned single-row controls.

**Tech Stack:** Tailwind v4 + DaisyUI theme vars, React 19, Vitest + RTL, `sips` for WebP.

## Global Constraints

- App in `app-react/`; run all commands there. Tests: `npx vitest run <path>` (or `npm run test`). Build: `npm run build`. Lint: `npm run lint` (`oxlint`, fails on unused imports).
- These are presentational changes: the existing `TopBar`/`HeaderMenu` tests are the regression net (they assert roles/labels/text, not colours) — keep them green; preserve the header's accessible structure (Home link, Practices/Yatras menu buttons, Settings text, no Yatras nav link).
- JSX auto-runtime — no `import React` in files that don't already have it (`TopBar.tsx` keeps its `React` import).
- Keep every export name/shape in `theme/tokens.ts` (≈34 consumers) — only values change.
- Light palette values (verbatim): base `#f4f5f7` / `#e9ebef` / `#d8dbe1`; text `#1f2937`; primary `#c8724a`; glass `rgba(255,255,255,0.72)`; border `rgba(0,0,0,0.08)`.

---

### Task 1: Light theme + tokens flip

**Files:**
- Modify: `app-react/src/index.css` (add a `[data-theme="light"]` block)
- Modify: `app-react/index.html` (`data-theme="dark"` → `"light"`)
- Modify: `app-react/src/theme/tokens.ts` (flip values to light)

**Interfaces:**
- Produces: the app renders under `data-theme="light"`; `tokens.ts` exports the same names with light values.

- [ ] **Step 1: Add the light theme block to `index.css`**

Immediately after the existing `[data-theme="dark"] { … }` block (which ends at the line with the closing `}` before `html, body, #root {`), insert:

```css
[data-theme="light"] {
  color-scheme: light;
  --color-base-100: #f4f5f7;
  --color-base-200: #e9ebef;
  --color-base-300: #d8dbe1;
  --color-base-content: #1f2937;
  --color-primary: #c8724a;
  --color-primary-content: #ffffff;
  --color-secondary: #64748b;
  --color-secondary-content: #ffffff;
  --color-accent: #d68a63;
  --color-accent-content: #1f2937;
  --color-neutral: #334155;
  --color-neutral-content: #f8fafc;
  --color-info: #2f80c4;
  --color-info-content: #ffffff;
  --color-success: #2f9e6f;
  --color-success-content: #ffffff;
  --color-warning: #c98a1e;
  --color-warning-content: #ffffff;
  --color-error: #d24b62;
  --color-error-content: #ffffff;
  --radius-selector: 0.5rem;
  --radius-field: 0.25rem;
  --radius-box: 0.5rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}
```

- [ ] **Step 2: Switch the document theme in `index.html`**

Change:
```html
<html lang="en" data-theme="dark">
```
to:
```html
<html lang="en" data-theme="light">
```

- [ ] **Step 3: Flip `theme/tokens.ts` to light**

Replace the whole file with:

```ts
// Shared light palette for inline styles (mirrors the DaisyUI light theme in
// index.css). Prefer DaisyUI classes (bg-base-100, text-primary, …) where a
// className is used; use these constants where a raw inline-style value is
// required.
export const ACCENT = '#c8724a'
export const ACCENT_LIGHT = '#d68a63'
export const ACCENT_GRADIENT = 'linear-gradient(135deg, #d68a63 0%, #c8724a 100%)'
export const ACCENT_SHADOW = 'rgba(200,114,74,0.40)'
export const ACCENT_SOFT = 'rgba(200,114,74,0.12)'
export const ACCENT_RING = 'rgba(200,114,74,0.15)'

export const SURFACE_1 = '#f4f5f7'
export const SURFACE_2 = '#e9ebef'
export const SURFACE_3 = '#d8dbe1'
export const SURFACE_GLASS = 'rgba(255,255,255,0.72)'

export const TEXT = '#1f2937'
export const TEXT_MUTED = 'rgba(31,41,55,0.60)'
export const TEXT_FAINT = 'rgba(31,41,55,0.42)'
export const BORDER = 'rgba(0,0,0,0.08)'
```

- [ ] **Step 4: Full suite, build, lint**

Run: `cd app-react && npm run test && npm run build && npm run lint`
Expected: all green — tests assert roles/text, not colours, so the flip doesn't break them.

- [ ] **Step 5: Commit**

```bash
cd app-react && git add src/index.css index.html src/theme/tokens.ts
git commit -m "feat(app-react): light theme foundation — DaisyUI light theme + light tokens"
```

---

### Task 2: Light-washed painting background

**Files:**
- Create: `app-react/public/bg.webp` (from the painting); Delete: `app-react/public/bg.jpg` + the 2.5 MB source
- Modify: `app-react/src/components/layout/AuthBackground.tsx`
- Modify: `app-react/index.html` (preload → `bg.webp`)

**Interfaces:**
- Produces: a light, washed full-viewport backdrop from `/bg.webp`.

- [ ] **Step 1: Optimize the painting to `bg.webp`**

From `app-react/`:
```bash
sips -s format webp -Z 1600 -s formatOptions 72 \
  "public/the-cleveland-museum-of-art-M_kaPq0-vgE-unsplash.jpg" --out public/bg.webp
ls -la public/bg.webp
```
Confirm `public/bg.webp` exists and is well under ~250 KB. Then remove the old peacock bg and the 2.5 MB source:
```bash
git rm public/bg.jpg
rm -f "public/the-cleveland-museum-of-art-M_kaPq0-vgE-unsplash.jpg"
```

- [ ] **Step 2: Rewrite `AuthBackground.tsx`**

Replace the whole file with:

```tsx
export function AuthBackground() {
  return (
    <div className="fixed inset-0 -z-10" style={{ background: '#f4f5f7' }}>
      {/* The Krishna painting as a soft, light-washed backdrop. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/bg.webp')",
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      />
      {/* Even cream scrim so the busy painting reads as a gentle backdrop. */}
      <div className="absolute inset-0" style={{ background: 'rgba(244,245,247,0.72)' }} />
      {/* Fade to the base colour toward the bottom, where content sits. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(244,245,247,0.30) 0%, rgba(244,245,247,0.55) 45%, rgba(244,245,247,0.85) 78%, #f4f5f7 100%)',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Update the preload in `index.html`**

Change:
```html
<link rel="preload" as="image" href="/bg.jpg" type="image/jpeg" />
```
to:
```html
<link rel="preload" as="image" href="/bg.webp" type="image/webp" />
```

- [ ] **Step 4: Build, test, lint**

Run: `cd app-react && npm run build && npm run test && npm run lint`
Expected: build resolves `/bg.webp`, all green. Confirm `bg.webp` is much smaller than the old 344 KB `bg.jpg` / 2.5 MB source.

- [ ] **Step 5: Commit**

```bash
cd app-react && git add public/bg.webp src/components/layout/AuthBackground.tsx index.html
git commit -m "feat(app-react): light-washed painting backdrop (bg.webp)"
```

---

### Task 3: Light + aligned header (`TopBar` + `HeaderMenu`)

**Files:**
- Modify: `app-react/src/components/layout/TopBar.tsx`
- Modify: `app-react/src/components/layout/HeaderMenu.tsx`

**Interfaces:**
- Consumes: nothing new. Preserves the header's accessible structure so `TopBar.test`/`HeaderMenu.test` stay green.

- [ ] **Step 1: Light-recolour `HeaderMenu.tsx`**

In `app-react/src/components/layout/HeaderMenu.tsx`, replace the three style constants:

```tsx
const glassPill = {
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.85)',
} as const
```
with:
```tsx
const glassPill = {
  background: 'rgba(255,255,255,0.60)',
  border: '1px solid rgba(0,0,0,0.08)',
  color: '#1f2937',
} as const
```

and replace the menu-panel + item styles. The menu `<div role="menu">` inline `style` object becomes:
```tsx
            style={{
              background: 'rgba(255,255,255,0.96)',
              border: '1px solid rgba(0,0,0,0.08)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            }}
```
and change the shared item-colour constant `const itemStyle = { color: 'rgba(255,255,255,0.85)' } as const` to `const itemStyle = { color: '#1f2937' } as const` (it's applied to both the `<Link>` and `<button>` menu items). Leave the `itemClass` string as-is (`hover:bg-white/10` reads fine on the light panel; keep it).

- [ ] **Step 2: Light-recolour + align `TopBar.tsx`**

Three edits in `app-react/src/components/layout/TopBar.tsx`:

(a) Header scrim → light. Replace the `<header>` `style` object's `background`:
```tsx
        background: 'linear-gradient(180deg, rgba(30,43,69,0.55) 0%, rgba(30,43,69,0) 100%)',
```
with:
```tsx
        background: 'linear-gradient(180deg, rgba(244,245,247,0.88) 0%, rgba(244,245,247,0) 100%)',
```

(b) Logo → dark silhouette on the light bar. Change the logo `<img>` style:
```tsx
        <img src="/logo.png" className="h-[35px] w-[35px] object-contain" style={{ filter: 'brightness(0) invert(1)' }} alt="Sadhana" />
```
to:
```tsx
        <img src="/logo.png" className="h-[35px] w-[35px] object-contain" style={{ filter: 'brightness(0)' }} alt="Sadhana" />
```

(c) Nav items → single-row, height-matched, dark text (this aligns them with the `h-9` menu pills). Replace the entire `renderNavItem` definition with:
```tsx
  const renderNavItem = ({ to, navKey, exact }: (typeof navItems)[number]) => (
    <NavLink
      key={to}
      to={to}
      end={exact}
      onClick={navKey === 'settings' ? (e) => { e.preventDefault(); openSettings() } : undefined}
      aria-label={t(`nav.${navKey}`)}
      className={`h-9 inline-flex items-center px-3 rounded-full text-sm font-medium transition-colors ${navKey === 'charts' ? 'lg:hidden' : ''}`}
    >
      {({ isActive }) => (
        <span
          style={{
            color: isActive ? '#1f2937' : 'rgba(31,41,55,0.62)',
            fontWeight: isActive ? 600 : 500,
          }}
        >
          {t(`nav.${navKey}`)}
        </span>
      )}
    </NavLink>
  )
```
(This drops the stacked icon + active-dot in favour of a single centered row, so the nav links line up with the `Practices ▾`/`Yatras ▾` pills. `ACCENT` is no longer used by `renderNavItem`; if `ACCENT` is now unused anywhere in `TopBar.tsx`, remove it from the import to satisfy `oxlint`.)

- [ ] **Step 3: Run the header tests + full suite + build + lint**

Run: `cd app-react && npx vitest run src/components/layout/TopBar.test.tsx src/components/layout/HeaderMenu.test.tsx && npm run test && npm run build && npm run lint`
Expected: all green — the accessible structure (Home link, Practices/Yatras buttons, Settings text, no Yatras link) is unchanged; only colours/layout classes changed.

- [ ] **Step 4: Commit**

```bash
cd app-react && git add src/components/layout/TopBar.tsx src/components/layout/HeaderMenu.tsx
git commit -m "feat(app-react): light + aligned header"
```

---

## Manual verification (after all tasks)

`cd app-react && npm run dev`, open the app:
1. The whole shell is **light** (cool-grey surfaces, dark text); the header bar is light with dark text and a dark logo.
2. The **painting shows as a soft, washed backdrop**, not a loud full-colour image; light UI stays legible over it.
3. The header controls (`Home`, `Practices ▾`, `Yatras ▾`, `Settings`) sit on **one aligned row**, same height.
4. Expected & known: page internals that use hardcoded dark inline styles (dashboard cards, charts, yatras grids, settings, auth) still look dark/wrong — those are the Stage 2+ passes.

## Self-Review Notes

- **Spec coverage:** light DaisyUI theme + data-theme (Task 1) ✓; tokens flip keeping export names (Task 1) ✓; painting→bg.webp + light-wash `AuthBackground` + preload (Task 2) ✓; light + aligned header incl. `HeaderMenu` recolour (Task 3) ✓; tests stay green / structure preserved (all tasks) ✓; staging note that page internals are later (spec + manual-verification) ✓.
- **Placeholders:** none — palette values, commands, and edits are concrete.
- **Type consistency:** `tokens.ts` export names unchanged (values only); `renderNavItem` no longer destructures `icon`/uses `ACCENT` (import cleanup called out); palette hexes (`#f4f5f7`, `#1f2937`, `#c8724a`, glass `rgba(255,255,255,…)`) are consistent across `index.css`, `tokens.ts`, `AuthBackground`, `TopBar`, `HeaderMenu`.
