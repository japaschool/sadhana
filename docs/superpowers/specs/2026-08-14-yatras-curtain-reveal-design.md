# Yatras Home Section — Giga-style Curtain Reveal

**Date:** 2026-08-14
**App:** `app-react`
**Status:** Approved (design)

## Goal

Replace the current entrance animation on the yatras home section with a
**Giga-style sticky-curtain reveal**: as the user scrolls the home screen, the
dashboard (practices + embedded charts) pins as a one-screen panel and the
yatras section **rises up and covers it like a curtain**, while the covered
dashboard scales down and dims so it visibly recedes.

Reference: the Giga landing page, where the next section slides up over a pinned
hero.

## Current behavior (to be replaced)

`app-react/src/pages/home/HomePage.tsx` currently wraps the yatras section in a
`motion.section` that fades in and rises 28px once on scroll into view:

```tsx
<motion.section
  initial={{ opacity: 0, y: 28 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-80px' }}
  transition={{ duration: 0.55, ease: 'easeOut' }}
  className="px-4 pb-14 pt-8 lg:pt-16 lg:px-6 max-w-lg lg:max-w-[1400px] mx-auto w-full"
>
  <YatrasPage embedded />
</motion.section>
```

This gentle fade-rise is removed and replaced by the curtain mechanic below.

## Behavior spec

1. **Pinned dashboard (base panel).** The practices + embedded-charts grid
   becomes a panel that is `sticky top-0` and exactly one viewport tall
   (`h-[100svh]`, using the small-viewport unit so mobile browser chrome doesn't
   cause jumps). Its content sits in an inner area that is
   `overflow-y-auto overscroll-contain`, so if the content is taller than one
   screen it scrolls **within** the panel instead of fighting the page scroll.
   On typical content (desktop two-column, mobile practices list) this rarely
   triggers.

2. **Rising curtain (overlay panel).** The yatras section follows the base in
   normal document flow inside the same containing block. Because the base is
   sticky (visually fixed) and the overlay is a later sibling, the overlay
   **paints over** the base and slides up to cover it as the user scrolls. The
   overlay reads as a lifting surface: `rounded-t-3xl`, a soft lift shadow
   (`shadow-2xl`), and a thin top highlight/hairline.

3. **Covered dashboard treatment.** As the curtain rises, the pinned dashboard
   underneath **scales to ~0.94 and dims** (brightness → ~0.55). This is driven
   by `useScroll` tracking the section's progress, mapped with `useTransform`.
   Approved: keep the dim + scale.

4. **Covering surface.** The app uses a *fixed peacock background* with glassy
   translucent panels. A translucent overlay would let the dashboard show
   through and break the "cover" illusion, so the curtain gets its **own
   opaque-ish navy tinted surface** (still glassy, but opaque enough to occlude
   what's behind it).

## Architecture

Keep units small, isolated, and testable.

### New component: `CurtainReveal` (`app-react/src/components/layout/CurtainReveal.tsx`)

Reusable layout primitive. Owns all the scroll/curtain mechanics so pages stay
declarative.

- **Props:** `{ base: React.ReactNode; overlay: React.ReactNode; className?: string }`
- **Responsibilities:**
  - Render a containing block (`relative`) that scopes the stickiness.
  - Render `base` inside `sticky top-0 h-[100svh] overflow-hidden`, with an inner
    `overflow-y-auto overscroll-contain` content area.
  - `useScroll({ target: overlayRef, offset: ['start end', 'start start'] })`
    → progress `0→1` mapped precisely to the curtain rising over exactly one
    viewport: `0` when the overlay's top sits at the viewport bottom (curtain
    about to rise), `1` when the overlay's top reaches the viewport top (base
    fully covered). This keeps the dim/scale synced to actual coverage rather
    than the whole section's length.
  - `useTransform` progress → `scale` (1 → 0.94) and `filter` brightness
    (1 → 0.55) applied to the base's inner content via a `motion.div`.
  - Render `overlay` in normal flow after the base as a `relative z-10` block
    with the curtain surface styling (`rounded-t-3xl`, `shadow-2xl`, tinted navy
    surface, top hairline).
  - `useReducedMotion()` → when true, skip the scale/dim transform and render the
    overlay statically below the base (no motion, no clipping).
- **Depends on:** `framer-motion` (`useScroll`, `useTransform`, `useReducedMotion`,
  `motion`), Tailwind.

### New component: `DashboardPanel` (`app-react/src/pages/home/DashboardPanel.tsx`)

Extract the existing practices + embedded-charts grid out of `HomePage` so it can
serve as the one-screen `base`. This is a straight move of the current grid
markup (offline banner, week calendar, practice cards, empty state, and the
desktop-only `<ChartsPage embedded />` column) plus the data hooks it needs. No
behavior change to the dashboard itself.

### `HomePage` after the change

`HomePage` becomes a thin composition:

```tsx
<CurtainReveal
  base={<DashboardPanel />}
  overlay={<YatrasPage embedded />}
/>
```

The desktop practice FABs (`fixed left-4 bottom-6`) remain, but **fade out once
the curtain has mostly covered the dashboard** (progress past ~0.6), since their
target — the dashboard — is then hidden. Approved.

## Data flow

No API or state changes. The dashboard's existing React Query hooks
(`practices`, `diary`) move with `DashboardPanel`. `CurtainReveal` is purely
presentational and holds only local scroll refs/derived motion values.

## Edge cases

- **Tall dashboard on mobile:** inner `overflow-y-auto overscroll-contain`
  content area absorbs the overflow so nothing is clipped; page scroll still
  drives the curtain. Nested scroll is contained to avoid scroll-chaining jank.
- **Reduced motion:** static fallback (overlay below base, rounded top, no
  scale/dim).
- **Short dashboard (content < one screen):** panel is still `h-[100svh]`;
  content aligns to the top; curtain behaves identically.
- **FABs over the covered dashboard:** faded out past ~0.6 progress.

## Testing (Vitest + React Testing Library)

Uses the existing framer-motion mock and i18n test setup. jsdom has no real
scroll or layout, so tests cover **structure and the reduced-motion branch**,
not pixel-level motion:

1. `CurtainReveal` renders both `base` and `overlay` content.
2. `CurtainReveal` applies the sticky one-screen classes to the base wrapper
   (`sticky`, `top-0`, `h-[100svh]`) and the curtain surface classes to the
   overlay (`rounded-t-3xl`).
3. Under mocked `useReducedMotion() === true`, the static branch renders (no
   transform wrapper / motion values), and both panels are present.
4. `HomePage` renders the dashboard content and the yatras section through
   `CurtainReveal` (smoke test that composition is wired).

## Out of scope

- No changes to `YatrasPage` internals, the charts, or the practices logic.
- No new i18n strings.
- No changes to the fixed peacock background / `AppShell`.
