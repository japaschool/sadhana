# Usual over time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/insights/usual` screen that draws each visible Overview row's rolling 90-day usual (median + P25–P75) week by week, linked from the Overview, plus an Insights tab that reopens the last Insights subpage.

**Architecture:** One pure module (`overview/usualOverTime.ts`) turns a row's `Series` into weekly `usualAt` points and decides ranges and per-row summary text. One screen (`overview/UsualOverTime.tsx`) fetches All data once, computes weeks for the whole history in a `useMemo`, clips per range and draws a Recharts ribbon per row, modelled on `PeriodDetail`'s `RowChart`. The Overview link is gated on the Year data it already has. Tab memory is one hook in `layouts/tabIcons.ts` used by the three shells.

**Tech Stack:** React + TypeScript, TanStack Query, Recharts, i18next, vitest + Testing Library. Frontend only (`app-react/`), no server change.

**Spec:** `docs/superpowers/specs/2026-11-13-usual-over-time-design.md`

## Global Constraints

- No new endpoint, no server change. No new dependency.
- Local `yyyy-mm-dd` dates only (`shift`, `daysBetween`, `toDateStr`/`fromDateStr`); never `toISOString()`.
- The ribbon's last point is `usualAt(series, todayCob, leftOutDays(periods, todayCob))`, the same call Me vs my normal makes.
- No marked-period bands or legend rows, no % change, arrows, better/worse, predictions. Teal/orange are not used.
- `--ui-chart-1` for line and band (band ~0.3 opacity), `--ui-hairline` grid.
- The Overview must not fetch All data. The screen's All fetch uses query key `['report-data', todayCob, 'AllData']`.
- A row is drawn when its whole history has ≥ 26 non-null weekly points; a null week is a gap (`connectNulls={false}`).
- Range chips `1y · 2y · 3y · 5y · All`, labels from `insights.range1y`… `insights.rangeall`; not remembered.
- All strings in en / ru / uk. Every localStorage read/write in try/catch.
- Run tests with Node 22 from `app-react/`: `npx vitest run <path>` (see memory: local-tooling).

## Review Focus

- **History shorter than a year** (≥ 26 points but first logged day after `today − 1y`): only `All` is offered and the screen opens on it, never on an empty 2y. Test in Task 1 (`opening_range_falls_back_to_all`).
- **A practice no longer logged**: last point null → "Last usual … · {month year}"; nothing in the range → "No usual in this range", no empty chart. Tests in Task 1 (`summary_*`) and Task 3 (`row_with_no_usual_in_range`).
- **Clock rows** (bedtime around midnight): y-axis and tooltip show clock times from minutes-after-noon, not raw numbers. Test in Task 3 (`clock_row_shows_times`).
- **Blocked localStorage** (private mode): tab still links to `/charts`, nothing throws. Test in Task 4 (`tab_survives_blocked_storage`).
- **A period opened from Settings** (`/insights/period/:id`) never becomes the Insights tab target. Test in Task 4 (`period_page_not_remembered`).

---

### Task 1: Weekly usual logic

**Files:**
- Create: `app-react/src/features/insights/overview/usualOverTime.ts`
- Test: `app-react/src/features/insights/overview/usualOverTime.test.ts`

