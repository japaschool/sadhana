# Goals — design

Mockups (claude.ai/design project "Sadhana Redesign"): [`Goals.dc.html`](https://claude.ai/design/p/cccefa4d-5554-41b1-be47-2704b1233b68?file=Goals.dc.html), frames `16m*`, `16t*` and `16d*`. Where a mockup and this spec differ on layout or visuals, the mockup wins. On behaviour, this spec wins.

*(my call)* marks decisions I made that weren't discussed in detail.

## Intent

Today targets exist only on reports, and they're always daily. Plenty of real goals aren't daily: learn a shloka a week or a month, do yoga twice a week, read 100 pages a week. Others run the other way, as a limit on something being reduced or stopped: no more than 5 cigarettes a day, or something no more than twice a month.

Daily bars can't show these. A weekly goal deliberately allows uneven days, so a 0 on Tuesday isn't a failure. The question is whether the week or month as a whole was on goal.

**Goals** is a new ready-made report with one row per goal. It's built on the finished report templates and doesn't depend on any personal insights phase.

## Goals

- A goal is one practice, a direction (at least or no more than), an amount and a period (day, week or month).
- One report can mix periods and directions.
- Each row shows where the running period stands and how the last 12 periods went.
- A near miss looks like a near miss rather than a failure.
- A period with nothing logged never looks like a success.
- All strings in en, ru and uk, on all three layouts, in light and dark.

## Non-goals

- Reminders or notifications about goals.
- Showing goals on Today.
- A combined score, or a summary across goals.
- A goal across several practices.
- Units on practices. Reading reads "At least 100 a week", and the practice name gives the meaning.
- A choice of first day of the week. The app has no such setting.
- Keeping a history of goal changes.
- Sharing. See Privacy.

## Anti-goals (failures even if it "works")

- Praise, streaks, badges, warnings or exclamation marks. Going over a limit is plain information.
- Pace demands such as "13 pages a day to reach it". "Days left" is arithmetic and stays; a required daily rate reads as an order.
- Carry-over. Three shlokas in one month don't pay for the next one. A goal is a rhythm, not a balance.
- An unlogged month that looks like a perfect month on a limit.
- A running period shown as missed before it's over, unless a limit has already been passed.
- Tradition-specific wording. Goals stay neutral, as in every template.

## Counting

The period is a calendar day, a Monday to Sunday week, or a calendar month, in local `yyyy-mm-dd` dates.

| Practice type | The form offers | Period value |
|---|---|---|
| Yes/no (`Bool`) | Nothing extra | Days marked yes |
| Number (`Int`) | Nothing extra | Sum of the numbers |
| Duration | Counts: Time or Days | Sum of minutes, or days with more than 0 minutes |

`Time` and `Text` practices can't be chosen.

**Blank days:**

- A day is logged if any practice in the report data has a value that day.
- On a logged day, a blank for this practice counts as 0, so people only need to tick when something happened.
- A day with nothing logged at all doesn't count.
- A past period with no logged days is **blank**, never met and never missed. This applies to both directions.
- The report data covers active practices only, so a day logged only in a practice that has since been hidden reads as unlogged. *(my call: rare, and not worth a new query)*

**First square:** the report data has a row for every date whether or not anything was logged, so history has to be worked out. A row starts at the first period holding a value for that practice, and shows at most 12 periods including the running one. With no values yet, the row shows only the running square. *(my call)*

## Square rule

Fuller is always better. `x` is the period value and `n` is the amount.

**At least:** `x >= n` is full (met). Otherwise the fill is `x / n`, at most 90%.

**No more than:**

| Value | State |
|---|---|
| `x = 0` | Full (met) |
| `0 < x < n` | Filled to `(n - x) / n`, at most 90%, and met |
| `x = n` | At the limit: met, with no fill and a thin met-colour outline |
| `x > n` | Over the limit: missed colour |

The 90% cap keeps 95 of 100 visibly different from a full square at 22px.

**Running period** (the last square): an open, dashed look, with the same fill rule. It's never shown as missed, except a limit already passed, which takes the missed colour and stays dashed. Blanks in the running period count as 0, so it's never blank.

A square goes from running to final when its period ends. There's no other state or stored result: everything is worked out from the diary each time.

Colours are the templates' met and missed values. An amount of 0 on "no more than" means none at all: `x = 0` is full and anything else is over the limit, so the at-the-limit state doesn't occur. *(my call)*

## The report

One row per goal, in form order:

- **Line 1:** practice name, the goal in words, then progress: "62 of 100 · 3 days left", or "3 of 5 today" for a daily goal.
- **Line 2:** up to 12 equal squares, right-aligned, oldest first. A daily row covers 12 days, a weekly row about 3 months and a monthly row a year.
- **Days left** includes today, as in the mockup (Friday shows 3). Durations use the `6h 14m` format.
- **Tap a square** for its dates and exact value, such as "12–18 Jan · 95 of 100", or "Nothing logged". Tap again to close. Hover on desktop.
- **Legend** under the rows, with "Part way / room left" for partly filled squares.
- **No range control.** The report always shows the last 12 periods, so the 7d, 30d and Ending today controls are hidden for it, along with the range-based summary above other reports.
- **Tap targets and access:** each square has a tap area of at least 44px high and is keyboard reachable, with its dates and value as its accessible name. Squares are 22px on mobile and 28px on larger layouts, so the tap area overlaps the gaps. *(my call)*

## The form

- Goals is the last entry under Ready-made reports on the New chart sheet.
- Fields: report name, then one card per goal, then Add goal, up to 12 goals *(my call: the existing series limit)*, and the private note.
- Each goal has a practice picker, At least / No more than, Counts (Duration practices only), an amount and a period. A new goal starts on At least and Week.
- The amount is whole numbers, or `h:mm` for time. Yes/no and number goals show no unit word; Duration by Days shows "days".
- At least needs 1 or more. No more than allows 0.
- Create is disabled until every goal has a practice and an amount.
- The live preview sits above the form on tablet, beside it on desktop and below it on mobile.
- Editing a saved report follows the other templates: from Settings › Charts, saved as you go.
- Practice suggestions don't apply, because the user names the goal by choosing the practice.

## Deleted or changed practices

A goal whose practice was deleted, hidden or retyped shows its own message in that row, with Choose a practice and Remove goal, and the other rows are unaffected. So goal practices don't go in the report's `required` list, which would replace nothing but adds a report-wide card.

Changing an amount or direction recalculates all 12 squares against the new goal. *(my call: there's no goal history)*

## Privacy

Goals can be very personal, so Goals reports are never returned by `/share/{id}/reports`, whatever the query. The form says so once. This hides the report only: practices that are already visible on the shared page stay visible, and per-report sharing is a separate project.

## Server

The format lives in `server/src/app/report/panels.rs`, as for the other templates.

- `Template::Goals(GoalsTemplate { goals })` and a new panel kind `Panel::Goals { goals }`, with `Goal { practice, direction, amount, period, counts }`.
- `direction` is `AtLeast` or `AtMost`. `period` is `Day`, `Week` or `Month`. `counts` is `Total` or `Days`.
- `version` stays 1, as the new variants are additive.
- **Validation (422):** practices must be the user's, using the same check as other reports; at most 12 goals; at least 1 goal; amount within the direction's limits.
- **Older clients:** builds sending `panels=true` can't draw the new panel kind, and today's client crashes on an unknown kind. `panels` becomes a minimum level: `false` is 0 and `true` is 1, so existing clients are unchanged, and a report is returned only if its level is at or below the requested one. Goals is level 2. Each later panel kind takes the next number, so Days between events becomes level 3. *(my call)*
- **Shared:** exclude Goals reports from `get_shared_reports`.
- No migration: the report lives in the existing `definition` column.

## Release order

Stable and preview share one database, and `Report::get_all` fails on the first definition it can't read. A Goals report saved on preview would therefore break that user's whole `GET /reports` on stable, and their shared page, and a rollback would do the same.

1. **First release, to stable:** `get_all` skips a panels definition it can't read and logs it, rather than failing the list. It needs its own test. *(my call)*
2. **Second release:** Goals, through preview as usual.

## Client

- `api/charts.ts`: mirror the new types, and send `panels=2` on `getReports`. `getSharedReports` keeps `panels=true`.
- Fetch `Year` report data for a Goals report, whatever range is selected. It always covers 12 calendar months, including the running one.
- Pure logic goes in `features/insights/panels`, tested like `panelLogic.ts`: period boundaries, period values, blank detection, first square, square state and progress text.
- Reuse `makeLookup`, which already maps practice ids to the names in report data and treats retyped practices as missing.
- Add a `GoalsPanelView`, drawn from `PanelsReportView`. `missingRequired` stays as it is, because goals don't use `required`.
- The existing report form, picker and live preview are reused, with one new draft kind in `TemplateForm`.
- Strings in en, ru and uk, with correct plurals for "days left".

## Testing

- **Pure logic (Vitest):** every row of the square rule, including 95 of 100 capped, an amount of 0, running states and a limit already passed. Blank days on logged and unlogged days. A week crossing a month, months of different lengths, Sunday (Monday-based weeks) and the first square for short histories.
- **Components:** form validation, Counts appearing only for Duration, tap to show and close, a missing-practice row beside healthy rows, and no range control.
- **Server (`make test`):** create, update and delete, each validation, `GET /reports` returning Goals only at level 2 or above, with `true` and no parameter unchanged, an unreadable definition skipped without failing the list, and `/share/{id}/reports` never returning it, even with `panels=2`.
