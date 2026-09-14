# Light Retheme — Stage 1: Foundation

**Date:** 2026-08-17
**App:** `app-react`
**Status:** Approved (design)

## Context

The user wants `app-react` restyled to the "clear and light" aesthetic of the
`static-react` landing page on `main` (cool-grey light base, serif headings,
round floating glass controls). `main` is already fully contained in `redesign`
(no merge needed); the light landing is `main`'s `static-react` (this branch
replaced it with a dark one). This is a large, multi-stage retheme; **Stage 1 is
the foundation** — the theme/token flip + background + header — which flips
everything driven by theme classes/tokens. Pages with hardcoded dark inline
styles are fixed in later stages.

Chosen: **cool-grey** light base; keep the **Krishna painting** as the backdrop
(washed light for legibility).

## 1. Theme flip (`index.css` + `index.html`)

Add a light DaisyUI theme and switch to it.

- In `index.css`, add a `[data-theme="light"]` block (mirroring the existing dark
  block's variable set) with:
  - `color-scheme: light`
  - `--color-base-100: #f4f5f7` (cool off-white), `--color-base-200: #e9ebef`,
    `--color-base-300: #d8dbe1`
  - `--color-base-content: #1f2937` (slate-800)
  - `--color-primary: #c8724a` (keep terracotta), `--color-primary-content: #ffffff`
  - `--color-secondary: #64748b`, `--color-secondary-content: #ffffff`
  - `--color-accent: #d68a63`, `--color-accent-content: #1f2937`
  - `--color-neutral: #334155`, `--color-neutral-content: #f8fafc`
  - `--color-info: #2f80c4`, `--color-success: #2f9e6f`, `--color-warning: #c98a1e`,
    `--color-error: #d24b62` (each with a light-appropriate `*-content`)
  - keep the radius/border/depth/noise lines as in the dark block.
- In `index.html`, change `<html lang="en" data-theme="dark">` →
  `data-theme="light"`. Leave the dark block in place (unused) — no theme toggle
  in scope.

## 2. `theme/tokens.ts` flip

Flip the inline-style tokens to light (keep the export names/shape so the ~34
consumers don't break):
- `SURFACE_1 #f4f5f7`, `SURFACE_2 #e9ebef`, `SURFACE_3 #d8dbe1`
- `SURFACE_GLASS rgba(255,255,255,0.72)`
- `TEXT #1f2937`, `TEXT_MUTED rgba(31,41,55,0.60)`, `TEXT_FAINT rgba(31,41,55,0.42)`
- `BORDER rgba(0,0,0,0.08)`
- `ACCENT`, `ACCENT_LIGHT`, `ACCENT_GRADIENT`, `ACCENT_SHADOW/SOFT/RING` unchanged
  (terracotta already suits the light base).

## 3. Background (`AuthBackground.tsx` + optimized painting)

- Optimize the untracked painting
  `public/the-cleveland-museum-of-art-M_kaPq0-vgE-unsplash.jpg` (2.5 MB, 2400×3484)
  to a resized WebP `public/bg.webp` via
  `sips -s format webp -Z 1600 -s formatOptions 72 <src> --out public/bg.webp`
  (target < ~250 KB; `sips` here supports WebP). Remove the old `public/bg.jpg`
  (peacock) and the 2.5 MB source.
- `AuthBackground` renders `bg.webp` at `cover`, behind a **light wash**: a
  translucent cream/white scrim (~`rgba(244,245,247,0.72)`) plus a gradient
  fading to `#f4f5f7` toward the bottom where content sits — so the painting is a
  soft, visible backdrop and light UI stays legible.
- Update the `index.html` preload from `/bg.jpg` → `/bg.webp` (`type="image/webp"`).

## 4. Header (`TopBar.tsx`) — light + aligned floating glass

Restyle the header for the light theme, adopting the landing's aligned round-glass
treatment and fixing the alignment issue:
- The nav links (Home, Charts[lg:hidden], Settings) and the `Practices ▾` /
  `Yatras ▾` menu triggers become a single, **vertically-centered aligned row** of
  light-glass controls (`h-9`+, `rounded-full`, `bg-white/60` / light border,
  dark text) — consistent height so everything lines up.
- Serif is available via the existing Playfair (`font-serif`); apply to header
  title/brand where appropriate.
- Preserve the accessible structure so tests hold: a `Home` link, `Practices` and
  `Yatras` menu buttons, a `Settings` control (text), and no `Yatras` nav link.
- `HeaderMenu` (the dropdown) surface/text colors move to light (light glass
  trigger, light menu panel, dark text) — update its inline color constants.

## Testing

- **`TopBar`**: existing assertions stay valid (Home link, Practices/Yatras
  buttons, Settings text, no Yatras nav link on `/`) — the restyle is
  presentational; update only if a class/structure the test reads changes.
- **`HeaderMenu`**: existing behavior tests (open on click, link vs onClick,
  outside-click close) stay green — only inline colors change.
- `index.css`, `theme/tokens.ts`, `AuthBackground` are presentational (no unit
  tests) — verified by build + the app rendering; the background size win by file
  size.
- Full suite + build + lint must stay green.

## Out of scope (later stages)

Hardcoded-dark inline styles inside pages/components (home dashboard, charts,
yatras, settings, auth, help) — each converted in its own follow-up stage. No
theme toggle. No functional changes.
