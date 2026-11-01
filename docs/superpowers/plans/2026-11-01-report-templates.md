# Report Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sleep, Japa and Duration report templates: short forms that write a new generic "panels" report, drawn by one renderer on every layout and on shared pages.

**Architecture:** A `panels` report is stored as JSON in `reports.definition`. The form settings live in `template`, and saving regenerates `panels`, the only thing the renderer reads. All values are computed on the client from the existing report-data responses, so there is no new data endpoint. Panels reports are returned only with `?panels=true`, so older builds never see them.

**Tech Stack:** Rust, actix-web, Diesel, Postgres (jsonb), React, TypeScript, TanStack Query, Recharts 3, Vitest, i18next.

**Spec:** `docs/superpowers/specs/2026-10-31-report-templates-design.md`. Mockups: `Report Templates.dc.html` in design project `cccefa4d-5554-41b1-be47-2704b1233b68`, read with the `claude_design` MCP. Where the spec and the mock differ on layout or visuals, the mock wins. **Each UI task reads its listed frames before writing markup.** The file is 1.7 MB, so read it by line range.

**Scope:** Spec phases 1 (Tasks 1–8, shippable alone) and 2 (Tasks 9–10). Phase 3 gets its own spec.

## Global Constraints

- Branch from `main`, the live branch. `master` is stale, whatever tooling says.
- Older cached React builds must keep working: the default responses of `GET /reports` and `GET /share/{id}/reports` don't change.
- `InsightsChart`, `computeTimeOverflow` and existing Graph and Grid behaviour stay as they are. A report's position in the alphabetical list is the only change to existing reports.
- Don't hand-edit `server/src/schema.rs`; run `make gen_schema`.
- All strings in en/ru/uk. Units are spelled out in ru/uk, so figure values stay on one line and labels, chips and legends wrap.
- Dates are local `yyyy-mm-dd` (`toDateStr`, `addDays`, `fromDateStr` from `features/today/date`), never `toISOString()`.
- Theme colours are CSS vars in `src/ui/theme.css`. Portals go through `UiPortal`.
- JS tests: `cd app-react && npx -y -p node@22 node node_modules/vitest/vitest.mjs run <file>` (host Node 26 breaks jsdom).
- Server tests: `docker exec <dev-container> bash -lc 'cd /workspaces/sadhana-pro && make test T=report'`. They need Postgres and run with `--test-threads=1`.

## Review Focus

1. **A report whose practice was later deleted is edited.** Autosave sends the old id, which is no longer the user's. The save must succeed, or the form is stuck failing forever. (Task 2)
2. **A tester turns preview off.** The older build hydrates the IndexedDB query cache written by the newer one. It must not see Panels rows, because `tracesFor` would throw. (Task 3)
3. **A shared page viewed in another language.** Labels stored in `panels` must follow the viewer's language, not the creator's. (Tasks 1, 5)
4. **A limit typed as minimum above maximum, or a required practice left empty, while editing.** Sending it would 422 and retry forever. The form shows the problem and doesn't save. (Task 7)
5. **A practice's type is changed after the report was made** (Time to Int, say). It must read as missing and never give a guessed number. (Task 4)

## Rollout (read before deploying)

Stable and preview share one Postgres. Three facts follow from that:

- `report_type_enum` gets a value the current stable binary can't decode. One `panels` row makes that user's `GET /reports` and shared page return 500 on stable, whichever client calls it.
- The new binary selects `reports.definition`, so the column must exist first. Migrations are gated by `RUN_DB_MIGRATIONS`, which isn't set in `sadhana.env`.
- So the order is: apply the migration, deploy the Task 1–2 server to **stable**, and only then put the UI on preview. Rolling stable back past Task 1 requires deleting panels rows first.

---

## Phase 1

### Task 1: Storage and the report format

**Files:**
- Create: `migrations/2026-11-01-000000-0000_panels_reports/up.sql`, `down.sql`
- Create: `server/src/app/report/panels.rs`
- Modify: `server/src/db_types.rs`, `server/src/schema.rs` (generated), `server/src/app/report/mod.rs`, `server/src/app/report/db.rs`, `server/src/app/shared.rs`

**Interfaces:**
- Produces: the JSON contract below, which Task 3 mirrors in TypeScript; `ReportType::Panels`; `ReportDefinition::Panels(PanelsReport)`; `Report::get_all(conn, user_id, panels: bool)`; `ReportsQuery { panels: bool }`.

- [ ] **Step 1: Write the migration**

