# Sadhana Pro — Diary Inputs Match the Rust Version

**Date:** 2026-08-08
**Scope:** Change the Home diary entry inputs in `app-react/src/pages/home/PracticeCard.tsx` to match the original Rust/Yew version's per-type input widgets. No backend or data-model changes; the optimistic-save mutation and flash/error states are preserved.

## Context

The React `PracticeCard` currently renders: Bool → toggle; Int → −/+ steppers around a number field; Duration → steppers + smart field + a lightning quick-add modal; Time → two separate `HH` and `MM` number fields; Text → `<select>` if `dropdown_variants`, else a single-line `<input>`.

The Rust reference (`frontend/src/routes/home.rs:309-465`) renders: Int → `<select>` if variants else `<input type="number" min=0 max=174>` (no steppers); Bool → checkbox; Duration → `<input type="text" inputmode="numeric">` (formatted on blur) + a "+" that opens an add-minutes prompt; Time → `<input type="text" inputmode="numeric">` that auto-formats to `HH:MM` as you type (`format_time`); Text → `<select>` if variants else `<textarea rows=4 maxlength=1024>`.

**Decisions (from brainstorming):** match Rust for **Int, Time, Duration, and Text**; keep the `<select>` dropdown for Int/Text practices configured with options; leave **Bool** as the existing toggle.

## Design

All edits in `PracticeCard.tsx`. A new small tested helper module `app-react/src/pages/home/inputFormat.ts` holds the pure formatting/parsing.

### Text (`data_type === 'Text'`)
- `dropdown_variants` present → `<select>` (unchanged from today).
- Else → **`<textarea rows={4} maxLength={1024}>`**, value = current text, save on blur (optimistic `{ Text: value }`). Replaces the single-line input.
- **Layout:** because the textarea needs vertical space, a free-text Text card renders **stacked** — the name/label row on top, the textarea full-width below. All other data types keep the current single-row layout (name left, control right).

### Int (`data_type === 'Int'`)
- `dropdown_variants` present → `<select>` (new branch mirroring Rust; options from `dropdown_variants` split on newline, save `{ Int: parseInt(option) }` — non-numeric options are ignored/empty).
- Else → **`<input type="number" inputmode="numeric" min={0}>`**, save on blur. The **−/+ stepper buttons are removed**.

### Time (`data_type === 'Time'`)
- Single **`<input type="text" inputmode="numeric" placeholder="HH:MM">`**. As the user types, `formatTimeInput` (ported from Rust `format_time`) keeps digits only, inserts the colon after the 2-digit hour, and clamps hours 0–23 / minutes 0–59. On blur, parse `HH:MM` → `{ h, m }` and save `{ Time: {h,m} }`. If the field is empty/incomplete on blur, **do not save** (previous value retained) — clearing an existing entry to empty is out of scope and matches today's React behavior, which never clears. Replaces the two `HH`/`MM` fields.

### Duration (`data_type === 'Duration'`)
- Single **`<input type="text" inputmode="numeric">`** displaying the formatted duration (reuse existing `fmtDur`: `45 min` / `1h` / `1h 30m`); on focus show raw minutes for editing, on blur re-format and save `{ Duration: minutes }`. The **−/+ steppers are removed**. Keep the **"+" quick-add** button → the existing `DurationQuickAddModal` (equivalent to Rust's add-minutes prompt), which adds to the current value.

### Bool — unchanged.

### Helper module `inputFormat.ts`
Pure, unit-tested:
- `formatTimeInput(raw: string, isBackspace: boolean): string` — digit-extract + colon-insert + clamp → partial/full `HH:MM` string for the controlled field.
- `parseTime(display: string): { h: number; m: number } | null` — `HH:MM` → clamped `{h,m}`, or `null` if incomplete/empty.
- (Duration formatting stays as the existing `fmtDur` in `PracticeCard.tsx`; parsing is `parseInt`.)

## Files

| File | Change |
|---|---|
| `app-react/src/pages/home/inputFormat.ts` | **New** — `formatTimeInput`, `parseTime` |
| `app-react/src/pages/home/inputFormat.test.ts` | **New** — unit tests for the helpers |
| `app-react/src/pages/home/PracticeCard.tsx` | Text→textarea (stacked) / keep select; Int→plain number / add select branch; Time→single auto-format field; Duration→single field + quick-add (drop steppers) |
| `app-react/src/pages/home/PracticeCard.test.tsx` | Update/extend for the new controls |

## Testing

- `inputFormat.test.ts`: `formatTimeInput` inserts colon after 2 digits (`"0630"`→`"06:30"`), clamps (`"99"`→`"23"`, minutes `"75"`→`"59"`), handles backspace without re-adding the colon; `parseTime` returns `{h,m}` for full input and `null` for empty/partial.
- `PracticeCard.test.tsx`: free-text Text renders a `textbox` (textarea) and saves on blur; Text with variants renders a `combobox` (select); Int (no variants) renders a `spinbutton` (number input) with **no** `−`/`+` buttons; Int with variants renders a select; Time renders one text field that formats to `HH:MM` and saves `{h,m}` on blur; Duration renders a text field + quick-add and no steppers. Keep the existing optimistic-update tests (Bool toggle unchanged).
- Full Vitest suite stays green; `tsc`/lint clean for touched files.
- Manual: on Home, add practices of each type and confirm the inputs behave like the Rust app.

## Non-goals

No backend/model changes; Bool control unchanged; dropdown kept for configured-options Int/Text; no changes outside the Home practice inputs.
