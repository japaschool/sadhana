# Days Between Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Days between events report template. It shows how long passes between events of one Bool or Text practice, and how up to 4 other rows look on the days around those events.

**Architecture:** There are two new generic panel kinds in the `panels` format. `Gaps` draws the gap figures and one mark per event, split by dropdown option. `Around` draws the days-around table. A `Gaps` template variant builds them. The server returns these reports only to owner clients that ask for `panels=3`, and never through `/share`. All values are calculated on the client from the existing report data, in a new pure module `gapLogic.ts`.

**Tech Stack:** Rust (actix-web, serde, Diesel tests on a real Postgres), React + TypeScript, Recharts, Vitest, i18next (en/ru/uk).

**Spec:** `docs/superpowers/specs/2026-11-01-personal-insights-design.md`, section "Days between events" (phase 4), plus "Shared definitions" (Colour, Direction, Time values) and "How this fits report templates". The form follows `docs/superpowers/specs/2026-10-31-report-templates-design.md`.

**Mockups:** the New chart sheet entry in `Report Templates.dc.html` reads "Days between events / How long between events, and the days around them". The report's own artboards are past the design tool's 256 KB read limit. Lay the report out like the existing templates: figure tiles, then the chart, then the table.

## Global Constraints

- Older cached clients must not break. A client that sends `panels=true` (with or without `months=true`) never receives a report holding a `Gaps` or `Around` panel. The owner's `GET /reports` returns those reports only when `panels` is 3 or more. `panels` is a minimum level: `true` means 1, and a missing value means 0. Level 2 is reserved for Goals (`2026-11-02-goals-design.md`).
- `GET /share/{id}/reports` never returns a report with a `Gaps` or `Around` panel, whatever level it asks for.
- An event is a true Bool or a non-empty Text. A dropdown practice (non-empty `dropdown_variants`, parsed with `parseOptions`) splits by option.
- Inputs: one event practice (Bool or Text), plus 0–4 compare rows. Each row is an Int, Duration or Time practice, or calculated Sleep.
- Typical gap (the median) needs 5 events. The days-around table needs 10 events of the selected option. Below that, say how many more are needed.
- A cell is coloured only when it's at least 0.3 standard deviations from usual. Teal means above usual, or earlier for Time and Sleep times. No red or green.
- Wording stays factual: "around", never "after" or "because of". No predictions.
- Durations use `formatDuration` (`6h 14m`). Local `yyyy-mm-dd` dates only, never `toISOString()`.
- Skip marked-period bands on the chart: marked periods don't exist yet (spec phase 1). Phase 1 adds them to every panels chart, this one included.
- Every new string goes in en, ru and uk, and `locales.test.ts` must pass.
- Don't hand-edit `server/src/schema.rs`. No migration is needed: the definition is JSON in `reports.definition`.
- Run Rust from the dev container: `docker exec <container> bash -lc 'cd /workspaces/sadhana-pro && make test T=report'`. Run `npm test` with Node 22, never the host's Node 26.

## Review Focus

1. **An event logged in the previous window:** the first event in the window must measure its gap from an event in `previous` data, not show "no gap". With range All there is no previous window, so the first event has `gap: null`. Pinned in Task 3.
2. **A dropdown value no longer in `dropdown_variants`:** it still counts as an event, under its own text as the option, and is listed after the current options. Pinned in Task 3.
3. **A Time compare row around midnight:** bedtimes of 23:30 and 00:30 must average to about 00:00, not noon. Pinned in Task 3.
4. **Today in the table:** an Int or Duration value logged today is left out, because the day isn't over. Time and Sleep values logged today count. Pinned in Task 3.
5. **The event practice retyped to Int, or deleted:** the report shows the missing-practice card instead of drawing a guessed value. Pinned in Task 4.

---

### Task 1: Server format, levels and privacy

**Files:**
- Modify: `server/src/app/report/panels.rs`
- Modify: `server/src/app/report/mod.rs` (`Report::get_all`, `ReportsQuery`)
- Modify: `server/src/app/shared.rs:56-70` (`get_shared_reports`)
- Modify: `server/src/app/report/db.rs` (callers of `ApiReport::get_all` in tests; new tests)

