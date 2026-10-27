# Mobile Today Redesign: Step 1 of the New UI

**Date:** 2026-10-06
**App:** `app-react`
**Status:** Approved (design), pending spec review
**Source design:** claude.ai/design project `cccefa4d-5554-41b1-be47-2704b1233b68`, `Sadhana Redesign.dc.html`. Frames 3a–3d (Turn 3), plus the 2b calendar content in Turn 1's calendar-sheet container. Dark colours come from frame "1a · Grouped list · dark".

## Context and goal

This is the first step of a full redesign of the `redesign` branch UI. Both the look and the layout change completely. The app needs **three real layouts (mobile, tablet, desktop)**, each with its own component tree. One layout adjusted with media queries is not enough.

This step:
1. sets up the multi-layout architecture and the new design system (theme tokens, fonts, primitives);
2. builds the **mobile Today screen** to match 3a–3d.

Every other screen, and Today on tablet and desktop, keeps rendering through the current (legacy) dark shell until its turn. Moving between new and legacy screens looks inconsistent while the work is in progress. That's accepted, because the branch isn't deployed.

## Decisions

| Topic | Decision |
|---|---|
| Practice groups | Out of scope. The UI shows one hardcoded group labelled "Practices" (i18n) containing all active practices. No backend change. |
| Theme | The mockup palette replaces the current one in the new shell. Light is the default. Dark uses **only** colours from frame 1a-dark, with one exception: danger red `#C2412D` is reused in dark because 1a has no red. |
| Light/dark switching | Follows `prefers-color-scheme`. No manual toggle in this step. |
| Fonts | Manrope + IBM Plex Mono through Google Fonts. Both ship `cyrillic` and `cyrillic-ext` subsets, which cover Russian and Ukrainian (ґ є і ї). |
| Layout architecture | Picked per route at runtime (`useLayout` + `ByLayout`), with the legacy page as fallback. |
| Unredesigned screens | Keep rendering in the legacy shell, untouched. |
| Calendar | Shows 2b's content in a bottom sheet that slides up (Turn 1 container). Weeks start on **Monday**, matching the strip and the current app. |
| "Yesterday's ›" (3d) | Cut. |

## Architecture

### Layout selection

- `src/layouts/useLayout.ts`: returns `'mobile' | 'tablet' | 'desktop'` from `matchMedia`. Breakpoints match Tailwind's: `< 640px` is mobile, `640–1023px` is tablet, `≥ 1024px` is desktop. It updates when the media query changes (resize or rotation).
- `src/layouts/ByLayout.tsx`: `<ByLayout mobile? tablet? desktop? legacy />` renders the element for the current layout, or `legacy` when that layout has none. Each layout element is lazy-loaded with `React.lazy`, so a device only downloads its own layout's code.
- **Router:** `/` moves out of the `AppShell` children into its own route:
  ```
  { path: '/', element: <ByLayout mobile={<MobileShell><TodayMobile/></MobileShell>} legacy={<AppShell/>} />,
    children: [{ index: true, element: <HomePage/> }] }
  ```
  The legacy `AppShell` still renders `<Outlet/>` → `HomePage`. All other routes stay as they are.

### Folder layout (`app-react/src/`)

```
ui/
  theme.css              tokens (CSS vars) scoped to .ui-root; light + dark
  primitives/            ListGroup, Row, Toggle, AnchoredMenu, BottomSheet, Keypad, SegmentedControl
layouts/
  useLayout.ts
  ByLayout.tsx
  mobile/MobileShell.tsx app bar (title + ⋯ slots) + bottom tabs
features/today/
  useToday.ts            data + save logic
  date.ts                local yyyy-mm-dd helper, 9-day window, month grid
  options.ts             dropdown option parsing
  mobile/
    TodayMobile.tsx
    DateHeader.tsx
    DayStrip9.tsx
    PracticeRow.tsx
    AddTimeSheet.tsx
    TextRowEditor.tsx
    CalendarSheet.tsx
```

Logic lives in hooks and plain modules; layout components only compose them. Future tablet and desktop Today screens reuse `useToday` and the primitives.

Legacy code (`AppShell`, `TopBar`, `BottomNav`, `pages/home/*`, `theme/tokens.ts`) is **not modified**. It gets deleted page by page as screens are redesigned.

## Theme (`ui/theme.css`)

The variables are defined on `.ui-root` and exposed to Tailwind v4 with `@theme inline` (e.g. `bg-surface`, `text-muted`). New components don't use DaisyUI. The legacy `data-theme="dark"` on `<html>` stays, and `.ui-root` sets its own `color`, `background` and `color-scheme`, so it overrides the inherited DaisyUI defaults.

