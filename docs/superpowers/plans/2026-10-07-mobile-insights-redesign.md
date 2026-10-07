# Mobile Insights Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile Insights viewer (design frames 5a/5b/5c, ⋯ menu from 2c) inside `MobileShell`. It shows one Graph report for a 7d/30d/90d/1y window ending on a chosen day, with a headline, a Recharts chart and a legend card of per-practice averages.

**Architecture:**
- `/charts` gets its own `ByLayout` route, as `/` and `/settings` did. Mobile renders `InsightsMobileScreen`. Tablet and desktop keep the legacy `ChartsPage` in `AppShell`.
- The legacy `ChartsPage` also becomes reachable at `/charts/manage?report=<id>`, so the ⋯ menu's "Edit" can open the old editor.
- Pure logic is split between `pages/charts/chartLogic.ts` (trace building and axis ids, shared with the legacy page) and `features/insights/insightsLogic.ts` (headline, delta, averages, labels).
- `useInsights` holds the selection (remembered in `localStorage`), the range, the end date and the queries.
- The components are thin.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, react-router 7, @tanstack/react-query 5, react-i18next, Recharts 3, Vitest + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-07-mobile-insights-redesign-design.md`

## Global Constraints

- All commands run from `app-react/` on the host. Tests: `npx vitest run <path>`. Types: `npx tsc -b`. Lint: `npm run lint`.
- **No new dependencies.** Charts use the installed `recharts`.
- New code uses only `ui-*` Tailwind colours and CSS vars from `src/ui/theme.css`. No DaisyUI classes (so not the legacy `Spinner` either), and no imports from `src/theme/tokens.ts`.
- Portalled UI goes through `AnchoredMenu` / `BottomSheet`.
- Every user-visible string goes through i18n, with keys in `en`, `ru` and `uk` (`public/locales/*/translation.json`). English test strings also go in `src/test/setup.ts`.
- Dates are local `yyyy-mm-dd` via `toDateStr` from `src/features/today/date.ts`. Never use `toISOString()`.
- Storage key `'insights-report'`. Every read and write is wrapped in try/catch.
- Range → server duration, exactly: `7d → Week`, `30d → Month`, `90d → Quarter`, `1y → Year`. Default `30d`.
- Chart colours, exactly:
  - light `--ui-chart-1…8`: `#E2A24B #D7867A #9DB98A #A99BD6 #0F9E95 #C77A3E #5F82D6 #C2689A`
  - dark `--ui-chart-1…8`: `#EDB45A #E3978B #A9C996 #B7AAE6 #22B89A #E08A4C #7C9DF0 #E07FB0`
- Legacy files touched:
  - `src/pages/charts/ChartsPage.tsx`: use the moved helpers and read `?report=`
  - `src/pages/charts/chartLogic.ts`: add the moved helpers
  - `src/router.tsx`
  - `src/ui/primitives/AnchoredMenu.tsx`: `MenuItem` grows to fit wrapped text
  - `src/ui/theme.css`: new tokens

  Nothing else.
- Commit after every task with a conventional message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Palette note (already checked while writing this plan).** Slots 5–8 were picked with the dataviz validator.
- With slot 4 in front of them, the 4→8 run passes CVD separation (worst ΔE 9.3) and the normal-vision floor (worst 17.2) in both modes.
- The full 8-slot palette still fails chroma, and in dark mode the lightness band. Every one of those failures comes from the mockup's fixed slots 1–4.
- The legend card names every colour, which is the secondary encoding those failures call for.

**Deliberate deviations from the spec (flag in review):**
- Headline and legend durations reuse `formatDuration` from `features/today/values.ts` with `today.unitH` / `today.unitMin`, giving `2 h 8 min` rather than `2h 08m`, so all three languages are covered.
- Positive deltas use a new `--ui-good` token (light `#4F7A3A`, dark `#A9C996`). The theme had no green, so check this against the 5a mockup.
- Dates use the locale's order (`Sep 7` in en, `7 сент.` in ru).

## Review Focus

1. **A window ending today.** Today's half-logged values must not pull the headline, the legend averages or the average lines down. Today is excluded, as `averageForType` already does. Test: Task 2 (`excludes today from the daily total`).
2. **Blocked storage (Safari private mode).** Reading the remembered report must fall back to All practices, and picking a report must not throw. Test: Task 4 (`falls back when storage throws, and select still works`).
3. **A remembered report that is gone or is a Grid.** It was deleted on another device or is now a table, so the screen must show All practices, not a blank chart. Test: Task 4 (`unknown or Grid id falls back to All practices`).
4. **Picking today in the calendar.** That must read as "Ending today", not an amber "Ending Oct 6 ×" pill. Test: Task 4 (`choosing today clears the end date`).
5. **A failed delete.** The confirm sheet must stay open with an error toast, not close as if the delete worked. Test: Task 7 (`keeps the sheet open and shows an error when delete fails`).

---

### Task 1: Shared trace building, axis ids and `?report=` in the legacy page

**Files:**
- Modify: `app-react/src/pages/charts/chartLogic.ts`
- Modify: `app-react/src/pages/charts/ChartsPage.tsx`
- Test: `app-react/src/pages/charts/chartLogic.test.ts`
- Test: `app-react/src/pages/charts/ChartsPage.test.tsx`

**Interfaces:**
- Produces, from `chartLogic.ts`:
  ```ts
  export type AxisId = 'num' | 'num-right' | 'time' | 'unit'
  export interface Trace extends TraceInput { type_: TraceType; color: string; showAverage: boolean; yAxis: string | null }
  export function resolveAxisId(yAxis: string | null, dataType: PracticeDataType): AxisId
  export function tracesFor(report: Report | null, practices: UserPractice[], colors: readonly string[]): Trace[]
  ```
  `report === null` means "All practices".
- `ChartsPage` reads `?report=<id>` as its initial selection.

- [ ] **Step 1: Write the failing tests**

Append to `src/pages/charts/chartLogic.test.ts`, and add `tracesFor, resolveAxisId` to its import from `./chartLogic`:

```ts
import type { Report } from '../../api/charts'
import type { UserPractice } from '../../types/api'

const P: UserPractice[] = [
  { id: 'p1', practice: 'Japa', data_type: 'Duration', is_active: true },
  { id: 'p2', practice: 'Wake up', data_type: 'Time', is_active: true },
  { id: 'p3', practice: 'Old', data_type: 'Int', is_active: false },
]
const COLORS = ['c1', 'c2']

describe('tracesFor', () => {
  it('All practices: every active practice as a regular line, no averages', () => {
    expect(tracesFor(null, P, COLORS)).toEqual([
      { name: 'Japa', dataType: 'Duration', type_: { Line: { style: 'Regular' } }, color: 'c1', showAverage: false, yAxis: null },
      { name: 'Wake up', dataType: 'Time', type_: { Line: { style: 'Regular' } }, color: 'c2', showAverage: false, yAxis: null },
    ])
  })

  it('Graph report: keeps type, average and axis, cycles colours, falls back for unknown practices', () => {
    const report: Report = {
      id: 'r1', name: 'R', definition: { Graph: { bar_layout: 'Stacked', traces: [
        { label: null, type_: 'Bar', practice: 'p1', y_axis: null, show_average: true },
        { label: null, type_: 'Dot', practice: 'p2', y_axis: 'Y2', show_average: false },
        { label: null, type_: { Line: { style: 'Square' } }, practice: 'gone', y_axis: null, show_average: false },
      ] } },
    }
    const t = tracesFor(report, P, COLORS)
    expect(t.map((x) => [x.name, x.dataType, x.type_, x.color, x.showAverage, x.yAxis])).toEqual([
      ['Japa', 'Duration', 'Bar', 'c1', true, null],
      ['Wake up', 'Time', 'Dot', 'c2', false, 'Y2'],
      ['gone', 'Int', { Line: { style: 'Square' } }, 'c1', false, null],
    ])
  })

  it('Grid report: one regular line per practice', () => {
    const grid: Report = { id: 'g', name: 'G', definition: { Grid: { practices: ['p2'] } } }
    expect(tracesFor(grid, P, COLORS).map((x) => x.name)).toEqual(['Wake up'])
  })
})

describe('resolveAxisId', () => {
  it('puts Y2 numeric traces on the right axis only', () => {
    expect(resolveAxisId(null, 'Duration')).toBe('num')
    expect(resolveAxisId('Y2', 'Int')).toBe('num-right')
    expect(resolveAxisId('Y2', 'Time')).toBe('time')
    expect(resolveAxisId(null, 'Bool')).toBe('unit')
    expect(resolveAxisId('Y2', 'Text')).toBe('unit')
  })
})
```

Append to `src/pages/charts/ChartsPage.test.tsx`. Reuse its existing imports and add `Routes, Route, MemoryRouter` if any are missing:

```tsx
describe('ChartsPage ?report=', () => {
  it('opens the report named in the query string', async () => {
    vi.mocked(chartsApi.getReports).mockResolvedValueOnce([
      { id: 'r1', name: 'Weekly', definition: { Graph: { bar_layout: 'Grouped', traces: [] } } },
    ])
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/charts/manage?report=r1']}>
          <Routes><Route path="/charts/manage" element={<ChartsPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('button', { name: /Weekly/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `npx vitest run src/pages/charts`
Expected: FAIL. `tracesFor` and `resolveAxisId` are not exported, and the picker shows "All practices".

- [ ] **Step 3: Implement in `chartLogic.ts`**

Add these imports at the top:

```ts
import type { Report, TraceType } from '../../api/charts'
import type { PracticeDataType, UserPractice } from '../../types/api'
```

The second line replaces the existing `PracticeDataType` import. Then append:

```ts
export type AxisId = 'num' | 'num-right' | 'time' | 'unit'

export interface Trace extends TraceInput {
  type_: TraceType
  color: string
  showAverage: boolean
  yAxis: string | null
}

export function resolveAxisId(yAxis: string | null, dataType: PracticeDataType): AxisId {
  if (yAxis === 'Y2' && axisKindFor(dataType) === 'num') return 'num-right'
  return axisKindFor(dataType)
}

const REGULAR_LINE: TraceType = { Line: { style: 'Regular' } }

/** Traces for a report; `null` = "All practices" (every active practice as a line). Colours go by index. */
export function tracesFor(report: Report | null, practices: UserPractice[], colors: readonly string[]): Trace[] {
  const byId = new Map(practices.map((p) => [p.id, p]))
  const color = (i: number) => colors[i % colors.length]
  const line = (pid: string, i: number): Trace => ({
    name: byId.get(pid)?.practice ?? pid,
    dataType: byId.get(pid)?.data_type ?? 'Int',
    type_: REGULAR_LINE, color: color(i), showAverage: false, yAxis: null,
  })
  if (report === null) return practices.filter((p) => p.is_active).map((p, i) => line(p.id, i))
  if ('Grid' in report.definition) return report.definition.Grid.practices.map(line)
  return report.definition.Graph.traces.map((t, i) => ({
    ...line(t.practice, i), type_: t.type_, showAverage: t.show_average, yAxis: t.y_axis,
  }))
}
```

- [ ] **Step 4: Use them in `ChartsPage.tsx`**

In `ChartPanel`:
- Replace the `activePractices` / `byId` / `traces` block, from `// Build traces for "all practices"` to the end of the `traces` ternary, with:
  ```ts
  const traces = tracesFor(report, practices, TRACE_COLORS)
  ```