**Interfaces:**
- Produces (JSON shapes the client mirrors in Task 2):
  - `Template::Gaps(GapsTemplate { event: Uuid, rows: Vec<Uuid>, sleep: Option<SleepRows> })`
  - `SleepRows { bedtime: Uuid, wake: Uuid, nap: Option<Uuid> }`
  - `Panel::Gaps { event: Uuid }`, `Panel::Around { event: Uuid, rows: Vec<AroundRow> }`
  - `AroundRow { label: Option<Label>, source: Source }`
  - `pub const MAX_AROUND_ROWS: usize = 4`
  - `PanelsReport::level(&self) -> u8`: 3 if any panel is `Gaps` or `Around`, otherwise 1.
  - `Report::get_all(conn, user_id, level: u8, months: bool, shared: bool)`

- [ ] **Step 1: Write the failing tests** in `db.rs`'s test module. Add a `gaps_report(event, rows)` helper beside `days_report`: template `Gaps`, panels `[Gaps { event }, Around { event, rows: rows as AroundRow { label: None, source: Practice } }]`.

```rust
#[test]
fn gaps_report_needs_level_3() {
    // create a Sleep report "s" and a gaps report "g"
    assert_eq!(names(ApiReport::get_all(conn, &u, 1, true, false)?), ["s"]); // panels=true, months=true
    assert_eq!(names(ApiReport::get_all(conn, &u, 3, true, false)?), ["g", "s"]);
}
#[test]
fn shared_never_gets_gaps() {
    assert_eq!(names(ApiReport::get_all(conn, &u, 3, true, true)?), ["s"]);
}
#[test]
fn gaps_round_trips() { /* create, read at level 3, definition equals the input */ }
#[test]
fn gaps_validate() {
    // 5 Around rows -> 422; template rows.len() + sleep (1) > 4 -> 422; an event practice of another user -> 422
}
```

In `mod.rs`, add a `#[cfg(test)]` test for the query:

```rust
#[test]
fn panels_query_is_a_level() {
    let q = |s| web::Query::<ReportsQuery>::from_query(s).unwrap().into_inner();
    assert_eq!(q("panels=true&months=true").panels, 1);
    assert_eq!(q("panels=3&months=true").panels, 3);
    assert_eq!(q("").panels, 0);
    assert_eq!(q("panels=false").panels, 0);
}
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `make test T=gaps` and `make test T=panels_query` in the container.
Expected: compile errors (no `Gaps` variant, `get_all` arity).

- [ ] **Step 3: Implement it**
  - `panels.rs`:
    - Add the types above, with the existing `#[serde(deny_unknown_fields)]`.
    - In `walk`, the `Gaps` template inserts `event`, `rows`, and the sleep ids. It rejects `rows.len() + sleep.is_some() as usize > MAX_AROUND_ROWS` with `invalid("Too many rows")`.
    - `Panel::Gaps` inserts `event`. `Panel::Around` rejects more than `MAX_AROUND_ROWS` rows the same way, then `collect`s each row source and inserts `event`.
    - Add `level()`.
  - `mod.rs`:
    - `ReportsQuery.panels: u8` uses `#[serde(default, deserialize_with = "level")]`. `level` reads a `String`: `"true"` → 1, `"false"` → 0, digits → that number, anything else → a serde error.
    - `get_all` passes `level > 0` to `DBReport::get_all`. It skips a panels report when `!months && p.has_month()`, when `p.level() > level`, or when `shared && p.level() >= 3`.
    - `get_reports` passes `shared: false`.
  - `shared.rs`: `get_shared_reports` passes `shared: true`.
  - Update the existing test calls: `false` → `0` and `true` → `1`, then add `, false`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `make test T=report` then `make lint` (clippy `-D warnings`).
Expected: all report tests pass, and clippy reports nothing.

- [ ] **Step 5: Commit**