**Interfaces:**
- Consumes: `usualAt`, `shift`, `Usual` from `./usual`; `Series` from `./series`; `fromDateStr`, `toDateStr` from `../../today/date`.
- Produces:
  - `export interface Week { week: string; usual: Usual | null }`
  - `export const MIN_WEEKS = 26`
  - `export function usualWeeks(series: Series, leftOut: Set<string>, todayCob: string, from: string): Week[]` — points at `todayCob`, `todayCob − 7`, … while `>= from`, returned ascending.
  - `export const enoughHistory = (weeks: Week[]) => boolean` — ≥ `MIN_WEEKS` non-null.
  - `export type UsualRange = '1y' | '2y' | '3y' | '5y' | 'all'`; `export const USUAL_RANGES: UsualRange[]`
  - `export function rangeStart(r: UsualRange, todayCob: string, first: string): string` — `all` → `first`; else `todayCob` with `setFullYear(year − n)` (calendar years, as `useInsights`' `lastYearEnd` does).
  - `export function offeredRanges(first: string, todayCob: string): UsualRange[]` — each `r ≠ all` with `first < rangeStart(r, …)`, then `'all'` always.
  - `export function openingRange(offered: UsualRange[]): UsualRange` — `'2y'` if offered, else `'1y'` if offered, else `'all'`.
  - `export function rangeSummary(weeks: Week[]): { start: Usual; last: { week: string; usual: Usual }; now: boolean } | null` — first and last non-null in `weeks`; `now` is true when the last non-null is the final week; `null` when none.

- [ ] **Step 1: Write the failing tests**

Reuse the `day`/`fill` helpers from `usual.test.ts` (copy them; `TODAY` from `./fixtures`).

```ts
describe('usualWeeks', () => {
  it('last_point_is_todays_usual', () => {
    const s = fill(0, 400, (i) => 10 + (i % 7))
    const w = usualWeeks(s, none, TODAY, day(-400))
    expect(w[w.length - 1]).toEqual({ week: TODAY, usual: usualAt(s, TODAY, none) })
    expect(w[0].week >= day(-400) && w[1].week === shift(w[0].week, 7)).toBe(true)
  })
  it('gap_over_90_days_breaks_the_line', () => {
    const s = new Map([...fill(0, 60, () => 5), ...fill(250, 400, () => 5)])
    const w = usualWeeks(s, none, TODAY, day(-400))
    const at = (d: number) => w.find((x) => x.week === day(-d))!.usual
    expect(at(0)).not.toBeNull() // 60 days of values
    expect(at(119)).toBeNull()   // 90-day window inside the gap
    expect(at(245)).not.toBeNull()
  })
  it('left_out_days_dont_change_the_result', () => {
    const base = fill(0, 300, () => 5)
    const spiked = new Map(base); for (let i = 100; i <= 130; i++) spiked.set(day(-i), 99)
    const leftOut = new Set(Array.from({ length: 31 }, (_, k) => day(-(100 + k))))
    expect(usualWeeks(spiked, leftOut, TODAY, day(-300))).toEqual(usualWeeks(base, leftOut, TODAY, day(-300)))
  })
  it('needs_26_points', () => {
    // 14 values first gives a usual 7+14 days later; widen `to` until exactly 25 then 26 non-null weeks.
    const weeks = (n: number) => Array.from({ length: n }, (_, i) => ({ week: day(-7 * i), usual: u(1, 2) }))
    expect(enoughHistory([...weeks(25), { week: day(-500), usual: null }])).toBe(false)
    expect(enoughHistory(weeks(26))).toBe(true)
  })
})
describe('ranges', () => {
  it('offers_only_covered_ranges', () => {
    expect(offeredRanges(day(-800), TODAY)).toEqual(['1y', '2y', 'all'])
    expect(rangeStart('2y', '2026-11-05', 'x')).toBe('2024-11-05')
  })
  it('opening_range_falls_back_to_all', () => {
    expect(openingRange(['1y', '2y', '3y', 'all'])).toBe('2y')
    expect(openingRange(['1y', 'all'])).toBe('1y')
    expect(openingRange(['all'])).toBe('all')
  })
})
describe('rangeSummary', () => {
  it('summary_now_and_start', () => {
    const r = rangeSummary([{ week: 'a', usual: null }, { week: 'b', usual: u(1, 3) }, { week: 'c', usual: u(5, 7) }])
    expect(r).toEqual({ start: u(1, 3), last: { week: 'c', usual: u(5, 7) }, now: true })
  })
  it('summary_last_when_now_is_null', () => {
    expect(rangeSummary([{ week: 'b', usual: u(1, 3) }, { week: 'c', usual: null }])?.now).toBe(false)
  })
  it('summary_none_in_range', () => {
    expect(rangeSummary([{ week: 'c', usual: null }])).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/insights/overview/usualOverTime.test.ts`
Expected: FAIL, cannot resolve `./usualOverTime`.

- [ ] **Step 3: Implement the module** with the signatures above. Fix the `gap_over_90_days` offsets if the windows land differently than the comment says (usual window = days −8…−97 plus lookback to 14 values within 365): the assertion that matters is a null in the middle of a > 90-day gap and non-null on both sides.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/insights/overview/usualOverTime.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/insights/overview/usualOverTime.ts app-react/src/features/insights/overview/usualOverTime.test.ts
git commit -m "feat(insights): weekly usual series for Usual over time"
```

---

### Task 2: Strings

**Files:**
- Modify: `app-react/public/locales/{en,ru,uk}/translation.json`

Add to `insights.overview` (the locales test checks the three files share keys):

| key | en | ru | uk |
|---|---|---|---|
| `usualOverTime` | Usual over time | Норма во времени | Норма в часі |
| `usualOverTimeText` | How your usual has moved | Как менялась ваша норма | Як змінювалася ваша норма |

Add a new `insights.usualOverTime` object:

| key | en | ru | uk |
|---|---|---|---|
| `title` | Usual over time | Норма во времени | Норма в часі |
| `intro` | Each week shows your usual as it stood then: your middle range over the 90 days before it, a week behind. Periods marked as left out don't count. | Каждая неделя — ваша норма на тот момент: средний диапазон за 90 дней до неё, с отставанием в неделю. Периоды, отмеченные как исключённые, не учитываются. | Кожен тиждень — ваша норма на той момент: середній діапазон за 90 днів до нього, із запізненням на тиждень. Періоди, позначені як виключені, не враховуються. |
| `now` | Usual now {{now}} · at the start {{start}} | Сейчас {{now}} · в начале {{start}} | Зараз {{now}} · на початку {{start}} |
| `last` | Last usual {{value}} · {{month}} | Последняя норма {{value}} · {{month}} | Остання норма {{value}} · {{month}} |
| `notEnough` | Not enough history yet | Пока мало истории | Поки замало історії |
| `noneInRange` | No usual in this range | В этом периоде нормы нет | У цьому періоді норми немає |
| `tip` | Usual {{median}} · {{p25}}–{{p75}} | Обычно {{median}} · {{p25}}–{{p75}} | Зазвичай {{median}} · {{p25}}–{{p75}} |
| `median` | Median | Медиана | Медіана |
| `chart` | {{name}}: usual by week | {{name}}: норма по неделям | {{name}}: норма за тижнями |

Legend "usual range" reuses `insights.overview.usualRange`. Range chip labels reuse `insights.range1y`…`insights.rangeall`.

- [ ] **Step 1:** Add the keys to all three files.
- [ ] **Step 2:** Run `npx vitest run src/features/insights/locales.test.ts` — Expected: PASS.
- [ ] **Step 3: Commit** `git commit -am "feat(insights): Usual over time strings"`

---

### Task 3: The screen

**Files:**
- Create: `app-react/src/features/insights/overview/UsualOverTime.tsx`
- Modify: `app-react/src/router.tsx` (lazy import next to `Rhythm`, route `{ path: '/insights/usual', element: ui(<UsualOverTime />) }` after `/insights/rhythm`)
- Test: `app-react/src/features/insights/overview/UsualOverTime.test.tsx`

**Interfaces:**
- Consumes: Task 1's exports; `useInsightRows(dataQ, todayCob)`; `loggedDays(entries, todayCob)`; `leftOutDays(periods, todayCob)`; `useMarkedPeriods`; `chartsApi.getReportData`; `RowLabel` (`MeVsNormal.tsx`, takes `{ n: { row }, practices }`); `rowName`, `rowValueText` (`format.ts`); `SettingsSubpage`; `useLayout`; `SegmentedControl`; `useChartTooltip`; `AXIS`, `TipShell`, `TipRow` (`../mobile/InsightsChart`); `formatTick`, `spansYears` (`../insightsLogic`); `clockText` (`../panels/panelLogic`).
- Produces: `export function UsualOverTime()`.

Shape (follow `Rhythm.tsx` / `YearMapScreen.tsx` for loading/error/back, `PeriodDetail.tsx` `RowChart` for the chart):

- `todayCob = toDateStr(new Date())`; `dataQ = useQuery({ queryKey: ['report-data', todayCob, 'AllData'], queryFn: () => chartsApi.getReportData(todayCob, 'AllData') })`; `data = useInsightRows(dataQ, todayCob)`.
- `first = loggedDays(data.entries, todayCob)[0]`. One `useMemo` over `[rows, series, periods, todayCob, first]`: `leftOut`, then per row `weeks = usualWeeks(series.get(row.key) ?? new Map(), leftOut, todayCob, first)`.
- `const [range, setRange] = useState<UsualRange | null>(null)`; shown range is `range ?? openingRange(offeredRanges(first, todayCob))`. Chips: `SegmentedControl` with `offeredRanges(…)`, labels `t('insights.range' + r)`, under the header.
- Per row: `<RowLabel>`, then
  - `!enoughHistory(weeks)` → `notEnough` line, no chart;
  - else `shown = weeks.filter((w) => w.week >= rangeStart(range, todayCob, first))`, `s = rangeSummary(shown)`: `s === null` → `noneInRange`, no chart; `s.now` → `now` line (`start`, `now` = `s.last.usual.median`); else `last` line (month = `Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })`). Values via `rowValueText(row.kind, v, units)`; line in `font-ui-mono text-xs`.
  - chart: `role="img" aria-label={t('insights.usualOverTime.chart', { name })}`, ~140px tall, `ComposedChart` with `Area dataKey={(w) => w.usual ? [w.usual.p25, w.usual.p75] : null}` (`fill var(--ui-chart-1)`, `fillOpacity 0.3`, `stroke none`), `Line dataKey={(w) => w.usual?.median ?? null}` (`stroke var(--ui-chart-1)`, `connectNulls={false}`, `dot={false}`), `CartesianGrid vertical={false} stroke var(--ui-hairline)`, `XAxis dataKey="week"` with `minTickGap` and `formatTick(…, spansYears(…))` like `RowChart`, `YAxis domain={['auto','auto']}` with `clockText` for Clock rows. Tooltip: `TipShell` titled with the week date, one `TipRow` of `tip`.
- Grid: `useLayout() === 'mobile'` → one column, else `grid-cols-2`. Under the rows, a legend: `usualRange` swatch + `median` line. Intro line `intro` at the top.
- `SettingsSubpage wide title={t('insights.usualOverTime.title')} back={{ to: '/charts', label: t('insights.overview.overview') }}`.

- [ ] **Step 1: Write the failing tests**

Mock setup copied from `YearMapScreen.test.tsx` (markedPeriods, charts, practices mocks; `show()`; `FOUR` practices). `data(daysBack)` fills `Кругов за день` daily.

```ts
it('fetches_all_data_and_draws_a_qualifying_row', async () => {
  getReportData.mockImplementation(async () => data(400))
  show(<UsualOverTime />)
  expect(await screen.findByRole('img', { name: /Кругов за день/ })).toBeInTheDocument()
  expect(getReportData).toHaveBeenCalledWith(today, 'AllData')
  expect(screen.getByText(/^Usual now .* · at the start /)).toBeInTheDocument()
})
it('short_history_offers_only_all', async () => {
  getReportData.mockImplementation(async () => data(300))
  show(<UsualOverTime />)
  await screen.findByRole('img', { name: /Кругов за день/ })
  expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
  expect(screen.queryByRole('radio', { name: '1y' })).not.toBeInTheDocument()
})
it('opens_on_2y_and_switches', async () => {
  getReportData.mockImplementation(async () => data(1200))
  show(<UsualOverTime />)
  expect(await screen.findByRole('radio', { name: '2y' })).toBeChecked()
  fireEvent.click(screen.getByRole('radio', { name: '3y' }))
  expect(screen.getByRole('radio', { name: '3y' })).toBeChecked()
})
it('row_without_history_says_so', async () => {
  // rounds for 400 days, bedtime only for the last 60
  ... expect(await screen.findByText('Not enough history yet')).toBeInTheDocument()
})
it('row_with_no_usual_in_range', async () => {
  // rounds logged from day −1100 to day −800 only; range 1y
  ... expect(await screen.findByText('No usual in this range')).toBeInTheDocument()
})
it('clock_row_shows_times', async () => {
  // Отбой at '22:30' daily for 400 days
  ... expect(await screen.findByText(/^Usual now 22:30 · at the start 22:30$/)).toBeInTheDocument()
})
```

The `row_with_no_usual_in_range` case also needs a 2y+ offer; set range by clicking `1y` after load.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/insights/overview/UsualOverTime.test.tsx`
Expected: FAIL, cannot resolve `./UsualOverTime`.

