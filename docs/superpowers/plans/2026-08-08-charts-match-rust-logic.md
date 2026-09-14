# Charts: Match Rust/Plotly Logic (React/recharts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the React (recharts) graph charts reproduce the original Rust/Yew (plotly) charts' data logic and get close on look, without adding Plotly.js.

**Architecture:** Extract all chart math into a pure, unit-tested `chartLogic.ts`. Refactor `ChartPanel` in `ChartsPage.tsx` to build typed trace descriptors (carrying each practice's `data_type` and `show_average`), route traces onto auto-grouped Y-axes by data type (numeric / time / unit), draw per-trace average reference lines, and align palette/legend/opacity to the Rust version. Grid shows all rows with a weekday date.

**Tech Stack:** React 19, TypeScript, recharts, TanStack Query, Vitest + @testing-library/react.

## Global Constraints

- No new dependencies (keep recharts; no Plotly.js).
- No backend or report-model changes; the saved per-trace `y_axis` field is left untouched (not used for rendering).
- Value mapping must match Rust `y_value` (`frontend/src/routes/charts/base.rs:365-409`): Int→number; Duration→minutes; Bool→1 if true else gap(null); Text→1 if present else gap(null); Time→minutes-of-day.
- Averages match Rust `average_value` (`base.rs:256-334`): exclude today; Int/Duration arithmetic mean; Time mean-minutes with overflow → HH:MM; Bool/Text none.
- Time overflow matches Rust `overflow_time` (`base.rs:336-363`): morning (h<12) vs evening (h>15 && <24); morning>evening ⇒ shift evening back a day (−1), else shift morning forward a day (+1).
- i18n: any new user-facing string goes in `public/locales/{en,ru,uk}/translation.json` AND `src/test/setup.ts` (this plan adds none — reuses existing keys).
- All existing Vitest tests must stay green.

---

### Task 1: Pure chart logic module (`chartLogic.ts`)

**Files:**
- Create: `app-react/src/pages/charts/chartLogic.ts`
- Test: `app-react/src/pages/charts/chartLogic.test.ts`

**Interfaces:**
- Consumes: `PracticeDataType` from `app-react/src/types/api.ts`.
- Produces:
  - `type AxisKind = 'num' | 'time' | 'unit'`
  - `axisKindFor(dt: PracticeDataType): AxisKind`
  - `valueToNumber(raw: unknown, dt: PracticeDataType): number | null`
  - `computeTimeOverflow(hours: number[]): -1 | 1`
  - `interface ChartDataRow { date: string; cob: string; [practiceName: string]: number | null | string }`
  - `interface TraceInput { name: string; dataType: PracticeDataType }`
  - `buildChartData(rawValues: {cob_date: string; practice: string; value: unknown}[], traces: TraceInput[], locale: string): ChartDataRow[]`
  - `averageForType(entries: {cob_date: string; value: unknown}[], dt: PracticeDataType, todayCob: string): number | null`
  - `formatMinutesAsHHMM(min: number): string`
  - `formatNumericTick(min: number): string` (identity number → string; used for tick labels)

- [ ] **Step 1: Write the failing tests**

```ts
// app-react/src/pages/charts/chartLogic.test.ts
import { describe, it, expect } from 'vitest'
import {
  axisKindFor, valueToNumber, computeTimeOverflow,
  buildChartData, averageForType, formatMinutesAsHHMM,
} from './chartLogic'

describe('axisKindFor', () => {
  it('routes data types to axes', () => {
    expect(axisKindFor('Int')).toBe('num')
    expect(axisKindFor('Duration')).toBe('num')
    expect(axisKindFor('Time')).toBe('time')
    expect(axisKindFor('Bool')).toBe('unit')
    expect(axisKindFor('Text')).toBe('unit')
  })
})

describe('valueToNumber', () => {
  it('Int passthrough', () => {
    expect(valueToNumber({ Int: 5 }, 'Int')).toBe(5)
    expect(valueToNumber(null, 'Int')).toBeNull()
  })
  it('Duration → minutes', () => {
    expect(valueToNumber({ Duration: 45 }, 'Duration')).toBe(45)
  })
  it('Bool true → 1, false → null (gap)', () => {
    expect(valueToNumber({ Bool: true }, 'Bool')).toBe(1)
    expect(valueToNumber({ Bool: false }, 'Bool')).toBeNull()
  })
  it('Text present → 1, empty/missing → null', () => {
    expect(valueToNumber({ Text: 'note' }, 'Text')).toBe(1)
    expect(valueToNumber({ Text: '' }, 'Text')).toBeNull()
    expect(valueToNumber(null, 'Text')).toBeNull()
  })
  it('Time → minutes of day', () => {
    expect(valueToNumber({ Time: { h: 6, m: 30 } }, 'Time')).toBe(390)
  })
})

describe('computeTimeOverflow', () => {
  it('mostly-evening with a morning straggler → +1', () => {
    expect(computeTimeOverflow([22, 23, 23, 1])).toBe(1)
  })
  it('mostly-morning with an evening straggler → -1', () => {
    expect(computeTimeOverflow([6, 7, 5, 23])).toBe(-1)
  })
})

describe('buildChartData', () => {
  it('keys rows by practice name and maps values', () => {
    const rows = buildChartData(
      [{ cob_date: '2026-08-01', practice: 'Reading', value: { Bool: true } }],
      [{ name: 'Reading', dataType: 'Bool' }],
      'en',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].Reading).toBe(1)
    expect(rows[0].cob).toBe('2026-08-01')
  })
  it('applies time overflow so a post-midnight value sits above the evening cluster', () => {
    const rows = buildChartData(
      [
        { cob_date: '2026-08-01', practice: 'Sleep', value: { Time: { h: 23, m: 0 } } },
        { cob_date: '2026-08-02', practice: 'Sleep', value: { Time: { h: 0, m: 30 } } },
      ],
      [{ name: 'Sleep', dataType: 'Time' }],
      'en',
    )
    // evening 23:00 → 1380; 00:30 shifted +1440 → 1470 (stays adjacent, not far below)
    expect(rows[0].Sleep).toBe(1380)
    expect(rows[1].Sleep).toBe(1470)
  })
})

describe('averageForType', () => {
  const today = '2026-08-08'
  it('Int mean excludes today', () => {
    const entries = [
      { cob_date: '2026-08-06', value: { Int: 2 } },
      { cob_date: '2026-08-07', value: { Int: 4 } },
      { cob_date: today, value: { Int: 100 } },
    ]
    expect(averageForType(entries, 'Int', today)).toBe(3)
  })
  it('Bool/Text have no average', () => {
    expect(averageForType([{ cob_date: '2026-08-06', value: { Bool: true } }], 'Bool', today)).toBeNull()
    expect(averageForType([{ cob_date: '2026-08-06', value: { Text: 'x' } }], 'Text', today)).toBeNull()
  })
})

describe('formatMinutesAsHHMM', () => {
  it('formats minutes, wrapping past a day', () => {
    expect(formatMinutesAsHHMM(390)).toBe('06:30')
    expect(formatMinutesAsHHMM(1470)).toBe('00:30')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app-react && npx vitest run src/pages/charts/chartLogic.test.ts`
Expected: FAIL (module not found / functions not exported).

- [ ] **Step 3: Implement `chartLogic.ts`**

```ts
// app-react/src/pages/charts/chartLogic.ts
import type { PracticeDataType } from '../../types/api'

export type AxisKind = 'num' | 'time' | 'unit'

export interface ChartDataRow {
  date: string
  cob: string
  [key: string]: number | null | string
}

export interface TraceInput {
  name: string
  dataType: PracticeDataType
}

export function axisKindFor(dt: PracticeDataType): AxisKind {
  if (dt === 'Time') return 'time'
  if (dt === 'Bool' || dt === 'Text') return 'unit'
  return 'num' // Int, Duration
}

/** Extract a typed field from either a primitive or the serde `{Variant: x}` shape. */
function unwrap(raw: unknown): { Int?: number; Bool?: boolean; Duration?: number; Text?: string; Time?: { h: number; m: number } } | number | boolean | null {
  if (raw === null || raw === undefined) return null
  return raw as never
}

export function valueToNumber(raw: unknown, dt: PracticeDataType): number | null {
  if (raw === null || raw === undefined) return null
  const o = raw as Record<string, unknown>
  switch (dt) {
    case 'Int':
      if (typeof raw === 'number') return raw
      return typeof o.Int === 'number' ? (o.Int as number) : null
    case 'Duration':
      if (typeof raw === 'number') return raw
      return typeof o.Duration === 'number' ? (o.Duration as number) : null
    case 'Bool': {
      const b = typeof raw === 'boolean' ? raw : (o.Bool as boolean | undefined)
      return b === true ? 1 : null // false or missing → gap
    }
    case 'Text': {
      const s = typeof raw === 'string' ? raw : (o.Text as string | undefined)
      return typeof s === 'string' && s.length > 0 ? 1 : null
    }
    case 'Time': {
      const t = (o.Time ?? raw) as { h: number; m: number } | undefined
      if (t && typeof t.h === 'number' && typeof t.m === 'number') return t.h * 60 + t.m
      return null
    }
  }
}

/** Mirrors Rust overflow_time: morning>evening ⇒ -1 else +1. */
export function computeTimeOverflow(hours: number[]): -1 | 1 {
  let morning = 0
  let evening = 0
  for (const h of hours) {
    if (h < 24 && h > 15) evening += 1
    if (h < 12) morning += 1
  }
  return morning > evening ? -1 : 1
}

function timeHour(raw: unknown): number | null {
  const o = raw as Record<string, unknown>
  const t = (o?.Time ?? raw) as { h: number } | undefined
  return t && typeof t.h === 'number' ? t.h : null
}

/** Apply the Rust y_value day adjustment to a Time value, in minutes. */
function timeMinutesWithOverflow(raw: unknown, overflow: -1 | 1): number | null {
  const base = valueToNumber(raw, 'Time')
  if (base === null) return null
  const h = timeHour(raw)
  if (h === null) return base
  if (overflow > 0 && h < 12) return base + 1440
  if (overflow < 0 && h > 15) return base - 1440
  return base
}

function shortDate(iso: string, locale: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

export function buildChartData(
  rawValues: { cob_date: string; practice: string; value: unknown }[],
  traces: TraceInput[],
  locale: string,
): ChartDataRow[] {
  const typeByName = new Map(traces.map((t) => [t.name, t.dataType]))
  const names = new Set(traces.map((t) => t.name))

  // Per Time-practice overflow, computed from all of that practice's hours.
  const overflowByName = new Map<string, -1 | 1>()
  for (const t of traces) {
    if (t.dataType !== 'Time') continue
    const hours = rawValues
      .filter((e) => e.practice === t.name)
      .map((e) => timeHour(e.value))
      .filter((h): h is number => h !== null)
    overflowByName.set(t.name, computeTimeOverflow(hours))
  }

  const dateMap = new Map<string, ChartDataRow>()
  for (const entry of rawValues) {
    if (!names.has(entry.practice)) continue
    const key = entry.cob_date
    if (!dateMap.has(key)) dateMap.set(key, { date: shortDate(key, locale), cob: key })
    const row = dateMap.get(key)!
    const dt = typeByName.get(entry.practice)!
    row[entry.practice] =
      dt === 'Time'
        ? timeMinutesWithOverflow(entry.value, overflowByName.get(entry.practice) ?? 1)
        : valueToNumber(entry.value, dt)
  }
  // Sort by cob ascending for a stable x-axis.
  return Array.from(dateMap.values()).sort((a, b) => a.cob.localeCompare(b.cob))
}

export function averageForType(
  entries: { cob_date: string; value: unknown }[],
  dt: PracticeDataType,
  todayCob: string,
): number | null {
  if (dt === 'Bool' || dt === 'Text') return null
  const past = entries.filter((e) => e.cob_date !== todayCob)
  const nums: number[] = []
  if (dt === 'Time') {
    const hours = past.map((e) => timeHour(e.value)).filter((h): h is number => h !== null)
    if (hours.length === 0) return null
    const overflow = computeTimeOverflow(hours)
    for (const e of past) {
      const v = timeMinutesWithOverflow(e.value, overflow)
      if (v !== null) nums.push(v)
    }
  } else {
    for (const e of past) {
      const v = valueToNumber(e.value, dt)
      if (v !== null) nums.push(v)
    }
  }
  if (nums.length === 0) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

export function formatMinutesAsHHMM(min: number): string {
  const norm = ((Math.round(min) % 1440) + 1440) % 1440
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatNumericTick(n: number): string {
  return String(n)
}
```

> Note: `unwrap` is a small helper kept only if used; if lint flags it as unused, delete it — `valueToNumber` reads fields directly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app-react && npx vitest run src/pages/charts/chartLogic.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add app-react/src/pages/charts/chartLogic.ts app-react/src/pages/charts/chartLogic.test.ts
git commit -m "feat(charts): pure chart logic matching Rust y_value/overflow/average"
```

---

### Task 2: Trace descriptors + palette in `ChartPanel`

**Files:**
- Modify: `app-react/src/pages/charts/ChartsPage.tsx` (trace-building `:160-185`, palette `TRACE_COLORS` `:36`, `buildChartData`/`valueToNumber` local defs `:95-134`)

**Interfaces:**
- Consumes: `buildChartData`, `axisKindFor`, `averageForType`, `formatMinutesAsHHMM`, `ChartDataRow`, `TraceInput` from `./chartLogic`.
- Produces: local `visibleTraces` array whose items are `{ name: string; type_: TraceType; color: string; dataType: PracticeDataType; showAverage: boolean }`.

- [ ] **Step 1: Delete the local `valueToNumber`, `shortDate`, `buildChartData`, and `ChartDataRow` from `ChartsPage.tsx`** (lines ~95-134) and import from `chartLogic`:

```ts
import {
  buildChartData, axisKindFor, averageForType, formatMinutesAsHHMM,
  type ChartDataRow,
} from './chartLogic'
import type { PracticeDataType } from '../../types/api'
```

(Keep any other existing imports. `UserPractice` is already imported.)

- [ ] **Step 2: Replace `TRACE_COLORS` (`:36`) with the Rust palette (named-color hexes, same order):**

```ts
const TRACE_COLORS = [
  '#FF8C00', // DarkOrange
  '#B22222', // FireBrick
  '#BDB76B', // DarkKhaki
  '#6A5ACD', // SlateBlue
  '#9370DB', // MediumPurple
  '#B0C4DE', // LightSteelBlue
  '#8B008B', // DarkMagenta
  '#FFA07A', // LightSalmon
  '#CD5C5C', // IndianRed
  '#DB7093', // PaleVioletRed
  '#FF6347', // Tomato
  '#808000', // Olive
  '#20B2AA', // LightSeaGreen
  '#AFEEEE', // PaleTurquoise
]
```

- [ ] **Step 3: Rebuild the `traces` descriptor (replace `:162-178`) to carry `dataType` and `showAverage`:**

```ts
const byId = new Map(practices.map((p) => [p.id, p]))
const byName = new Map(practices.map((p) => [p.practice, p]))

const traces: { name: string; type_: TraceType; color: string; dataType: PracticeDataType; showAverage: boolean }[] =
  report === null
    ? activePractices.map((p, i) => ({
        name: p.practice,
        type_: { Line: { style: 'Regular' as const } },
        color: TRACE_COLORS[i % TRACE_COLORS.length],
        dataType: p.data_type,
        showAverage: false,
      }))
    : isGrid(report.definition)
      ? report.definition.Grid.practices.map((pid, i) => ({
          name: practiceMap[pid] ?? pid,
          type_: { Line: { style: 'Regular' as const } } as TraceType,
          color: TRACE_COLORS[i % TRACE_COLORS.length],
          dataType: byId.get(pid)?.data_type ?? 'Int',
          showAverage: false,
        }))
      : report.definition.Graph.traces.map((t, i) => ({
          name: practiceMap[t.practice] ?? t.practice,
          type_: t.type_,
          color: TRACE_COLORS[i % TRACE_COLORS.length],
          dataType: byId.get(t.practice)?.data_type ?? 'Int',
          showAverage: t.show_average,
        }))
```

> `byName` is used in Step: it resolves a trace name → practice for average entry lookup in Task 3. If lint flags `byName` unused before Task 3 lands, complete Task 3 in the same commit.

- [ ] **Step 4: Update the `buildChartData` call (`:185`)** to pass typed traces:

```ts
const chartData = buildChartData(
  rawValues as { cob_date: string; practice: string; value: unknown }[],
  visibleTraces.map((t) => ({ name: t.name, dataType: t.dataType })),
  locale,
)
```

- [ ] **Step 5: Run the app type-check + existing chart tests**

Run: `cd app-react && npx tsc -b 2>&1 | grep ChartsPage || echo "ChartsPage clean"; npx vitest run src/pages/charts/ChartsPage.test.tsx`
Expected: no new ChartsPage tsc errors; ChartsPage tests still PASS (rendering unchanged so far except palette).

- [ ] **Step 6: Commit**

```bash
git add app-react/src/pages/charts/ChartsPage.tsx
git commit -m "refactor(charts): typed trace descriptors + Rust palette, use chartLogic"
```

---

### Task 3: Auto Y-axes by data type + average reference lines

**Files:**
- Modify: `app-react/src/pages/charts/ChartsPage.tsx` (chart render block `:244-306`)
- Modify: import `ReferenceLine` from recharts (top import line)

**Interfaces:**
- Consumes: `axisKindFor`, `averageForType`, `formatMinutesAsHHMM`, trace descriptors from Task 2, `rawValues`, `todayCob`.
- Produces: rendered multi-axis chart with per-trace `yAxisId` and average `ReferenceLine`s.

- [ ] **Step 1: Add `ReferenceLine` to the recharts import.** Find the `from 'recharts'` import and add `ReferenceLine`.

- [ ] **Step 2: Before the `return`, compute which axes are used and per-trace averages:**

```ts
const usedAxes = new Set(visibleTraces.map((t) => axisKindFor(t.dataType)))
const numAxisAllDuration =
  visibleTraces.filter((t) => axisKindFor(t.dataType) === 'num').every((t) => t.dataType === 'Duration') &&
  visibleTraces.some((t) => axisKindFor(t.dataType) === 'num')

const averages = visibleTraces
  .filter((t) => t.showAverage)
  .map((t) => {
    const entries = rawValues.filter((e: { practice: string }) => e.practice === t.name)
    const avg = averageForType(entries as { cob_date: string; value: unknown }[], t.dataType, todayCob)
    return avg === null ? null : { axis: axisKindFor(t.dataType), value: avg, color: t.color }
  })
  .filter((a): a is { axis: 'num' | 'time' | 'unit'; value: number; color: string } => a !== null)
```

- [ ] **Step 3: Replace the single `<YAxis .../>` (`:254`) with conditional per-kind axes:**

```tsx
{usedAxes.has('num') && (
  <YAxis
    yAxisId="num"
    orientation="left"
    domain={[0, 'auto']}
    tick={{ fontSize: 10, fill: '#9ca3af' }}
    tickLine={false}
    axisLine={false}
    tickFormatter={(v: number) => (numAxisAllDuration ? `${v} min` : String(v))}
  />
)}
{usedAxes.has('time') && (
  <YAxis
    yAxisId="time"
    orientation="right"
    tick={{ fontSize: 10, fill: '#9ca3af' }}
    tickLine={false}
    axisLine={false}
    tickFormatter={formatMinutesAsHHMM}
  />
)}
{usedAxes.has('unit') && (
  <YAxis yAxisId="unit" hide domain={[0, 1.1]} />
)}
```

- [ ] **Step 4: Add `yAxisId` to every trace in the `visibleTraces.map` render (`:271-304`).** Each `<Bar>`/`<Line>` gains `yAxisId={axisKindFor(dataType)}` and per-type opacity. Replace the map body with:

```tsx
{visibleTraces.map(({ name, type_, color, dataType }) => {
  const yAxisId = axisKindFor(dataType)
  const label = traceLabel(type_)
  if (label === 'Bar') {
    return <Bar key={name} yAxisId={yAxisId} dataKey={name} fill={color} fillOpacity={0.35} radius={[2, 2, 0, 0]} maxBarSize={20} />
  }
  if (label === 'Dot') {
    return (
      <Line key={name} yAxisId={yAxisId} type="monotone" dataKey={name} stroke="none" strokeWidth={0}
        dot={{ r: 4, fill: color, strokeWidth: 0, fillOpacity: 0.8 }} activeDot={{ r: 5, fill: color }} name={name} />
    )
  }
  const isSquare = typeof type_ === 'object' && 'Line' in type_ && type_.Line.style === 'Square'
  return (
    <Line key={name} yAxisId={yAxisId} type={isSquare ? 'stepAfter' : 'natural'} dataKey={name}
      stroke={color} strokeOpacity={0.7} strokeWidth={2}
      dot={{ r: 2.5, fill: color, strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls name={name} />
  )
})}
```

- [ ] **Step 5: Render average lines after the traces map (inside `<ComposedChart>`):**

```tsx
{averages.map((a, i) => (
  <ReferenceLine
    key={`avg-${i}`}
    yAxisId={a.axis}
    y={a.value}
    stroke={a.color}
    strokeDasharray="6 4"
    strokeOpacity={0.8}
    ifOverflow="extendDomain"
  />
))}
```

- [ ] **Step 6: Also add `yAxisId="num"` fallback safety** — the `<Bar>`/`<Line>` now always have a `yAxisId`; recharts requires every series' `yAxisId` to match a rendered `<YAxis>`. Since axes are rendered from `usedAxes` (derived from the same traces), every referenced id exists. Verify by running the app.

- [ ] **Step 7: Manual + test check**

Run: `cd app-react && npx vitest run src/pages/charts/ChartsPage.test.tsx && npx tsc -b 2>&1 | grep ChartsPage || echo clean`
Expected: existing ChartsPage tests PASS; no new tsc errors. Then load http://localhost:5173 → open/create a report mixing Duration + Time + Bool; confirm left numeric axis, right HH:MM axis, bool marks at top, and a dashed average line when `show_average` is on.

- [ ] **Step 8: Commit**

```bash
git add app-react/src/pages/charts/ChartsPage.tsx
git commit -m "feat(charts): auto per-type Y-axes + average reference lines"
```

---

### Task 4: Grid parity + legend/look

**Files:**
- Modify: `app-react/src/pages/charts/ChartsPage.tsx` — `GridTable` (`:313-343`), `<Legend>` (`:258-270`)

**Interfaces:**
- Consumes: `ChartDataRow` (now has `cob`), `useTranslation` locale.
- Produces: grid rendering all rows with a weekday date; bottom-centered legend.

- [ ] **Step 1: Legend to bottom-center.** In the `<Legend .../>` props add `verticalAlign="bottom"` and `align="center"` (keep the existing `onClick`/`formatter`/`wrapperStyle`).

- [ ] **Step 2: Rewrite `GridTable` to show all rows with a weekday date.** Replace its body:

```tsx
function GridTable({ chartData, practiceNames }: { chartData: ChartDataRow[]; practiceNames: string[] }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const fmt = (cob: string) =>
    new Date(cob + 'T00:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th className="text-left px-2 py-1.5 font-semibold" style={{ color: '#9ca3af', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{t('charts.date')}</th>
            {practiceNames.map((name) => (
              <th key={name} className="text-right px-2 py-1.5 font-semibold" style={{ color: '#9ca3af', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chartData.map((row, i) => (
            <tr key={row.cob} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
              <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{fmt(row.cob)}</td>
              {practiceNames.map((name) => (
                <td key={name} className="px-2 py-1.5 text-right text-gray-700">
                  {row[name] == null ? '—' : String(row[name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

> Note the grid shows numeric values (Time as minutes, Bool as `1`/`—`), consistent with the graph's numeric mapping. This matches the Rust grid's "value or blank" behavior closely enough; raw-string rendering of Time HH:MM is out of scope.

- [ ] **Step 3: Run full suite + typecheck + lint**

Run: `cd app-react && npm run test && npx tsc -b 2>&1 | grep -E "charts/(ChartsPage|chartLogic)" || echo "charts clean"; npm run lint 2>&1 | grep -E "charts/" | grep -i error || echo "no charts lint errors"`
Expected: all tests PASS; no tsc/lint errors in charts files.

- [ ] **Step 4: Commit**

```bash
git add app-react/src/pages/charts/ChartsPage.tsx
git commit -m "feat(charts): grid shows all rows with weekday date; bottom legend"
```

---

## Self-Review

**Spec coverage:**
- Value mapping (Bool gap, Text=1, Time minutes) → Task 1 `valueToNumber` ✓
- Time overflow → Task 1 `computeTimeOverflow` + `buildChartData` ✓
- Auto Y-axes by type → Task 3 ✓
- Average line → Task 1 `averageForType` + Task 3 `ReferenceLine` ✓
- Look (legend/opacity/palette) → Task 2 palette, Task 3 opacity, Task 4 legend ✓
- Grid parity (all rows, weekday date) → Task 4 ✓
- No new deps / no backend change → Global Constraints ✓

**Placeholder scan:** none (all steps have concrete code).

**Type consistency:** `axisKindFor` returns `'num'|'time'|'unit'` used as `yAxisId` in Task 3 and axis render; `ChartDataRow` gains `cob` (Task 1) consumed by `GridTable` (Task 4); trace descriptor shape (`dataType`, `showAverage`) defined in Task 2 and consumed in Task 3; `buildChartData(rawValues, TraceInput[], locale)` signature consistent between Task 1 and its call in Task 2.

**Known follow-up:** the `unwrap` helper in Task 1 is optional — delete if unused to satisfy lint. `byName` (Task 2) is only needed if a future task looks practices up by name; Task 3 looks up averages via `rawValues` by trace name directly, so `byName` may be removed if lint flags it.