| Token | Light (3a) | Dark (1a only) |
|---|---|---|
| `--bg` | #F7F4EE | #15121D |
| `--surface` (rows, menu) | #FFFFFF | #211D2C |
| `--surface-sheet` | #FFFDF9 | #211D2C |
| `--surface-field` (text preview, chips bg) | #F8F4EC / #F1ECE2 | #2C2738 |
| `--hairline` (group gap/border) | #ECE6DB | #2C2738 |
| `--control-border` | #E7E1D6 | #332E40 |
| `--ink` | #1F1B16 | #F1ECE4 |
| `--ink-2` (notes) | #3E372E | #BDB6C9 |
| `--muted` | #7A7163 | #A39DB0 |
| `--faint` (future days, inactive tabs) | #BDB4A6 / #8A8174 | #5C566B / #8F88A0 |
| `--accent` (text, caret, ＋ glyph) | #9A6410 | #F0B54A |
| `--accent-fill` (toggle on, focus ring) | #E8A93A | #F0B54A |
| `--accent-soft` (＋ button bg, selected option, focus halo) | #FBF0DA | #4A3D25 |
| `--accent-pill` (active tab) | #F3DDB0 | #4A3D25 |
| `--toggle-off-track` / `--toggle-off-knob` | #ECE6DB / #FFFFFF | #3A3448 / #8F88A0 |
| `--toggle-on-knob` | #FFFFFF | #15121D |
| `--selected-bg` / `--selected-fg` (day) | #1F1B16 / #F7F4EE | #F0B54A / #15121D |
| `--backdrop` | rgba(31,27,22,.42) | rgba(21,18,29,.6) |
| `--tabbar-bg` | rgba(247,244,238,.96) | rgba(21,18,29,.94) |
| `--danger` | #C2412D | #C2412D |
| `--primary-btn-bg` / `-fg` | #1F1B16 / #F7F4EE | #F1ECE4 / #15121D |

Dark is applied with `@media (prefers-color-scheme: dark) { .ui-root { … } }`. `MobileShell` keeps `<meta name="theme-color">` in sync with `--bg`.

### Fonts

- `index.html`: add `Manrope:wght@400;500;600;700;800` and `IBM+Plex+Mono:wght@400;500;600` to the existing non-blocking Google Fonts preload. The legacy fonts stay.
- Tokens: `--font-ui: Manrope, system-ui, sans-serif` and `--font-mono: 'IBM Plex Mono', ui-monospace, monospace`. Mono values use `font-variant-numeric: tabular-nums`.

## Mobile shell (`MobileShell`)

- Root: `.ui-root`, `min-height: 100dvh`, `background: var(--bg)`.
- **App bar**, placed below `env(safe-area-inset-top)`, never on the system clock line. It has a title slot (left) and a ⋯ slot (right, 44×44 tap target). The ⋯ menu is an `AnchoredMenu` whose items come from the screen.
- **Bottom tabs:** fixed, `64px + env(safe-area-inset-bottom)`, `--tabbar-bg` with a top hairline. Today `/`, Insights `/charts`, Yatra `/yatras`, Settings `/settings`. The icons are the mockup's simple glyphs (square, square, circle, diamond) as inline SVG or CSS. The active tab has a 44×28 `--accent-pill` behind the icon. Tabs pointing at legacy screens navigate normally, and `ByLayout` renders legacy there.
- Content is padded so it clears the tab bar.

## Mobile Today

### `useToday(date)`

Returns:
- `practices`: active user practices in their existing order.
- `values: Record<practiceName, PracticeValue | undefined>`.
- `save(practice, value | null)`: an optimistic React Query mutation on `['diary', date]`, with rollback on error, an error toast and invalidation on settle. Ported from `PracticeCard`. Also invalidates `['incomplete-days', …]`. `null` clears the entry; the server's diary `value` is `Option<JsonValue>`.
- `summary: { filled, total, requiredLeft }`.
- `incomplete: Set<string>` for the visible 9-day window, from `GET /diary/incomplete-days?from&to` (one query).
- Loading and error flags.
- It also prefetches the diaries of the other days in the window (existing behaviour) and refetches the current day on `visibilitychange` (existing behaviour).

**Rules (these fix the P0 diary-input bugs for this screen):**
- An empty input saves `null`, never `0` or `""`.
- Nothing is saved when the value hasn't changed.
- All dates use the local `yyyy-mm-dd` helper in `date.ts`. `toISOString()` is not used anywhere in the new code.

### Options (`options.ts`)

`parseOptions(dropdown_variants)` splits on commas **and** newlines, trims each option and drops empty ones. Commas are the format `main` uses; newlines cover what the React form has saved. Options show for **Int and Text** practices. Int options save `{ Int: n }` and Text options save `{ Text: s }`.