- [ ] **Step 3: Implement `UsualOverTime` and the route** as described above.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/insights/overview/UsualOverTime.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/insights/overview/UsualOverTime.tsx app-react/src/features/insights/overview/UsualOverTime.test.tsx app-react/src/router.tsx
git commit -m "feat(insights): Usual over time screen"
```

---

### Task 4: Overview link and Insights tab memory

**Files:**
- Modify: `app-react/src/features/insights/overview/OverviewLinks.tsx`, `OverviewMobile.tsx`, `OverviewWide.tsx`, `useOverview.ts`
- Modify: `app-react/src/layouts/tabIcons.ts`, `layouts/mobile/MobileShell.tsx`, `layouts/tablet/TabletShell.tsx`, `layouts/desktop/DesktopShell.tsx`
- Test: `app-react/src/features/insights/overview/Overview.test.tsx`, `app-react/src/layouts/mobile/MobileShell.test.tsx`

**Interfaces:**
- Consumes: Task 1's `usualWeeks`, `enoughHistory`; `leftOutDays`.
- Produces:
  - `useOverview()` returns an extra `usualHistory: boolean` — some visible row has `enoughHistory(usualWeeks(series.get(row.key), leftOut, todayCob, logged[0]))` on the **Year** data it already loads (cheap proxy, per spec; no All fetch). `false` when `logged` is empty.
  - `OverviewLinks({ usual }: { usual: boolean })` — third link `{ to: '/insights/usual', title: t('insights.overview.usualOverTime'), text: t('insights.overview.usualOverTimeText') }` only when `usual`. Callers pass `ov.usualHistory`. Three links in a `grid-cols-2` wrap to a second line: fine.
  - In `tabIcons.ts`: `export function insightsTabTo(pathname: string, stored: string | null): string` (pure) and `export function useInsightsTabTo(pathname: string): string` (hook). Key `'insights-page'`; remembered paths `['/insights/year', '/insights/rhythm', '/insights/usual']`. `insightsTabTo`: a remembered path → itself; `'/charts'` → `'/charts'`; else `stored` if it is a remembered path, else `'/charts'`. The hook reads the key at render (try/catch → `null`) and in a `useEffect` on `pathname` writes it for a remembered path, removes it on `'/charts'` (try/catch both).
  - Shells: `const insightsTo = useInsightsTabTo(pathname)`; `NavLink to={tab.to === '/charts' ? insightsTo : tab.to}`; keep `key={tab.to}` and `tabActive(tab.to, …)` unchanged. `TabletShell`/`DesktopShell` already have `pathname`; `MobileShell`'s `TabBar` too.

- [ ] **Step 1: Write the failing tests**

In `Overview.test.tsx` (use its existing data helpers):
```ts
it('usual_link_needs_26_weeks', async () => {
  // with ~300 days of rounds: link present; with ~120 days: regular but no link
  expect(await screen.findByRole('link', { name: /Usual over time/ })).toHaveAttribute('href', '/insights/usual')
  ...
  expect(screen.queryByRole('link', { name: /Usual over time/ })).not.toBeInTheDocument()
  expect(getReportData).not.toHaveBeenCalledWith(expect.anything(), 'AllData')
})
```
In `MobileShell.test.tsx` (render `MobileShell` inside `MemoryRouter initialEntries={[path]}`; read the Insights tab link by its `today.tabInsights` label):
```ts
it('tab_reopens_last_insights_page', () => {
  renderAt('/insights/usual'); cleanup(); renderAt('/yatras')
  expect(insightsTab()).toHaveAttribute('href', '/insights/usual')
  cleanup(); renderAt('/charts'); cleanup(); renderAt('/yatras')
  expect(insightsTab()).toHaveAttribute('href', '/charts')
})
it('period_page_not_remembered', () => {
  renderAt('/insights/rhythm'); cleanup(); renderAt('/insights/period/p1'); cleanup(); renderAt('/')
  expect(insightsTab()).toHaveAttribute('href', '/insights/rhythm')
})
it('tab_survives_blocked_storage', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  renderAt('/insights/year'); cleanup(); renderAt('/yatras')
  expect(insightsTab()).toHaveAttribute('href', '/charts')
})
```
Add `afterEach(() => localStorage.clear())`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/insights/overview/Overview.test.tsx src/layouts/mobile/MobileShell.test.tsx`
Expected: FAIL (no Usual over time link; tab href is `/charts`).

- [ ] **Step 3: Implement** `usualHistory`, the `OverviewLinks` prop, `insightsTabTo` / `useInsightsTabTo`, and the three shell changes.

- [ ] **Step 4: Run the whole frontend suite and lint**

Run: `npm test && npm run lint && npm run build` in `app-react/`
Expected: all pass, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add -A app-react/src
git commit -m "feat(insights): Overview links to Usual over time; Insights tab reopens the last subpage"
```

---

### Task 5: Check it in the app

- [ ] **Step 1:** `make run`, sign in as a `@demo.sadhana.pro` user (seed: `npx tsx scripts/seed-demo.ts` in `static-react/`), open Insights → Overview → Usual over time on mobile (390px), tablet (900px) and desktop widths, light and dark. Check: chips under the header, ribbon gaps on missing stretches, clock row shows times, tooltip on hover/tap.
- [ ] **Step 2:** Leave via the Log tab, tap Insights → lands on `/insights/usual`; open Charts, leave, tap Insights → `/charts`.
- [ ] **Step 3:** Fix anything found, re-run `npm test`, commit.