`up.sql`:
```sql
ALTER TYPE report_type_enum ADD VALUE 'panels';
ALTER TABLE reports ADD COLUMN definition jsonb;
```
`ADD VALUE` works in Diesel's migration transaction on PG12+ as long as nothing uses the value in that transaction. `down.sql` deletes `panels` rows, drops the column, and recreates the enum without the value (rename old, create new, `ALTER COLUMN report_type TYPE ... USING report_type::text::report_type_enum`, drop old).

- [ ] **Step 2: Run the migration and regenerate the schema**

Run: `make migrate && make gen_schema`
Expected: `reports` gains `definition -> Nullable<Jsonb>`.

- [ ] **Step 3: Write failing tests in `report/db.rs` `tests`**

- `panels_round_trips`: create a Sleep `PanelsReport`, `get_all(.., true)` returns an equal definition with no `report_traces` rows and a null `bar_layout`.
- `default_read_hides_panels`: with one Grid and one panels report, `get_all(.., false)` returns only the Grid and `get_all(.., true)` returns both.
- `panels_rejects_unknown_field`: `serde_json::from_value::<PanelsReport>` of a valid JSON value with an extra key in a series returns `Err`.

Derive `PartialEq` on the format types for the assertion.

- [ ] **Step 4: Run them to verify they fail**

Run: `make test T=panels`
Expected: compile failure, no `PanelsReport`.

- [ ] **Step 5: Implement the format in `panels.rs`**

Every struct and enum gets `#[serde(deny_unknown_fields)]`. Field names are final; the shapes below are the contract.

```rust
pub struct PanelsReport { pub version: u32, pub template: Option<Template>,
    /// Practices the report can't work without. `label` names the form field for the missing-practice message.
    pub required: Vec<Required>, pub panels: Vec<Panel> }
pub struct Required { pub practice: Uuid, pub label: Label }

pub enum Template { Sleep(SleepTemplate) }            // Japa, Duration: Tasks 9, 10
pub struct SleepTemplate { pub bedtime: Uuid, pub wake: Uuid, pub nap: Option<Uuid>, pub min: Option<i32>, pub max: Option<i32> }

/// Key: translated at display, so shared pages follow the viewer's language. Text: a user's own words.
pub enum Label { Key(String), Text(String) }

#[serde(tag = "kind")]
pub enum Panel { Stats { stats: Vec<Stat> }, Chart(ChartPanel) }

pub struct ChartPanel { pub title: Option<Label>, pub series: Vec<Series>, pub bar_layout: BarLayout,
    pub format: Format, pub reversed: bool, pub target: Option<Target>, pub lines: Vec<RefLine> }
pub struct Series { pub label: Option<Label>,            // None = the practice's name
    pub mark: Mark, pub source: Source, pub axis: Side,
    /// Index of a series this one is drawn beside: no value there, no value here (a nap on a night with no bar).
    pub only_with: Option<usize> }
pub enum Mark { Bar, Line, Dot, Range }
pub enum Side { Left, Right }
pub enum Format { Duration, Count, NoonClock }           // NoonClock: minutes after the noon before the night

pub enum Source { Practice { practice: Uuid }, Calc { terms: Vec<Term> }, Range { from: Ref, to: Ref } }
pub struct Ref { pub practice: Uuid, pub day_offset: i32 }
pub struct Term { pub sign: i8, pub practice: Uuid, pub day_offset: i32, pub optional: bool }

pub struct Target { pub min: Option<i32>, pub max: Option<i32>, pub of: Source, pub lines: bool, pub colour: bool, pub label: Option<Label> }
pub struct RefLine { pub of: Source, pub pick: Option<End>, pub dashed: bool }
pub enum End { From, To }

pub struct Stat { pub label: Label, pub value: StatValue, pub under: Option<Box<Stat>> }
pub enum StatValue {
    Average { of: Source, pick: Option<End>, format: Format, scope: Scope },
    OnTarget { of: Source, min: Option<i32>, max: Option<i32>, scope: Scope },
    Logged { of: Source, scope: Scope },
    CountTrue { of: Source, scope: Scope },
}
/// Sleep: today in, missing skipped. Japa and Duration: today out, missing counts as 0.
pub struct Scope { pub today: bool, pub missing_zero: bool }
```

Reuse `BarLayout` from `db_types`. Target `of` is a `Source` rather than the spec's `"stack"`, because the Sleep times chart colours by a total it doesn't draw. The spec leaves the JSON shape to the builder.

- [ ] **Step 6: Wire the storage**

- `ReportType::Panels` in `db_types.rs`. `ReportDefinition::Panels(PanelsReport)`, with `report_type`, `group_columns` (None), `bar_layout` (None) and a new `definition_json() -> Option<serde_json::Value>`.
- `db::Report` gains `definition: Option<serde_json::Value>`. `create` and `update` write it. `ReportTrace::update` maps Panels to an empty list.
- `get_all(conn, user_id, panels)` adds `.filter(reports::report_type.ne(ReportType::Panels))` when false, applied with `into_boxed()` or a branch.
- `get_reports` and `get_shared_reports` take `web::Query<ReportsQuery>`, where `#[derive(Deserialize)] pub struct ReportsQuery { #[serde(default)] pub panels: bool }`.

