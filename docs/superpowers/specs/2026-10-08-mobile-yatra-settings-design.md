# Mobile Yatra Settings Redesign

**Date:** 2026-10-08
**App:** `app-react`
**Status:** Approved (design), pending spec review
**Source design:** claude.ai/design project `cccefa4d-5554-41b1-be47-2704b1233b68`, `Yatra Settings Mobile.dc.html`, frames 12m1–12m25 (Turn 12). Tablet and desktop frames (12t*, 12d*) are out of scope here.

## Context and goal

Yatra settings (linking your practices, and the admin pages for a yatra) still render as legacy pages in the old dark `AppShell`. This step rebuilds them for the **mobile layout** from the Turn 12 mockups. Tablet and desktop keep the legacy pages, which `ByLayout` picks on the same URLs.

The backend already supports everything the mockups need. **No server changes.**

## Decisions

| Topic | Decision |
|---|---|
| Layouts | Mobile only. Tablet and desktop fall back to the legacy pages per route. |
| Entry points | As in the mockup (Yatra screen header "Settings", the unlinked banner, landing after join), **plus** a "Yatras" section on the mobile Settings hub with one row per yatra. |
| Delivery | One spec, two phases. Phase 1: member side (12m1–8 + Settings row). Phase 2: admin (12m9–23). |
| Legacy pages | Kept until tablet and desktop are redesigned too; they're still the fallback for those layouts. |
| Saving | No Save buttons. Every change saves at once (debounced for text), with a toast and Undo where undo is possible. Destructive actions confirm first. |
| Join page | No mockup, so the legacy join page stays. On mobile, a successful join lands on the link page (12m2). |
| Invite link | The real `/yatra/:id/join` URL. The mockup's short code (`/join/bl-7KQ2MX`) doesn't exist and isn't added. |
| Bonus | One bonus threshold worth +1, stored as `bonus_rules: [{ threshold, points: 1 }]`, as the legacy editor does. |
| Colour palette | Standard 2/3-colour palettes in the editor. Stored configs using other colours (MutedRed, DarkGreen) keep them until the count or direction is changed. |

## Routes

| Route | Mobile screen | Frames |
|---|---|---|
| `/yatra/:id/settings` | Link your practices (member page with Manage yatra / Leave yatra rows) | 12m2–7, 12m24–25 |
| `/yatra/:id/admin/settings` | Manage yatra hub | 12m9 |
| `/yatra/:id/admin/general` | General | 12m10 |
| `/yatra/:id/admin/practices` | Practices list, Add and Delete sheets | 12m11–13 |
| `/yatra/:id/practice/:practice_id/edit` | Practice editor | 12m14–16 |
| `/yatra/:id/admin/members` | Members, member sheet, remove confirm | 12m17–19 |
| `/yatra/:id/admin/statistics` | Statistics, edit-statistic sheet | 12m20–21 |
| `/yatra/:id/admin/invite` | Invite | 12m22 |
| `/yatra/:id/admin/danger` | Danger zone, delete confirm | 12m23 |

