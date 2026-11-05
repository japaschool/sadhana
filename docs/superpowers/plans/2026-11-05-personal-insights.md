# Personal Insights (phases 1–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Insights Overview (Me vs my normal, change suggestions, calculated Sleep, the less regular view, streaks), marked periods, Before/during/after cards, the Year map and the Rhythm fingerprint.

**Architecture:** One new server resource, `marked_periods` (layered `yatras` style, CRUD only). Everything else is calculated on the client from `GET /diary/{today}/report?duration=Year` in pure, tested modules under `features/insights/overview/`. Per-device choices (streaks, suggestions, sleep practices, dismissals) live in one `localStorage` key. Cards are shared components; each layout composes them in its own tree.

**Tech Stack:** Rust (actix-web, Diesel, Postgres tests), React + TypeScript, React Query, Recharts, Vitest, i18next (en/ru/uk).

**Spec:** `docs/superpowers/specs/2026-11-01-personal-insights-design.md`, phases 1–3. Phase 4 (Days between events) is shipped; see `docs/superpowers/plans/2026-11-03-days-between-events.md` for the patterns it set.

**Mockups:** `Personal Insights.dc.html` in "Sadhana Redesign" (artboards 16m1–16m15, 16m19–20, 16t1–3, 16d1–3). The file is over the 256 KB read limit: get a `serve_url` from `render_preview`, `curl` it into the scratchpad, and strip tags to read the copy. Where a number differs, the spec wins.

## Global Constraints

- Older cached clients must not break: no existing route, response shape or report data changes. Marked-period bands are the only addition to an existing chart.
- "Logged day: a day with at least one non-null value. Only logged days count in any average, median or range." A missed day is never read as 0.
- Empty values: "on a past day that has at least one Int or Duration value, an empty Int or Duration counts as 0 if that practice was filled in at least once in the window". An empty Time is left out.
- Today: included for Time and Sleep once filled in; excluded for Int, Duration and Total time.
- Rows: Time and Int practices in practice order, then calculated Sleep when available, then Total time (sum of all Duration practices). Bool and Text aren't rows. Active practices only.
- Usual range: P25–P75 of logged days in the 90 days before the last 7 days, median as "usual", needs 14 logged days, left-out period days skipped with the window reaching back up to a year.
- Now: mean of the last 7 days, needs 3 values.
- Time values compare as minutes after noon (`(v - 720 + 1440) % 1440`), so 23:30 and 00:30 are neighbours.
- Colour: the existing `--ui-div-p3 … --ui-div-m3` tokens (already in `ui/theme.css`, light and dark). Teal (`p*`) means above usual or earlier. Never red/green for this. Every tinted cell has its number in text or tooltip.
- Words: Usual, Above usual, Below usual, Earlier, Later. No prediction, no cause ("around", never "because of"), no scores or badges. Streaks only when the user turned them on.
- Marked period: name 1–100 chars (trimmed), `start_date`, `end_date` (null while ongoing, `>= start_date`), `exclude_from_usual` default true. Periods may overlap. Never exposed through `/share`.
- Per-device storage only, key `sadhana.insights`; blocked storage falls back to defaults for the visit.
- Local `yyyy-mm-dd` dates (`toDateStr`/`fromDateStr`/`addDays` from `features/today/date`), never `toISOString()`. Durations via `formatDuration` (`6h 14m`).
- Every new string in en, ru and uk; `locales.test.ts` passes. Russian/Ukrainian copy from 16m19–20.
- Don't hand-edit `server/src/schema.rs` (`make gen_schema`). The migration runs on prod only when applied explicitly (gated).
- Rust runs in the dev container: `docker exec <container> bash -lc 'cd /workspaces/sadhana-pro && make test T=marked_periods'`. `npm test` with Node 22 (docker `node:22` image), never the host's Node 26.

## Review Focus

1. **An irregular user who logged only a wake-up on some days:** those days must not count as 0 rounds, and their Total time must be empty. Pinned in Task 3.
2. **An ongoing marked period with `exclude_from_usual` on that covers the whole last week:** "now" falls back to the period's own value with a hollow dot, never "Below usual". Pinned in Task 4.
3. **A user whose bedtime practice was deleted or retyped after they chose it in the sleep sheet:** Sleep disappears and the sheet asks again; no guessed value. Pinned in Task 6.
4. **A logging gap right after a period ends:** days with fewer than 3 values in their 7-day window neither count towards nor break the 14-day stretch. Pinned in Task 11.
5. **A Year map week straddling a year boundary or DST change:** weeks still run Monday–Sunday and each day lands in exactly one week. Pinned in Task 13.