- Delete the local `function resolveAxisId(...)`.
- Add `tracesFor, resolveAxisId` to the `./chartLogic` import.
- Drop any import that becomes unused (`axisKindFor`, and `PracticeDataType` if nothing else uses it). `npx tsc -b` will name them.

In `ChartsPage`:
- Add `useSearchParams` to the `react-router-dom` import.
- Replace `const [selectedId, setSelectedId] = useState(ALL_PRACTICES_ID)` with:
  ```ts
  const [searchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState(() => searchParams.get('report') ?? ALL_PRACTICES_ID)
  ```

- [ ] **Step 5: Run the tests and types**

Run: `npx vitest run src/pages/charts && npx tsc -b`
Expected: PASS, with no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/charts
git commit -m "refactor(charts): share tracesFor/resolveAxisId; ChartsPage reads ?report=

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Insights logic (headline, delta, averages, labels)

**Files:**
- Create: `app-react/src/features/insights/insightsLogic.ts`
- Test: `app-react/src/features/insights/insightsLogic.test.ts`

**Interfaces:**
- Consumes: `Trace`, `TraceInput`, `AxisId`, `resolveAxisId`, `valueToNumber`, `averageForType`, `formatMinutesAsHHMM` from `pages/charts/chartLogic`. `formatDuration`, `DurationUnits` from `features/today/values`. `fromDateStr` from `features/today/date`.
- Produces:
  ```ts
  export interface Headline { kind: 'duration' | 'count' | 'time'; value: number; delta: number | null }
  export interface AverageLine { axis: AxisId; value: number; color: string }
  export function averageDailyTotal(rows: ReportDataEntry[], traces: TraceInput[], todayCob: string): number | null
  export function headline(traces: TraceInput[], rows: ReportDataEntry[], prevRows: ReportDataEntry[] | undefined, todayCob: string): Headline | null
  export function formatHeadline(h: Headline, u: DurationUnits): string
  export function formatDelta(pct: number): string                       // '+12%' / '−8%'
  export function averageLines(traces: Trace[], rows: ReportDataEntry[], barLayout: BarLayout, todayCob: string): AverageLine[]
  export function traceAverageLabel(trace: TraceInput, rows: ReportDataEntry[], todayCob: string, u: DurationUnits): string
  export function formatDay(cob: string, locale: string): string          // 'Sep 7'
  export function windowLabel(rows: ReportDataEntry[], locale: string): string  // 'Sep 7 – Oct 6' ('' if empty)
  export function formatDurationTick(min: number, u: DurationUnits): string     // '30m', '1h', '1h30'
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import type { ReportDataEntry } from '../../api/charts'
import type { Trace } from '../../pages/charts/chartLogic'
import {
  averageDailyTotal, headline, formatHeadline, formatDelta, averageLines,
  traceAverageLabel, formatDay, windowLabel, formatDurationTick,
} from './insightsLogic'

const TODAY = '2026-10-06'
const U = { h: 'h', min: 'min' }
const e = (cob_date: string, practice: string, value: unknown): ReportDataEntry => ({ cob_date, practice, value })
const tr = (name: string, dataType: Trace['dataType'], extra: Partial<Trace> = {}): Trace => ({
  name, dataType, type_: { Line: { style: 'Regular' } }, color: `c-${name}`, showAverage: false, yAxis: null, ...extra,
})
const dur = (n: number) => ({ Duration: n })

describe('averageDailyTotal', () => {
  it('sums traces per day, counts missing as 0, floors', () => {
    const rows = [
      e('2026-10-04', 'A', dur(30)), e('2026-10-04', 'B', dur(10)),
      e('2026-10-05', 'A', dur(25)), e('2026-10-05', 'B', null),
      e('2026-10-05', 'Other', dur(999)),
    ]
    expect(averageDailyTotal(rows, [tr('A', 'Duration'), tr('B', 'Duration')], TODAY)).toBe(32) // 65 / 2
  })
  it('excludes today from the daily total', () => {
    const rows = [e('2026-10-05', 'A', dur(60)), e(TODAY, 'A', dur(0))]
    expect(averageDailyTotal(rows, [tr('A', 'Duration')], TODAY)).toBe(60)
  })
  it('is null when nothing was logged', () => {
    expect(averageDailyTotal([e('2026-10-05', 'A', null)], [tr('A', 'Duration')], TODAY)).toBeNull()
  })
})

describe('headline', () => {
  const cur = [e('2026-10-04', 'A', dur(40)), e('2026-10-05', 'A', dur(60))]
  const prev = [e('2026-09-03', 'A', dur(40)), e('2026-09-04', 'A', dur(40))]

  it('all Duration → average daily total with delta', () => {
    expect(headline([tr('A', 'Duration')], cur, prev, TODAY)).toEqual({ kind: 'duration', value: 50, delta: 25 })
  })
  it('all Int → count', () => {
    const rows = [e('2026-10-04', 'N', { Int: 3 }), e('2026-10-05', 'N', { Int: 4 })]
    expect(headline([tr('N', 'Int')], rows, undefined, TODAY)).toEqual({ kind: 'count', value: 3, delta: null })
  })
  it('exactly one Time → its average time, never a delta', () => {
    const rows = [e('2026-10-04', 'W', { Time: { h: 5, m: 0 } }), e('2026-10-05', 'W', { Time: { h: 5, m: 30 } })]
    expect(headline([tr('W', 'Time')], rows, rows, TODAY)).toEqual({ kind: 'time', value: 315, delta: null })
  })
  it('anything else → no headline', () => {
    expect(headline([tr('A', 'Duration'), tr('N', 'Int')], cur, prev, TODAY)).toBeNull()
    expect(headline([tr('B', 'Bool')], cur, prev, TODAY)).toBeNull()
    expect(headline([tr('W', 'Time'), tr('X', 'Time')], cur, prev, TODAY)).toBeNull()
    expect(headline([], cur, prev, TODAY)).toBeNull()
  })
  it('no headline when nothing was logged', () => {
    expect(headline([tr('A', 'Duration')], [e('2026-10-05', 'A', null)], prev, TODAY)).toBeNull()
  })
  it('hides the delta without previous data or when previous is 0', () => {
    expect(headline([tr('A', 'Duration')], cur, undefined, TODAY)!.delta).toBeNull()
    expect(headline([tr('A', 'Duration')], cur, [e('2026-09-04', 'A', null)], TODAY)!.delta).toBeNull()
    expect(headline([tr('A', 'Duration')], cur, [e('2026-09-04', 'A', dur(0))], TODAY)!.delta).toBeNull()
  })
  it('rounds the delta to a whole percent', () => {
    const p45 = [e('2026-09-04', 'A', dur(45))]
    expect(headline([tr('A', 'Duration')], cur, p45, TODAY)!.delta).toBe(11) // 50 vs 45 = 11.1%
    const c40 = [e('2026-10-05', 'A', dur(40))]
    expect(headline([tr('A', 'Duration')], c40, p45, TODAY)!.delta).toBe(-11)
  })
})

describe('formatting', () => {
  it('formatHeadline per kind', () => {
    expect(formatHeadline({ kind: 'duration', value: 128, delta: null }, U)).toBe('2 h 8 min')
    expect(formatHeadline({ kind: 'count', value: 16, delta: null }, U)).toBe('16')
    expect(formatHeadline({ kind: 'time', value: 1470, delta: null }, U)).toBe('00:30')
  })
  it('formatDelta signs', () => {
    expect(formatDelta(12)).toBe('+12%')
    expect(formatDelta(-8)).toBe('−8%')
    expect(formatDelta(0)).toBe('+0%')
  })
  it('formatDurationTick', () => {
    const u = { h: 'h', min: 'm' }
    expect([30, 60, 90, 125, 0].map((m) => formatDurationTick(m, u))).toEqual(['30m', '1h', '1h30', '2h05', '0m'])
  })
  it('window labels', () => {
    expect(formatDay('2026-09-07', 'en')).toBe('Sep 7')
    expect(windowLabel([e('2026-09-07', 'A', null), e('2026-10-06', 'A', null)], 'en')).toBe('Sep 7 – Oct 6')
    expect(windowLabel([], 'en')).toBe('')
  })
})

describe('traceAverageLabel', () => {
  it('yes/no shows done over past days', () => {
    const rows = [
      e('2026-10-03', 'R', { Bool: true }), e('2026-10-04', 'R', { Bool: false }),
      e('2026-10-05', 'R', { Bool: true }), e(TODAY, 'R', { Bool: true }),
    ]
    expect(traceAverageLabel(tr('R', 'Bool'), rows, TODAY, U)).toBe('2/3')
  })
  it('duration, time, count and no data', () => {
    expect(traceAverageLabel(tr('A', 'Duration'), [e('2026-10-05', 'A', dur(128))], TODAY, U)).toBe('2 h 8 min')
    expect(traceAverageLabel(tr('W', 'Time'), [e('2026-10-05', 'W', { Time: { h: 5, m: 15 } })], TODAY, U)).toBe('05:15')
    expect(traceAverageLabel(tr('N', 'Int'), [e('2026-10-05', 'N', { Int: 7 })], TODAY, U)).toBe('7')
    expect(traceAverageLabel(tr('N', 'Int'), [], TODAY, U)).toBe('—')
  })
})

describe('averageLines', () => {
  const rows = [e('2026-10-05', 'A', dur(30)), e('2026-10-05', 'B', dur(20))]
  it('one line per trace with show_average, in its colour and on its axis', () => {
    const traces = [tr('A', 'Duration', { showAverage: true, yAxis: 'Y2' }), tr('B', 'Duration')]
    expect(averageLines(traces, rows, 'Grouped', TODAY)).toEqual([{ axis: 'num-right', value: 30, color: 'c-A' }])
  })
  it('stacked: one accent line at the average total of the bars', () => {
    const traces = [tr('A', 'Duration', { type_: 'Bar', showAverage: true }), tr('B', 'Duration', { type_: 'Bar' })]
    expect(averageLines(traces, rows, 'Stacked', TODAY)).toEqual([{ axis: 'num', value: 50, color: 'var(--ui-accent)' }])
  })
  it('none when no trace asks for one', () => {
    expect(averageLines([tr('A', 'Duration', { type_: 'Bar' })], rows, 'Stacked', TODAY)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run src/features/insights/insightsLogic.test.ts`