```bash
git add server/src/app/report server/src/app/shared.rs
git commit -m "feat(reports): Gaps and Around panels, shown only at panels=3 and never shared"
```

---

### Task 2: Client types, request level and lookup text

**Files:**
- Modify: `app-react/src/api/charts.ts`
- Modify: `app-react/src/api/charts.test.ts:8-14`
- Modify: `app-react/src/features/insights/panels/panelLogic.ts` (`Lookup`, `makeLookup`)
- Test: `app-react/src/features/insights/panels/panelLogic.test.ts`

**Interfaces:**
- Produces:
  - `export interface SleepRows { bedtime: string; wake: string; nap: string | null }`
  - `export interface GapsTemplate { event: string; rows: string[]; sleep: SleepRows | null }`, added to `Template` as `{ Gaps: GapsTemplate }`
  - `export interface AroundRow { label: Label | null; source: Source }`
  - `Panel` gains `| { kind: 'Gaps'; event: string } | { kind: 'Around'; event: string; rows: AroundRow[] }`
  - `Lookup.text(practice: string, cob: string): string | null`: the trimmed raw Text value, or null when it's empty, not Text, or unavailable.
  - `Lookup.options(practice: string): string[]`: `parseOptions(dropdown_variants)`, or `[]`.

- [ ] **Step 1: Write the failing tests**
  - `charts.test.ts`: `getReports` asks `'/reports'` with `{ params: { panels: 3, months: true } }`. The shared call stays `{ panels: true, months: true }`.
  - `panelLogic.test.ts`, `describe('lookup text')`:
    - With practice `P('ev','Event','Text')` plus `dropdown_variants: 'Fast, Feast'`, an entry `{ Text: '  Fast ' }` gives `text('ev', cob) === 'Fast'`.
    - `{ Text: '' }` gives `null`.
    - An Int practice gives `null`.
    - `options('ev')` gives `['Fast', 'Feast']`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd app-react && npx vitest run src/api/charts.test.ts src/features/insights/panels/panelLogic.test.ts`
Expected: FAIL (`params` mismatch; `text` is not a function).

- [ ] **Step 3: Implement it.** Add the types, change the owner params to `panels: 3`, and add `text` and `options` to `makeLookup`. Read `text` from the same raw map as `textNumber`, accepting a string or `{ Text }`. TypeScript will then flag every `Panel` switch that misses the new kinds; Task 4 handles them.

- [ ] **Step 4: Run the tests and confirm they pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(insights): Gaps types, ask for panels level 3, lookup text and options"
```

---

### Task 3: Gap and days-around logic

**Files:**
- Create: `app-react/src/features/insights/panels/gapLogic.ts`
- Test: `app-react/src/features/insights/panels/gapLogic.test.ts`

**Interfaces:**
- Consumes: `Lookup` (Task 2), `resolve` and `scalar` from `panelLogic.ts`, `addDays`/`fromDateStr`/`toDateStr` from `today/date`.
- Produces:
  - `export interface GapEvent { cob: string; option: string | null; prev: string | null; gap: number | null }`. `gap` is the number of calendar days since the previous event of any option, and is null when there is none.
  - `export function gapEvents(event: string, days: string[], prevDays: string[], l: Lookup): GapEvent[]`. It returns only the events within `days`, oldest first, but it looks back through `prevDays` to measure the first gap. `option` is set only when `l.options(event).length > 0`.
  - `export function eventOptions(event: string, events: GapEvent[], l: Lookup): string[]`. This is `l.options(event)` that occur in `events`, in that order, then any other option texts seen, in order of first appearance.
  - `export const TYPICAL_MIN = 5`, `export const AROUND_MIN = 10`, `export const OFFSETS = [-1, 0, 1, 2] as const`
  - `export function gapFigures(events: GapEvent[]): { typical: number | null; longest: GapEvent | null; latest: GapEvent | null }`
    - `typical` is the median of the non-null gaps. It needs `events.length >= TYPICAL_MIN`. With an even count, it's the mean of the two middle gaps, rounded.
    - `longest` has the largest gap; on a tie, the later event wins.
    - `latest` is the last event that has a gap.
  - `export type RowKind = 'Count' | 'Duration' | 'Clock'`
  - `export function rowKind(source: Source, l: Lookup): RowKind | null`. A Practice source maps Int to Count, Duration to Duration, and Time to Clock. A Calc source maps to Duration. Anything else, or an unavailable practice, gives null.
  - `export interface AroundCell { value: number | null; step: -3 | -2 | -1 | 0 | 1 | 2 | 3 }`
  - `export interface AroundLine { row: AroundRow; kind: RowKind; usual: number | null; cells: AroundCell[] }`, with one cell per `OFFSETS` entry.
  - `export function aroundTable(rows: AroundRow[], events: GapEvent[], days: string[], l: Lookup, todayCob: string): AroundLine[]`

