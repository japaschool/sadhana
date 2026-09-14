# Home header: Practices / Yatras / Reports dropdowns

**Date:** 2026-08-14
**App:** `app-react`
**Status:** Approved (design)

## Goal

Turn the home header's action cluster into three consistent dropdown menus —
**Practices ▾**, **Yatras ▾**, **Reports ▾** — replacing today's `Practices ▾`
dropdown + standalone `New report` button. Each menu groups that section's
create/manage actions.

## Menus

- **Practices ▾** *(unchanged content)*
  - Add new practice → `/user/practice/new`
  - Edit practices → `/user/practices`
- **Yatras ▾** *(new)*
  - Create new yatra → calls `useUiStore().requestYatraCreate()` (bumps
    `yatraCreateNonce`), which the embedded home `YatrasPage` already listens for
    and opens its create-yatra modal — same signal the mobile bottom-nav "+" uses.
  - View yatras → `/yatras`
- **Reports ▾** *(was a standalone "New report" button)*
  - New report → `/charts/new`
  - Manage reports → `/charts`

## Architecture

### New: `HeaderMenu` (`src/components/layout/HeaderMenu.tsx`)
Reusable controlled dropdown extracted from the current single dropdown in
`HomeHeaderActions`. Owns its `open` state, outside-click close (document
`mousedown` listener, cleaned up), and ARIA (`aria-haspopup="menu"`,
`aria-expanded`, `role="menu"`/`role="menuitem"`).

- **Props:** `{ label: string; items: HeaderMenuItem[] }`
- **`HeaderMenuItem`:** `{ label: string; to: string } | { label: string; onClick: () => void }`
  - A `to` item renders a `react-router` `Link` (`role="menuitem"`); an `onClick`
    item renders a `button` (`role="menuitem"`). Both close the menu on activate.

### `HomeHeaderActions` (`src/components/layout/HomeHeaderActions.tsx`)
Rewritten to render three `HeaderMenu`s (Practices, Yatras, Reports) with the
items above. "Create new yatra" is an `onClick` item calling `requestYatraCreate`
from `useUiStore`. No standalone link remains.

### Unchanged
`TopBar` still renders `<HomeHeaderActions />` gated to the home route,
desktop-only. The persistent desktop nav keeps its **Yatras** link (a global
destination needed on non-home pages), so the desktop home shows both a
`Yatras ▾` action menu and the `Yatras` nav link — accepted tradeoff to avoid
touching global/mobile navigation.

## i18n

Reuse existing keys: `home.practicesMenu`, `home.addPractice`,
`home.editPractices`, `yatras.createNewYatra`, `charts.newReport`,
`charts.manage`, `nav.yatras` (the Yatras menu label).

Add new keys to all three production locales (`public/locales/{en,ru,uk}`) **and**
`src/test/setup.ts`:
- `home.reportsMenu` = "Reports"
- `home.viewYatras` = "View yatras"

(Russian/Ukrainian values resolved during implementation, matching the tone of
neighboring keys.)

## Testing

- **`HeaderMenu`**: renders the trigger with its label; menu closed until
  clicked; a `to` item renders a link with the right `href`; an `onClick` item
  renders a button that fires its handler and closes the menu.
- **`HomeHeaderActions`**: the three trigger buttons render; opening each shows
  the right items/routes; "Create new yatra" calls `requestYatraCreate` (assert
  via a spy on the store action or the resulting `yatraCreateNonce` bump);
  "New report" → `/charts/new`, "Manage reports" → `/charts`, "View yatras" →
  `/yatras`.
- **`TopBar`**: update the existing gating test to assert a menu **trigger
  button** (e.g. `Practices`) is present on `/` and absent on `/yatras` — the
  prior assertion on the always-visible "New report" link no longer holds now
  that it lives inside a closed dropdown.

## Out of scope

- No changes to `YatrasPage`/`ChartsPage` internals, the curtain, or mobile
  navigation. The persistent nav is not modified.
