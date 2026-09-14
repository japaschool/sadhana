# Home: fix curtain scroll + move FABs into the header

**Date:** 2026-08-14
**App:** `app-react`
**Status:** Approved (design)

## Goal

Two related changes to the home screen:

1. **Fix the curtain scroll.** The just-shipped Giga-style curtain reveal can't
   be scrolled — you can't reach the yatras section.
2. **Replace the floating FABs with header actions.** Drop the bottom-left
   practices FABs and the bottom-right new-report FAB; surface those actions in
   the (desktop) header as a **Practices ▾** dropdown and a **New report** button.

## 1. Scroll fix

### Root cause
`CurtainReveal.tsx:37` wraps the pinned base's content in
`overflow-y-auto overscroll-contain`. Because the base fills the entire first
screen (`sticky top-0 h-[100svh]`), the wheel/touch gesture is captured by that
nested scroll container, and `overscroll-behavior: contain` **refuses to chain**
the scroll to the window — so the page never scrolls to raise the curtain.
(`html, body, #root` have no `overflow: hidden`, so the window itself can scroll;
the trap is purely the nested container.)

### Fix (chosen mechanic: "read-then-reveal")
Change the inner scroll area from `overflow-y-auto overscroll-contain` →
`overflow-y-auto`. Removing `overscroll-contain` lets the scroll chain to the
window:
- Dashboard fits one screen → wheel chains immediately → curtain rises (Giga feel).
- Dashboard taller than one screen → scroll through it first (nothing hidden),
  then continuing chains to the window and raises the curtain.

The sticky pin, dim/scale, and overlay covering are unchanged. `useScroll`
already tracks window scroll, so the dim/scale correctly begins as the curtain
rises.

### Cleanup
All FABs move to the header (below), so `CurtainReveal`'s `fab` slot becomes
unused. Remove the `fab` prop, its `fabOpacity` transform, and the fab-slot
rendering (and the corresponding test case). This keeps `CurtainReveal` focused
on the reveal.

## 2. Remove the home FABs

In `HomePage.tsx`, delete the `fab={…}` block (both practice FABs + the
new-report FAB) and the imports it needed (`Link`, `FaPlus`, `FaSlidersH`,
`ACCENT`, `ACCENT_GRADIENT`). `HomePage` becomes:

```tsx
<CurtainReveal base={<DashboardPanel />} overlay={<YatrasPage embedded />} />
```

`SectionLabel`, `DateContextLabel`, and `toDateStr` remain (used by tests /
`DateContextLabel`). The standalone `/charts` page keeps its own gated
new-report FAB (`!embedded`); only the home screen's FABs are replaced.

## 3. Header actions

### New component: `HomeHeaderActions` (`src/components/layout/HomeHeaderActions.tsx`)
Presentational. Renders:
- A daisyUI **Practices ▾** dropdown with two items:
  - **Add new practice** → `/user/practice/new`
  - **Edit practices** → `/user/practices`
- A **New report** button → `/charts/new`

All are `react-router` `Link`s to existing routes. Styled to sit in the
transparent glass header (matching the existing nav's light-on-photo treatment).
Depends on: `react-router` `Link`, `react-i18next`, daisyUI dropdown classes,
theme tokens.

### Wiring into `TopBar.tsx`
`TopBar` gains `useLocation()` and renders `<HomeHeaderActions />` only when
`pathname === '/'` and not `showBack`/`showClose`. Placement: after the logo,
before the `ml-auto` nav (so actions sit left, nav stays right — matching the
approved mockup). It inherits the header's `hidden sm:flex`, so it's desktop-only
— the same scope as the FABs it replaces. Mobile (bottom nav + existing add
paths) is unchanged.

## 4. i18n

Add header-action strings to the production locale resources **and**
`src/test/setup.ts` (project i18n discipline requires both). Reuse the existing
`charts.newReport` ("New report"). New keys (final names resolved against the
existing `home.*` namespace during implementation):
- `home.practices` → "Practices"
- `home.addPractice` → "Add new practice"
- `home.editPractices` → "Edit practices"

## Testing

- **`HomeHeaderActions`**: the two menu items and the button render and link to
  `/user/practice/new`, `/user/practices`, `/charts/new` (assert `href`s under a
  `MemoryRouter`).
- **`TopBar`**: `HomeHeaderActions` renders on `/` and is absent on another route
  (e.g. `/yatras`), via `MemoryRouter initialEntries`.
- **`CurtainReveal`**: drop the fab-slot test; keep the sticky/one-screen and
  rounded-curtain assertions.
- **`HomePage`**: existing tests stay green (no FAB assertions there).

## Out of scope

- No change to the sticky offset / header transparency, `YatrasPage`/`ChartsPage`
  internals, or mobile navigation.
- The standalone `/charts` new-report FAB stays.
