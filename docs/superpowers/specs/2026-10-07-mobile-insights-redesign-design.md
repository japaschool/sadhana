# Mobile Insights Redesign: Step 3 of the New UI

**Date:** 2026-10-07
**App:** `app-react`
**Status:** Approved (design), pending spec review
**Source design:** claude.ai/design project `cccefa4d-5554-41b1-be47-2704b1233b68`, `Sadhana Redesign.dc.html`. Frames 5a (light), 5b (report dropdown open) and 5c (dark, past end date) from Turn 5. The ⋯ menu contents come from 2c (Turn 2). Builds on `2026-10-06-mobile-today-redesign-design.md` and `2026-10-06-mobile-settings-redesign-design.md`.

## Context and goal

The third redesigned screen is the **mobile Insights viewer** inside the new `MobileShell`. It shows one graph report for a time window. Tablet and desktop keep the legacy `ChartsPage`.

## Scope

**In scope**
- Picking a report.
- Picking the range and the end date.
- The chart card: a headline, the chart and its average lines.
- The legend card with per-practice averages.
- A ⋯ menu.
- Remembering the selected report.

**Out of scope**
- **Table (Grid) reports.** They don't appear in the report list on mobile.
- **Report editing.** Creating and editing reports keep using the legacy pages, reached from the ⋯ menu.
- **The tablet layout.**
- **Settings → Reports (2e).**
- **The 5d end-date sheet.** The existing `CalendarSheet` is used instead.
- **Tapping a legend row to isolate a trace.**

## Decisions

| Topic | Decision |
|---|---|
| Chart library | **Keep Recharts** (already installed and used by the legacy page). It covers stacked bars with rounded tops, `ReferenceLine` average lines, multiple Y axes and custom ticks. The headline and legend are plain HTML outside the chart. Plotly is only in the old Yew `frontend/` and isn't involved. A hand-written SVG would mean re-implementing axes and Y2, and visx/d3 would add a dependency for no gain. |
| Mixed units | **One chart with multiple Y axes**, using the legacy axis rules. The axes **show tick labels**, which the mockup doesn't have. |
| Report list | "All practices" first: every active practice as a line, which is the legacy default. Then the user's Graph reports in API order. Grid reports are filtered out. |
| Remembered report | The selected report id is stored in `localStorage` (`insights-report`), wrapped in try/catch. If the stored id is unknown, belongs to a Grid report or can't be read, the screen falls back to "All practices". |
| Range | 7d / 30d / 90d / 1y / All, mapped to the server's `Week` / `Month` / `Quarter` / `Year` / `AllData`. Default is 30d. All has no previous window, so no delta. No backend change. Not remembered. |
| End date | "Ending today ⌄" opens the existing `CalendarSheet` (from `features/today/mobile`), with the same red dots for incomplete days. Any other end date shows as an amber pill "Ending 30 Sep ×", and × resets it to today. Not remembered. |
| ⋯ menu | New chart → `/charts/new`. Edit "<name>" → legacy `ChartsPage` at `/charts/manage`. Copy share link. Export CSV. Delete report, after a `BottomSheet` confirm. Edit and Delete are hidden for "All practices". |
| Colours | New tokens `--ui-chart-1…8` in `theme.css` with light and dark sets. Slots 1–4 come from the mockup: light `#E2A24B #D7867A #9DB98A #A99BD6`, dark `#EDB45A #E3978B #A9C996 #B7AAE6`. Slots 5–8 are new colours in the same muted style, checked with the dataviz palette validator against both card backgrounds. The average line uses `--ui-accent`. |

## Screen (mobile, 390pt reference)

1. **Header** (`AppBar` style from Today): the title "Insights" and a ⋯ button with a 44px hit target.
2. **Report link:**
   - The report name in amber with a ▾. It's one line and truncates with an ellipsis, and the row is at least 36px tall.
   - Tapping it opens an `AnchoredMenu` listing the reports. Full names wrap, and the selected one has a ✓.
   - The legacy page has a chart/table "kind" caption. It's dropped because only graphs are listed.
3. **Range row:** a `SegmentedControl` (Plex Mono, 12px) on the left and the end-date control on the right.
4. **Chart card** (`bg-ui-surface`, hairline border, 22px radius):
   - **Caption:** "Daily average · 7 Sep – 6 Oct". For a single Time trace it's "Average · …".
   - **Headline value:** Plex Mono, 30px.
   - **Delta line:** "+12% vs previous 30 days". Green when the change is ≥ 0, muted when it's negative.
   - **Chart:** 170px tall. X axis has 3 ticks (start, middle, end), Plex Mono 11px. Y axes have Plex Mono 11px tick labels. Gridlines are hairline and horizontal only.
5. **Legend card:** one row per trace: a 10px swatch, the practice name, and the average on the right in Plex Mono.

Every string comes from i18n in en, ru and uk.

## Data and logic

### Fetching
- **Reports:** `chartsApi.getReports()`, query key `['reports']`.
- **Practices:** `practicesApi.getUserPractices()`, query key `['practices']`.
- **Current window:** `chartsApi.getReportData(end, duration)`, with `end` as a local `yyyy-mm-dd` (from `features/today/date.ts` `toDateStr`, never `toISOString()`).
- **Previous window:** `chartsApi.getReportData(prevEnd, duration)`. `prevEnd` is the day before the current window's first `cob_date`, taken from the response so it matches the server's calendar-month and calendar-year arithmetic. This query is used only for the delta.