- [ ] **Step 7: Run tests**

Run: `make test T=report`
Expected: PASS, including every existing report test (update their `get_all` calls with `false`).

- [ ] **Step 8: Commit**

```bash
git add migrations server/src
git commit -m "feat(reports): store panels reports, returned only with panels=true"
```

### Task 2: Validation and ownership

`update_report` and `delete_report` currently take no user at all and filter by report id only. Any signed-in user can edit any report. The spec's ownership tests require closing this.

**Files:**
- Modify: `server/src/app/report/mod.rs`, `server/src/app/report/db.rs`, `server/src/app/report/panels.rs`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `PanelsReport::validate(&self, allowed: &HashSet<Uuid>) -> Result<(), AppError>`; `PanelsReport::practice_ids(&self) -> HashSet<Uuid>`; `DBReport::update(conn, user_id, report_id, name, definition)`; `DBReport::delete(conn, user_id, report_id)`.

- [ ] **Step 1: Write failing tests**

- `update_of_another_users_report_is_not_found` and `delete_of_another_users_report_is_not_found`: return `AppError::NotFound` and change nothing. Cover Grid and Panels.
- `put_cannot_change_type`: Grid to Panels and Panels to Graph give 422.
- `rejects_foreign_practice`, `rejects_negative_target`, `rejects_min_above_max`, `rejects_wrong_version`, `rejects_too_many_panels`, `rejects_too_many_series`, `rejects_oversized_definition`: each gives 422 on create. Check negative and `min > max` on `Target`, `OnTarget` and the template.
- `keeps_a_deleted_practice_already_in_the_report`: create a report referencing nap practice N, delete N, then update only `max`. The update succeeds. A *new* foreign id in the same update is still 422.

- [ ] **Step 2: Run them to verify they fail**

Run: `make test T=report`
Expected: compile errors or FAIL.

- [ ] **Step 3: Implement**

- Limits: `MAX_PANELS = 8`, `MAX_SERIES = 12`, `MAX_STATS = 8`, `MAX_TERMS = 16`, serialised definition ≤ 32 KiB, `version == 1`.
- Create: `allowed` = all of the user's practices, hidden included (`UserPractice::all_user_practices`).
- Update: `allowed` = the same, plus `practice_ids()` of the stored definition.
- Update first loads the stored row filtered by `id` and `user_id`. No row gives `NotFound`. A different `report_type` gives 422.
- `update_report` and `delete_report` get `req: HttpRequest` and use `auth::get_current_user`.
- Validate inside `web::block`, in the same transaction as the write.

- [ ] **Step 4: Run tests**