### Screen

1. **`DateHeader`** (app bar title):
   - Line 1: "Tue, 6 October" plus an accent chevron, 20px/800, formatted with `Intl.DateTimeFormat(locale, { weekday:'short', day:'numeric', month:'long' })`.
   - Line 2: a 12px `--muted` summary, e.g. "6 of 13 · 1 required left" (i18n plurals). The "· N required left" part is left out when `requiredLeft` is 0.
   - Tapping it opens the `CalendarSheet`.
   - ⋯ menu items: add practice, edit practices, download CSV, share link (the same actions as `HomeHeaderActions`).
2. **`DayStrip9`**:
   - Shows Sunday before the week, Mon–Sun, then Monday after: a 9-column grid. The edge days use `--faint` for their numbers and labels.
   - Each cell: an 11px weekday initial (locale-aware), a 36×36 r11 mono numeral, and a 5px dot.
   - The selected day uses `--selected-bg/fg`. Future days are `--faint`. The dot is `--danger` when the day is in `incomplete`.
   - Tapping a day selects it. Swiping horizontally moves a week; the gesture logic is ported from `WeekCalendar` into a small hook in the same folder.
3. **Group**: an 11px uppercase `--muted` label "Practices", then a `ListGroup` (r18, 1px `--hairline` gaps) with one `PracticeRow` per practice.
4. **States**:
   - Loading: 4 skeleton rows inside the group.
   - Error: an inline banner.
   - No practices: a restyled empty state with "Add starters" (the existing seed mutation) and an "add custom" link.
   - Offline: a slim banner under the app bar.

### `PracticeRow`

The row is at least 50px tall, with the label (15px/500) on the left and the value area on the right.

**Empty state.** "+ Add" (13px/700, `--accent`). If the practice is required, a `--danger` dot plus a "Required" label (12px/700) replaces it.

| Type | With value | Interaction |
|---|---|---|
| Time | `04:10` (mono 15/500) | Tapping opens an inline mono input, using `formatTimeInput` / `parseTime` from `pages/home/inputFormat.ts`. Blur or Enter saves; an empty input saves `null`. |
| Int (no options) | `17` | Inline `inputMode="numeric"` input with the same save rules. |
| Int/Text with options | `Good` (15/600) + a `--muted` chevron | Opens the `AnchoredMenu` (3b). |
| Bool | A toggle (44×26) whether or not there's a value | Tapping toggles and saves immediately. |
| Duration | `30 min` (mono) + a 34×34 r10 `--accent-soft` ＋ button | ＋ opens `AddTimeSheet` in **Add** mode. Tapping the value opens it in **Set total** mode. Empty → "+ Add" opens it in Add mode. |
| Text | A wrapped preview in a `--surface-field` r12 block below the label row, with "Edit" (12/600) on the right | Opens `TextRowEditor` (3d). Empty → a prompt line ("What's on your mind today?", i18n). Tapping anywhere edits. |

Durations are formatted as `30 min` / `1 h` / `1 h 15 min` (i18n units).

**Save feedback.** On failure, the row's value turns `--danger` for about 600ms and an error toast appears.

### `AnchoredMenu` (3b)

- About 210px wide, `--surface`, r16, 6px padding, with a shadow. It's anchored under the trigger and right-aligned, and flips above it when there isn't room below.
- Options are 44px tall and listed in their configured order. The selected option has a `--accent-soft` background, weight 700 and an accent ✓.
- A divider is followed by **Clear** (`--muted`), which saves `null`.
- With 8 or more options the list scrolls inside the menu (max-height about 8 rows).
- It closes on a backdrop tap or Escape. It uses `role="listbox"`, arrow-key navigation, and returns focus to the trigger on close.
- The ⋯ menu uses the same primitive.

### `BottomSheet` (shared primitive)

- Sits over `--backdrop`, slides up from the bottom (framer-motion is already installed), full width, r28 top corners, `--surface-sheet` background, with a 40×5 grab handle and bottom padding that includes the safe area.
- It closes on a backdrop tap, a drag-down past a threshold, or Escape. Focus is trapped while it's open, and `aria-modal="true"`.

### `AddTimeSheet` (3c)

- Header:
  - Left: the practice name (20/800) and "Logged today: **30 min**" (13px `--muted`, value in mono).
  - Right: an **Add | Set total** `SegmentedControl`.
- Readout block (`--surface-field`, r20):
  - Left: a big `--accent` mono amount (48px), "+45" in Add mode or the total in minutes ("75") in Set mode, followed by "min" and a caret.
  - Right: "NEW TOTAL" with the resulting total in mono 20/600.