Rules for `aroundTable`. These are the decisions the tests pin.
- **Row values:** a row's value on a day is `scalar(resolve(source, cob, l), null)`. For a Clock row, convert minutes after midnight to minutes after noon: `((v - 720) % 1440 + 1440) % 1440`.
- **Skipped days:** null values are skipped and never read as 0. For Count and Duration rows, today and future days are skipped. For Clock and Duration-from-Calc (Sleep) rows, today counts, but future days don't.
- **Usual:** the mean of the row's values over `days`, with `sd` their population standard deviation. Fewer than 2 values gives `usual: null`, and every cell's `step` is 0.
- **Cell value:** the mean of the row's values at `event.cob + offset` across `events`. The caller passes only the events of the selected option.
- **Cell step:** `z = (value - usual) / sd`. If `|z| >= 1.0` the step is ±3, else if `|z| >= 0.6` it's ±2, else if `|z| >= 0.3` it's ±1, otherwise 0. The sign is `+` for above usual. For Clock rows it's flipped, so earlier is `+`, which is teal. `sd === 0` gives step 0. *(the spec leaves the steps above 0.3 to the builder)*
- ponytail: the spec's "empty Int counts as 0 when the day has other values" rule isn't applied here. A null is skipped, which can't turn a gap into a collapse. Add the rule when the Overview's shared value function exists.

- [ ] **Step 1: Write the failing tests** (`gapLogic.test.ts`), using the `P`/`e`/`makeLookup` fixtures as in `panelLogic.test.ts`:

```ts
it('measures each gap from the previous event, reaching into the previous window', () => {
  // Bool 'ev' true on 09-28 (prev window), 10-02, 10-05; false on 10-03
  expect(gapEvents('ev', oct, sept, l)).toEqual([
    { cob: '2026-10-02', option: null, prev: '2026-09-28', gap: 4 },
    { cob: '2026-10-05', option: null, prev: '2026-10-02', gap: 3 },
  ])
})
it('the first event with nothing before it has no gap', () => { /* prevDays = [] → first gap null */ })
it('a Text practice counts non-empty text; a dropdown sets the option', () => { /* '' is no event; 'Fast' → option 'Fast' */ })
it('lists current options first, then retired ones as seen', () => {
  // variants 'Fast, Feast', events Feast, Old, Fast → ['Fast', 'Feast', 'Old']
})
it('typical gap needs 5 events and takes the median', () => {
  // 5 events, gaps [null, 3, 5, 4, 10] → median of [3, 4, 5, 10] = 4.5 → typical 5; the first 4 events alone → null
})
it('longest prefers the later of equal gaps; latest is the last with a gap', () => {})
it('a Time row averages 23:30 and 00:30 to 00:00', () => {
  // two events, value on same day 23:30 and 00:30 → cell value === 720 (minutes after noon)
})
it('leaves out today for Int rows but keeps today for Time rows', () => {})
it('colours a cell only from 0.3 SD, earlier is + for Clock rows', () => {
  // Int row usual 10, sd 2: cell 10.5 → step 0; 10.6 → 1; 12 → 3; Time row earlier by 1 sd → +3
})
it('a row with fewer than 2 values has no usual and no colour', () => {})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd app-react && npx vitest run src/features/insights/panels/gapLogic.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `gapLogic.ts`** to the signatures and rules above. Count calendar days between dates with `fromDateStr` and a rounded millisecond difference divided by 86,400,000, so DST shifts don't cause off-by-one errors.

- [ ] **Step 4: Run the tests and confirm they pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/insights/panels/gapLogic*
git commit -m "feat(insights): gap and days-around logic"
```