---

## Phase 1 — Marked periods and Overview

### Task 1: Server — `marked_periods` table and routes

**Files:**
- Create: `migrations/2026-11-05-000000-0000_marked_periods/{up,down}.sql`
- Create: `server/src/app/marked_periods/{mod,dto,handlers,service}.rs` (copy the shape of `app/practice_groups`)
- Modify: `server/src/app/mod.rs`, `server/src/routes.rs` (inside `api_scope`), `server/src/schema.rs` (regenerated)

**Interfaces:**
- Produces (JSON the client mirrors in Task 2):
  - `GET /api/marked-periods` → `{ "periods": [MarkedPeriod] }`, ordered `start_date DESC, created_at DESC`
  - `POST /api/marked-periods` body `MarkedPeriodForm` → `{ "id": Uuid }`
  - `PUT /api/marked-period/{id}` body `MarkedPeriodForm` → `null`; `DELETE /api/marked-period/{id}` → `null`
  - `MarkedPeriod { id: Uuid, name: String, start_date: NaiveDate, end_date: Option<NaiveDate>, exclude_from_usual: bool }`
  - `MarkedPeriodForm { name: String, start_date: NaiveDate, end_date: Option<NaiveDate>, exclude_from_usual: bool }`
  - Another user's id → `AppError::NotFound`. Bad name or `end < start` → `AppError::UnprocessableEntity`.

- [ ] **Step 1: Migration.** `up.sql`:

```sql
CREATE TABLE marked_periods (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  start_date date NOT NULL,
  end_date date NULL CHECK (end_date IS NULL OR end_date >= start_date),
  exclude_from_usual bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marked_periods_user_id ON marked_periods(user_id);
SELECT diesel_manage_updated_at('marked_periods');
```

`down.sql`: `DROP TABLE marked_periods;`. Run `make migrate && make gen_schema` in the container.

- [ ] **Step 2: Write the failing tests** in `service.rs`'s `mod tests` (reuse the `new_user` helper pattern from `practice_groups/service.rs`):
  - `create_then_list_returns_period` — fields round-trip, list newest start first.
  - `name_is_trimmed_and_limited` — `"  Retreat "` saves `"Retreat"`; `""`, `"   "` and 101 chars → `UnprocessableEntity`; 100 chars ok (count chars, so 100 Cyrillic letters pass).
  - `end_before_start_is_rejected` — on create and update.
  - `other_users_period_is_not_found` — update and delete of another user's id → `NotFound`, row unchanged.
  - `deleting_user_deletes_periods` — `DELETE FROM users` cascades.

- [ ] **Step 3: Run** `make test T=marked_periods` → FAIL (functions missing).
- [ ] **Step 4: Implement** `service::{list, create, update, delete}(conn, user_id, …)`, handlers (`auth::get_current_user`, `web::block`), routes:

```rust
.service(web::scope("/marked-periods")
    .route("", web::get().to(app::marked_periods::list_periods))
    .route("", web::post().to(app::marked_periods::create_period)))
.service(web::scope("/marked-period/{id}")
    .route("", web::put().to(app::marked_periods::update_period))
    .route("", web::delete().to(app::marked_periods::delete_period)))
```

- [ ] **Step 5: Run** `make test T=marked_periods` → PASS; `make lint` clean.
- [ ] **Step 6: Commit** `feat(server): marked periods table and CRUD routes`.

### Task 2: Client API and query hook

**Files:**
- Create: `app-react/src/api/markedPeriods.ts`, `app-react/src/api/markedPeriods.test.ts`

**Interfaces:**
- Produces:
  - `interface MarkedPeriod { id: string; name: string; start_date: string; end_date: string | null; exclude_from_usual: boolean }`
  - `type MarkedPeriodForm = Omit<MarkedPeriod, 'id'>`
  - `markedPeriodsApi.{ list(): Promise<MarkedPeriod[]>; create(f): Promise<string>; update(id, f): Promise<void>; remove(id): Promise<void> }`
  - `MARKED_PERIODS_KEY = ['marked-periods'] as const`
  - `useMarkedPeriods(): { periods: MarkedPeriod[]; isLoading: boolean }` (React Query, persisted like other queries)
  - `useSavePeriod()`, `useDeletePeriod()`: mutations that invalidate `MARKED_PERIODS_KEY`; errors surface through the mutation (no outbox).