### Traces
- Traces are built the same way the legacy `ChartPanel` builds them: a name, the configured `type_`, a colour slot by index, the practice's data type, `show_average` and `y_axis`.
- This mapping moves into `chartLogic.ts` as `tracesFor(report, practices)` so the old and new screens share it.

### Axes
- `resolveAxisId` moves from `ChartsPage` into `chartLogic.ts`.
- The `num` axis is on the left, and `num-right` (traces with `y_axis === 'Y2'`) on the right.
- `time` goes on the right, or on the left when it's the only axis in use.
- The `unit` (yes/no) axis stays hidden.
- **Tick labels:**
  - an axis carrying only durations: `30m`, `1h`, `1h30`
  - counts: plain integers
  - time: `HH:MM` via `formatMinutesAsHHMM`

### Averages and the headline
Per-trace averages use the existing `averageForType`, which excludes today when the window ends today. Yes/no traces show days-done over days, e.g. `18/30`.

**Headline rules** (pure function `headline(traces, rows, prevRows)`):

| Traces | Headline value | Delta |
|---|---|---|
| All `Duration` | Average of the daily total, formatted `2h 08m` | Yes |
| All `Int` | Average of the daily total | Yes |
| Exactly one `Time` trace | Its average time, `HH:MM` | No |
| Anything else | No headline (the caption and value rows are omitted) | — |

- **Delta** = `(cur − prev) / prev`, rounded to a whole percent.
- It's hidden when there's no previous data or `prev` is 0.

### Average lines
- If `bar_layout` is `Stacked` and any trace has `show_average`, there is one dashed accent line at the average daily total.
- Otherwise each trace with `show_average` gets its own dashed line in that trace's colour, on that trace's axis.

### Selection persistence
- `useInsights` reads `insights-report` once on mount and writes it whenever the selection changes.
- The fallback described under Decisions applies once the reports have loaded.

## Architecture

**Router**
- On mobile, `/charts` moves out of the `AppShell` children into its own `ByLayout` route, as `/` and `/settings` did:
  ```
  { path: '/charts', element: <ByLayout mobile={<InsightsMobileScreen/>} legacy={<AppShell/>} />,
    children: [{ index: true, element: <ChartsPage/> }] }
  ```
- `/charts/manage` is added under `AppShell` and renders `ChartsPage`, so mobile users can still reach the legacy editor.
- `ChartsPage` reads an optional `?report=<id>` and uses it as its initial selection. This is a one-line change, so "Edit" opens the right report.
- `/charts/new` is unchanged.

**Files**
```
features/insights/
  useInsights.ts          selection (+ localStorage), range, end date, queries, derived traces/rows/headline
  useInsights.test.tsx
  insightsLogic.ts        window labels, headline(), yes/no averages, delta
  insightsLogic.test.ts
  locales.test.ts         en/ru/uk key parity, as the other features do
  mobile/
    InsightsMobile.tsx    header, report link, range row, cards
    InsightsMobile.test.tsx
    InsightsChart.tsx     the Recharts ComposedChart
    ReportMenu.tsx        5b list (AnchoredMenu)
    MoreMenu.tsx          ⋯ menu + delete confirm sheet
    EndDateControl.tsx    "Ending today ⌄" / amber pill + CalendarSheet
pages/charts/chartLogic.ts  + tracesFor(), resolveAxisId() (moved from ChartsPage)
ui/theme.css               + --ui-chart-1…8 (light and dark)
```

**Colours in SVG.** Recharts sets `fill` and `stroke` as SVG attributes. The chart passes `var(--ui-chart-n)` strings, which are valid in presentation attributes in current browsers. If iOS Safari doesn't apply them, `InsightsChart` resolves the variables with `getComputedStyle` on its `.ui-root` ancestor and re-reads them when the theme changes.

## Error and edge states

- **Loading:** `Spinner` inside the chart card.
- **No rows with values in the window:** the card shows "No data in this range" and the headline is hidden.
- **The selected report was deleted elsewhere:** the screen falls back to "All practices".
- **Report-data request fails:** the inline message "Couldn't load data", and react-query's default retry applies.

## Testing

- **`insightsLogic.test.ts`:**
  - the headline rules table, row by row
  - delta rounding and hiding
  - yes/no `done/total`
  - window labels
- **`chartLogic.test.ts`:**
  - `tracesFor` for "All practices" and a Graph report
  - `resolveAxisId` cases
- **`useInsights.test.tsx`:**
  - a stored id is restored
  - an unknown or Grid id falls back to All practices
  - a selection change is written to storage
  - `prevEnd` comes from the first row of the current window
- **`InsightsMobile.test.tsx`:**
  - switching reports through the 5b menu
  - picking a past end date shows the amber pill, and × resets it
  - Edit and Delete are hidden for "All practices"
  - Grid reports don't appear in the menu
- **Manual check:** Recharts doesn't render SVG in jsdom, so check the chart by running the app at 390px, in light and dark, with:
  - a stacked duration report
  - a mixed duration + time + yes/no report
  - "All practices"