Run: `make test T=report`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
make lint
git add server/src
git commit -m "feat(reports): validate panels reports and check report ownership"
```

### Task 3: Client types, the report list and sorting

**Files:**
- Create: `app-react/src/features/insights/useReports.ts`, `useReports.test.tsx`
- Create: `app-react/src/features/insights/ReportGlyph.tsx`
- Modify: `app-react/src/api/charts.ts`, `chartLogic.ts`, `useInsights.ts`, `useChartEditor.ts`, `NewChartSheet.tsx`, `MoreMenu.tsx`, `ReportMenu.tsx`, `ChartEditorWide.tsx`, `features/settings/sections.tsx`, `SettingsLists.tsx`, `features/shared/parts.tsx`
- Test: `chartLogic.test.ts`, `useInsights.test.tsx`, `api/persister.test.ts`

**Frames:** 15m17.

**Interfaces:**
- Consumes: the Task 1 JSON contract.
- Produces, in `api/charts.ts`: TypeScript mirrors of every Task 1 type (same field names; Rust enums as `{ Variant: ... }` unions, `Panel` as `{ kind: 'Stats', stats } | { kind: 'Chart', ... }`), and `ReportDefinition` gaining `{ Panels: PanelsReport }`.
- Produces, in `useReports.ts` (not `api/charts.ts`, because existing tests `vi.mock` that module with only `chartsApi`):
  - `export const REPORTS_KEY = ['reports', 'panels'] as const`
  - `export function sortReports(list: Report[], locale: string): Report[]`
  - `export function useReports(): UseQueryResult<Report[]>`, sorted via `select`
  - `export const isPanels = (r: Report | null): r is Report & { definition: { Panels: PanelsReport } }`

- [ ] **Step 1: Write failing tests**

- `sortReports`: sorts across types by name, `['Ёлка', 'Ель', 'Яма']` for `ru`, `['ambient', 'Zen']` case-insensitively for `en`, and leaves the input array unmutated.
- `tracesFor(panelsReport, ...)` returns `[]`.
- `chartsApi.getReports` and `getSharedReports` send `params: { panels: true }`.
- `useInsights`: a panels report is listed and selectable, with `withTables` both true and false. A shared user's default is the alphabetically first report.
- `persister.test.ts`: `shouldPersist` is true for `REPORTS_KEY`, so the new key stays saved.
- Old-build guard: `REPORTS_KEY` isn't `['reports']`. The comment on the constant explains why: an older build reads `['reports']` from the shared IndexedDB cache and `tracesFor` throws on a Panels row.

- [ ] **Step 2: Run them to verify they fail**

Run the Vitest command on those files.
Expected: FAIL.

- [ ] **Step 3: Implement**

- Replace every `['reports']` and `queryFn: chartsApi.getReports` with `REPORTS_KEY` or `useReports()`: `useChartEditor`, `NewChartSheet`, `MoreMenu`, `SettingsLists`, `sections.tsx`, `useInsights`.
- The prefix-matching `invalidateQueries` in `MoreMenu` keeps working either way; use `REPORTS_KEY` for consistency.
- Shared reports use `[...src.key, 'reports', 'panels']`.
- `sortReports` uses `new Intl.Collator(locale, { sensitivity: 'base' })`. Sorting in `select` also covers `setQueryData` appends after Create. `select` is a `useCallback` on `i18n.language`.
- `useInsights`: `reports` filter becomes `withTables || !('Grid' in r.definition)`. Expose `previousEntries: previous.data` and `panels: report && isPanels(report) ? report.definition.Panels : null`.
- `tracesFor`: return `[]` for Panels, before the `Graph` line.
- Third-kind handling: `useKind` (a new `shared.template` string), `ChartRows` label, `ChartsColumn` icon and count (`practice_ids` count isn't on the client; show no count for panels).
- `ReportGlyph({ report })`: the muted type glyph from 15m17. Used in `ReportMenu`, `ChartRows`, `ChartsColumn` and shared `ReportList`. `ReportMenu` puts a divider under All practices.

- [ ] **Step 4: Run all JS tests**

Run: `cd app-react && npx -y -p node@22 node node_modules/vitest/vitest.mjs run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src
git commit -m "feat(insights): load panels reports and sort report lists by name"
```

### Task 4: Panels logic

**Files:**
- Create: `app-react/src/features/insights/panels/panelLogic.ts`, `panelLogic.test.ts`

**Interfaces:**
- Consumes: Task 3 types; `valueToNumber` from `chartLogic`; `addDays`, `fromDateStr`, `toDateStr`.
- Produces:

```ts
export interface Lookup {
  /** Numeric value on a day; null when empty, or the practice is unavailable. */
  value(practice: string, cob: string): number | null
  /** In the practices list, active, and the type the source needs. */
  available(practice: string, type?: PracticeDataType): boolean
  type(practice: string): PracticeDataType | undefined
  name(practice: string): string | undefined
}
export type Resolved = number | [number, number] | null
export type BarState = 'ok' | 'under' | 'over' | 'neutral'

