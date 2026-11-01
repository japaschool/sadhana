# Personal insights — design

Mockups: `Personal Insights.dc.html` in the "Sadhana Redesign" project (https://claude.ai/design/p/cccefa4d-5554-41b1-be47-2704b1233b68?file=Personal+Insights.dc.html). Where a number or rule differs, this spec wins.

## Intent

Charts show history, but they don't show dynamics. An average hides nearly everything: one user's rounds were exactly 18 or 20 on 86% of days, so an average graph looks flat while real shifts go unseen. Yatras began to fix this with a trend column, a stability heatmap and colour zones. Personal Insights needs the same, and more.

The core question is **"how am I doing compared with my own normal?"** People push, then settle, and bad patches and holidays pull them down. The app should show this honestly: what changed, whether it has returned, and how long that took, without predicting or judging.

## Who it serves

Production data, 2026-11-01:

- 1,057 users; 69 logged in the last 90 days and 40 in the last 30.
- Of those 69, 16 logged 70+ of the 90 days and 44 logged fewer than 20. 36 of the 69 started in the last 3 months.
- The typical active user has 4 practices. Nearly all have the Russian default set: bedtime, wake-up, rounds per day and rounds before 7.

So everything must work from those four practices alone, and the less regular majority needs a real experience rather than an empty one.

## Goals

- An **Overview** screen that opens Insights by default. Existing charts stay as they are, behind it.
- **Me vs my normal:** each practice against the user's own usual range.
- **Marked periods:** named days or periods of any kind, shown across the insights.
- **Before, during, after:** what a marked period did, and whether things have returned.
- **Year map** and **Rhythm fingerprint.**
- **Days between events,** plus what happens around an event.
- **Calculated sleep** from bedtime and wake-up.
- A view for **less regular users,** with streaks as an opt-in setting.
- All of it on mobile, tablet and desktop, in light and dark themes, with all strings in en/ru/uk.

## Non-goals

- Tradition-specific anything: no Ekadashi, Kartika or fasting concepts in the product. Users name their own periods.
- Calendar feeds. A Vaishnava calendar is a stretch goal, and could later feed marked periods.
- Repeating marked days.
- "What I work on" (weekly or monthly focus). Parked.
- Notifications and the Gayatri reminder. Separate project.
- Guided new-user setup. Separate spec and mockups.
- Shared pages. They're being reworked separately, and nothing here appears on them.
- Previous-period overlays on charts (last month vs this month). Left to generic report work.
- Logging an event twice in one day. Low priority, as a practice stores one value per day.
- Auto-written trade-off cards ("on days you wake before 4:30…").

## Anti-goals (failures even if it "works")

- Gamification: scores, badges, levels, or streaks shown to anyone who hasn't chosen them.
- A prediction ("expect a setback") or a claimed cause ("the retreat raised your rounds"). The app doesn't know why: one user's extra rounds came from a vow that overlapped a retreat.
- Judging language or colours. Below usual is not a failure, and red/green is not used for it.
- A screen that's empty or broken for someone with 4 practices or irregular logging.
- A missed day read as a zero, so that a gap looks like a collapse.
- An existing report's data changing. Marked-period bands are the only addition to its display.
- An older cached client breaking.

## Shared definitions

These apply to every screen. Put them in tested pure functions in `features/insights`.

- **Logged day:** a day with at least one non-null value. Only logged days count in any average, median or range.
- **Empty values:** on a past day that has at least one Int or Duration value, an empty Int or Duration counts as 0 if that practice was filled in at least once in the window, because such practices are often skipped on purpose. On a day with no Int or Duration value at all, those rows have no value, so logging only a wake-up isn't read as 0 rounds. An empty Time is left out. *(my call)*
- **Today:** included for Time and Sleep once filled in. Excluded for Int, Duration and Total time, as the day isn't over, matching the report templates spec. *(my call)*
- **Rows:** Time and Int practices in practice order, plus calculated Sleep when available and **Total time**, the sum of all Duration practices. Bool and Text practices aren't rows. The existing active-only rule applies, because report data returns active practices only.
- **Usual range:** the middle 50% (P25–P75) of logged days in the 90 days before the last 7 days, with the median as "usual". Days in a marked period with "leave out of my usual range" on are skipped, and the window reaches further back to replace them, up to a year. It needs 14 logged days; below that there's no range. The range moves with time, so a lasting change becomes the new usual by itself once the period is over. *(my call)*
- **Now:** the mean of the row over the last 7 days, needing at least 3 values. With fewer, the row shows its usual and "Not enough recent days" with no dot or word, so a thin week can't read as a collapse. *(my call)*
- **Time values:** compare across midnight by treating minutes as an offset from noon, so 23:30 and 00:30 are neighbours.
- **Calculated sleep:** the report templates spec's night calculation: night D runs from the bedtime logged on D−1 to the wake-up logged on D. Share one function with that work, whichever ships first. A missing time gives no value, never a guess.
- **Finding bedtime and wake-up:** practices have no semantic type. If the user has a Sleep template report, use its bedtime, wake-up and nap, so Sleep here equals that report's total. Otherwise, if active Time practices match the default bedtime and wake-up names in any language, use them. Otherwise ask once on the Overview which two to use, or skip sleep. The choice is stored per device in `localStorage`, so another device may ask again. *(my call)*
- **Colour:** the diverging scale in the mockup, 3 steps either way from neutral, with its light and dark values and dot colours. Add them as new theme tokens. Every cell has a value in its tooltip or text.
- **Direction:** the app doesn't know what's good. Teal means above usual, or earlier for Time practices.

## Marked periods

A marked period is a named stretch of one or more days. It can be good, bad or neither: a retreat, a holiday, flu, a new baby.

- Fields: **name** (free text, 1–100 characters), **start**, **end** (empty while ongoing), **leave out of my usual range** (on by default). Periods may overlap.
- **Where managed:** a list under Settings › Insights, plus entry points from the Overview prompt and Before, during, after. Settings › Insights also holds Show streaks and the bedtime and wake-up choice.
- **Where it appears:** a band on Insights charts, a bar along the top of the Year map, a dot on Me vs my normal, and a Before, during, after card. It's left out of usual ranges and the fingerprint when the setting is on.
- **Suggestions:** the app watches for a change and asks. Each day from the 45th logged day on, compare each row's median over the last 5 days with that row's P10–P90 over the preceding 56 days. When 2+ rows are outside for 3+ consecutive days, in any direction, show "Something changed around {date}. Want to name it?", name the rows that moved, and offer **Mark this period** and **Not now**. Don't suggest within a marked period. Settings › Insights has a "Suggest periods to mark" toggle, on by default. Dismissals are stored per device, keyed by start date. *(my call)*
- On one user's year this gave 5 suggestions of 3+ days, found a 10-day stretch 2 days after it began, and needs tuning on more data. The thresholds are the builder's to adjust, within about one suggestion every two months for a regular user.
- Marking from a suggestion prefills the dates, and the user can correct them.
- **Open periods:** after an ongoing period has run 30 days, and every 30 days after that, the Overview asks "Is {name} still going?" with **Yes** and **It ended on…**, so a forgotten period doesn't keep hiding data. *(my call)*

## Overview

Insights opens on an Overview segment, alongside the current charts and tables. The selected report stays remembered in the existing way; the opening view is always Overview. *(my call)*

### Regular view (at least 1 row has a usual range, and there are 3+ logged days in the last 14)

1. Any suggestion prompt.
2. **Me vs my normal:** one row each, showing name, current value, usual value, a strip with the range band, a dot for now, and a hollow dot for the most recent marked period if it ended within 30 days. A neutral word goes at the end: Usual, Above usual, Below usual, Earlier or Later.
   - **Now** skips days in a period left out of usual. If that leaves fewer than 3 values, show the period's own value with the hollow dot, and no "now" dot.
   - A row with no usual range yet shows its value only, with no strip or word.
   - **Usual** means within the band plus a small margin, so that values near the edge don't flip. *(builder sets the margin)*
3. Before, during, after cards, while relevant.
4. Links or sections for the Year map and fingerprint. *(builder's layout)*

### Less regular view (everyone else)

- **Days practised:** a month grid of logged days, with this month's count against last month's. The count never resets.
- **On days you practise:** the plain average of each row over logged days in the last 90 days.
- A short welcome-back line after a gap of 3+ days, with no mention of what was missed. This line also shows in the regular view.
- Once enough days exist, it moves to the regular view by itself.

**Streaks:** a Settings option, off by default, showing the current and longest run of logged days as plain numbers. No badges or celebrations. Stored per device. *(my call)*

## Before, during, after

One card per marked period of 3+ days, shown on the Overview from its start until 30 days after it ends, and listed in full under the period in Settings. Single-day periods get no card.

- **Rows** are the same as Me vs my normal, each showing before → during → after. **Before** is the usual value at the start of the period. **After** is since the end, up to 4 weeks, so the value stays meaningful for as long as the card shows.
- **Status chip**, never a forecast. Each row has its own chip, by the rules below, and the card's chip is its least settled row, so N on the card is the longest row's N:
  - **In progress** during the period.
  - **Still settling** after it, until every row has been within usual for 14 evaluated days in a row on a 7-day average.
  - **Back to usual after N days**, once that has happened. N runs from the period's end to the first day of that stretch.
  - **Still different** after 30 days, if it hasn't. This can still change to Back to usual later, so N can exceed 30.
- **Measuring the chip** *(my call)*: "usual" here is frozen at the period's start, so the chip can only say Back to usual if the person returned, not because the baseline moved. A day with fewer than 3 values in its 7-day window isn't evaluated: it neither counts towards nor breaks the 14. Rows with no range at the period's start are ignored. If no row has one, the card shows no chip.
- A chip names any overlapping period.
- **Chart:** the 7-day average of one row, defaulting to the one that changed most, with a picker. It shows the moving usual range and median over the past year, with marked periods as bands.

## Year map

A grid of rows by weeks, over the last 52 weeks (26 on mobile), with weeks running Monday to Sunday.

- Each cell is the week's mean compared with that row's median across the map, scaled by median absolute deviation, in 3 steps each way from neutral. A week with no logged days is blank.
- Marked periods run along the top as bars with their names.
- The tooltip gives the week, value and usual.

## Rhythm fingerprint

A grid of rows by weekdays, over the last 180 days, skipping left-out periods. It needs 8 weeks of data.

- Rows are Int practices and each Duration practice separately, as this is where the mix matters. Time practices are left out.
- Each cell shows the average, tinted by how far it sits from that row's typical day.

## Days between events

A report for practices where the gap matters. Built as a fourth template in the report templates format, so **it depends on that work's phase 1**. It appears in the report menu, and not on the Overview.

- **Inputs:** one Bool or Text practice, and up to 4 Int, Duration, Time or Sleep rows to compare. An event is a true Bool or a non-empty Text. A dropdown practice splits by option.
- **Summary figures:** typical gap (median), longest gap and latest gap, with dates. Typical gap needs 5 events.
- **Chart:** one mark per event, at the height of the days since the previous one, coloured by option, with marked periods as bands.
- **The days around it:** one table for the selected option, with a switch between options when there are 2+, because different options can mean different things, with the day before, the same day, the next day and 2 days after, against usual. Colour a cell only when it's at least 0.3 standard deviations from usual. Show the table only with 10+ events; below that, show how many more are needed.
- Wording stays factual, such as "around" rather than "after" or "because of".
- **Private, for now** *(my call)*: these reports can hold sensitive practices, so `GET /share/{id}/reports` never returns them. Revisit in the shared page rework, which will let a person share a chosen report.
- **Older clients:** builds that send `panels=true` can't draw the new kinds. The owner's `GET /reports` returns them only with a new `panels=2`, which new clients send, and the existing filter otherwise stays. *(my call)*
- **Generic format:** the gap mark, split by option and "days around" table are new panel or source kinds in the `panels` format, not template-only code, so the generic editor can reach them later. This adds a template variant and panel kinds to the Rust type.

## How this fits report templates

`2026-10-31-report-templates-design.md` answers one question per report; this design looks across all practices. They're built to sit together. Mockups: `Report Templates.dc.html` in the same project, checked against this design.

- **Independent builds:** either can ship first, except Days between events, which needs templates phase 1. *(recommended order: Sleep template first, as it's further along and gives this work its night calculation)*
- **New chart sheet:** Days between events becomes a fourth ready-made report on that sheet. Its form follows the templates' rule of suggesting a practice with a Use button rather than filling it in.
- **Durations:** use one format, the templates' `6h 14m`.
- **Report menu:** the Overview sits beside the report menu, not in it. All practices, template reports and alphabetical sorting all stay under Charts.
- **Marked periods** are the "out of routine" feature that spec defers. The panels renderer draws them as bands, like other charts. Template summary figures stay unchanged for now; dropping left-out days from them is a later change, and it would also cover that spec's travel-night problem.
- **Different averages, on purpose:** template Japa and Duration averages count a missing day as 0, like existing Insights, while this design uses logged days only. So one practice can show two averages for an irregular logger. The report answers "how much over this range", and the Overview answers "what's a typical day for me". Label them accordingly.
- **Different colours, on purpose:** templates colour by a target the user set, so a met or missed colour is fair. Insights has no target and stays neutral.

## Server

Follow the layered `yatras` style.

- New `marked_periods` table: `id`, `user_id` (cascade on delete), `name`, `start_date`, `end_date` (nullable), `exclude_from_usual` (default true), timestamps. Check `end_date >= start_date`.
- Routes: `GET`/`POST /api/marked-periods`, `PUT`/`DELETE /api/marked-period/{id}`, for the authenticated user only. Validate name length and date order (422).
- Regenerate `schema.rs`. Migrations must be applied explicitly on prod, as they're gated.
- Apart from the Days between events changes above, no other server change. Insight values are calculated on the client from `/diary/{cob}/report`.
- Not exposed through `/share`.

## Client

- `Year` report data covers the Year map, usual ranges and fingerprint. Before, during, after uses `AllData` for older periods, which only people with long histories will notice.
- Pure logic lives in `features/insights`, tested like `chartLogic.ts`. Layout components are per layout, following the three-layout rule.
- Queries persist as usual, so insights open offline. Creating or editing a period needs a connection, as the outbox only covers diary entries. Show the normal error state.
- Older clients ignore the new table and routes.

## Phases

Agreed order:

1. **Marked periods and Overview:** Me vs my normal, suggestions, calculated sleep, the less regular view and streaks.
2. **Before, during, after.**
3. **Year map and fingerprint.**
4. **Days between events,** after report templates phase 1.

## Testing

- Pure logic: usual range with skipped periods and the window reaching back, too few days, a thin week, partly filled days, today's handling, midnight wrap, empty-value rules, the status chip's transitions with logging gaps, and suggestions firing on a known synthetic series and staying quiet on a flat one.
- Fixtures for 4 practices, irregular logging, exactly one row with a range, and a user with no Time practices.
- Server (`make test`): CRUD, ownership, validation and cascade delete.
- All three layouts render the Overview. `locales.test.ts` covers translations.

## Left to the builder

Layout per screen, exact colour steps, wording within the rules above, the near-edge margin, and detector tuning.
