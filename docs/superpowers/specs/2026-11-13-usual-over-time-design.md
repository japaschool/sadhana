# Usual over time — design

## Intent

Me vs my normal says where the last 7 days sit against today's usual. It can't say how that usual has moved. This screen draws each Overview row's rolling usual (the same 90-day median + P25–P75 that Me vs my normal uses) week by week over months or years, so the user can see their normal drift. Mockup: option 1 of https://claude.ai/artifact/EDp6VeVbG1Xb6sVJGKZPjB (the screen keeps its ribbon and drops its chips and period bands; see below).

## Goals

- One stacked ribbon per visible Overview row: median line + P25–P75 band, one point per week.
- A range switch over the existing long ranges, opening on the longest available up to 2y.
- The same usual: the ribbon's last point is `usualAt(…, todayCob, …)`, the function Me vs my normal uses (see 9 for the one edge case where their inputs differ).
- The Insights tab returns to whichever Insights subpage the user was on.

## Non-goals / anti-goals

- No marked periods on this chart (no bands, no legend rows). Left-out days don't move the ribbon, and kept-in days move it weeks later (the window lags), so a band would only suggest a cause the chart can't show.
- No % change, arrows, "better/worse", predictions or causes (memory: insights-product-stance). Teal/orange are not used here: the ribbon has no "now vs usual" word.
- No new endpoint, no server change.
- Not an Overview card holding the chart itself: it's a link to its own screen.

## Decided with the user

1. **Placement.** A third link in `OverviewLinks` (next to Year map, Rhythm) opens `/insights/usual`, a full screen.
2. **Range.** Range chips `1y · 2y · 3y · 5y · All` (labels as the Charts range switch already uses). Only ranges the history covers are offered: a range `r` shows when the user's first logged day is earlier than `today − r` (All always shows when anything shows). Opens on the longest offered range up to 2y. The choice is **not** remembered.
3. **Data.** One fetch: `chartsApi.getReportData(todayCob, 'AllData')` with the same query key Charts' All uses (`['report-data', todayCob, 'AllData']`, matching `useYearData`'s pattern), fed through `useInsightRows`. The range only clips what is drawn, so the first week of any range still gets a full 90-day window (up to a year of lookback).
4. **Marked periods.** Not drawn. Days of periods with `exclude_from_usual` stay out of the rolling usual (`leftOutDays(periods, todayCob)`), as in Me vs my normal. The screen's intro line says so, like `usualExplain` does.
5. **Thresholds.**
   - A week's point = `usualAt(series, weekEnd, leftOut)`. `null` (under `MIN_USUAL` = 14 kept values) is a gap: line and band break, nothing is drawn across.
   - A row is drawn when its **whole history** has ≥ 26 non-null weekly points (~6 months). Otherwise it shows its name plus one line: "Not enough history yet".
   - The Overview link appears only when at least one visible row passes the 26-point bar. Otherwise there's no link and no note.
6. **Row shape.** Stacked, one short chart per row: name (with `CalculatedTag` for Sleep/totals, via `RowLabel`), a mono line "Usual now {now} · at the start {start}" (the first and last non-null points in the shown range), then the chart. The y-axis fits the row's own values, and clock rows use `rowSeries`' minutes-after-noon, formatted as clock times. Month ticks on x, thinned for longer ranges. Tap/hover a week shows the shared tooltip (`useChartTooltip`, `TipShell`): week date, median, P25–P75.
7. **Tab memory.** The Insights tab (`TABS` in `layouts/tabIcons.ts`, `to: '/charts'`) opens the last Insights screen, saved per device in localStorage like `useInsightsView`. Rendering `/insights/year`, `/insights/rhythm` or `/insights/usual` (the screens `OverviewLinks` opens) stores its path. Rendering `/charts` clears it. The tab links to the stored path, else `/charts`. The stored path never expires, same as the Overview/Charts choice. Storage reads and writes are wrapped in try/catch, as `useInsightsView` does.
   - *My call:* `/insights/period/:id` is not remembered, because Settings → Marked periods opens it too, and an Insights tab that reopens a period someone looked at from Settings would be surprising.
8. **A row with little in the shown range** (*my call*). The row qualifies on whole history but the chosen range can be thin, e.g. a practice that's no longer logged. "Usual now" is the point at `todayCob`. When that point is null, the line reads "Last usual {value} · {month year}" for the last non-null point. When the range has no non-null point at all, the row shows its name and "No usual in this range". The chart is drawn whenever it has at least one point.

9. **Known difference from Me vs my normal (accepted).** `rowSeries` zero-fills a count practice only when it has a value somewhere in the loaded entries. All data can therefore fill zeros that Year data doesn't, for a count practice last logged more than a year ago. In that case this screen's "usual now" can differ from the Overview's. `rowSeries` is not changed.

## Weekly series logic (the one test)

A pure function in `overview/usualOverTime.ts`:

```ts
usualWeeks(series: Series, leftOut: Set<string>, todayCob: string, from: string): { week: string; usual: Usual | null }[]
```

- The points are weekly, ending at `todayCob` and stepping back 7 days to `from`, then put in ascending order. So the last point is `usualAt(series, todayCob, leftOut)`, identical to Me vs my normal's usual.
- `from` for the 26-point check is the first logged day. For drawing, it's `today − range` (All: the first logged day).
- Local `yyyy-mm-dd` throughout (`shift`, `daysBetween` from `usual.ts`). Never `toISOString()`.

`usualOverTime.test.ts` (vitest), on fixture series, covers: the last point equals `usualAt(…, todayCob, …)`; a gap of more than 90 days with no values gives null points (a break, not interpolated); left-out days don't change the result; the 26-point rule.

Cost: about 52 × 90 lookups per row per year. For 5y and ~10 rows that's ~250k map reads in a `useMemo`, which is fine. Compute once for the whole history and clip per range.

## Layouts

Following `YearMapScreen`: one screen wrapped in `ui()` in `router.tsx`, inside `SettingsSubpage` (back header). `useLayout()` sets the grid: mobile has rows stacked in one column, tablet and desktop put rows in two columns. The range chips sit under the header. Tokens from `src/ui/theme.css` (`--ui-chart-1` for line and band, band at ~0.3 opacity like the mockup; `ui-hairline` grid).

## Strings (en / ru / uk)

Link title + text, screen title, intro line (90-day usual, a week behind, left-out periods not counted), "Usual now {{now}} · at the start {{start}}", "Not enough history yet", tooltip "Usual {{median}} · {{p25}}–{{p75}}", legend "usual range" / "median" (reuse `insights.overview.usualRange` where it fits). Range labels reuse the Charts range keys.

## Left to the builder

- The chart component's internals (Recharts `ComposedChart` with a range `Area` [p25, p75] + `Line` median, `connectNulls={false}`), chart height, and tick thinning.
- Whether the "has history" check for the link lives in `useOverview` (that would mean the Overview loads All data) or uses the year data the Overview already has as a cheap proxy. **Builder's call, with the constraint that the Overview must not start fetching All data on every visit.** A 26-point usual needs ≥ ~7 months of data, so the year data is enough to decide the link.
- Exact key names and file split inside `features/insights/overview/`.