export function makeLookup(entries: ReportDataEntry[], previous: ReportDataEntry[] | undefined, practices: UserPractice[]): Lookup
export function windowDays(entries: ReportDataEntry[]): string[]         // sorted, unique, current window only
export function resolve(source: Source, cob: string, l: Lookup): Resolved
export function stateOf(value: number | null, target: Pick<Target, 'min' | 'max'> | null): BarState | null
export function statResult(v: StatValue, days: string[], l: Lookup, todayCob: string): { value: number | null; of?: number }
export function visiblePanels(def: PanelsReport, l: Lookup): Panel[]     // what can be drawn
export function missingRequired(def: PanelsReport, l: Lookup): Required[]
export function fitHours(values: number[]): [number, number]             // whole hours around the data
```

- [ ] **Step 1: Write failing tests** (`T(h, m)` builds a `{ Time: { h, m } }` entry)

Sleep calculation, with Range `from` bed@−1 and `to` wake@0, and Calc `+wake@0 −bed@−1`:
- 23:00→07:00: Calc 480, Range `[660, 1140]`.
- 01:00→07:00: Calc 360, Range `[780, 1140]`.
- Missing bedtime, missing wake-up: `null` from both.
- Same time both sides (`duration = 0`): `null` from both.
- Total Calc with an `optional` nap term: 480 + 30 = 510; empty nap gives 480; a night with no duration and a nap gives `null`.
- First night: bedtime read from `previous`; with `previous` undefined, `null`.

Other:
- `resolve` of a Time source whose practice was retyped to Int gives `null`, and `available(id, 'Time')` is false.
- Average bedtime across midnight: nights at 23:30 and 00:30 average `From` to 720, which is 00:00 at `NoonClock`.
- `stateOf`: with `{min: 360, max: 540}`, 359 `under`, 360 `ok`, 540 `ok`, 541 `over`. Min only: 1000 `ok`. Max only: 100 `ok`. Neither: `neutral`. `null` value: `null`.
- `statResult`: `OnTarget` counts logged nights only (`{ value: 22, of: 29 }` shape on a smaller fixture); `Logged` counts nights. `Scope { today: true, missing_zero: false }` includes today and skips missing. `{ today: false, missing_zero: true }` excludes today and divides by all past days, flooring, matching `averageDailyTotal`.
- `visiblePanels`: a series or stat with a non-optional reference to an unavailable practice is dropped, and a chart with no series left is dropped. An `optional` term with a missing practice counts as 0 and keeps its series. A deleted id never throws.
- `missingRequired` returns the `Required` rows that aren't available, hidden and deleted alike.
- `fitHours([690, 1140])` gives `[660, 1200]`; `fitHours([])` gives `[0, 720]`.

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`makeLookup` maps id to name through practices (`ReportDataEntry.practice` is a **name**) and merges `entries` with `previous`. `resolve` semantics:

```
Practice: value(practice, cob)
Calc:     any required term empty or unavailable → null
          time terms sum (signed) mod 1440; a pair that wraps to 0 → null; other terms add as sign × (value ?? 0)
Range:    to or from empty, or not Time → null
          d = (to − from) mod 1440; d = 0 → null
          start = (from − 720) mod 1440; return [start, start + d]
```
`only_with` is applied in Task 6, where rows are built. Use a real modulo: `((x % 1440) + 1440) % 1440`.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/insights/panels
git commit -m "feat(insights): resolve panels sources, states and stats"
```

### Task 5: Sleep template builder

**Files:**
- Create: `app-react/src/features/insights/panels/templates.ts`, `templates.test.ts`

**Interfaces:**
- Consumes: Task 3 types, Task 4 `Lookup` semantics.
- Produces:

```ts
export function sleepPanels(t: SleepTemplate): PanelsReport
export interface Slot { key: string; types: PracticeDataType[]; required: boolean; hints: string[] }
export const SLEEP_SLOTS: Slot[]           // bedtime Time, wake Time, nap Duration
export const SLEEP_DEFAULTS = { min: 360, max: 540 }
export function suggestFor(slot: Slot, practices: UserPractice[], taken: Set<string>): UserPractice | null
export function pickerGroups(slot: Slot, practices: UserPractice[]): { compatible: UserPractice[]; cant: { practice: UserPractice; reason: 'type' }[] }
```

- [ ] **Step 1: Write failing tests**

- `sleepPanels` with all inputs: `required` lists bedtime and wake; `panels` is Stats, then the times chart, then the duration chart.
- Times chart: one `Range` series from bedtime@−1 to wake@0, `reversed: true`, `format: 'NoonClock'`, two `lines` (From solid, To dashed), target `of` the total Calc with `colour: true, lines: false`.
- Duration chart: night Calc plus nap `Practice` with `only_with: 0`, `bar_layout: 'Stacked'`, target with `lines: true, colour: true`.
- No nap: one series in the duration chart, and no nap term.
- With both limits null: `Logged` replaces `OnTarget`, target `min`/`max` are null, and bars are neutral.
- One limit: `OnTarget` has that limit only.
- Stats use `Scope { today: true, missing_zero: false }`, and the average sleep stat has `under` set to the night-only average.
- Every `Label` in the output is a `Key`, so a shared page translates it.
- A `locales.test.ts` case: every `Key` that `sleepPanels` emits exists in en, ru and uk under `reportPanels.*`.
- `suggestFor`: suggests a Time practice whose name matches a hint, in any of en/ru/uk; never a hidden one; never one in `taken`; `null` with no match.
- `pickerGroups`: active compatible listed; wrong type in `cant`; hidden left out.

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

Hints live with the slot as lowercase substrings (`bed`, `sleep`, `сон`, `отбой`, `сп`, …). Mirror `suggestions` in `yatras/settings/linking.ts` for matching; it's a hint only, and the form never applies it unprompted.

- [ ] **Step 4: Run tests and commit**

```bash
git add app-react/src/features/insights/panels app-react/public/locales
git commit -m "feat(insights): build Sleep reports from template settings"
```

### Task 6: Renderer on every layout