---

### Task 4: Render Gaps and Around panels

**Files:**
- Modify: `app-react/src/ui/theme.css`: diverging tokens in the light block, the explicit dark block and the `prefers-color-scheme: dark` block, plus `--color-ui-div-*` entries in the Tailwind `@theme` list
- Modify: `app-react/src/features/insights/panels/panelLogic.ts` (`visiblePanels`, `panelSources`, `missingRequired`)
- Modify: `app-react/src/features/insights/panels/StatsPanelView.tsx`: extract the tile grid as `export function FigureGrid({ items, cols }: { items: { label: string; text: string; note?: string }[]; cols: 2 | 4 })` and use it in `StatsPanelView`, with no change to its output
- Create: `app-react/src/features/insights/panels/GapsPanelView.tsx`
- Create: `app-react/src/features/insights/panels/AroundPanelView.tsx`
- Modify: `app-react/src/features/insights/panels/PanelsReportView.tsx`
- Modify: `app-react/public/locales/{en,ru,uk}/translation.json` (`reportPanels.*`)
- Test: `app-react/src/features/insights/panels/panelLogic.test.ts`, `PanelsReportView.test.tsx`

**Interfaces:**
- Consumes: everything from Task 3, plus `AroundRow`/`Panel` from Task 2.
- Produces:
  - `GapsPanelView({ event, days, prevDays, lookup, todayCob, height, cols, interactive })`
  - `AroundPanelView({ event, rows, days, prevDays, lookup, todayCob })`
  - CSS vars `--ui-div-p3 … --ui-div-0 … --ui-div-m3`, plus `--ui-on-div-p3`/`--ui-on-div-m3` for the text on step-3 cells. The values come from the mockup's "Diverging scale":
    - Light: `#0C7F78 #93D0C9 #DCEFEB #EEE8DE #F6E5D5 #E6B78E #A9622B`. The text on step 3 is `#FFFFFF`.
    - Dark: `#3FC2B8 #1F6B66 #1E3B3E #2C2738 #43302A #7E5230 #E59A5E`. The text on step 3 is `#15121D`.

Panel rules:
- **`visiblePanels`:** keeps `Gaps`/`Around` only when `event` is available as Bool or Text. For `Around`, it drops rows whose `rowKind` is null, and drops the panel when no rows remain.
- **`missingRequired`:** a required practice used as a `Gaps`/`Around` event that is no longer Bool or Text is missing.
- **`panelSources`:** includes the `Around` row sources.
- **Gaps panel content:**
  - `FigureGrid` with three tiles:
    - Typical gap: `{{count}} days`. Below 5 events it shows "—", with a note "Needs {{count}} events".
    - Longest gap: N days, with the note `{{from}} – {{to}}`.
    - Latest gap: N days, with the note `{{from}} – {{to}}`.
  - Under the tiles, a Recharts `ComposedChart` over `days`:
    - One `Bar` per option, stacked, with `var(--ui-chart-{i+1})` by index from `eventOptions`. A non-dropdown practice gets one bar in `--ui-chart-1`.
    - The bar's height is `gap` on an event day and null otherwise.
    - It reuses `AXIS`/`TICK`/`formatTick`, with an integer Y axis labelled in days.
    - A legend of options appears when there are 2 or more.
    - The tooltip (when `interactive`) shows the date, the option, and "{{count}} days since {{date}}".
  - With no events in the window: "No events in this range".