Expected: FAIL, because `./insightsLogic` can't be resolved.

- [ ] **Step 3: Implement**

```ts
import type { BarLayout, ReportDataEntry } from '../../api/charts'
import {
  averageForType, formatMinutesAsHHMM, resolveAxisId, valueToNumber,
  type AxisId, type Trace, type TraceInput,
} from '../../pages/charts/chartLogic'
import { fromDateStr } from '../today/date'
import { formatDuration, type DurationUnits } from '../today/values'

export interface Headline { kind: 'duration' | 'count' | 'time'; value: number; delta: number | null }
export interface AverageLine { axis: AxisId; value: number; color: string }

const forTrace = (rows: ReportDataEntry[], name: string) => rows.filter((e) => e.practice === name)

/** Mean over the window's days (today excluded, missing = 0) of the traces' summed values; null if nothing was logged. */
export function averageDailyTotal(rows: ReportDataEntry[], traces: TraceInput[], todayCob: string): number | null {
  const types = new Map(traces.map((t) => [t.name, t.dataType]))
  const days = new Set<string>()
  let sum = 0
  let any = false
  for (const e of rows) {
    const dt = types.get(e.practice)
    if (!dt || e.cob_date === todayCob) continue
    days.add(e.cob_date)
    const v = valueToNumber(e.value, dt)
    if (v !== null) { sum += v; any = true }
  }
  return any ? Math.floor(sum / days.size) : null
}

export function headline(
  traces: TraceInput[], rows: ReportDataEntry[], prevRows: ReportDataEntry[] | undefined, todayCob: string,
): Headline | null {
  if (traces.length === 1 && traces[0].dataType === 'Time') {
    const value = averageForType(forTrace(rows, traces[0].name), 'Time', todayCob)
    return value === null ? null : { kind: 'time', value, delta: null }
  }
  const all = (dt: TraceInput['dataType']) => traces.length > 0 && traces.every((t) => t.dataType === dt)
  const kind = all('Duration') ? 'duration' : all('Int') ? 'count' : null
  if (!kind) return null
  const value = averageDailyTotal(rows, traces, todayCob)
  if (value === null) return null
  const prev = prevRows ? averageDailyTotal(prevRows, traces, todayCob) : null
  return { kind, value, delta: prev ? Math.round(((value - prev) / prev) * 100) : null }
}

export function formatHeadline(h: Headline, u: DurationUnits): string {
  if (h.kind === 'duration') return formatDuration(h.value, u)
  if (h.kind === 'time') return formatMinutesAsHHMM(h.value)
  return String(h.value)
}

export function formatDelta(pct: number): string {
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}%`
}

// ponytail: a stacked report's single line uses the first bar's axis; stacks split across Y1/Y2 get no second line.
export function averageLines(traces: Trace[], rows: ReportDataEntry[], barLayout: BarLayout, todayCob: string): AverageLine[] {
  if (!traces.some((t) => t.showAverage)) return []
  const bars = traces.filter((t) => t.type_ === 'Bar')
  if (barLayout === 'Stacked' && bars.length) {
    const value = averageDailyTotal(rows, bars, todayCob)
    return value === null ? [] : [{ axis: resolveAxisId(bars[0].yAxis, bars[0].dataType), value, color: 'var(--ui-accent)' }]
  }
  return traces.filter((t) => t.showAverage).flatMap((t) => {
    const value = averageForType(forTrace(rows, t.name), t.dataType, todayCob)
    return value === null ? [] : [{ axis: resolveAxisId(t.yAxis, t.dataType), value, color: t.color }]
  })
}

export function traceAverageLabel(trace: TraceInput, rows: ReportDataEntry[], todayCob: string, u: DurationUnits): string {
  const entries = forTrace(rows, trace.name)
  if (trace.dataType === 'Bool' || trace.dataType === 'Text') {
    const past = entries.filter((e) => e.cob_date !== todayCob)
    const done = past.filter((e) => valueToNumber(e.value, trace.dataType) === 1).length
    return `${done}/${past.length}`
  }
  const avg = averageForType(entries, trace.dataType, todayCob)
  if (avg === null) return '—'
  if (trace.dataType === 'Duration') return formatDuration(avg, u)
  if (trace.dataType === 'Time') return formatMinutesAsHHMM(avg)
  return String(avg)
}

