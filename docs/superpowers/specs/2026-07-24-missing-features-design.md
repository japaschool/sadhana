---
name: missing-features-parity
description: Design spec for 5 features present in the Rust frontend but missing from the React rewrite — Graph/Grid Editors, Daily Score Config, CSV Export, Duration Quick-Add Modal, Month Calendar
metadata:
  type: project
---

# Missing Features Parity — Design Spec

**Date:** 2026-07-24  
**Branch:** redesign  
**Scope:** `app-react/` only — backend already supports all of these

---

## Background

A feature comparison between the Rust/Yew frontend (`frontend/`) and the React rewrite (`app-react/`) identified 5 missing features. This spec covers their design and implementation order.

---

## Feature 1 — Graph/Grid Editors (enhanced ReportCard)

### What's missing
`ReportCard` in `ChartsPage.tsx` allows adding/removing practices and picking a trace type on add. It cannot:
- Rename a report
- Change bar layout (Grouped / Stacked / Overlaid)
- Edit an existing trace's type, custom label, or show-average toggle

### Design

Extend `ReportCard` inline — no new route or page.

**Graph report expanded state adds:**
- **Report name** — text input at top of expanded section, saves on blur via `chartsApi.updateReport`
- **Bar layout** — `<select>` (Grouped / Stacked / Overlaid), saves on change
- **Per-trace rows** — each row shows:
  - Practice name (read-only label)
  - Type `<select>` (Line / Bar / Dot) — replaces the static `TraceTypeBadge`
  - Custom label text input (optional, saved on blur)
  - Show average checkbox
  - Delete (×) button
- **Add practice row** — unchanged (practice picker + type picker + Add button)

**Grid report expanded state adds:**
- **Report name** — text input, saves on blur
- Practice list unchanged (checkbox rows already work)

**Save strategy:** Each individual change calls `chartsApi.updateReport` immediately (same pattern as existing `removeItem`/`addItem`). No explicit Save button.

**No Y-axis selection** — the React chart renderer uses a single shared Y-axis; multi-axis is not needed.

### Files affected
- `app-react/src/pages/charts/ChartsPage.tsx` — extend `ReportCard`

---

## Feature 2 — Daily Score Config (YatraPracticeEditPage)

### What's missing
`YatraPracticeEditPage.tsx` has colour zones but no daily score configuration. The server already stores `daily_score` as JSONB on `yatra_practices` and uses it to compute scores shown in the yatra heatmap.

### Design

Add a **"Daily Score"** collapsible section below colour zones in `YatraPracticeEditPage`, visible only for `Int`, `Duration`, and `Time` data types.

**Fields:**
- **Better when** — `<select>`: "Higher is better" / "Lower is better"
- **Mandatory threshold** — type-aware value input:
  - `Int` → `<input type="number">`
  - `Duration` → text input, format `"30m"` / `"1h 30m"`
  - `Time` → text input, format `"HH:MM"`
  - Description: "Reaching this value earns the mandatory point for the day"
- **Bonus threshold** — same format as mandatory
  - Description: "Reaching this value earns an extra bonus point"
  - Clearing it removes the bonus rule