**Files:**
- Create: `app-react/src/features/insights/panels/PanelsReportView.tsx`, `ChartPanelView.tsx`, `StatsPanelView.tsx`, `PanelsReportView.test.tsx`
- Modify: `app-react/src/ui/theme.css`, `mobile/InsightsChart.tsx` (exports only), `mobile/InsightsMobile.tsx`, `tablet/InsightsTablet.tsx`, `features/shared/SharedReports.tsx`, `features/shared/parts.tsx`, `app-react/public/locales/*/translation.json`

**Frames:** the Sleep report frames (the spec cites 15m6 and 15m8–15m10), 15m19, 15m22–15m27, 15t7, 15t10, and their tablet and desktop equivalents.

**Interfaces:**
- Consumes: Task 4 functions; `useInsights().panels`, `.entries`, `.previousEntries`, `.todayCob`; `TICK`, `AXIS`, `PointTip` layout from `InsightsChart`; `formatTick`, `spansYears`, `formatDurationTick` from `insightsLogic`.
- Produces:
  - `PanelsReportView({ report, definition, entries, previous, practices, todayCob, chartHeight, formLink }: {...; formLink: string | null })`. `formLink` is null on shared pages, so no link is shown.
  - `labelText(label: Label | null, t: TFunction, fallback?: string): string`
  - Theme tokens `--ui-state-ok`, `--ui-state-under`, `--ui-state-under-fill`, `--ui-state-over`, `--ui-state-over-stripe`, `--ui-state-none`, `--ui-state-ok-solid`, `--ui-state-under-solid`, `--ui-state-over-solid`.

- [ ] **Step 1: Add the theme tokens**

Light: ok `#B9790F`; under `#C2412D`, fill at 13%; over `#5F4FA3`, stripe `#A99BD6`; none `#8A8174`. Dark: ok `#F0B54A`; under `#F08A74`, fill at 16%; over `#9C8CE6`, stripe `#3A3448`; none `#8F88A0`. Copy the `*-solid` values for 1y from frame **15m8**. Add them in every block that defines `--ui-chart-1` (lines 35, 96, 149) and register them in `@theme inline`.

- [ ] **Step 2: Write failing tests**

Recharts doesn't lay out in jsdom, so render with a stubbed `ResponsiveContainer` as existing Insights tests do, and assert on text and roles.

- A Sleep report renders average sleep, night-only average, average bedtime, average wake-up and "22 of 29".
- Both limits null: "Nights logged" shows and the legend has no state rows. One limit: the legend has that state only.
- Hidden or deleted required practice: the message names the form label and links to `formLink`. With `formLink` null there's no link. It never shows a UUID.
- Missing optional nap: no message and no nap row.
- Labels render in the active language: switch i18n to `ru` and assert the Russian figure label.
- `InsightsMobile`, `InsightsTablet` and `SharedReports` each render the view for a panels report and hide the headline, legend list and table toggle.

- [ ] **Step 3: Run them to verify they fail**

Expected: FAIL.

- [ ] **Step 4: Implement `ChartPanelView`**

- Rows: one per `windowDays`, with `s{i}` from `resolve`, `only_with` applied, and `state` from `stateOf(resolve(target.of))`. Range series pass `[low, high]` to `<Bar dataKey>`.
- Marks: Phase 1 draws `Bar` and `Range`. `Line` and `Dot` come in Task 9.
- `Stacked` uses a shared `stackId`. `Overlaid` follows `barPlacement`.
- States: `<Cell>` per bar. `under` uses `stroke` plus the pale fill. `over` uses `url(#stripes-{useId()})`, a per-chart `<pattern>` with the over colour behind stripes; the id must be unique because the preview can mount twice. `Cell`s apply only when `target.colour`.
- More than 120 days switches to the `*-solid` colours with no stroke or pattern.
- Y axis: `reversed` from the panel; `NoonClock` uses `domain={fitHours(...)}`, hourly ticks, and `formatMinutesAsHHMM(v + 720)`. `Duration` uses `[0, 'auto']` and `formatDurationTick`.
- `ReferenceLine`s: target min and max when `target.lines`, with `ifOverflow="extendDomain"`; `lines` with solid or dashed stroke.
- Tooltip: date, then each series (Range as `from → to`), then the target value under `target.label`. Copy `PointTip`'s markup by exporting a shared `TipShell` from `InsightsChart.tsx`, without changing its output.

`StatsPanelView` keeps values on one line and lets labels wrap, with a grid per 15m, 15t and 15d frames. A nested `under` renders beneath its value. `OnTarget` renders with a `{{value}} of {{total}}` string.

- [ ] **Step 5: Wire the layouts**