- **Around panel content:**
  - A title, "The days around it". When there are 2 or more options, a segmented switch picks the option; it defaults to the first option and lives in local state.
  - With fewer than `AROUND_MIN` events of that option, it shows only "{{count}} more events needed for this table" (plural forms).
  - Otherwise it shows a table:
    - Rows: the row label, or the practice name.
    - Columns: Day before, Same day, Next day, 2 days after, then Usual.
    - Each cell shows its value (Count to 1 decimal place, Duration via `formatDuration`, Clock via `clockText`), with the background `--ui-div-{p|m}{n}` or `--ui-div-0`.
    - Each cell's `title` and `aria-label` hold the value and the usual, so the tint is never the only signal.
  - A note: "Average on those days, against your usual over this range. Tinted when it's clearly different."
- **`PanelsReportView`:** renders `Gaps` with the first-chart height, and `Around` after it. It passes `prevDays`, and passes `cols` to `GapsPanelView`.

- [ ] **Step 1: Write the failing tests**
  - `panelLogic.test.ts`: `visiblePanels` drops a `Gaps` panel whose event is now Int. `missingRequired` reports that event. An `Around` panel with only a Bool row is dropped.
  - `PanelsReportView.test.tsx`, given a gaps report with a Bool event on 12 days of a 60-day window and one Int row:
    - The figures "Typical gap", "Longest gap" and "Latest gap" render.
    - The table has 4 day columns, and a cell's `aria-label` contains its usual.
    - With 6 events it shows "4 more events needed for this table".
    - With a dropdown event it shows an option switch, and choosing the second option changes the table's event count message or cells.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd app-react && npx vitest run src/features/insights/panels`
Expected: FAIL.

- [ ] **Step 3: Implement it** as above. Add the en/ru/uk strings under `reportPanels`: `typicalGap`, `longestGap`, `latestGap`, `gapDays_one/_other` (plus ru/uk `_few/_many`), `needsEvents`, `gapSince`, `noEvents`, `around`, `dayBefore`, `sameDay`, `nextDay`, `twoDaysAfter`, `usual`, `moreEvents_*`, `aroundNote`, `event`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd app-react && npx vitest run src/features/insights` and `npm run lint`
Expected: PASS, and no lint errors.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(insights): draw Gaps and Around panels"
```

---

### Task 5: The template, its form and the New chart sheet

**Files:**
- Modify: `app-react/src/features/insights/panels/templates.ts`
- Modify: `app-react/src/features/insights/panels/TemplateForm.tsx`
- Modify: `app-react/src/features/insights/panels/NewTemplateScreen.tsx:54`: `duration` is `'Year'` for `gaps`
- Modify: `app-react/src/features/insights/settings/mobile/NewChartSheet.tsx`: `TEMPLATES` gains `'gaps'` last
- Modify: `app-react/src/features/insights/ReportGlyph.tsx`: a `gaps` glyph, three dots at different heights on a baseline
- Modify: locales (`chartSettings.gaps`, `gapsDesc`, `gapsSubtitle`; `templateForm.gapsName`, `newGaps`, `readyGaps`, `needsGaps`, `event`, `hint_event`, `compare`, `compareHint`, `sleepCalculated`, `noneEvent`, following the `days` key set)
- Test: `templates.test.ts`, `TemplateForm.test.tsx`, `settings/mobile/ChartEditorMobile.test.tsx`