export function formatDay(cob: string, locale: string): string {
  return fromDateStr(cob).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

export function windowLabel(rows: ReportDataEntry[], locale: string): string {
  if (!rows.length) return ''
  return `${formatDay(rows[0].cob_date, locale)} – ${formatDay(rows[rows.length - 1].cob_date, locale)}`
}

export function formatDurationTick(min: number, u: DurationUnits): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}${u.min}`
  return m === 0 ? `${h}${u.h}` : `${h}${u.h}${String(m).padStart(2, '0')}`
}
```

- [ ] **Step 4: Run the test and check it passes**

Run: `npx vitest run src/features/insights/insightsLogic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/insights/insightsLogic.ts src/features/insights/insightsLogic.test.ts
git commit -m "feat(insights): headline, delta, averages and label logic

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Strings in en/ru/uk

**Files:**
- Modify: `app-react/public/locales/en/translation.json`, `ru/translation.json`, `uk/translation.json` (a new top-level `insights` object)
- Modify: `app-react/src/test/setup.ts` (the English `insights` block)
- Create: `app-react/src/features/insights/locales.test.ts`

**Interfaces:**
- Produces the keys `insights.*` listed below.
- The new screen also reuses these existing keys:
  - `charts.allPractices`, `charts.shareLink`, `charts.downloadCsv`, `charts.copied`, `charts.deleteTitle`, `charts.deleteMsg`
  - `common.cancel`, `common.delete`, `common.error`, `common.loading`
  - `today.more`, `today.unitH`, `today.unitMin`, `today.calendar`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'

type Dict = { insights?: Record<string, string> }
const files = import.meta.glob<Dict>('../../../public/locales/*/translation.json', { eager: true, import: 'default' })

const KEYS = [
  'title', 'reports', 'range', 'range7d', 'range30d', 'range90d', 'range1y',
  'endingToday', 'endingOn', 'resetEnd', 'dailyAverage', 'average',
  'vsPrev7d', 'vsPrev30d', 'vsPrev90d', 'vsPrev1y', 'noData', 'loadFailed',
  'legend', 'tickMin', 'newChart', 'editReport', 'deleteReport',
]

describe('insights.* translations', () => {
  it('has every key in en, ru and uk', () => {
    const langs = Object.keys(files).map((p) => /locales\/(\w+)\//.exec(p)![1]).sort()
    expect(langs).toEqual(['en', 'ru', 'uk'])
    for (const [path, dict] of Object.entries(files)) {
      for (const k of KEYS) expect(dict.insights?.[k], `${path} insights.${k}`).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run src/features/insights/locales.test.ts`
Expected: FAIL on `insights.title`.

- [ ] **Step 3: Add the strings**

Add an `"insights"` object, after `"today"`, to each file.

en:
```json
"insights": {
  "title": "Insights",
  "reports": "Reports",
  "range": "Range",
  "range7d": "7d", "range30d": "30d", "range90d": "90d", "range1y": "1y",
  "endingToday": "Ending today",
  "endingOn": "Ending {{date}}",
  "resetEnd": "Back to today",
  "dailyAverage": "Daily average · {{range}}",
  "average": "Average · {{range}}",
  "vsPrev7d": "{{delta}} vs previous 7 days",
  "vsPrev30d": "{{delta}} vs previous 30 days",
  "vsPrev90d": "{{delta}} vs previous 90 days",
  "vsPrev1y": "{{delta}} vs previous year",
  "noData": "No data in this range",
  "loadFailed": "Couldn't load data",
  "legend": "Averages",
  "tickMin": "m",
  "newChart": "New chart",
  "editReport": "Edit “{{name}}”",
  "deleteReport": "Delete report"
}
```

ru:
```json
"insights": {
  "title": "Аналитика",
  "reports": "Отчёты",
  "range": "Период",
  "range7d": "7д", "range30d": "30д", "range90d": "90д", "range1y": "1г",
  "endingToday": "По сегодня",
  "endingOn": "По {{date}}",
  "resetEnd": "Вернуться к сегодня",
  "dailyAverage": "В среднем за день · {{range}}",
  "average": "В среднем · {{range}}",
  "vsPrev7d": "{{delta}} к предыдущим 7 дням",
  "vsPrev30d": "{{delta}} к предыдущим 30 дням",
  "vsPrev90d": "{{delta}} к предыдущим 90 дням",
  "vsPrev1y": "{{delta}} к предыдущему году",
  "noData": "Нет данных за этот период",
  "loadFailed": "Не удалось загрузить данные",
  "legend": "Средние",
  "tickMin": "м",
  "newChart": "Новый график",
  "editReport": "Изменить «{{name}}»",
  "deleteReport": "Удалить отчёт"
}
```

uk:
```json
"insights": {
  "title": "Аналітика",
  "reports": "Звіти",
  "range": "Період",
  "range7d": "7д", "range30d": "30д", "range90d": "90д", "range1y": "1р",
  "endingToday": "По сьогодні",
  "endingOn": "По {{date}}",
  "resetEnd": "Повернутися до сьогодні",
  "dailyAverage": "У середньому за день · {{range}}",
  "average": "У середньому · {{range}}",
  "vsPrev7d": "{{delta}} до попередніх 7 днів",
  "vsPrev30d": "{{delta}} до попередніх 30 днів",
  "vsPrev90d": "{{delta}} до попередніх 90 днів",
  "vsPrev1y": "{{delta}} до попереднього року",
  "noData": "Немає даних за цей період",
  "loadFailed": "Не вдалося завантажити дані",
  "legend": "Середні",
  "tickMin": "хв",
  "newChart": "Новий графік",
  "editReport": "Змінити «{{name}}»",
  "deleteReport": "Видалити звіт"
}
```

In `src/test/setup.ts`, add the same English block as a JS object (`insights: { title: 'Insights', … }`) next to `today: {`.

- [ ] **Step 4: Run the test and check it passes**

Run: `npx vitest run src/features/insights/locales.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/locales src/test/setup.ts src/features/insights/locales.test.ts
git commit -m "feat(insights): strings for the mobile Insights screen in en/ru/uk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `useInsights` hook

**Files:**
- Create: `app-react/src/features/insights/useInsights.ts`
- Test: `app-react/src/features/insights/useInsights.test.tsx`

**Interfaces:**
- Consumes:
  - `chartsApi.getReports` / `getReportData(cob, duration)`
  - `practicesApi.getUserPractices`
  - `tracesFor`, `buildChartData`, `Trace`, `ChartDataRow` from Task 1 / `chartLogic`
  - `headline`, `averageLines`, `Headline`, `AverageLine` from Task 2
  - `toDateStr`, `fromDateStr`, `addDays` from `features/today/date`
- Produces:
  ```ts
  export const ALL = '__all__'
  export type Range = '7d' | '30d' | '90d' | '1y'
  export const RANGES: Range[]
  export type GraphReportRow = Report & { definition: { Graph: GraphReport } }
  export function useInsights(): {
    reports: GraphReportRow[]            // Graph reports only, in API order
    report: GraphReportRow | null        // null = All practices
    selectedId: string                   // report.id or ALL
    select(id: string): void             // also writes localStorage['insights-report']
    range: Range; setRange(r: Range): void
    end: Date | null                     // null = today
    setEnd(d: Date | null): void         // picking today stores null
    todayCob: string
    traces: Trace[]
    entries: ReportDataEntry[]           // current window, raw
    rows: ChartDataRow[]                 // for the chart
    barLayout: BarLayout
    headline: Headline | null
    averages: AverageLine[]
    hasData: boolean
    isLoading: boolean
    isError: boolean
  }
  ```

- [ ] **Step 1: Write the failing test**

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useInsights, ALL } from './useInsights'

vi.mock('../../api/charts', () => ({ chartsApi: { getReports: vi.fn(), getReportData: vi.fn() } }))
vi.mock('../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
import { chartsApi } from '../../api/charts'
import { practicesApi } from '../../api/practices'
const charts = vi.mocked(chartsApi)
const practices = vi.mocked(practicesApi)

const GRAPH = { id: 'r1', name: 'Japa', definition: { Graph: { bar_layout: 'Grouped' as const, traces: [
  { label: null, type_: 'Bar' as const, practice: 'p1', y_axis: null, show_average: true },
] } } }
const GRID = { id: 'g1', name: 'Grid', definition: { Grid: { practices: ['p1'] } } }

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return renderHook(() => useInsights(), { wrapper })
}

describe('useInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 9))
    charts.getReports.mockResolvedValue([GRAPH, GRID])
    practices.getUserPractices.mockResolvedValue([{ id: 'p1', practice: 'Japa', data_type: 'Duration', is_active: true }])
    charts.getReportData.mockImplementation(async (cob) =>
      cob === '2026-10-06' ? [{ cob_date: '2026-09-07', practice: 'Japa', value: { Duration: 30 } }] : [])
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear() })

  it('lists Graph reports only and defaults to All practices', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.reports.map((r) => r.id)).toEqual(['r1'])
    expect(result.current.selectedId).toBe(ALL)
    expect(result.current.traces.map((t) => t.name)).toEqual(['Japa'])
  })

  it('restores a stored id', async () => {
    localStorage.setItem('insights-report', 'r1')
    const { result } = setup()
    await waitFor(() => expect(result.current.report?.id).toBe('r1'))
    expect(result.current.traces[0].showAverage).toBe(true)
  })

  it.each(['zzz', 'g1'])('unknown or Grid id %s falls back to All practices', async (id) => {
    localStorage.setItem('insights-report', id)
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.selectedId).toBe(ALL)
  })

  it('writes a selection change to storage', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.select('r1'))
    expect(localStorage.getItem('insights-report')).toBe('r1')
    expect(result.current.selectedId).toBe('r1')
  })

  it('falls back when storage throws, and select still works', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.selectedId).toBe(ALL)
    act(() => result.current.select('r1'))
    expect(result.current.selectedId).toBe('r1')
  })

  it('fetches the 30d window ending today, then the previous window ending the day before its first row', async () => {
    setup()
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-09-06', 'Month'))
    expect(charts.getReportData).toHaveBeenCalledWith('2026-10-06', 'Month')
  })

  it('maps the range to the server duration and the end date to a local yyyy-mm-dd', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.setRange('1y'); result.current.setEnd(new Date(2026, 8, 30)) })
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-09-30', 'Year'))
  })

  it('choosing today clears the end date', async () => {
    const { result } = setup()
    act(() => result.current.setEnd(new Date(2026, 9, 6, 18)))
    expect(result.current.end).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run src/features/insights/useInsights.test.tsx`