- In `InsightsMobile` and `InsightsTablet`, `const panels = ins.panels && !ins.isLoading && !ins.isError`, and render `PanelsReportView` in place of the chart section. `formLink` is `/settings/charts/${report.id}`. The shared loading and error states stay.
- `InsightsDesktopScreen` reuses `InsightsTablet`; only `chartHeight` differs.
- Shared: a `panels` flag on `useShared`, with `grid`-style branches at `SharedReports.tsx:145,231,313`. Hide `CsvButton`, `DayTable` and the chart/table switch for panels: CSV needs `traces`, which panels don't have, and the spec lets the builder hide what needs a special case. Mobile More's CSV is the whole diary, so it stays.
- Legend toggles aren't used for panels.

- [ ] **Step 6: Run all JS tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app-react/src app-react/public/locales
git commit -m "feat(insights): render panels reports on all layouts and shared pages"
```

### Task 7: Sleep form, create and edit

**Files:**
- Create: `app-react/src/features/insights/panels/TemplateForm.tsx`, `SlotPickerSheet.tsx`, `TemplateForm.test.tsx`, `NewTemplateScreen.tsx`
- Modify: `settings/mobile/NewChartSheet.tsx`, `settings/mobile/ChartEditorMobile.tsx`, `settings/wide/ChartEditorWide.tsx`, `settings/useChartEditor.ts`, `app-react/src/router.tsx`, `app-react/public/locales/*/translation.json`
- Test: `settings/mobile/ChartEditorMobile.test.tsx`, `settings/wide/ChartEditorWide.test.tsx`

**Frames:** 15m1–15m3, 15d13, and the 15t and 15d form frames.

**Interfaces:**
- Consumes: Task 5 `sleepPanels`, `SLEEP_SLOTS`, `SLEEP_DEFAULTS`, `suggestFor`, `pickerGroups`; `useChartEditor().update`; `PanelsReportView`; `NameCard`, `Footer`, `DeleteChartSheet`, `FailedBanner`, `CARD`, `FIELD`, `BTN`, `AutosaveText`.
- Produces:
  - `TemplateForm({ value, onChange, practices }: { value: TemplateDraft; onChange(d: TemplateDraft): void; practices: UserPractice[] })`
  - `type TemplateDraft = { kind: 'Sleep'; bedtime: string | null; wake: string | null; nap: string | null; min: number | null; max: number | null }`
  - `draftProblem(d: TemplateDraft): 'required' | 'minMax' | null`
  - `draftToDefinition(d: TemplateDraft): { Panels: PanelsReport } | null` (null when `draftProblem` isn't null)
  - Route `/settings/charts/new/:template`, which sits beside `/settings/charts/:id`; React Router ranks the static segment first.

- [ ] **Step 1: Write failing tests**

- New sheet: Sleep on top (Tasks 9 and 10 add Japa and Duration beside it), then "Build your own" with Graph and Table keeping their name-and-Create step. Sleep navigates to `/settings/charts/new/sleep`.
- New form: Create is disabled until name, bedtime and wake-up are set. A suggestion shows **Use** and fills nothing until pressed. Create posts a `Panels` definition, adds it to `REPORTS_KEY`, calls `writeStored(id)` and navigates to `/charts`.
- `min` and `max` start at 360 and 540, and each can be cleared.
- Picker lists compatible active practices and says why others can't be used.
- `draftProblem`: required empty gives `'required'`; `min > max` gives `'minMax'`; `min === max` gives null.
- Edit: changing `max` sends a PUT whose `template` and regenerated `panels` both carry the value.
- Edit with `min > max` shows the inline error and sends no PUT (Review Focus 4). Fixing it sends one.
- Edit where a required practice was deleted: its slot shows as missing, and choosing another saves. Changing a limit alone is held back by `draftProblem` with the slot flagged.
- `/settings/charts/:id` of a panels report shows the form, name card and delete, not Graph or Table sections. Wide layouts show a live preview.

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

- `useChartEditor` gains `panels: PanelsReport | null`, and the existing `update` is used as is. It already saves the whole report, debounces to one in flight, and handles failure and Undo.
- `ChartEditorMobile` and `ChartEditorWide`: `ed.panels` branches beside `graph` / `TableColumns`. `subtitle` gains a panels case. The sticky-preview logic stays Graph-only. The preview is `PanelsReportView` from `ed.entries`, with `previous` undefined.
- `// ponytail: the preview has no previous window, so its first night has no bar; pass it through if that reads as wrong.`
- `NewChartSheet` is reshaped per 15m1. `NewTemplateScreen` is `MobileShell` on mobile and the wide shell with a preview on tablet and desktop.

- [ ] **Step 4: Run all JS tests and lint**

Run: `cd app-react && npx -y -p node@22 node node_modules/vitest/vitest.mjs run && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src app-react/public/locales
git commit -m "feat(insights): create and edit Sleep reports from a form"
```

### Task 8: Phase 1 verification

**Files:** fixes only.

- [ ] **Step 1: Run everything**

Run: `make lint && make test`, then the Vitest command, then `npm run build` in `app-react/`.
Expected: all pass.

- [ ] **Step 2: Check it in the real app**

Use the `run` skill. Create a Sleep report on mobile, tablet and desktop widths, in light and dark, and in `en` and `ru`, against real logged data. Check:
- 7d, 30d and 1y textures, including the 1y solid colours.
- The reversed clock axis and both average lines.
- Tooltip contents.
- A shared page in a logged-out window.
- `curl /api/reports` without `panels=true` contains no panels report.
- Hiding the Bedtime practice shows the message and link, and the report still opens.

- [ ] **Step 3: Commit any fixes, then stop for a Phase 1 ship decision**

Follow **Rollout** above. Phase 2 starts once Phase 1 has been used, since it may adjust the format.

---

## Phase 2

### Task 9: Japa template

**Files:**
- Modify: `server/src/app/report/panels.rs`, `app-react/src/api/charts.ts`, `panels/panelLogic.ts`, `panels/templates.ts`, `panels/ChartPanelView.tsx`, `panels/TemplateForm.tsx`, `settings/mobile/NewChartSheet.tsx`, locales
- Test: `panelLogic.test.ts`, `templates.test.ts`, `PanelsReportView.test.tsx`, `report/db.rs` tests

**Frames:** the Japa frames in `15m*`, `15t*`, `15d*`.

**Interfaces:**
- Produces: `Template::Japa(JapaTemplate { total: Uuid, target: i32, morning: Option<Uuid>, quality: Option<Uuid>, attunement: Option<Uuid> })`; `japaPanels(t): PanelsReport`; `JAPA_SLOTS`; `numericVariants(p: UserPractice): boolean`.

- [ ] **Step 1: Write failing tests**

- Text quality: `value` of `{ Text: '4' }` is 4; `'good'` is `null`; Int passes through.
- `pickerGroups`: a Text practice is compatible only when every `dropdown_variants` entry, split on commas and newlines, is numeric.
- `japaPanels`: Stats use `Scope { today: false, missing_zero: true }`. Rounds chart has total bars with met and missed states, a target line, morning `Bar` overlaid (`bar_layout: 'Overlaid'`), and attunement as `Dot`. Quality chart exists only with a quality input and uses a `Line` on `axis: 'Right'`.
- Days on target counts past days only, and today's value doesn't move the average.
- Server: a Japa report round-trips, and a negative `target` is 422.

- [ ] **Step 2: Run them to verify they fail**

- [ ] **Step 3: Implement**

Add `Line` and `Dot` to `ChartPanelView`, following `InsightsChart`'s props. In `makeLookup`, Text converts with `Number()` when finite, otherwise `null`. This is a Lookup-level rule, so `resolve` stays unchanged and Text in an existing report isn't touched: `valueToNumber` keeps its behaviour. If the format needs a change, keep it additive: `version` is bumped only if stored reports must change.

- [ ] **Step 4: Run tests and commit**

```bash
git add server/src app-react/src app-react/public/locales
git commit -m "feat(insights): add the Japa report template"
```

### Task 10: Duration template

**Files:** as Task 9.

**Frames:** the Duration frames in `15m*`, `15t*`, `15d*`.

**Interfaces:**
- Produces: `Template::Duration(DurationTemplate { practices: Vec<Uuid>, goal: Option<i32> })`; `durationPanels(t): PanelsReport`; a multi-select `Slot` (`many: true`).

- [ ] **Step 1: Write failing tests**

- One practice with goal: met and missed states plus a goal line.
- Several practices: stacked series using `--ui-chart-n` colours, target `colour: false`, `lines: true`.
- Stats: average per day with `Scope { today: false, missing_zero: true }` equals `averageDailyTotal` on the same data; days on goal only when `goal` is set.
- With one of several practices deleted, the others still draw, and `required` lists each practice, so its message shows.
- Server: `practices: []` is 422; more than `MAX_SERIES` is 422.

- [ ] **Step 2: Run them to verify they fail**

- [ ] **Step 3: Implement**

Daily total is a Calc of all practices with every term `optional: true`. With all terms optional and all empty the day resolves to 0, which matches "a missing day counts as 0", so `resolve` needs no new case. The picker reuses `SlotPickerSheet` with checkboxes.

- [ ] **Step 4: Full verification**

Repeat Task 8 steps 1–2 for Japa and Duration. Then run `make lint && make test` and the Vitest command.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/src app-react/src app-react/public/locales
git commit -m "feat(insights): add the Duration report template"
```