**Serialization** (matches server's existing JSONB schema):
```ts
interface DailyScoreConfig {
  better_direction: 'Higher' | 'Lower'
  mandatory_threshold: PracticeValue | null
  bonus_rules: Array<{ threshold: PracticeValue; points: number }>  // points always 1
}
```

**Save strategy:** Config is included in the existing `saveMutation` PUT body alongside `colour_zones`. No separate save.

### Type changes
- Add `DailyScoreConfig` interface to `app-react/src/types/api.ts`
- Add `daily_score_config?: DailyScoreConfig | null` to `YatraPractice`

### Files affected
- `app-react/src/types/api.ts` — add types
- `app-react/src/pages/yatras/YatraPracticeEditPage.tsx` — add Daily Score section

> Daily Score Config is edit-only — a new practice has no ID yet and scoring is only meaningful once the practice exists.

---

## Feature 3 — CSV Export

### What's missing
Charts page has a share-link button but no way to download the raw data.

### Design

Add a **download button** in the `ChartsPage` header row, to the left of the share button.

**Behaviour:**
- Only visible when a specific report is selected (hidden for "All Practices")
- Uses the currently selected `duration`
- Calls the existing `/diary/${cob}/report?duration=${duration}` endpoint
- Converts the `ReportDataEntry[]` response to CSV:
  ```
  date,practice,value
  2026-07-01,Meditation,30
  ...
  ```
- Prepends UTF-8 BOM (`﻿`) for correct Cyrillic display in Excel
- Triggers browser download as `data.csv` via a temporary `<a>` element (same technique as Rust version)

**Icon:** download/arrow-down icon (lucide `LuDownload`)

### Files affected
- `app-react/src/pages/charts/ChartsPage.tsx` — add download button and CSV logic

---

## Feature 4 — Duration Quick-Add Modal

### What's missing
Duration `PracticeCard` has `+`/`−` step buttons and a direct input but no way to add a specific number of minutes in one tap (useful for "I just did 45 minutes of yoga").

### Design

**Trigger:** A small lightning/plus button (`⚡` icon or `+` with `m` label) added to the Duration card's control row, next to the step buttons.

**Modal:**
- Fixed overlay with semi-transparent backdrop (matches existing app modal style — glass card, rounded-2xl)
- Title: "Add minutes"
- `<input type="number" inputMode="numeric">` — autofocused, centered
- Two buttons: Cancel (closes modal, no change) / Add (adds entered value to current duration and saves)
- Pressing Enter submits

**Logic:** `newValue = currentDuration + enteredMinutes`. Saves via the existing `logValue` mutation in `PracticeCard`.

**Component:** `DurationQuickAddModal` — local to `PracticeCard.tsx`, no separate file needed.

### Files affected
- `app-react/src/pages/home/PracticeCard.tsx` — add modal component and trigger button

---

## Feature 5 — Month Calendar

### What's missing
`WeekCalendar` shows a 9-day sliding strip with no way to jump to a distant date without repeated swiping.

### Design

**Trigger:** The month/year label in the `WeekCalendar` header becomes a tappable `<button>`.

**Modal overlay** (`MonthCalendar` component):
- Fixed full-screen backdrop (semi-transparent black), tap to close
- Centered glass card (rounded-xl, blur backdrop)
- **Header:** Month name + year, `‹` prev / `›` next month buttons
- **Weekday row:** Mo Tu We Th Fr Sa Su (translated via i18n)
- **Day grid:** 7 columns, correct weekday offset (Monday-first)
  - Today: amber text colour
  - Selected date: teal gradient circle (matching week calendar style)
  - Days with incomplete practices: small red dot in top-right corner
- **"Today" link** at bottom — selects today and closes
- Tapping any day: selects date, calls `onDateChange`, closes modal

**Incomplete days:** calls `/diary/incomplete` API for the displayed month's date range. Fetches fresh when month changes.

**Component location:** `app-react/src/pages/home/MonthCalendar.tsx` — new file, rendered from `HomePage.tsx` or `WeekCalendar.tsx`.

**i18n:** Month names and weekday narrow labels already handled by `date.toLocaleDateString(locale, ...)` — no new translation keys needed.

### Files affected
- `app-react/src/pages/home/MonthCalendar.tsx` — new component
- `app-react/src/pages/home/WeekCalendar.tsx` — make header label a button, pass open/close state up or manage locally
- `app-react/src/api/practices.ts` — add `getIncompleteDays(from, to)` if not present

---

## Implementation Order

1. Graph/Grid Editors — highest impact, unblocks chart power users
2. Daily Score Config — completes the yatra practice data model
3. CSV Export — small addition, high utility
4. Duration Quick-Add Modal — convenience feature, self-contained
5. Month Calendar — navigation improvement, most new code

---

## Out of Scope

- Multi Y-axis chart rendering (Y1–Y8) — current single-axis renderer is preferred
- Bonus rule point multipliers beyond 1 — server supports it but UI keeps it simple (always 1)
- Drag-to-reorder yatra practices — separate task not in this spec