- [ ] **Step 1: Failing test** in the style of `api/practices.test.ts`: `list` reads `res.data.periods` from `GET /marked-periods`; `create` POSTs the form and returns `id`; `update` PUTs `/marked-period/{id}`; `remove` DELETEs it.
- [ ] **Step 2: Run** `npm test -- markedPeriods` → FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(insights): marked periods API client`.

### Task 3: Rows and daily values (`series.ts`)

**Files:**
- Create: `app-react/src/features/insights/overview/series.ts`, `series.test.ts`, `fixtures.ts` (test fixtures shared by Tasks 3–13)

**Interfaces:**
- Consumes: `Lookup`, `makeLookup`, `resolve`, `scalar` (`panels/panelLogic.ts`); `RowKind` (`panels/gapLogic.ts`); `sleepSource` (`panels/templates.ts`); `SleepRows` (`api/charts.ts`).
- Produces:
  - `interface InsightRow { key: string; kind: RowKind; practice: string | null; special: 'sleep' | 'total' | null }` — `key` is the practice id, or `'sleep'` / `'total'`.
  - `insightRows(practices: UserPractice[], sleep: SleepRows | null): InsightRow[]`
  - `type Series = Map<string, number>` (cob → value; Clock values are minutes after noon)
  - `rowSeries(rows: InsightRow[], entries: ReportDataEntry[], practices: UserPractice[], sleep: SleepRows | null, todayCob: string): Map<string, Series>`
  - `loggedDays(entries: ReportDataEntry[], todayCob: string): string[]` (sorted; a day with any non-null value; today counts once any value is in)
  - `fixtures.ts`: `practice(id, name, type, opts?)`, `entries(days: Record<cob, Record<practiceName, unknown>>)`, `FOUR` (bedtime, wake-up, rounds per day, rounds before 7, Russian default names), `TODAY = '2026-11-05'`.

- [ ] **Step 1: Failing tests:**
  - `rows_follow_practice_order_then_sleep_then_total` — Time/Int practices in order, Bool/Text/inactive dropped, `sleep` row only when `sleep` given, `total` only when ≥1 Duration practice.
  - `empty_int_is_zero_on_a_day_with_other_numbers` — day has rounds=16, rounds-before-7 empty, and rounds-before-7 filled on another day in the window → `0`.
  - `wake_only_day_gives_no_count_values` — day with only wake-up: no value in Int rows, none in `total`.
  - `never_filled_int_stays_empty` — an Int practice never filled in the window has no 0s.
  - `today_counts_for_clock_and_sleep_not_counts` — today: wake-up present, rounds absent from series, `total` absent.
  - `clock_is_minutes_after_noon` — 23:30 → 690, 00:30 → 750.
  - `sleep_is_night_from_previous_bedtime` — bedtime 22:00 on D−1, wake 04:00 on D → 360 on D; missing bedtime → no value.
- [ ] **Step 2: Run** `npm test -- overview/series` → FAIL.
- [ ] **Step 3: Implement.** Sleep via `scalar(resolve(sleepSource(sleep), cob, l), null)`. `total` = sum of Duration practices on days that have ≥1 Int or Duration value (empties as 0 by the same rule).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(insights): overview rows and daily values`.

### Task 4: Usual range, now, word (`usual.ts`)

**Files:**
- Create: `app-react/src/features/insights/overview/usual.ts`, `usual.test.ts`

**Interfaces:**
- Consumes: `Series`, `InsightRow` (Task 3); `MarkedPeriod` (Task 2).
- Produces:
  - `interface Usual { median: number; p25: number; p75: number; n: number }`
  - `leftOutDays(periods: MarkedPeriod[], todayCob: string): Set<string>` — days of periods with `exclude_from_usual`; an open period runs to today.
  - `usualAt(series: Series, cob: string, leftOut: Set<string>): Usual | null` — as if `cob` were today. Walk back from `cob − 7` one calendar day at a time, skipping left-out days, until 90 non-left-out days are collected or `cob − 365` is passed; take the values present; `null` below `MIN_USUAL = 14`. Percentiles by linear interpolation between closest ranks.
  - `nowValue(series, todayCob, leftOut): number | null` — mean over `today−6..today` excluding left-out days; null below 3 values.
  - `periodValue(series, p: MarkedPeriod, todayCob): number | null` — mean over the period's days up to today; null with none.
  - `type Word = 'usual' | 'above' | 'below' | 'earlier' | 'later'`
  - `wordFor(now: number, u: Usual, kind: RowKind): Word` — within `[p25 − m, p75 + m]` with `m = max(0.15 × (p75 − p25), 1)` is `usual`; Clock below is `earlier`, above `later`.
  - `withinUsual(v, u): boolean` (same margin; reused by Task 11)
  - `interface NormalRow { row: InsightRow; now: number | null; usual: Usual | null; word: Word | null; hollow: { period: MarkedPeriod; value: number } | null; recentDays: number }`
  - `meVsNormal(rows, series: Map<string, Series>, periods, todayCob): NormalRow[]` — `hollow` is the most recent marked period that ended within 30 days, or (when `now` is null because left-out days ate the week) the current left-out period; `word` only with both `now` and `usual`; `recentDays` = logged days in the last 7, for "2 of the last 7 days logged".
  - `isRegular(normal: NormalRow[], logged: string[], todayCob): boolean` — ≥1 row with `usual` and ≥3 logged days in the last 14.