- Chips **+5 +10 +15 +30 +60** in a 5-column grid with 40px r12 bordered buttons. They add up (+30 then +15 gives +45). In Set mode they add to the typed total.
- `Keypad`: 3×4 keys (1–9, C, 0, ⌫), 50px r12 `--surface-field`, mono 20. Typing replaces whatever amount the chips built up. C resets to 0. Because the keypad is on screen, the system keyboard never opens.
- Footer: a 1fr **Cancel** and a 2fr primary button: "Add 45 min" or "Set 1 h 15 min". It's disabled when Add is 0. In Set mode, 0 → saves `null` (the button reads "Clear").
- Replaces `DurationQuickAddModal` for the new screen. The legacy screen keeps its own copy.

### `TextRowEditor` (3d)

- In place of the preview: an auto-growing textarea (min 120px, r12, 1.5px `--accent-fill` border, 4px `--accent-soft` halo, 15/1.55). The label row's "Edit" turns into **Done** (14/700 `--accent`).
- Saves 600ms after typing stops (debounced), and again immediately on Done or blur. An empty or whitespace-only result saves `null`. `maxLength` is 1024.
- Footer: "Saved as you type" (12px `--muted`).
- Keeps the field visible above the keyboard with `scrollIntoView({ block: 'nearest' })` on focus and on `visualViewport` resize.

### `CalendarSheet` (2b content, Turn 1 container)

- Uses `BottomSheet`.
- Header:
  - Month and year pickers ("October ▾", "2026 ▾"; 20/800, r10, `--surface` with `--control-border`). Each opens an `AnchoredMenu`. Years run from 2015 to the current year.
  - ‹ › buttons (40×40 r12) move by one month.
- Grid:
  - A Monday-first 7-column grid with locale-aware weekday initials (11/700 `--faint`) and leading blank cells.
  - Day cells are 46px tall: a 38×34 r10 mono 14 numeral plus a 5px dot.
  - The selected day uses `--selected-bg/fg`, future days are `--faint`, and the dot is `--danger` when the day is in `incomplete-days` for that month (query `['incomplete-days', from, to]`, as in the existing component).
  - Tapping a day that isn't in the future selects it and closes the sheet.
- Footer, above a hairline: a legend ("● Required practices missing") on the left and a **Today** link (14/700 `--accent`) on the right, which jumps to today and closes the sheet.

## i18n

New keys under `today.*` in `public/locales/{en,ru,uk}/translation.json`:
- group label;
- summary with plurals (`_one/_few/_many/_other` for ru/uk);
- `requiredLeft`, `required`, `add`;
- `addMode`, `setTotal`, `loggedToday`, `newTotal`, `addMinutes`, `setTo`, `clear`, `cancel`;
- `done`, `savedAsYouType`, `textPrompt`;
- `calendarLegend`, `goToday`;
- duration units;
- tab labels (`today`, `insights`, `yatra`, `settings`);
- the empty and offline strings, reusing existing `home.*` keys where they already exist.

Dates and weekday initials come from `Intl` using `i18n.language`.

## Testing

Vitest + Testing Library + msw, following the repo's patterns:
- `useLayout` / `ByLayout`: each breakpoint maps to the right layout (mocked `matchMedia`); a missing layout element falls back to legacy.
- `options.ts`: comma, newline, mixed, whitespace and empty input.
- `date.ts`: the local date string around midnight with a non-UTC TZ, the 9-day window (Sunday, Monday and mid-week selections), and the Monday-first month grid offset.
- `useToday`:
  - `summary` counts;
  - the optimistic save followed by rollback when the request fails;
  - `save(null)` sends `value: null`;
  - an unchanged value doesn't save.
- `PracticeRow`, one test per type:
  - the right control renders;
  - required and empty shows "Required";
  - an empty input saves `null`.
- `AddTimeSheet`:
  - chips add up;
  - typing replaces the amount;
  - C and ⌫ work;
  - Set total and Set 0 clear the value;
  - the button label follows the amount.
- `AnchoredMenu`: select, Clear and Escape all work, and focus returns to the trigger.
- `DayStrip9`: renders 9 days, shows dots from `incomplete`, and moves a week on swipe.
- `CalendarSheet`: month navigation, dots, selecting a day, and the Today link.
- Manual: a browser at 390×844 in light and dark, in en/ru/uk (Cyrillic renders in Manrope and Plex Mono). `npm run lint` and `npm test` pass.

## Out of scope

- Practice groups (backend, editor and real grouping).
- Tablet and desktop Today, and every other screen in the new design.
- A manual Appearance toggle (Light/Dark/Auto).
- "Yesterday's ›" in the text editor.
- P0 items not fixed incidentally here: practice-form dropdown editing, logout cache clear, API mismatches, deployment and service worker.