Expected: FAIL, because `./useInsights` can't be resolved.

- [ ] **Step 3: Implement**

```ts
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../api/charts'
import type { GraphReport, Report, ReportDuration } from '../../api/charts'
import { practicesApi } from '../../api/practices'
import { buildChartData, tracesFor } from '../../pages/charts/chartLogic'
import { addDays, fromDateStr, toDateStr } from '../today/date'
import { averageLines, headline } from './insightsLogic'

export const ALL = '__all__'
const KEY = 'insights-report'
const COLORS = Array.from({ length: 8 }, (_, i) => `var(--ui-chart-${i + 1})`)

export type Range = '7d' | '30d' | '90d' | '1y'
export const RANGES: Range[] = ['7d', '30d', '90d', '1y']
const DURATION: Record<Range, ReportDuration> = { '7d': 'Week', '30d': 'Month', '90d': 'Quarter', '1y': 'Year' }

export type GraphReportRow = Report & { definition: { Graph: GraphReport } }
const isGraph = (r: Report): r is GraphReportRow => 'Graph' in r.definition

function readStored(): string {
  try { return localStorage.getItem(KEY) ?? ALL } catch { return ALL }
}

function writeStored(id: string) {
  try { localStorage.setItem(KEY, id) } catch { /* blocked storage: the choice lasts for this visit */ }
}

export function useInsights() {
  const { i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const reportsQ = useQuery({ queryKey: ['reports'], queryFn: chartsApi.getReports })
  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const [stored, setStored] = useState(readStored)
  const [range, setRange] = useState<Range>('30d')
  const [end, setEndState] = useState<Date | null>(null)

  const reports = (reportsQ.data ?? []).filter(isGraph)
  // An unknown, deleted or Grid id simply isn't found, so the screen shows All practices.
  const report = reports.find((r) => r.id === stored) ?? null
  const duration = DURATION[range]
  const todayCob = toDateStr(new Date())
  const endCob = end ? toDateStr(end) : todayCob

  const current = useQuery({
    queryKey: ['report-data', endCob, duration],
    queryFn: () => chartsApi.getReportData(endCob, duration),
  })
  // From the response, so it matches the server's calendar-month/-year arithmetic.
  const first = current.data?.[0]?.cob_date
  const prevEnd = first ? toDateStr(addDays(fromDateStr(first), -1)) : null
  const previous = useQuery({
    queryKey: ['report-data', prevEnd, duration],
    queryFn: () => chartsApi.getReportData(prevEnd!, duration),
    enabled: prevEnd !== null,
  })

  const traces = tracesFor(report, practicesQ.data ?? [], COLORS)
  const entries = current.data ?? []
  const names = new Set(traces.map((t) => t.name))
  const barLayout = report?.definition.Graph.bar_layout ?? 'Grouped'

  return {
    reports,
    report,
    selectedId: report?.id ?? ALL,
    select: (id: string) => { setStored(id); writeStored(id) },
    range,
    setRange,
    end,
    setEnd: (d: Date | null) => setEndState(d && toDateStr(d) !== todayCob ? d : null),
    todayCob,
    traces,
    entries,
    rows: buildChartData(entries, traces, locale),
    barLayout,
    headline: headline(traces, entries, previous.data, todayCob),
    averages: averageLines(traces, entries, barLayout, todayCob),
    hasData: entries.some((e) => names.has(e.practice) && e.value !== null && e.value !== undefined),
    isLoading: reportsQ.isLoading || practicesQ.isLoading || current.isLoading,
    isError: current.isError,
  }
}
```

- [ ] **Step 4: Run the test and check it passes**

Run: `npx vitest run src/features/insights/useInsights.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/insights/useInsights.ts src/features/insights/useInsights.test.tsx
git commit -m "feat(insights): useInsights with remembered report, range and end date

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Chart colour tokens and the Recharts chart

Recharts doesn't render SVG in jsdom (`ResponsiveContainer` has no size), so this task is checked by types here and visually in Task 8.

**Files:**
- Modify: `app-react/src/ui/theme.css`
- Create: `app-react/src/features/insights/mobile/InsightsChart.tsx`

**Interfaces:**
- Consumes:
  - `Trace`, `ChartDataRow`, `AxisId`, `resolveAxisId`, `formatMinutesAsHHMM` from `chartLogic`
  - `AverageLine`, `formatDay`, `formatDurationTick` from `insightsLogic`
- Produces:
  ```tsx
  export function InsightsChart(props: { rows: ChartDataRow[]; traces: Trace[]; barLayout: BarLayout; averages: AverageLine[] }): JSX.Element
  ```
- Produces the CSS tokens `--ui-chart-1…8` and `--ui-good` (Tailwind `text-ui-good`).

- [ ] **Step 1: Add the tokens to `theme.css`**

In the light `.ui-root` block, after `--ui-on-primary`:
```css
  --ui-good: #4F7A3A;
  /* Chart series, in fixed order. Slots 1–4 from the 5a mockup; 5–8 checked with the dataviz validator. */
  --ui-chart-1: #E2A24B;
  --ui-chart-2: #D7867A;
  --ui-chart-3: #9DB98A;
  --ui-chart-4: #A99BD6;
  --ui-chart-5: #0F9E95;
  --ui-chart-6: #C77A3E;
  --ui-chart-7: #5F82D6;
  --ui-chart-8: #C2689A;
```

In **both** dark blocks (`:root[data-ui-theme='dark'] .ui-root` and the `prefers-color-scheme` copy), after `--ui-on-primary`:
```css
  --ui-good: #A9C996;
  --ui-chart-1: #EDB45A;
  --ui-chart-2: #E3978B;
  --ui-chart-3: #A9C996;
  --ui-chart-4: #B7AAE6;
  --ui-chart-5: #22B89A;
  --ui-chart-6: #E08A4C;
  --ui-chart-7: #7C9DF0;
  --ui-chart-8: #E07FB0;
```

In `@theme inline`, add `--color-ui-good: var(--ui-good);`. The chart vars are only used through inline styles and SVG attributes, so they need no Tailwind mapping.

- [ ] **Step 2: Write `InsightsChart.tsx`**

```tsx
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import type { BarLayout } from '../../../api/charts'
import { formatMinutesAsHHMM, resolveAxisId, type AxisId, type ChartDataRow, type Trace } from '../../../pages/charts/chartLogic'
import { formatDay, formatDurationTick, type AverageLine } from '../insightsLogic'