- [ ] **Step 1: Failing tests:** `usual_needs_14_days`; `usual_skips_last_7_days`; `left_out_days_are_skipped_and_window_reaches_back` (a 30-day left-out period inside the window → the window starts 30 days earlier; values in the period don't move the median); `window_stops_at_a_year`; `now_needs_3_values` (2 values → null); `ongoing_left_out_week_gives_hollow_not_word`; `recent_period_shows_hollow_for_30_days` (ended 30 days ago yes, 31 no); `near_edge_is_usual` (p75=16, now=16.2 → usual); `clock_earlier_and_later`; `midnight_wrap_median` (bedtimes 23:30/00:30 alternate → median ≈ 720 i.e. 00:00); `regular_vs_less_regular` (fixtures: 4 practices with 20 logged days → regular; 8 logged days → less regular; exactly one row with a range → regular with that one strip).
- [ ] **Step 2: Run** → FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(insights): usual range and me vs my normal`.

### Task 5: Suggestions, streaks, welcome back, prefs

**Files:**
- Create: `app-react/src/features/insights/overview/{suggest,streaks,prefs}.ts` with tests

**Interfaces:**
- Produces:
  - `interface Suggestion { start: string; rows: string[] }` (row keys, in row order)
  - `detectChange(series: Map<string, Series>, rows: InsightRow[], logged: string[], periods: MarkedPeriod[], dismissed: string[], todayCob): Suggestion | null`
  - `runs(logged: string[], todayCob): { current: Run | null; longest: Run | null }`, `interface Run { start: string; end: string; length: number }` — `current` ends today or yesterday; `longest` is this calendar year's.
  - `welcomeBack(logged, todayCob): boolean`
  - `monthCount(logged, month: string /* yyyy-mm */): number`
  - `interface InsightPrefs { streaks: boolean; suggest: boolean; sleep: SleepRows | 'skip' | null; dismissed: string[]; openAsked: Record<string, string> }` — defaults `{ streaks: false, suggest: true, sleep: null, dismissed: [], openAsked: {} }`
  - `useInsightPrefs(): [InsightPrefs, (patch: Partial<InsightPrefs>) => void]` — reads/writes `localStorage['sadhana.insights']`; a `useSyncExternalStore` over a module-level listener set so Settings and Overview stay in step in one tab.
  - `openPeriodToAsk(periods, openAsked, todayCob): MarkedPeriod | null` — an ongoing period with `start ≤ today − 30`, and either never asked or asked ≥ 30 days ago.

Detector algorithm (spec's numbers; thresholds are tunable constants at the top of `suggest.ts`):

```
needs logged.length >= 45 (counting from the 45th logged day on)
for each day d in today−30 .. today:
  for each row: recent = values in d−4..d (need ≥3); base = values in d−60..d−5 (need ≥14)
                out if median(recent) < P10(base) or > P90(base)
  d is flagged when ≥2 rows are out
runs of ≥3 consecutive flagged days; take the latest run whose last day ≥ today−14
start = first flagged day − 4; drop it if any of its days is inside a marked period or start ∈ dismissed
rows = union of rows out on any day of the run
```

- [ ] **Step 1: Failing tests:** `quiet_on_flat_series` (180 days of noise ±1 around 16 rounds, wake 4:20 ±5m → null); `fires_on_synthetic_shift` (from day −10 wake-up 1h earlier and rounds +8 → start within 2 days of the shift, rows = wake, rounds); `one_row_moving_is_quiet`; `needs_45_logged_days`; `not_inside_marked_period`; `dismissed_start_stays_quiet`; `current_run_survives_today_unlogged`; `longest_run_this_year`; `welcome_back_after_3_day_gap` (gap of 2 → false; logged today after 3 empty days → true); `prefs_default_and_round_trip` (blocked `localStorage` → defaults, no throw); `open_period_asked_every_30_days`.
- [ ] **Step 2–4:** run FAIL, implement, run PASS.
- [ ] **Step 5: Commit** `feat(insights): change suggestions, streaks and per-device prefs`.

### Task 6: `useOverview` hook

**Files:**
- Create: `app-react/src/features/insights/overview/useOverview.ts`, `useOverview.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–5; `chartsApi.getReportData`, `practicesApi.getUserPractices`, `REPORTS_KEY`/`chartsApi.getReports`; `sleepRowsFor` (`panels/templates.ts`).
- Produces `useOverview()` returning:
  `{ isLoading; isError; todayCob; rows: InsightRow[]; series: Map<string, Series>; logged: string[]; normal: NormalRow[]; regular: boolean; suggestion: Suggestion | null; openPeriod: MarkedPeriod | null; periods: MarkedPeriod[]; askSleep: boolean; timePractices: UserPractice[]; prefs; setPrefs }`
- Data: one query, key `['report-data', todayCob, 'Year']` (shared with `useInsights`, so it's persisted and opens offline).
- Sleep: `prefs.sleep` when it's `SleepRows` and both practices are still active Time practices; `'skip'` → none; otherwise `sleepRowsFor(reports, practices)`; otherwise `askSleep = true` when the user has ≥2 active Time practices. A stored choice that's no longer valid is treated as `null` (asks again).
- `suggestion` is null when `prefs.suggest` is off.

- [ ] **Step 1: Failing tests** (render with a `QueryClient`, mocked APIs): `uses_sleep_report_practices`; `asks_when_no_match`; `stored_choice_wins`; `stale_choice_asks_again` (stored bedtime id no longer in practices → `askSleep` true, no `sleep` row); `skip_hides_sleep_without_asking`; `no_time_practices_no_sleep_no_ask`; `suggestion_off_by_pref`.
- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: Commit** `feat(insights): overview data hook`.

### Task 7: Overview cards and the mobile Overview

**Files:**
- Create in `app-react/src/features/insights/overview/`: `MeVsNormal.tsx` (props `{ normal: NormalRow[]; variant: 'stacked' | 'columns' }`), `SuggestionCard.tsx`, `OpenPeriodCard.tsx`, `SleepSetupSheet.tsx`, `LessRegular.tsx` (Days practised grid, streaks, "On days you practise"), `WelcomeBack.tsx`, `OverviewLinks.tsx` (Year map, Rhythm fingerprint rows), `PeriodSheet.tsx` (new/edit period; used here and in Task 9), `format.ts` (`rowValueText(kind, v, units)`, `rowName(row, practices, t)`), `Overview.test.tsx`
- Modify: `features/insights/mobile/InsightsMobile.tsx` (segment), `features/insights/locales.test.ts` if it lists namespaces; `src/i18n/*` locale files (`insights.overview.*`)

**Interfaces:**
- Consumes: `useOverview` (Task 6), `useSavePeriod` (Task 2), `BottomSheet`, `SegmentedControl`, `monthCells` (`panels/panelLogic.ts`).
- Produces: `OverviewMobile()`; `PeriodSheet({ period?: MarkedPeriod; prefill?: Partial<MarkedPeriodForm>; onClose })`.

Layout and copy per 16m1, 16m3, 16m10, 16m12, 16m14, 16m15:
- Insights gets a `SegmentedControl` **Overview | Charts** under the title. It always opens on Overview (state, not stored). Charts shows today's screen unchanged, with its report menu.
- Regular view order: suggestion → open-period prompt → welcome back → Me vs my normal → Before/during/after cards (Task 12) → Year map / Rhythm links (Task 14).
- Me vs my normal row: name (Sleep has a "calculated" tag), now value, "Usual {median} · {p25}–{p75}", a strip with the P25–P75 band, a filled dot for now, a hollow dot for `hollow`, and the word. Not-enough row: "—" and "Not enough recent days · {n} of the last 7 days logged", no dot or word. No-range row: value only, "No usual range yet · appears after 14 logged days". Dot colours `--ui-chart-5` (teal) / `--ui-chart-6` (orange) by direction; usual dot `--ui-ink`.
- Suggestion: "Something changed around {date}. Want to name it?", "{rows} all moved that week.", **Mark this period** (opens `PeriodSheet` prefilled `start`, `end: null`) and **Not now** (adds `start` to `prefs.dismissed`).
- Open period: "Is {name} still going?", "Started {date}, {n} days ago.", **Yes** (sets `openAsked[id] = today`) and **It ended on…** (opens `PeriodSheet` on that period with End focused).
- Sleep sheet: two pickers over active Time practices, **Save** (stores `prefs.sleep`), **Skip for now** (stores `'skip'`).
- Less regular view: welcome-back line "Good to see you back. You've logged {n} days this month, {d} more than last month." (omit the comparison when not more); Days practised month grid with this month's count; streaks block only when `prefs.streaks`; "On days you practise" plain averages over logged days in the last 90; "Me vs my normal shows up once you've logged 14 days. {n} so far."
- `PeriodSheet`: Name (hint "Any name you like. Only you see it."), Start, End (`<input type="date">`; empty = "Still going"), toggle "Leave out of my usual range" (on by default), **Save period**; edit mode adds **Delete**. Save errors show the normal error line and keep the sheet open.

- [ ] **Step 1: Failing tests** (`Overview.test.tsx`, mocked `useOverview` data built from `fixtures.ts`): `regular_view_shows_rows_and_words`; `thin_week_shows_no_word`; `less_regular_view_for_8_days` (Days practised count 8, averages, "8 so far"); `streaks_hidden_by_default_shown_when_on`; `not_now_dismisses`; `mark_this_period_prefills_start`; `sleep_sheet_save_and_skip`; `period_sheet_validates_name_and_dates` (Save disabled for blank name or end < start); `opens_on_overview_and_switches_to_charts`.
- [ ] **Step 2: Run** `npm test -- overview` → FAIL. **Step 3:** implement, with en/ru/uk strings. **Step 4:** PASS, plus `npm test -- locales`.
- [ ] **Step 5: Commit** `feat(insights): Overview on mobile`.

### Task 8: Tablet and desktop Overview

**Files:**
- Modify: `features/insights/tablet/InsightsTablet.tsx` (used by desktop too), its test, `desktop/InsightsDesktop.test.tsx`

Per 16t1/16d1: the same Overview | Charts segment under the title; Me vs my normal uses `variant="columns"` (one line per row: name, Now, Usual, strip, word); cards sit in a two-column grid below it on tablet and desktop; desktop keeps the log panel beside Insights.

- [ ] **Step 1: Failing tests:** each layout renders Overview by default with a `columns` Me vs my normal; switching to Charts shows the existing report menu.
- [ ] **Step 2–4:** FAIL, implement, PASS. **Step 5: Commit** `feat(insights): Overview on tablet and desktop`.

### Task 9: Settings › Insights

**Files:**
- Modify: `features/settings/SettingsLists.tsx` (`ChartsSettings` is the Insights settings page; add an "Insights" section above the charts list), its test
- Create: `features/settings/MarkedPeriods.tsx` (route `/settings/periods`, `ui()`), test
- Modify: `router.tsx`, `features/settings/SettingsDetail.tsx` only if the hub's Insights count should stay charts-only (leave it)

Per 16m9 and 16m13:
- Insights section rows: **Show streaks** toggle (hint "Adds plain run lengths, like “3 days in a row”, under Days practised. Off by default."), **Suggest periods to mark** toggle, **Bedtime and wake-up** (value "{bedtime} · {wake}" or "Off"; opens `SleepSetupSheet`), **Marked periods** (count; links to `/settings/periods`).
- Marked periods page: intro copy, the open-period prompt, "Your periods" list (name, "In progress" chip for open ones, dates, "Left out of usual range" / "Counted in usual range"), **+ New period**; tapping a period opens `PeriodSheet` in edit mode. Footer: "Leaving a period out keeps an unusual stretch from moving what counts as your normal." Before/during/after for a period is linked from its row once Task 12 lands.

- [ ] **Step 1: Failing tests:** `toggles_write_prefs`; `periods_list_shows_status_and_usual_flag`; `new_period_posts_and_refreshes`; `delete_period`; `save_error_keeps_sheet_open`.
- [ ] **Step 2–4:** FAIL, implement, PASS. **Step 5: Commit** `feat(settings): Insights settings and marked periods`.

### Task 10: Marked periods as bands on charts

**Files:**
- Create: `features/insights/periodBands.ts` (+ test)
- Modify: `features/insights/mobile/InsightsChart.tsx`, `features/insights/panels/ChartPanelView.tsx`, `features/insights/panels/GapsPanelView.tsx`, and the three Insights screens that render them (pass `periods` from `useMarkedPeriods`). Not on `/shared` pages: those pass no periods.

**Interfaces:**
- Produces `periodBands(periods: MarkedPeriod[], days: string[], todayCob): { x1: string; x2: string; name: string }[]` — periods clipped to the chart's first..last day; an open period runs to the last day; none outside the window.
- Draw each with Recharts `<ReferenceArea x1 x2 fill="var(--ui-chip)" fillOpacity={0.6} label={{ value: name, position: 'insideTopLeft' }} ifOverflow="hidden" />` behind the series, plus a "Marked period" legend swatch when any band shows (16m11).

- [ ] **Step 1: Failing tests:** `clips_to_window`; `open_period_runs_to_last_day`; `outside_window_dropped`; a `PanelsReportView` render test asserts the band's name appears and a shared render shows none.
- [ ] **Step 2–4:** FAIL, implement, PASS. **Step 5: Commit** `feat(insights): marked periods as chart bands`.

## Phase 2 — Before, during, after

### Task 11: `bda.ts` logic

**Files:**
- Create: `app-react/src/features/insights/overview/bda.ts`, `bda.test.ts`

**Interfaces:**
- Consumes: `usualAt`, `withinUsual`, `leftOutDays` (Task 4).
- Produces:
  - `type Chip = { kind: 'progress' } | { kind: 'settling' } | { kind: 'back'; days: number } | { kind: 'different' }`
  - `interface BdaRow { row: InsightRow; before: number | null; during: number | null; after: number | null; chip: Chip | null }`
  - `interface Bda { period: MarkedPeriod; rows: BdaRow[]; chip: Chip | null; overlaps: MarkedPeriod[] }`
  - `beforeDuringAfter(period, rows, series, periods, todayCob): Bda`
  - `cardPeriods(periods, todayCob): MarkedPeriod[]` — periods of ≥3 days (open ones counted to today) from their start until 30 days after their end, newest first.
  - `movingAverage(s: Series, from: string, to: string): Map<string, number | null>` (7-day mean, needs 3) and `changedMost(bda): string` (row key with the largest `|during − before| / (p75 − p25)`), for Task 12's chart.

Rules:
- `before` = `usualAt(series, period.start, leftOut)` median, where `leftOut` excludes this period itself; frozen for the chip.
- `during` = mean over the period's days to today. `after` = mean over `end+1 .. min(end+28, today)`.
- Row chip: open period or `end ≥ today` → progress. Otherwise, for each day `e` from `end+1` to today, average the values in `max(e−6, end+1) .. e`; fewer than 3 values → not evaluated (skip, don't reset). Within the frozen usual (`withinUsual`) extends the stretch, outside resets it. The first stretch reaching 14 evaluated days → `back`, `days` = first day of that stretch − end. None, and `today − end > 30` → `different`; else `settling`. A row with no usual at the start → `chip: null`.
- Card chip: `progress` if open; else `different` if any row is, else `settling` if any, else `back` with the largest `days`; null when every row's chip is null.
- `overlaps`: other periods sharing at least one day.

- [ ] **Step 1: Failing tests:** `in_progress_while_open`; `settling_then_back_after_n_days` (synthetic: back inside from day end+5, steady → `back` 5 once 14 days pass, `settling` before); `different_after_30_days` and `different_turns_back_later` (N > 30); `logging_gap_neither_counts_nor_breaks` (5 empty days inside the stretch still reach 14 evaluated days); `outside_day_resets_stretch`; `baseline_frozen_at_start` (a usual that drifts after the end doesn't make it "back"); `card_chip_is_least_settled`; `no_range_rows_ignored_and_no_chip`; `single_day_period_has_no_card`; `card_shown_until_30_days_after_end`; `overlaps_named`.
- [ ] **Step 2–4:** FAIL, implement, PASS. **Step 5: Commit** `feat(insights): before, during, after logic`.

### Task 12: Before/during/after cards and detail

**Files:**
- Create: `features/insights/overview/BdaCard.tsx`, `features/insights/overview/PeriodDetail.tsx` (route `/insights/period/:id`, `ui()`), tests
- Modify: the three Overview layouts (insert cards), `features/settings/MarkedPeriods.tsx` (each period links to its detail), `router.tsx`

Per 16m1 and 16m4–6:
- Card: name, dates, chip, "Overlaps: {names}", **Open**; a Before/During/After mini-table of the 3 rows with the largest change.
- Detail: name, "{dates} · {n} days", chip and overlaps; a row picker (chips per row, default `changedMost`); a chart of the row's 7-day average over the past year with the moving usual band (`usualAt` for each day: P25–P75 as a Recharts `Area` range, median as a dashed line) and every marked period as a band (Task 10); then "Each row" with before → during → after and the row chip. Footnote: "Before is your usual when the period started. After is up to 4 weeks from the day it ended." Chip copy: "In progress", "Still settling", "Back to usual after {n} days", "Still different".
- Data: Year data; when `period.start` is before `today − 365 + 97`, also query `AllData` (key `['report-data', todayCob, 'AllData']`) and use it.

- [ ] **Step 1: Failing tests:** card shows for a recent period and not for a single-day one; detail picker defaults to the most-changed row; an old period triggers the `AllData` request.
- [ ] **Step 2–4:** FAIL, implement, PASS. **Step 5: Commit** `feat(insights): before, during, after cards and detail`.

## Phase 3 — Year map and fingerprint

### Task 13: `yearMap.ts` and `fingerprint.ts`

**Files:**
- Create: `app-react/src/features/insights/overview/{yearMap,fingerprint}.ts` with tests
- Modify: `panels/gapLogic.ts` — export `stepOf` (z thresholds 0.3/0.6/1) for reuse

**Interfaces:**
- Produces:
  - `weekStarts(n: 26 | 52, todayCob): string[]` — Mondays, oldest first, the last one this week's.
  - `interface MapCell { week: string; mean: number | null; days: number; step: Step }`
  - `yearMap(rows, series, n, todayCob): { row: InsightRow; median: number | null; cells: MapCell[] }[]` — weekly mean of logged days; `median` and MAD across that row's non-empty weekly means; `step` = 0 when MAD is 0, else `k = (mean − median) / MAD` with steps at |k| ≥ 0.5 / 1.5 / 3, sign inverted for Clock (earlier is +). A week with no logged days has `mean: null`.
  - `fingerprintRows(practices): InsightRow[]` — Int practices and each Duration practice (no Time, Sleep or Total).
  - `fingerprint(rows, series, periods, todayCob): { row; typical: number; days: { avg: number | null; step: Step }[] }[] | null` — last 180 days skipping left-out days; Monday first; `typical` = mean of all values; `step = stepOf((avg − typical) / sd)`; null until the logged days span ≥ 8 distinct weeks.

- [ ] **Step 1: Failing tests:** `weeks_run_monday_to_sunday_across_new_year_and_dst` (every day of the span lands in exactly one week); `empty_week_is_blank`; `steps_scale_by_mad`; `clock_earlier_is_positive`; `fingerprint_needs_8_weeks`; `fingerprint_skips_left_out_days`; `fingerprint_has_no_time_rows`.
- [ ] **Step 2–4:** FAIL, implement, PASS. **Step 5: Commit** `feat(insights): year map and rhythm fingerprint logic`.

### Task 14: Year map and fingerprint screens

**Files:**
- Create: `features/insights/overview/YearMap.tsx` (route `/insights/year`), `Rhythm.tsx` (route `/insights/rhythm`), tests
- Modify: `router.tsx`, `OverviewLinks.tsx` (Task 7) to link them

Per 16m7, 16m8, 16t3, 16d3:
- Year map: 26 weeks on mobile, 52 on tablet/desktop (`useLayout()`); month labels over the columns; marked periods as named bars along the top; cells tinted `--ui-div-*`; tap/hover a cell for a popover "Week of {date} · {n} of 7 days", "{row}", "avg {v} · usual {median}", "{word} · {k} of 3 steps", "In {period names}". Legend: "Earlier · above", "Later · below", "No days logged". Mobile footnote: "Turn the phone or open on a larger screen for 52 weeks."
- Rhythm: Mon–Sun columns, each row "typical {v}" and seven averages tinted by step; legend Above / Below / No days logged; footnote "Rows come from your number and duration practices." Before 8 weeks: "Your rhythm shows up after 8 weeks of entries."
- Both are reached from the Overview links, not the report menu.

- [ ] **Step 1: Failing tests:** mobile renders 26 columns and tablet 52; a cell's popover shows its numbers; rhythm shows the not-yet message for a 3-week history.
- [ ] **Step 2–4:** FAIL, implement, PASS. **Step 5: Commit** `feat(insights): year map and rhythm fingerprint screens`.

### Task 15: Branch verification

- [ ] `make lint` (clippy + `npm run lint`) clean.
- [ ] `make test` in the container and `npm test` (Node 22) all pass.
- [ ] `make run`, then check Overview, Settings › Insights, a period detail, Year map and Rhythm on mobile, tablet and desktop widths, light and dark, in en and ru.
- [ ] Note for deploy: the `marked_periods` migration must be applied explicitly on prod before this build goes out.
