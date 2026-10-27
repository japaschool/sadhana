# Sadhana Pro — Match React Charts to the Rust/Plotly Version

**Date:** 2026-08-08
**Scope:** Bring the React (`app-react`, recharts) graph charts in line with the original Rust/Yew (`frontend`, plotly) charts — same data logic and a close visual result. **Keep recharts** (no Plotly.js). No backend or report-model changes.

## Context

Both frontends share the same report model (Graph/Grid, `PracticeTrace{label,type_,practice,y_axis,show_average}`, `BarLayout` Grouped/Stacked/Overlaid, `LineStyle` Regular/Square, `ReportDuration` Week…AllData) — see `app-react/src/api/charts.ts` and `frontend/src/routes/charts/mod.rs`. The React graph already renders line/bar/dot with bar layouts, durations, grid, and CSV.

The **data-mapping and axis logic diverge** from the Rust version. Current React logic: `valueToNumber` (`ChartsPage.tsx:95-110`), `buildChartData` (`:119-134`), a single `YAxis`, chart render (`:244-306`), grid (`:313-343`). Rust references: `y_value`/`average_value`/`overflow_time` (`frontend/src/routes/charts/base.rs:256-409`), per-type axis config (`frontend/src/components/chart.rs:237-259`).

**Decisions (from brainstorming):** stay on recharts and replicate the logic; **auto-group Y-axes by practice data type** (not the manual per-trace `y_axis` field); match the Rust value mapping, averages, Time handling, grid, and get close on look. `ChartPanel` already has `practices: UserPractice[]` (with `data_type`) and `practiceMap`, so axis routing by type is available.

## Design

### 1. New `chartLogic.ts` (pure, unit-tested)

Extract chart math out of `ChartsPage.tsx` into `app-react/src/pages/charts/chartLogic.ts`:

- **`valueToNumber(raw)`** — match Rust `y_value`:
  - `Int` → number; `Duration` → minutes (number).
  - `Bool` → `1` if true, **`null` if false or missing** (gap; today returns `0`).
  - `Text` → `1` if present/non-empty, **`null` if missing** (today Text is dropped).
  - `Time {h,m}` → minutes-of-day (`h*60+m`); overflow applied at series level (below).
  - Handles both wire shapes (primitive and `{Int|Bool|Duration|Time|Text: …}`).
- **`applyTimeOverflow(series)`** — port Rust `overflow_time` (`base.rs:336-363`): for a Time practice's values, detect clustering across the midnight boundary and offset the minority cluster by ±1440 min so the trend stays continuous. HH:MM formatting uses `value mod 1440`.
- **`averageForType(values, dataType)`** — match Rust `average_value` (`base.rs:256-334`): **exclude today**; `Int`/`Duration` → arithmetic mean; `Time` → mean minutes (with overflow) → HH:MM; `Bool`/`Text` → none.
- **`axisKindFor(dataType)`** → `'num' | 'time' | 'unit'` (Int/Duration→num, Time→time, Bool/Text→unit).
- **Formatters:** `formatMinutesAsHHMM(min)`, optional `min` suffix for the numeric axis.

### 2. Auto Y-axes by data type (in `ChartPanel`)

Route each trace to a recharts `yAxisId` via `axisKindFor(practice.data_type)` (data type looked up from `practices`). Render only the axes actually used:
- **`num`** (Int/Duration) — `orientation="left"`, `domain={[0, 'auto']}` (Rust `RangeMode::ToZero`); tick suffix `"min"` when the num axis carries only Duration traces.
- **`time`** (Time) — `orientation="right"`, `tickFormatter={formatMinutesAsHHMM}`.
- **`unit`** (Bool/Text) — `hide`, `domain={[0, 1.1]}` (marks sit at 1, no grid).
Each `<Line>/<Bar>` gets the matching `yAxisId`.

### 3. Average line

For traces with `show_average` and an averageable type, render a horizontal dashed recharts `<ReferenceLine y={avg} yAxisId={kind} stroke={color} strokeDasharray="6 4" />` (label = formatted average). Averages come from `averageForType` (today excluded).

### 4. Look/feel toward plotly

- Legend `verticalAlign="bottom" align="center"`.
- Per-type opacity: bars ~0.35, lines ~0.5, dots ~0.8 (Rust `chart.rs:276-312`).
- Align the color palette to the Rust palette (read from `frontend/src/components/chart.rs`); extend React's 8-color list to match ordering/colors.
- X-axis keeps the readable short date (`shortDate`).

### 5. Grid parity

Grid shows **all** rows (remove the `slice(-14)` cap at `ChartsPage.tsx:~318`) with the Rust date format "Weekday, D Mon" (e.g. "Thursday, 7 Aug").

## Files

| File | Change |
|---|---|
| `app-react/src/pages/charts/chartLogic.ts` | **New** — pure logic (value mapping, time overflow, averages, axis routing, formatters) |
| `app-react/src/pages/charts/ChartsPage.tsx` | Use `chartLogic`; multi-`yAxisId` axes (num/time/unit); `ReferenceLine` averages; legend bottom; opacities; palette; grid all-rows + date format |
| `app-react/src/pages/charts/chartLogic.test.ts` | **New** — unit tests for the pure logic |
| `app-react/src/pages/charts/ChartsPage.test.tsx` | Update if rendering assertions shift |

## Testing

- `chartLogic.test.ts`: Bool true→1 / false→null; Text present→1 / missing→null; Int/Duration passthrough; Time→minutes + overflow (a series spanning midnight offsets the minority cluster); `averageForType` per type excluding today; `axisKindFor` mapping.
- `ChartsPage.test.tsx`: existing tests (CSV, empty state, selection) stay green; add a smoke test that a Time trace uses the time axis and a Bool trace the hidden unit axis (via `yAxisId`/formatter), and that `show_average` renders a `ReferenceLine`.
- Full Vitest suite green. Manual: open a report mixing Duration + Time + Bool and confirm axes/lines read sensibly.

## Non-goals

- No Plotly.js. No manual per-trace `y_axis` picker (auto-by-type instead; the saved `y_axis` field is left untouched, just not used for rendering). No backend/report-model changes. No new chart kinds.