**Interfaces:**
- Consumes: the Task 2 types. `useReports()` supplies the Sleep report lookup.
- Produces:
  - `export function sleepSource(s: SleepRows): Source`, extracted from `sleepPanels`' `total` (nap optional). `sleepPanels` uses it, with no change to its output.
  - `export function gapsPanels(t: GapsTemplate): PanelsReport`, which builds:
    - `required: [{ practice: t.event, label: key('event') }]`
    - `panels: [{ kind: 'Gaps', event }, ...(rows.length ? [{ kind: 'Around', event, rows }] : [])]`
    - The rows are `t.rows` as `{ label: null, source: Practice }`, then the sleep row `{ label: key('sleep'), source: sleepSource(t.sleep) }`.
  - `templateSlug` returns `'gaps'` for `Gaps`.
  - `export const GAPS_EVENT_SLOT: Slot = { key: 'event', types: ['Bool', 'Text'], required: true, hints: [] }`. ponytail: there are no hints, so no Use suggestion, because no practice name says "event". Add hints if users ask.
  - `export const GAPS_ROWS_SLOT: Slot = { key: 'compare', types: ['Int', 'Duration', 'Time'], required: false, hints: [], many: true }`
  - `export const MAX_ROWS = 4`
  - `export function sleepRowsFor(reports: Report[], practices: UserPractice[]): SleepRows | null`
    - It takes the first Sleep template report (by name) whose bedtime and wake are still available Time practices.
    - Otherwise it takes `suggestFor(SLEEP_SLOTS[0])` and `suggestFor(SLEEP_SLOTS[1])` when both match, with no nap.
    - Otherwise null.
  - `TemplateDraft` gains `{ kind: 'Gaps'; event: string | null; rows: string[]; sleep: SleepRows | null }`, and `NEW_DRAFTS.gaps`.

Form behaviour:
- **Event slot:** a `SlotRow` for `GAPS_EVENT_SLOT`. `SlotRow` and `PracticeChecks` show each practice's own type icon (`p.data_type`) instead of `slot.types[0]`.
- **Compare checklist:** `PracticeChecks` for `GAPS_ROWS_SLOT`, which gains an `optional` prop (shows "Optional" and never flags missing). It also gains an `extra` row, "Sleep (calculated)", shown first when `sleepRowsFor` isn't null; ticking it stores those rows in `draft.sleep`.
- **Counting:** the count includes Sleep, and more than `MAX_ROWS` shows `tooMany`.
- **`draftProblem`:** no event → `'required'`; `rows.length + (sleep ? 1 : 0) > MAX_ROWS` → `'tooMany'`.
- **`draftOf`:**
  - It keeps the event only if it still fits, and filters `rows` to those that fit.
  - It keeps `sleep` only while bedtime and wake are available Time practices.
  - The event practice can't be the same as a compare row, because the types never overlap.

- [ ] **Step 1: Write the failing tests**
  - `templates.test.ts`:
    - `gapsPanels({ event: 'ev', rows: ['r'], sleep: { bedtime: 'b', wake: 'w', nap: null } })` has panels of kinds `['Gaps', 'Around']`, with the Around rows' second source equal to `sleepSource(...)`.
    - With `rows: [], sleep: null` there is only `['Gaps']`.
    - `templateSlug` gives `'gaps'`.
    - `sleepRowsFor` prefers the Sleep report's practices over name matches.
  - `TemplateForm.test.tsx`:
    - Create is blocked with no event.
    - Picking a Bool event and two Int rows builds the definition.
    - A fifth row (four rows plus Sleep) shows "A report can show up to 4 practices."
    - The Sleep row appears only when bedtime and wake can be found.
  - `ChartEditorMobile.test.tsx`: the new chart sheet lists `…/new/days` then `/settings/charts/new/gaps` last.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd app-react && npx vitest run src/features/insights`
Expected: FAIL.

- [ ] **Step 3: Implement it** as above. `draftToDefinition` maps `Gaps` to `{ Panels: gapsPanels({ event, rows, sleep }) }`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd app-react && npm test && npm run lint`
Expected: PASS, including `locales.test.ts`.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(insights): add the Days between events template"
```

---

### Task 6: Verification

- [ ] **Step 1: Run everything.** `make lint` and `make test` in the container, then `npm test` with Node 22. Expected: all green.
- [ ] **Step 2: Check it in the browser**, using the `run` skill or `make run`.
  - Create a Days between events report with a Bool event and Rounds, Wake-up and Sleep rows.
  - Check it on mobile, tablet and desktop widths, in light and dark.
  - Check that a shared link (`/share/{id}`) doesn't list it.
  - Check that `GET /api/reports?panels=true&months=true` leaves it out.
- [ ] **Step 3: Commit any fixes, then stop for a ship decision.** No migration is needed. Older cached builds keep working, because they never receive the report.