- Existing URLs (`/settings`, `/admin/settings`, `/practice/:id/edit`) keep their meaning, so links and the tablet/desktop fallback keep working. The new `admin/*` sub-routes have no legacy page. On tablet and desktop they redirect to `/yatra/:id/admin/settings`.
- `/yatra/:id/practice/new` stays legacy-only. On mobile, adding a practice is a sheet on the Practices page.
- Admin routes check `is_admin`. A non-admin is redirected to `/yatra/:id/settings`.
- Each screen uses `MobileShell` + `AppBar` with a back link to its parent (the parent's name is the back label, as in the mockup: "‹ Manage yatra", "‹ Practices"). The yatra name is the subtitle under the title.

## Code layout

```
src/features/yatras/settings/
  useYatraSettings.ts   queries + mutations for one yatra (practices, user links, users, is_admin, yatra)
  linking.ts            pure: suggested matches, picker groups, link summary
  zones.ts              pure: value parse/format, bound + threshold validation, range-bar geometry, palette mapping
  statistics.ts         pure: aggregations allowed per data type
  *.test.ts
  mobile/
    LinkPracticesMobile.tsx   12m2–7
    LinkPickerSheet.tsx       12m5
    ManageYatraMobile.tsx     12m9
    GeneralMobile.tsx         12m10
    PracticesMobile.tsx       12m11–13
    PracticeEditorMobile.tsx  12m14–16
    RangeBar.tsx
    MembersMobile.tsx         12m17–19
    StatisticsMobile.tsx      12m20–21
    InviteMobile.tsx          12m22
    DangerZoneMobile.tsx      12m23
src/ui/primitives/Toast.tsx   "Saved" / message + optional Undo, ~5 s
```

The Yatra screen changes (12m1, 12m8) go into the existing `features/yatras/mobile/YatrasMobile.tsx`. The Settings row goes into `features/settings/mobile/SettingsMobile.tsx`.

## Saving, Undo and errors

- Each link, toggle and value is a React Query mutation that fires on change. Text inputs (yatra name, practice name, bounds, thresholds, statistic label) save on a short debounce while typing and again on blur. Requests for one resource are sent one at a time, in order (same approach as Today's inline values).
- After a save, `Toast` shows "Saved" or a specific message (e.g. "Linked Gratitude → Day's realisation"), with **Undo** when the change can be reversed:
  - links: Undo resends the full previous mapping (`PUT /user-practices` replaces the whole list, so this is exact);
  - toggles and values: Undo restores the previous value.
- Deleting a practice or statistic, removing a member, leaving and deleting the yatra are not undoable. They ask first in a confirm sheet (12m6, 12m13, 12m19, 12m23).
- Invalid values are not sent. The field says why (e.g. "Must be more than 7, the Red bound"). In the editor the range bar keeps the last valid config and a line says "Not saved yet. The bar keeps the last valid bounds until this is fixed." (12m15). The same rule applies to an empty name and to an unparseable time or duration.
- A failed save shows an error toast, rolls the field back to the server value and refetches.

## Member side (phase 1)

### Link your practices (12m2–4, 12m24–25)

- Data: `GET /yatra/:id/user-practices` (each yatra practice + the linked user practice **name** or `null`) and the user's practices (`practicesApi`, existing query).
- Header card: "N of M linked" (or "All M linked"), a progress bar and "Saves as you go". Below it, the summary sentence:
  - some unlinked: "Your entries for A, B and C won't appear in the table." The list is joined with `Intl.ListFormat` in the current language;
  - all linked: "Everything you log on Today appears in the table."
  - Right after joining (`?joined=1`), the title reads "You've joined {name}" with the intro line from 12m2.
- "Link N suggested matches" applies every suggestion in one request with one Undo. Hidden when there are none.
- Rows read *yatra practice ← your practice*, each with its type icon and label (# Number, Yes / No, Time of day, Duration, Aa Text), and a status on the row:
  - linked: "Your practice · {name} · Linked". Tapping it opens the picker;
  - suggested: "Suggested match · {name}" with a **Link** button, and "Not linked · your entries won't appear";
  - unlinked, no suggestion: "Choose a practice", which opens the picker;
  - no compatible practice: "You have no {Type} practice · Nothing to link yet · Add one in My practices ›", which goes to `/user/practices`.
- Rows below: **Manage yatra** (with an "Admin" badge, admins only) and **Leave yatra**.

### Matching (`linking.ts`)

A user practice is a **suggested match** for a yatra practice when it has the same data type, is active, isn't linked to another practice in this yatra, and its name matches:
1. exactly, ignoring case and surrounding spaces; otherwise
2. one name contains the other, or they share a whole word of at least 4 letters (case-insensitive).

The first rule wins over the second. Each user practice is suggested for at most one yatra practice, and each yatra practice gets at most one suggestion.

### Picker (12m5, 12m25)

A bottom sheet titled "Link to “{yatra practice}”" with "Only {Type} practices can fill it", in groups:
1. **Suggested** — the suggested match, if any.
2. Other compatible practices (same type, active, unlinked here).
3. **Don't link** — "Your entries won't appear". Unlinks.
4. **Already linked in this yatra** — "Linked to {other} · moving unlinks it there", with **Move here**. One request moves it.
5. **Can't link here** — every other practice, disabled, with its reason: "{Type} · this needs a {Type}", or "Inactive · turn it on in My practices".

When the required type is Time or Duration, the group 5 header is followed by the "Time of day or Duration?" explainer (05:30 *when it happened* / 1:30 *how long it took*).

### Leave yatra (12m6–7)

- Confirm sheet: "Leave {name}?" with the 12m6 text, **Leave yatra** (danger) / Cancel. On success, go to `/yatras`.
- If the user is the only admin (from `GET /users`), show the 12m7 sheet instead: **Choose another admin** goes to Members, **Delete yatra…** goes to Danger zone. The server also refuses this case; if it does anyway, show the error toast.

### Yatra screen (12m1, 12m8)

- The header gets a **Settings** action that opens `/yatra/:id/settings`.
- **Unlinked banner** when any yatra practice is unlinked for the user: "{N} of your practices aren't linked", the summary sentence, **Link practices** and **Later**. "Later" stores the current sorted set of unlinked practice IDs in localStorage per yatra (try/catch). The banner comes back when the set changes.
- In the user's own card, cells for unlinked practices show "not linked" instead of a value.
- **Switcher sheet (12m8):** replaces the yatra dropdown menu. It lists "Your yatras" with the role and member count ("Admin · 8 members"), then a **New yatra** block: name input, "You'll be its admin. Add practices and invite devotees next." and **Create yatra**. The member count is the length of `GET /users`, fetched only when the sheet is open. The ⋯ menu loses "Create new yatra".

### Settings tab

A "Yatras" section on the mobile Settings hub, after Preferences, with one `SettingsRow` per yatra (the yatra name, then "Admin" or "Member") that goes to `/yatra/:id/settings`. Hidden when the user has no yatras.

## Admin side (phase 2)

### Hub (12m9)

Rows with live summaries:
- General — "Name, daily score metrics"
- Practices — "{n} · order, colours, score"
- Members — "{n} members · {k} admins"
- Statistics — "{n} tiles · visible to everyone/admins"
- Invite — "Share the join link"
- Danger zone — "Delete yatra" (danger colour)

### General (12m10)

- **Yatra name** (autosave; empty isn't saved) — "Shown at the top of the table and in invites."
- **Show daily score metrics** toggle (`show_stability_metrics`) with its explainer.
- "{k} of {n} practices have score thresholds", listing Number/Time/Duration practices: those with a threshold show "done X · bonus Y", the rest show **Set threshold ›**, which opens the editor. Footnote: "Practices without a threshold add nothing to the score. Yes / No and Text practices can't have one."
- Saved with `PUT /yatra/:id`, always sending the current `statistics` so it isn't cleared.

### Practices (12m11–13)

- Intro: "Drag to reorder: the table shows columns in this order. Tap a practice to edit its colours and score."
- Sortable list via `@dnd-kit/sortable` (already installed) → `reorderPractices` on drop, with Undo.
- Each row: type icon, name, summary ("3 colours · done 16 · bonus 20", "2 colours · not in score", "No colours · not in score", "Shown as ✓", "Shown as written") and a ⋯ row menu: **Rename**, **Delete…**. Tapping the row opens the editor.
- **+ Add practice** opens a sheet: name, then "What kind of value?" with five types, each with its description and example. A note says "The type can't be changed after the practice is created." **Add practice** creates it, closes the sheet and opens the new practice's editor.
- **Delete confirm**: "Delete “{name}”?" — "Its column, colours and the {n} statistic(s) that use it are removed for everyone. Members keep their own entries." On confirm, statistics that use this practice are removed from the yatra's `statistics` config, then the practice is deleted.

### Practice editor (12m14–16)

- **Name** (autosave). **Type** read-only: "Set when the practice was created".
- **Yes / No and Text**: only the explainer from 12m16 (no colours, no score), then **Delete practice**.
- **Colours in the table** — "Paint each cell by its value."
  - Off / 2 colours / 3 colours.
  - Better when the value is Higher / Lower.
  - Bound fields: 3 colours, Higher → "Red up to [ ]", "Yellow up to [ ]", "Above X: Green". Lower → "Green up to", "Yellow up to", "Above X: Red". 2 colours drops Yellow. Units follow the type ("rounds" for the practice's Number is just the number; Duration shows h:mm; Time shows hh:mm).
  - Mapping: Higher → `bounds: [Red, Yellow]`, `best_colour: Green`; Lower → `bounds: [Green, Yellow]`, `best_colour: Red`. Off → `colour_zones: null`.
  - **Empty cell**: Neutral / Red / Yellow / Green → `no_value_colour`.
  - Changing count or direction resets colours to these palettes; editing a bound value keeps the stored colours.
- **Range bar** (`RangeBar.tsx`): one horizontal scale with the colour segments, bound ticks, and ✓ (done) and ★ (bonus) markers above it. The scale runs from 0 (Number, Duration) or the earliest value minus padding (Time) to the largest bound/threshold plus ~25%. Geometry is a pure function in `zones.ts`.
- **In the table**: sample cells, one inside each zone plus "empty", painted with `ZONE_BG`.
- **Daily score** — "Up to 2 points a day from this practice. Shown on the bar above as ✓ and ★."
  - Summary: "Counts as done at ≥ X · bonus at ≥ Y" (≤ for Lower).
  - Better when: Same as colours / Higher / Lower (Same as colours is only offered when colours are on).
  - **✓ Done at · +1 point** → `mandatory_threshold`; **★ Bonus at · +1 more** → `bonus_rules`.
  - When colours are on and the done threshold differs from where the best zone starts, a chip offers **Done starts where {Green} starts**, which copies that bound.
  - Bonus note: "Bonus only counts on days when every practice with a done threshold is done."
  - Both empty → `daily_score_config: null`.
- **Validation** (`zones.ts`): bounds strictly increasing; bonus ≥ done for Higher, ≤ for Lower; values must parse for the type. Empty saves `null`.
- "Saved as you edit" footer, then **Delete practice** (same confirm as 12m13, then back to Practices).

### Members (12m17–19)

- "{n} members · {k} admins. A yatra always keeps at least one admin."
- List with initials avatar, name, "You" and "Admin" badges.
- Tapping a member opens a sheet: **Admin** toggle — "Can edit practices, members, statistics and yatra settings" (`toggle_admin`) — and **Remove from yatra**. The toggle is disabled with a reason for the last admin; on yourself it is allowed only when another admin exists. Removing yourself isn't offered here (use Leave yatra).
- Remove confirm: "Remove {name}?" with the 12m19 text.

### Statistics (12m20–21)

- **Visible to**: Admins / Everyone (`visible_to_all`). "Tiles sit above the yatra table."
- **Preview** tiles: label, value and unit, "{aggregation} · {range}". Values come from `GET /yatra/:id/data` for today (`statistics`, matched by position).
- List of statistics; tapping one opens the **Edit statistic** sheet: tile preview, Label, Practice, Aggregation, Time range, **Delete statistic**, **Done**. Each change saves (`PUT /yatra/:id`).
- **+ Add statistic** opens the same sheet with defaults (first Number/Duration/Time practice, Avg, Last 30 days), added on first valid change.
- Aggregations by type (`statistics.ts`):
  - Number, Duration: Sum, Average, Min, Max, Count
  - Time: Average, Min (earliest), Max (latest), Count — with "Sum isn't offered: adding up times of day has no meaning."
  - Yes / No, Text: Count only.
  - Changing the practice to one where the aggregation isn't valid switches it to Count.

### Invite (12m22)

"Invite devotees" — "Anyone with this link can join {name}. After joining they link their own practices." The URL `{origin}/yatra/:id/join`, **Share link** (`navigator.share`; hidden when unsupported) and **Copy** (clipboard, then a "Copied" toast). Hint: "Share opens your phone's share sheet."

### Danger zone (12m23)

The 12m23 text and **Delete yatra…**, which opens a confirm sheet: "Delete {name}?" — "This deletes the yatra for all {n} members and can't be undone." A text field "Type the yatra name to confirm"; **Delete forever** is enabled only on an exact match. On success: invalidate `yatras`, go to `/yatras`.

## i18n

Every string is in en, ru and uk. Frames 12m24 (ru) and 12m25 (uk) give the reference wording for the member page and the picker. Long strings wrap, never truncate (except member and practice names in single-line rows).

## Theme

Only `ui-*` tokens and existing primitives (`BottomSheet`, `AnchoredMenu`, `Toggle`, `SegmentedControl`, `SettingsRow`, `ListGroup`). Zone colours use the existing `ZONE_BG`. Dark mode follows the existing theme, as in the mockup's dark frames.

## Testing

- **Unit (Vitest):** `linking.ts` (suggestions, picker groups, summary), `zones.ts` (parse/format, validation, palette mapping, range-bar geometry), `statistics.ts` (aggregations per type).
- **Component** (mocked `yatrasApi`, like `SettingsMobile.test.tsx`):
  - link a suggestion, then Undo restores the previous mapping;
  - Move here sends one request with the link moved;
  - leave as the last admin shows the 12m7 sheet and sends nothing;
  - an out-of-order bound shows the error and sends nothing;
  - Delete forever is disabled until the name matches;
  - a non-admin opening an admin route is redirected.
- **Locales:** en/ru/uk key sets match (existing pattern).
- **Manual:** dev container, mobile width, light and dark.

## Out of scope

- Tablet and desktop yatra settings (12t*, 12d*).
- A redesigned join page.
- Short invite codes.
- Multiple bonus rules or points other than 1.
- Deleting the legacy yatra pages.
