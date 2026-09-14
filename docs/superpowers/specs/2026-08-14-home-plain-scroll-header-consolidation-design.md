# Home: plain-scroll page + header consolidation

**Date:** 2026-08-14
**App:** `app-react`
**Status:** Approved (design)

## Goal

Make the home page scroll reliably by dropping the pinned-curtain effect, keep
"see my yatras" on the same home page, and consolidate/clean up the header.

## 1. Scroll → plain scrolling page

Remove the `CurtainReveal` pin + inner-scroll mechanic (the repeated source of
scroll traps). `HomePage` renders normal document flow:

```tsx
<>
  <DashboardPanel />
  <section id="home-yatras">
    <YatrasPage embedded />
  </section>
</>
```

The page scrolls like any normal page — no `sticky`, no nested `overflow`, no
`overscroll` traps. The yatras section is a normal full-width block below the
dashboard (same width/padding conventions as the dashboard; a light rounded-top
surface is fine but no pinning/dimming).

**Cleanup:** delete `CurtainReveal.tsx` and `CurtainReveal.test.tsx` — nothing
else consumes them after this change.

## 2. "View yatras" stays on the home page

In the header's `Yatras ▾` menu, **View yatras** changes from a `/yatras`
navigation to a smooth scroll to the on-page section:
`document.getElementById('home-yatras')?.scrollIntoView({ behavior: 'smooth' })`.
This is safe because the header actions render only on the home route.
**Create new yatra** is unchanged (fires `useUiStore().requestYatraCreate()`).

## 3. Header consolidation (`TopBar` + `HomeHeaderActions`)

- **Remove `Reports ▾`** from `HomeHeaderActions` → it now renders `Practices ▾`
  + `Yatras ▾` only. (Accepted consequence: the desktop home loses its
  "new report" entry point; the user confirmed removal.)
- **Consolidate on the right:** logo stays left; a single right-aligned cluster
  (`ml-auto`) holds `HomeHeaderActions` (Practices ▾, Yatras ▾) followed by the
  desktop nav. The actions no longer sit on the left.
- **Remove Yatras from the desktop nav only:** filter `navKey !== 'yatras'` when
  `TopBar` renders the nav. `navItems` itself is unchanged, so the **mobile
  `BottomNav` keeps Yatras**.
- **Settings → icon:** in the desktop nav, the Settings item renders its gear
  icon only (no "Settings" text). It still calls `openSettings()`.
- **Logo ~10% bigger:** `h-8 w-8` → `h-[35px] w-[35px]`.

Everything here is desktop-only (the header is `hidden sm:flex`); mobile is
unchanged except that it is unaffected.

## Testing

- **`HomePage`**: renders the dashboard content and a `#home-yatras` section
  containing the yatras view; no `CurtainReveal`. Existing dashboard-behavior
  tests (Optional divider, 7-day fetch, etc.) stay green.
- **`HomeHeaderActions`**: renders `Practices ▾` + `Yatras ▾` and NOT a
  `Reports` trigger; "View yatras" is an action (not a link) — assert it's a
  `menuitem` button (no `href`) and, given jsdom lacks layout, at least that
  clicking it doesn't navigate/throw; "Create new yatra" still bumps
  `yatraCreateNonce`.
- **`TopBar`**: on `/`, the Practices trigger is present and the desktop nav has
  no `Yatras` link; Settings renders as an icon (its accessible name/`aria-label`
  present, no visible "Settings" text label). On another route the home actions
  are absent.
- **Delete** `CurtainReveal.test.tsx`.

## Out of scope

- No changes to `YatrasPage`/`ChartsPage`/`DashboardPanel` internals, the mobile
  `BottomNav`, or the `/yatras` standalone route.