const TICK = { fontSize: 11, fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fill: 'var(--ui-muted)' }
const AXIS = { tick: TICK, tickLine: false, axisLine: false } as const

interface InsightsChartProps { rows: ChartDataRow[]; traces: Trace[]; barLayout: BarLayout; averages: AverageLine[] }

// Colours are var(--ui-chart-n) strings in SVG attributes. If iOS Safari ignores them (Task 8 check),
// resolve them with getComputedStyle on the .ui-root ancestor instead.
export function InsightsChart({ rows, traces, barLayout, averages }: InsightsChartProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const units = { h: t('today.unitH'), min: t('insights.tickMin') }
  const axisOf = (tr: Trace) => resolveAxisId(tr.yAxis, tr.dataType)
  const used = new Set(traces.map(axisOf))
  const numTick = (axis: AxisId) =>
    traces.filter((tr) => axisOf(tr) === axis).every((tr) => tr.dataType === 'Duration')
      ? (v: number) => formatDurationTick(v, units)
      : (v: number) => String(v)
  const xTicks = rows.length
    ? [...new Set([rows[0], rows[Math.floor((rows.length - 1) / 2)], rows[rows.length - 1]].map((r) => r.cob))]
    : []
  const stacked = barLayout === 'Stacked'
  const topBar = traces.filter((tr) => tr.type_ === 'Bar').at(-1)

  return (
    <ResponsiveContainer width="100%" height={170}>
      <ComposedChart data={rows} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--ui-hairline)" />
        <XAxis dataKey="cob" ticks={xTicks} interval={0} tickFormatter={(c: string) => formatDay(c, locale)} {...AXIS} />
        {used.has('num') && <YAxis yAxisId="num" orientation="left" width={40} domain={[0, 'auto']} tickFormatter={numTick('num')} {...AXIS} />}
        {used.has('num-right') && <YAxis yAxisId="num-right" orientation="right" width={40} domain={[0, 'auto']} tickFormatter={numTick('num-right')} {...AXIS} />}
        {used.has('time') && (
          <YAxis yAxisId="time" orientation={used.has('num') ? 'right' : 'left'} width={44} domain={['auto', 'auto']}
            tickFormatter={formatMinutesAsHHMM} {...AXIS} />
        )}
        {used.has('unit') && <YAxis yAxisId="unit" hide domain={[0, 1.1]} />}
        {traces.map((tr) => {
          const axis = axisOf(tr)
          if (tr.type_ === 'Bar') {
            // ponytail: only the last bar trace gets rounded tops when stacked; a day where it's 0 shows a square top.
            const rounded = !stacked || tr === topBar
            return (
              <Bar key={tr.name} yAxisId={axis} dataKey={tr.name} fill={tr.color} stackId={stacked ? axis : undefined}
                radius={rounded ? [4, 4, 0, 0] : 0} maxBarSize={16} isAnimationActive={false} />
            )
          }
          if (tr.type_ === 'Dot') {
            return (
              <Line key={tr.name} yAxisId={axis} dataKey={tr.name} stroke="none" isAnimationActive={false}
                dot={{ r: 4, fill: tr.color, strokeWidth: 0 }} activeDot={false} />
            )
          }
          return (
            <Line key={tr.name} yAxisId={axis} dataKey={tr.name} type={tr.type_.Line.style === 'Square' ? 'stepAfter' : 'monotone'}
              stroke={tr.color} strokeWidth={2} dot={{ r: 2.5, fill: tr.color, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
          )
        })}
        {averages.map((a, i) => (
          <ReferenceLine key={i} yAxisId={a.axis} y={a.value} stroke={a.color} strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors. If Recharts' types reject `radius={0}`, use `radius={[0, 0, 0, 0]}`.

- [ ] **Step 4: Commit**

```bash
git add src/ui/theme.css src/features/insights/mobile/InsightsChart.tsx
git commit -m "feat(insights): chart colour tokens and the Recharts chart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The mobile screen (report menu, range, end date, cards)

**Files:**
- Modify: `app-react/src/ui/primitives/AnchoredMenu.tsx` (`MenuItem` grows to fit wrapped text)
- Create: `app-react/src/features/insights/mobile/ReportMenu.tsx`
- Create: `app-react/src/features/insights/mobile/EndDateControl.tsx`
- Create: `app-react/src/features/insights/mobile/InsightsMobile.tsx`
- Test: `app-react/src/features/insights/mobile/InsightsMobile.test.tsx`

**Interfaces:**
- Consumes:
  - `useInsights`, `ALL`, `RANGES`, `GraphReportRow` (Task 4)
  - `InsightsChart` (Task 5)
  - `formatHeadline`, `formatDelta`, `traceAverageLabel`, `windowLabel`, `formatDay` (Task 2)
  - `CalendarSheet` from `features/today/mobile/CalendarSheet`
  - `AppBar`, `MobileShell`, `SegmentedControl`, `AnchoredMenu`/`MenuItem`
- Produces:
  - `InsightsMobile`, and `InsightsMobileScreen` (wrapped in `MobileShell`), for the router in Task 8.
  - The ⋯ actions are added in Task 7. Here `AppBar` gets no `actions`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { InsightsMobileScreen } from './InsightsMobile'
import { setViewportWidth } from '../../../test/viewport'

vi.mock('../../../api/charts', () => ({
  chartsApi: { getReports: vi.fn(), getReportData: vi.fn(), deleteReport: vi.fn() },
}))
vi.mock('../../../api/practices', () => ({
  practicesApi: { getUserPractices: vi.fn(), getIncompleteDays: vi.fn() },
}))
import { chartsApi } from '../../../api/charts'
import { practicesApi } from '../../../api/practices'
const charts = vi.mocked(chartsApi)
const practices = vi.mocked(practicesApi)

const LONG = 'Morning sadhana with a very long report name'

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/charts']}><InsightsMobileScreen /></MemoryRouter>
    </QueryClientProvider>,
  )
}

// The ▾ is aria-hidden, so the link's accessible name is just the report name.
const reportLink = () => screen.findByRole('button', { name: /^(All practices|Morning sadhana)/ })

describe('InsightsMobile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(390)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 9))
    practices.getUserPractices.mockResolvedValue([
      { id: 'p1', practice: 'Japa', data_type: 'Duration', is_active: true },
      { id: 'p2', practice: 'Reading', data_type: 'Duration', is_active: true },
    ])
    practices.getIncompleteDays.mockResolvedValue([])
    charts.getReports.mockResolvedValue([
      { id: 'r1', name: LONG, definition: { Graph: { bar_layout: 'Stacked', traces: [
        { label: null, type_: 'Bar', practice: 'p1', y_axis: null, show_average: true },
      ] } } },
      { id: 'g1', name: 'Grid one', definition: { Grid: { practices: ['p1'] } } },
    ])
    charts.getReportData.mockImplementation(async (cob) =>
      cob === '2026-10-04'
        ? [{ cob_date: '2026-10-04', practice: 'Japa', value: { Duration: 40 } }]
        : [
            { cob_date: '2026-10-05', practice: 'Japa', value: { Duration: 60 } },
            { cob_date: '2026-10-06', practice: 'Japa', value: { Duration: 30 } },
          ])
  })
  afterEach(() => { vi.useRealTimers(); localStorage.clear() })

  it('shows the headline, delta, window and legend for All practices', async () => {
    renderScreen()
    // Today (Oct 6) is excluded: the headline is Oct 5's 60 min; the previous window (Oct 4) had 40 → +50%.
    expect(await screen.findByText('+50% vs previous 30 days')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Insights' })).toBeInTheDocument()
    expect(screen.getByText('Daily average · Oct 5 – Oct 6')).toBeInTheDocument()
    expect(screen.getAllByText('1 h')).toHaveLength(2) // headline + Japa legend row
    const legend = screen.getByRole('list', { name: 'Averages' })
    expect(within(legend).getByText('Japa').parentElement).toHaveTextContent('1 h')
    expect(within(legend).getByText('Reading').parentElement).toHaveTextContent('—')
  })

  it('switches reports through the menu; Grid reports are not listed', async () => {
    renderScreen()
    fireEvent.click(await reportLink())
    const menu = screen.getByRole('menu', { name: 'Reports' })
    expect(within(menu).getByRole('menuitemradio', { name: 'All practices' })).toHaveAttribute('aria-checked', 'true')
    expect(within(menu).queryByText('Grid one')).toBeNull()
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: LONG }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(await reportLink()).toHaveTextContent(LONG)
    expect(localStorage.getItem('insights-report')).toBe('r1')
  })

  it('switches the range', async () => {
    renderScreen()
    await screen.findByText('+50% vs previous 30 days')
    fireEvent.click(screen.getByRole('radio', { name: '7d' }))
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-10-06', 'Week'))
  })

  it('a past end date shows the amber pill, and × resets it to today', async () => {
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: /Ending today/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Calendar' })).getByRole('button', { name: 'Wednesday, September 30' }))
    expect(await screen.findByRole('button', { name: 'Ending Sep 30' })).toBeInTheDocument()
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-09-30', 'Month'))
    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(screen.getByRole('button', { name: /Ending today/ })).toBeInTheDocument()
  })

  it('shows "No data in this range" when nothing was logged', async () => {
    charts.getReportData.mockResolvedValue([{ cob_date: '2026-10-05', practice: 'Japa', value: null }])
    renderScreen()
    expect(await screen.findByText('No data in this range')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Averages' })).toBeNull()
  })

  it('shows an inline error when the data request fails', async () => {
    charts.getReportData.mockRejectedValue(new Error('boom'))
    renderScreen()
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load data")
  })
})
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run src/features/insights/mobile/InsightsMobile.test.tsx`
Expected: FAIL, because `./InsightsMobile` can't be resolved.

- [ ] **Step 3: Let `MenuItem` wrap**

In `src/ui/primitives/AnchoredMenu.tsx`, in `MenuItem`:
- change `h-11` to `min-h-11 py-2.5` in the button's class
- give the ✓ span `shrink-0`

```tsx
      className={`flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-left text-[15px] outline-none focus-visible:bg-ui-accent-soft ${tone}`}
    >
      {children}
      {selected && <span aria-hidden className="shrink-0 text-ui-accent">✓</span>}
```

Run: `npx vitest run src/ui/primitives` and check it still passes.

- [ ] **Step 4: Write `ReportMenu.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { ALL, type GraphReportRow } from '../useInsights'

interface ReportMenuProps {
  anchor: HTMLElement
  reports: GraphReportRow[]
  selectedId: string
  onSelect: (id: string) => void
  onClose: () => void
}

export function ReportMenu({ anchor, reports, selectedId, onSelect, onClose }: ReportMenuProps) {
  const { t } = useTranslation()
  return (
    <AnchoredMenu anchor={anchor} label={t('insights.reports')} onClose={onClose}>
      <MenuItem selected={selectedId === ALL} onSelect={() => onSelect(ALL)}>{t('charts.allPractices')}</MenuItem>
      {reports.map((r) => (
        <MenuItem key={r.id} selected={selectedId === r.id} onSelect={() => onSelect(r.id)}>{r.name}</MenuItem>
      ))}
    </AnchoredMenu>
  )
}
```

- [ ] **Step 5: Write `EndDateControl.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarSheet } from '../../today/mobile/CalendarSheet'
import { toDateStr } from '../../today/date'
import { formatDay } from '../insightsLogic'

interface EndDateControlProps { end: Date | null; onChange: (d: Date | null) => void }

export function EndDateControl({ end, onChange }: EndDateControlProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      {end ? (
        <span className="flex shrink-0 items-center rounded-full bg-ui-accent-pill text-[13px] font-bold text-ui-accent">
          <button type="button" onClick={() => setOpen(true)} className="min-h-9 pr-1 pl-3">
            {t('insights.endingOn', { date: formatDay(toDateStr(end), i18n.language || 'en') })}
          </button>
          <button type="button" aria-label={t('insights.resetEnd')} onClick={() => onChange(null)}
            className="flex h-9 w-9 items-center justify-center text-base">×</button>
        </span>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="flex min-h-9 shrink-0 items-center gap-1 text-[13px] font-bold text-ui-muted">
          {t('insights.endingToday')} <span aria-hidden>⌄</span>
        </button>
      )}
      {open && <CalendarSheet date={end ?? new Date()} onSelect={onChange} onClose={() => setOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 6: Write `InsightsMobile.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppBar } from '../../../layouts/mobile/AppBar'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { formatDelta, formatHeadline, traceAverageLabel, windowLabel } from '../insightsLogic'
import { RANGES, useInsights } from '../useInsights'
import { EndDateControl } from './EndDateControl'
import { InsightsChart } from './InsightsChart'
import { ReportMenu } from './ReportMenu'

const CARD = 'rounded-[22px] border border-ui-hairline bg-ui-surface'

export function InsightsMobile() {
  const { t, i18n } = useTranslation()
  const ins = useInsights()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const h = ins.headline
  const ready = !ins.isLoading && !ins.isError && ins.hasData

  return (
    <>
      <AppBar title={<h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ui-ink">{t('insights.title')}</h1>} />
      <div className="flex flex-col gap-3 px-4 pb-6">
        <button type="button" aria-haspopup="menu" onClick={(e) => setMenuAnchor(e.currentTarget)}
          className="flex min-h-9 max-w-full items-center gap-1 self-start text-[17px] font-bold text-ui-accent">
          <span className="truncate">{ins.report?.name ?? t('charts.allPractices')}</span>
          <span aria-hidden className="shrink-0">▾</span>
        </button>

        <div className="flex items-center justify-between gap-2">
          <div className="font-ui-mono [&_button]:text-xs">
            <SegmentedControl label={t('insights.range')} value={ins.range} onChange={ins.setRange}
              options={RANGES.map((r) => ({ value: r, label: t(`insights.range${r}`) }))} />
          </div>
          <EndDateControl end={ins.end} onChange={ins.setEnd} />
        </div>

        <section className={`${CARD} p-4`}>
          {ins.isLoading ? (
            <div className="flex h-[170px] items-center justify-center">
              <span role="status" aria-label={t('common.loading')}
                className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
            </div>
          ) : ins.isError ? (
            <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('insights.loadFailed')}</p>
          ) : !ins.hasData ? (
            <p className="py-10 text-center text-sm text-ui-muted">{t('insights.noData')}</p>
          ) : (
            <>
              {h && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-ui-muted">
                    {t(h.kind === 'time' ? 'insights.average' : 'insights.dailyAverage', { range: windowLabel(ins.entries, i18n.language || 'en') })}
                  </p>
                  <p className="font-ui-mono text-[30px] leading-tight text-ui-ink">{formatHeadline(h, units)}</p>
                  {h.delta !== null && (
                    <p className={`text-xs font-semibold ${h.delta >= 0 ? 'text-ui-good' : 'text-ui-muted'}`}>
                      {t(`insights.vsPrev${ins.range}`, { delta: formatDelta(h.delta) })}
                    </p>
                  )}
                </div>
              )}
              <InsightsChart rows={ins.rows} traces={ins.traces} barLayout={ins.barLayout} averages={ins.averages} />
            </>
          )}
        </section>

        {ready && (
          <ul aria-label={t('insights.legend')} className={`${CARD} px-4 py-1`}>
            {ins.traces.map((tr) => (
              <li key={tr.name} className="flex min-h-11 items-center gap-3 border-b border-ui-hairline last:border-0">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: tr.color }} />
                <span className="min-w-0 flex-1 truncate text-[15px] text-ui-ink2">{tr.name}</span>
                <span className="font-ui-mono text-sm text-ui-ink">{traceAverageLabel(tr, ins.entries, ins.todayCob, units)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {menuAnchor && (
        <ReportMenu anchor={menuAnchor} reports={ins.reports} selectedId={ins.selectedId}
          onSelect={(id) => { ins.select(id); setMenuAnchor(null) }} onClose={() => setMenuAnchor(null)} />
      )}
    </>
  )
}

export function InsightsMobileScreen() {
  return (
    <MobileShell>
      <InsightsMobile />
    </MobileShell>
  )
}
```

- [ ] **Step 7: Run the tests and types**

Run: `npx vitest run src/features/insights && npx tsc -b && npm run lint`
Expected: PASS, with no errors.
- jsdom renders the `ResponsiveContainer` empty and may log a width/height warning. That's expected.
- If the legend `parentElement` assertions don't find the row, use `within(legend).getAllByRole('listitem')[i]` instead.

- [ ] **Step 8: Commit**

```bash
git add src/ui/primitives/AnchoredMenu.tsx src/features/insights/mobile
git commit -m "feat(insights): mobile Insights screen with report menu, range, end date and cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: ⋯ menu and delete confirmation

**Files:**
- Create: `app-react/src/features/insights/mobile/MoreMenu.tsx`
- Modify: `app-react/src/features/insights/mobile/InsightsMobile.tsx`
- Test: `app-react/src/features/insights/mobile/InsightsMobile.test.tsx` (append)

**Interfaces:**
- Consumes:
  - `copyShareLink`, `downloadCsv` from `features/today/actions`
  - `chartsApi.deleteReport`
  - `useToast`, `BottomSheet`, `AppBarAction`
  - `GraphReportRow` (Task 4)
- Produces:
  ```ts
  export function useMoreMenu(report: GraphReportRow | null): { actions: AppBarAction[]; sheet: ReactNode }
  ```
- Edit goes to `/charts/manage?report=<id>`, which the router serves in Task 8 using Task 1's `?report=` support.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('InsightsMobile', …)`:

```tsx
  const openMore = async () => fireEvent.click(await screen.findByRole('button', { name: 'More' }))

  it('hides Edit and Delete for All practices', async () => {
    renderScreen()
    await openMore()
    const menu = screen.getByRole('menu', { name: 'More' })
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'New chart', 'Share reports link', 'Download data (CSV)',
    ])
  })

  it('offers Edit and Delete for a report; Edit opens the legacy editor on it', async () => {
    localStorage.setItem('insights-report', 'r1')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/charts']}>
          <Routes>
            <Route path="/charts" element={<InsightsMobileScreen />} />
            <Route path="/charts/manage" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await screen.findByRole('button', { name: LONG })
    await openMore()
    expect(screen.getByRole('menuitem', { name: 'Delete report' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: `Edit “${LONG}”` }))
    expect(screen.getByTestId('location')).toHaveTextContent('/charts/manage?report=r1')
  })

  it('deletes the report after confirming and falls back to All practices', async () => {
    localStorage.setItem('insights-report', 'r1')
    charts.deleteReport.mockImplementation(async () => {
      charts.getReports.mockResolvedValue([])
    })
    renderScreen()
    await screen.findByRole('button', { name: LONG })
    await openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete report' }))
    const sheet = screen.getByRole('dialog', { name: 'Delete report' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(charts.deleteReport).toHaveBeenCalledWith('r1'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByRole('button', { name: 'All practices' })).toBeInTheDocument()
  })

  it('keeps the sheet open and shows an error when delete fails', async () => {
    localStorage.setItem('insights-report', 'r1')
    charts.deleteReport.mockRejectedValue(new Error('boom'))
    renderScreen()
    await screen.findByRole('button', { name: LONG })
    await openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete report' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete report' })).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Delete report' })).toBeInTheDocument()
  })
```

At the top of the file:
- add `Routes, Route, useLocation` to the `react-router-dom` import
- add this probe:

```tsx
function LocationProbe() {
  const l = useLocation()
  return <p data-testid="location">{l.pathname + l.search}</p>
}
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `npx vitest run src/features/insights/mobile/InsightsMobile.test.tsx`
Expected: the 4 new tests FAIL, because there is no "More" button.

- [ ] **Step 3: Write `MoreMenu.tsx`**

```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../../api/charts'
import { useToast } from '../../../hooks/useToast'
import type { AppBarAction } from '../../../layouts/mobile/AppBar'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { copyShareLink, downloadCsv } from '../../today/actions'
import type { GraphReportRow } from '../useInsights'

export function useMoreMenu(report: GraphReportRow | null): { actions: AppBarAction[]; sheet: ReactNode } {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const remove = useMutation({
    mutationFn: (id: string) => chartsApi.deleteReport(id),
    onSuccess: () => { setConfirming(false); void qc.invalidateQueries({ queryKey: ['reports'] }) },
    onError: () => showToast({ message: t('common.error'), variant: 'error' }),
  })

  const actions: AppBarAction[] = [
    { label: t('insights.newChart'), onSelect: () => navigate('/charts/new') },
    ...(report
      ? [{ label: t('insights.editReport', { name: report.name }), onSelect: () => navigate(`/charts/manage?report=${encodeURIComponent(report.id)}`) }]
      : []),
    { label: t('charts.shareLink'), onSelect: () => { if (copyShareLink()) showToast({ message: t('charts.copied'), variant: 'success' }) } },
    { label: t('charts.downloadCsv'), onSelect: () => { downloadCsv().catch(() => showToast({ message: t('common.error'), variant: 'error' })) } },
    ...(report ? [{ label: t('insights.deleteReport'), onSelect: () => setConfirming(true) }] : []),
  ]

  const sheet = confirming && report ? (
    <BottomSheet label={t('charts.deleteTitle')} onClose={() => setConfirming(false)}>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold text-ui-ink">{t('charts.deleteTitle')}</h2>
        <p className="text-sm text-ui-muted">{t('charts.deleteMsg', { name: report.name })}</p>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-2.5">
        <button type="button" onClick={() => setConfirming(false)}
          className="h-[50px] rounded-[14px] border border-ui-control text-[15px] font-bold text-ui-ink">
          {t('common.cancel')}
        </button>
        <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(report.id)}
          className="h-[50px] rounded-[14px] bg-ui-danger text-[15px] font-bold text-white disabled:opacity-60">
          {t('common.delete')}
        </button>
      </div>
    </BottomSheet>
  ) : null

  return { actions, sheet }
}
```

- [ ] **Step 4: Wire it into `InsightsMobile.tsx`**

- Add `import { useMoreMenu } from './MoreMenu'`.
- After `const ins = useInsights()`, add `const more = useMoreMenu(ins.report)`.
- Pass `actions={more.actions}` to `AppBar`.
- Render `{more.sheet}` just before the closing `</>`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/features/insights && npx tsc -b && npm run lint`
Expected: PASS. `ToastContainer` lives in `MobileShell`, so the error toast text is in the DOM.

- [ ] **Step 6: Commit**

```bash
git add src/features/insights/mobile
git commit -m "feat(insights): more menu with new/edit/share/export/delete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Route `/charts` on mobile and check it in a browser

**Files:**
- Modify: `app-react/src/router.tsx`

**Interfaces:**
- Consumes `InsightsMobileScreen` (Task 6) and `ChartsPage` with `?report=` (Task 1).

- [ ] **Step 1: Wire the routes**

In `src/router.tsx`:

```tsx
const InsightsMobileScreen = lazy(() => import('./features/insights/mobile/InsightsMobile').then((m) => ({ default: m.InsightsMobileScreen })))
```

Add it next to `SettingsMobileScreen`. Then add a sibling after the `/settings` entry:

```tsx
      {
        path: '/charts',
        element: <ByLayout mobile={<InsightsMobileScreen />} legacy={<AppShell />} />,
        children: [{ index: true, element: <ChartsPage /> }],
      },
```

In the `AppShell` children:
- replace `{ path: '/charts', element: <ChartsPage /> },` with `{ path: '/charts/manage', element: <ChartsPage /> },`
- leave `/charts/new` as it is

- [ ] **Step 2: Full test suite, types and lint**

Run: `npx vitest run && npx tsc -b && npm run lint`
Expected: all PASS.

- [ ] **Step 3: Manual check at 390×844**

Run the app (`npm run dev` with the server up, as for the earlier redesign plans). Open `/charts` in a 390×844 viewport, in light and then dark (Settings → Theme). Check each of these against frames 5a / 5b / 5c:

- **A stacked duration report:**
  - bars are stacked with rounded tops
  - there's one dashed amber average line
  - the left axis reads `30m / 1h / 1h30`
  - the headline reads `N h N min` with a green or muted delta
- **A mixed duration + time + yes/no report:**
  - duration axis on the left, `HH:MM` axis on the right, no yes/no axis
  - no headline
  - the legend shows `18/30`-style values for yes/no
- **All practices:** one line per active practice, every series a distinct colour, legend swatches match the lines.
- **The 5b menu:** long names wrap, ✓ on the current report, no Grid reports.
- **End date:** picking a past day shows the amber pill, × goes back to "Ending today", and the calendar has red dots.
- **⋯ menu:** Edit opens the legacy page on the same report, and New chart opens `/charts/new`.
- **The tablet width** (≥ 768px) still shows the legacy `ChartsPage`.
- **iOS Safari** (or the Safari Web Inspector simulator): chart series are coloured, not black.
  - If they are black, `var()` in SVG attributes isn't applied. Resolve the colours in `InsightsChart` with `getComputedStyle(ref.closest('.ui-root')).getPropertyValue('--ui-chart-n')`, re-read on theme change, and commit that as a follow-up.

- [ ] **Step 4: Commit**

```bash
git add src/router.tsx
git commit -m "feat(insights): route mobile /charts to the redesigned screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
