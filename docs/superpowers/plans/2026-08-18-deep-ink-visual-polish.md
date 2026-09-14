# Deep Ink Visual Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the authenticated `app-react` UI (Home first) to the approved "Deep Ink + Glow" dark direction — controlled dark surface (photo retired to the login screen), serif headings + Inter body, brightened teal accent — and fix the tangled Charts panel by grouping series by unit.

**Architecture:** Colors are centralized in `src/theme/tokens.ts` (inline-style constants) and the DaisyUI `@theme`/`[data-theme]` blocks in `src/index.css`; retuning these cascades app-wide. The app-wide photo backdrop lives in `AppShell` (authenticated routes only); it is replaced with a Deep Ink gradient layer and the photo is moved to `GuestRoute` (login/register). Per-component work retunes the Home surfaces (header, calendar, practice rows) and rebuilds the Charts panel as stacked single-unit "small multiples."

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind 4 + DaisyUI 5, Recharts 3, framer-motion, TanStack Query, i18next, Vitest + Testing Library + MSW. Commands (run from `app-react/`): `npm test` (vitest run), `npm run lint` (oxlint), `npm run dev` (vite → http://localhost:5173).

## Global Constraints

- Only touch files under `app-react/`. No backend/API/route-contract changes.
- Behavior-preserving: the existing Vitest suite must stay green. Only update a test assertion when the class/style it checks was intentionally changed by a task; never weaken a behavioral assertion to make it pass.
- Follow existing patterns: inline styles read from `theme/tokens.ts`; DaisyUI utility classes (`text-base-content`, etc.) where already used. Do not introduce a new styling system.
- i18n discipline: no new hardcoded user-facing strings. Use existing `t()` keys; do not add locale keys in this pass.
- Dark theme is the target. Do not edit the `[data-theme="light"]` block; light theme may render darkened inline surfaces (accepted per the spec's non-goals).
- Preserve responsive/mobile (installable PWA): the `TopBar` mobile variant and `BottomNav` must still work.
- Accessibility: body and label text on the new surfaces must meet WCAG AA contrast.
- Fonts unchanged (keep Playfair Display serif + Inter). The optional Newsreader swap is out of scope.
- Commit after each task.

**Note on TDD for visual tasks:** Pure color/spacing changes have no meaningful unit test — the suite asserts roles/text/behavior, not hex values. For visual tasks (1–4) the cycle is: make the change → run the full suite (must stay green) → lint → visual check in the browser → commit. Task 5 (chart logic) is pure logic and uses real red-green TDD. Task 6 consumes it.

---

### Task 1: Design tokens — Deep Ink palette

**Files:**
- Modify: `src/theme/tokens.ts` (full rewrite of the constant values)
- Modify: `src/index.css:10-40` (the `[data-theme="dark"]` block only)

**Interfaces:**
- Produces: new/retuned exports from `tokens.ts` consumed by every later task — `ACCENT`, `ACCENT_LIGHT` (new), `ACCENT_GRADIENT`, `ACCENT_SHADOW`, `ACCENT_SOFT`, `ACCENT_RING`, `SURFACE_1/2/3`, `SURFACE_GLASS`, `SURFACE_PANEL` (new), `SURFACE_ELEVATED` (new), `APP_BACKDROP` (new), `TEXT`, `TEXT_MUTED`, `TEXT_FAINT`, `BORDER`.

- [ ] **Step 1: Rewrite the token constants**

Replace the body of `src/theme/tokens.ts` (keep the top comment) with:

```ts
export const ACCENT = '#2dd4bf'            // primary interactive teal (fills, active)
export const ACCENT_LIGHT = '#5eead4'      // luminous teal for lines / highlights / glow
export const ACCENT_GRADIENT = 'linear-gradient(135deg, #5eead4 0%, #2dd4bf 100%)'
export const ACCENT_SHADOW = 'rgba(45,212,191,0.40)'
export const ACCENT_SOFT = 'rgba(94,234,212,0.12)'
export const ACCENT_RING = 'rgba(94,234,212,0.30)'

export const SURFACE_1 = '#0e141b'
export const SURFACE_2 = '#151d27'
export const SURFACE_3 = '#1b2531'
export const SURFACE_GLASS = 'rgba(20,28,38,0.72)'
export const SURFACE_PANEL = 'rgba(20,28,38,0.72)'     // cards / chart panels
export const SURFACE_ELEVATED = 'rgba(26,35,47,0.80)'  // practice rows

export const TEXT = '#eef3f8'
export const TEXT_MUTED = 'rgba(238,243,248,0.58)'
export const TEXT_FAINT = 'rgba(238,243,248,0.42)'
export const BORDER = 'rgba(255,255,255,0.08)'

// Deep Ink + Glow backdrop for the authenticated shell.
export const APP_BACKDROP =
  'radial-gradient(70% 55% at 84% -5%, rgba(45,212,191,0.16), transparent 50%),' +
  'radial-gradient(60% 45% at 8% 108%, rgba(56,189,248,0.09), transparent 55%),' +
  'linear-gradient(160deg, #0b0f14 0%, #070a0e 100%)'
```

- [ ] **Step 2: Retune the dark DaisyUI theme**

In `src/index.css`, inside `[data-theme="dark"]`, change only these lines:

```css
  --color-base-100: #0e141b;
  --color-base-200: #151d27;
  --color-base-300: #1b2531;
  --color-base-content: #eef3f8;
  --color-primary: #2dd4bf;
  --color-primary-content: #04201b;
  --color-accent: #5eead4;
  --color-accent-content: #04201b;
```

Leave `secondary`, `neutral`, `info`, `success`, `warning`, `error`, radius, and the `[data-theme="light"]` block untouched.

- [ ] **Step 3: Run the suite + lint**

Run: `npm test && npm run lint`
Expected: all tests pass, lint clean. (Token values aren't asserted, so no test should change here. If one fails, it is a real regression — investigate, don't edit the token.)

- [ ] **Step 4: Visual check**

Run `npm run dev`, open http://localhost:5173. The app currently still shows the photo (removed in Task 2) — that's fine. Confirm accent-colored elements (buttons, active states) now read as brighter teal and nothing looks broken.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/theme/tokens.ts app-react/src/index.css
git commit -m "feat(app-react): Deep Ink token palette (surfaces, brightened teal, backdrop)"
```

---

### Task 2: Deep Ink backdrop — swap photo for gradient, move photo to login

**Files:**
- Create: `src/components/layout/AppBackground.tsx`
- Modify: `src/components/layout/AppShell.tsx:18-24` (replace `<AuthBackground/>` + tint)
- Modify: `src/components/layout/GuestRoute.tsx` (mount the photo backdrop for auth pages)

**Interfaces:**
- Consumes: `APP_BACKDROP` from `tokens.ts` (Task 1).
- Produces: `AppBackground` component (default-free named export `AppBackground`).

Context: `AppShell` wraps only authenticated routes; `GuestRoute` renders auth pages outside it. `AuthBackground` (the `/bg.webp` photo) is currently mounted by `AppShell`, so the photo sits behind the *app*. We invert that.

- [ ] **Step 1: Create the Deep Ink backdrop component**

Create `src/components/layout/AppBackground.tsx`:

```tsx
import { APP_BACKDROP } from '../../theme/tokens'

/** Fixed full-bleed Deep Ink + Glow backdrop for the authenticated shell. */
export function AppBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ background: APP_BACKDROP }}
    />
  )
}
```

- [ ] **Step 2: Use it in AppShell (remove the photo + tint)**

In `src/components/layout/AppShell.tsx`:
- Replace the import `import { AuthBackground } from './AuthBackground'` with `import { AppBackground } from './AppBackground'`.
- Replace the `<AuthBackground />` element **and** the sibling `<div className="fixed inset-0 -z-10 pointer-events-none" style={{ background: 'rgba(20,28,38,0.15)' }} />` tint with a single `<AppBackground />`.

Resulting top of the returned JSX:

```tsx
    <div className="relative">
      <AppBackground />
      <TopBar />
```

- [ ] **Step 3: Give the login/register pages the photo**

In `src/components/layout/GuestRoute.tsx`, render the photo behind the guest outlet:

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Spinner } from '../ui/Spinner'
import { AuthBackground } from './AuthBackground'

export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (isAuthenticated) return <Navigate to="/" replace />
  return (
    <>
      <AuthBackground />
      <Outlet />
    </>
  )
}
```

- [ ] **Step 4: Run the suite + lint**

Run: `npm test && npm run lint`
Expected: green. If `AppShell`/`HomePage` tests query for the old tint node, update the query to expect `AppBackground` (a single fixed `-z-10` layer). Do not remove behavioral assertions.

- [ ] **Step 5: Visual check (both sides of auth)**

`npm run dev`:
- Home (`/`) and Charts now sit on the near-black Deep Ink surface with a soft teal glow top-right — no photo.
- Log out (or visit `/login` in a fresh session) and confirm the **photo** now backs the login/register screens.

- [ ] **Step 6: Commit**

```bash
git add app-react/src/components/layout/AppBackground.tsx app-react/src/components/layout/AppShell.tsx app-react/src/components/layout/GuestRoute.tsx
git commit -m "feat(app-react): Deep Ink app backdrop; move photo to login screen"
```

---

### Task 3: Header (TopBar) — deep-ink bar + active nav ring

**Files:**
- Modify: `src/components/layout/TopBar.tsx` (header background 50-58, `renderNavItem` 22-42, Pro tag 71-74)
- Check: `src/components/layout/TopBar.test.tsx`, `HeaderMenu.test.tsx` (update only if they assert changed styles)

**Interfaces:**
- Consumes: `ACCENT_LIGHT`, `ACCENT_RING`, `TEXT`, `BORDER` from `tokens.ts`.

- [ ] **Step 1: Import tokens**

At the top of `TopBar.tsx` add:

```tsx
import { ACCENT_LIGHT, ACCENT_RING, TEXT, BORDER } from '../../theme/tokens'
```

- [ ] **Step 2: Deep-ink header bar**

Replace the `<header>` `style` object (lines 52-58) with a deeper translucent bar + hairline border (keep the blur — content scrolls underneath):

```tsx
      style={{
        background: 'linear-gradient(180deg, rgba(9,13,18,0.78) 0%, rgba(9,13,18,0.32) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${BORDER}`,
      }}
```

- [ ] **Step 3: Active nav pill gets a teal ring**

In `renderNavItem`, replace the inner `<span style={{…}}>` (lines 32-40) so the active item shows a teal ring + soft wash while inactive stays muted:

```tsx
      {({ isActive }) => (
        <span
          className="inline-flex items-center h-9 px-3 rounded-full transition-colors"
          style={{
            color: isActive ? '#ffffff' : 'rgba(255,255,255,0.72)',
            fontWeight: isActive ? 600 : 500,
            border: isActive ? `1px solid ${ACCENT_RING}` : '1px solid transparent',
            background: isActive ? 'rgba(94,234,212,0.08)' : 'transparent',
          }}
        >
          {t(`nav.${navKey}`)}
        </span>
      )}
```

(The `h-9 px-3 rounded-full` on the outer `NavLink` className at line 29 is now redundant padding; leave the outer className as-is — the inner span provides the pill. No behavioral change.)

- [ ] **Step 4: Brighten the "Pro" tag**

At line 73, change the Pro tag color from `#3aa6a0` to the luminous teal:

```tsx
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em]" style={{ color: ACCENT_LIGHT }}>Pro</span>
```

And at line 72 set the "Sadhana" color to `TEXT` (replace the literal `#f2f4f6`).

- [ ] **Step 5: Run suite + lint, then visual check**

Run: `npm test && npm run lint` (update `TopBar.test.tsx` only if it asserts the old Pro hex or nav styles). Then `npm run dev`: header reads as a crisp deep-ink bar; the active route (e.g. Home) shows a teal-ringed pill; "Pro" glows teal.

- [ ] **Step 6: Commit**

```bash
git add app-react/src/components/layout/TopBar.tsx
git commit -m "feat(app-react): deep-ink header with teal active-nav ring"
```

---

### Task 4: Practice rows + calendar — elevated surfaces on tokens

**Files:**
- Modify: `src/pages/home/PracticeCard.tsx` (container 191-210, toggle 264, field focus/blur 48-55)
- Modify: `src/pages/home/WeekCalendar.tsx` (container 120-128, selected-day shadow 103)
- Modify: `src/pages/home/MonthCalendar.tsx` (retune surface/accent to tokens — read the file, replace hardcoded surface `rgba(255,255,255,0.0x)` with `SURFACE_PANEL` and accent hexes with `ACCENT`/`ACCENT_LIGHT`, mirroring WeekCalendar)
- Check: `PracticeCard.test.tsx`, `WeekCalendar.test.tsx`, `MonthCalendar.test.tsx`

**Interfaces:**
- Consumes: `SURFACE_ELEVATED`, `SURFACE_PANEL`, `ACCENT`, `ACCENT_LIGHT`, `ACCENT_RING`, `ACCENT_SHADOW`, `TEXT_FAINT`, `BORDER` from `tokens.ts`.

- [ ] **Step 1: PracticeCard — elevated solid surface + logged affordance**

In `PracticeCard.tsx`:
- Add to the tokens import (line 9): `SURFACE_ELEVATED, ACCENT_LIGHT, ACCENT_RING, BORDER`.
- Replace the card container `style` (lines 194-210). Drop the now-pointless `backdrop-filter` blur (no photo behind), use the elevated surface, and use tokens for the state borders:

```tsx
      style={{
        background: SURFACE_ELEVATED,
        border: errorFlash
          ? '1px solid rgba(225,29,72,0.55)'
          : flash
          ? `1px solid ${ACCENT_LIGHT}`
          : hasValue
          ? `1px solid ${ACCENT_RING}`
          : `1px solid ${BORDER}`,
        boxShadow: errorFlash
          ? '0 2px 12px rgba(225,29,72,0.10)'
          : flash
          ? '0 2px 12px rgba(45,212,191,0.16)'
          : '0 2px 12px rgba(0,0,0,0.20)',
      }}
```

Also remove the two now-unused lines in the same object (`backdropFilter`, `WebkitBackdropFilter`) and the `className` `backdrop-blur` if present (the className at line 193 has no blur class — leave it).

- [ ] **Step 2: PracticeCard — toggle + field focus use tokens**

- Line 264: change the on-color literal `'#3aa6a0'` to `ACCENT`.
- In `fieldFocus`/`fieldBlur` (lines 49-54), replace the `rgba(58,166,160,...)` focus tints with `rgba(45,212,191,0.55)` (border) and `rgba(45,212,191,0.08)` (background); leave the blur values as-is.

(The value-color already switches to `ACCENT` when a value exists — that plus the `ACCENT_RING` border is the "logged" affordance from the mockup. No control-markup change needed.)

- [ ] **Step 3: WeekCalendar — panel surface + accent shadow**

In `WeekCalendar.tsx`:
- Add `SURFACE_PANEL, ACCENT_SHADOW` to the tokens import (line 4).
- Replace the container `style` (lines 122-127): use `background: SURFACE_PANEL`, drop the `backdropFilter`/`WebkitBackdropFilter` blur lines, keep `border: 1px solid ${BORDER}` and `boxShadow: '0 4px 20px rgba(0,0,0,0.35)'`.
- Line 103: change the selected-day shadow `rgba(58,166,160,0.35)` to `ACCENT_SHADOW`.

- [ ] **Step 4: MonthCalendar — mirror the retune**

Open `src/pages/home/MonthCalendar.tsx`. Replace its hardcoded modal/panel surface (`rgba(255,255,255,0.0x)` / any `#26313d`-style solid) with `SURFACE_PANEL` (or `SURFACE_2` for a solid modal body), swap accent hexes (`#3aa6a0`/`rgba(58,166,160,…)`) to `ACCENT`/`ACCENT_SHADOW`, and border literals to `BORDER`. Keep all layout/behavior identical.

- [ ] **Step 5: Run suite + lint, then visual check**

Run: `npm test && npm run lint`. Update `PracticeCard.test`/`WeekCalendar.test`/`MonthCalendar.test` only where they assert a changed style literal; keep role/text/interaction assertions. Then `npm run dev`: practice rows are crisp elevated cards (logged ones carry a teal-ringed border), today's date is a solid teal marker, the month popover matches.

- [ ] **Step 6: Commit**

```bash
git add app-react/src/pages/home/PracticeCard.tsx app-react/src/pages/home/WeekCalendar.tsx app-react/src/pages/home/MonthCalendar.tsx
git commit -m "feat(app-react): elevated practice rows + calendar on Deep Ink tokens"
```

---

### Task 5: Chart logic — group series by unit (TDD)

**Files:**
- Modify: `src/pages/charts/chartLogic.ts` (append new exports)
- Create/Modify test: `src/pages/charts/chartLogic.test.ts` (add a describe block; create the file if it does not exist)

**Interfaces:**
- Consumes: `PracticeDataType` from `types/api`.
- Produces: `type ChartUnit = 'duration' | 'count' | 'time' | 'bool'`; `chartUnitFor(dt): ChartUnit | null`; `interface UnitGroup<T>`; `groupTracesByUnit<T extends { dataType: PracticeDataType }>(traces: T[]): UnitGroup<T>[]`. Consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

Add to `src/pages/charts/chartLogic.test.ts` (create if missing, with the imports):

```ts
import { describe, it, expect } from 'vitest'
import { chartUnitFor, groupTracesByUnit } from './chartLogic'

describe('chartUnitFor', () => {
  it('maps each data type to its charting unit', () => {
    expect(chartUnitFor('Duration')).toBe('duration')
    expect(chartUnitFor('Int')).toBe('count')
    expect(chartUnitFor('Time')).toBe('time')
    expect(chartUnitFor('Bool')).toBe('bool')
  })
  it('excludes Text (not chartable)', () => {
    expect(chartUnitFor('Text')).toBeNull()
  })
})

describe('groupTracesByUnit', () => {
  it('groups traces by unit, drops Text, and orders duration→count→time→bool', () => {
    const traces = [
      { name: 'Water', dataType: 'Int' as const },
      { name: 'Journal', dataType: 'Text' as const },
      { name: 'Wake', dataType: 'Time' as const },
      { name: 'Reading', dataType: 'Duration' as const },
      { name: 'Cold shower', dataType: 'Bool' as const },
      { name: 'Dishes', dataType: 'Duration' as const },
    ]
    const groups = groupTracesByUnit(traces)
    expect(groups.map((g) => g.unit)).toEqual(['duration', 'count', 'time', 'bool'])
    expect(groups[0].traces.map((t) => t.name)).toEqual(['Reading', 'Dishes'])
    expect(groups.some((g) => g.traces.some((t) => t.name === 'Journal'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/charts/chartLogic.test.ts`
Expected: FAIL — `chartUnitFor`/`groupTracesByUnit` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/pages/charts/chartLogic.ts`:

```ts
export type ChartUnit = 'duration' | 'count' | 'time' | 'bool'

/** The single-unit chart bucket a data type belongs to; null = not chartable (Text). */
export function chartUnitFor(dt: PracticeDataType): ChartUnit | null {
  switch (dt) {
    case 'Duration': return 'duration'
    case 'Int':      return 'count'
    case 'Time':     return 'time'
    case 'Bool':     return 'bool'
    case 'Text':     return null
  }
}

export interface UnitGroup<T extends { dataType: PracticeDataType }> {
  unit: ChartUnit
  traces: T[]
}

const UNIT_ORDER: ChartUnit[] = ['duration', 'count', 'time', 'bool']

/** Split traces into per-unit groups (stable within a group), excluding Text,
 *  ordered duration→count→time→bool. Empty groups are omitted. */
export function groupTracesByUnit<T extends { dataType: PracticeDataType }>(
  traces: T[],
): UnitGroup<T>[] {
  const map = new Map<ChartUnit, T[]>()
  for (const tr of traces) {
    const u = chartUnitFor(tr.dataType)
    if (u === null) continue
    if (!map.has(u)) map.set(u, [])
    map.get(u)!.push(tr)
  }
  return UNIT_ORDER.filter((u) => map.has(u)).map((u) => ({ unit: u, traces: map.get(u)! }))
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/pages/charts/chartLogic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/pages/charts/chartLogic.ts app-react/src/pages/charts/chartLogic.test.ts
git commit -m "feat(app-react): chart unit grouping helper (group series by unit)"
```

---

### Task 6: Charts panel — stacked single-unit sections + Deep Ink restyle

**Files:**
- Modify: `src/pages/charts/ChartsPage.tsx` (`glass` 36-42, `TRACE_COLORS` 43-58, duration strip 212-239, `ChartPanel` body render 209-352)
- Check: any charts tests under `src/pages/charts/`

**Interfaces:**
- Consumes: `groupTracesByUnit`, `chartUnitFor`, `ChartUnit`, `axisKindFor`, `formatMinutesAsHHMM`, `buildChartData`, `averageForType` from `chartLogic`; `SURFACE_PANEL`, `ACCENT`, `ACCENT_LIGHT`, `BORDER` from `tokens`.

Rationale: today every practice in "All practices" is plotted on shared num/time/unit axes → spaghetti. We render **one chart section per unit group**, each with a single correct Y-axis, sharing the date X-axis. Bool renders as a dot strip; Text is already excluded by the grouping helper. `buildChartData` still runs once over all visible traces — each section reads only its own columns from the shared rows.

- [ ] **Step 1: Panel surface + calmer palette**

In `ChartsPage.tsx`:
- Add `SURFACE_PANEL, ACCENT_LIGHT` to the tokens import (line 34).
- Replace the `glass` object (36-42) — drop the blur (no photo behind), use the panel token:

```tsx
const glass: React.CSSProperties = {
  background: SURFACE_PANEL,
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
}
```

- Replace `TRACE_COLORS` (43-58) with a calmer, higher-contrast set that reads on near-black (teal leads):

```tsx
const TRACE_COLORS = [
  '#5eead4', // teal
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#38bdf8', // sky
  '#f472b6', // pink
  '#34d399', // emerald
  '#fb923c', // orange
  '#c4b5fd', // light violet
]
```

- [ ] **Step 2: Extract a single-unit `ChartSection` component**

Add this component above `ChartPanel` in `ChartsPage.tsx`. It renders one Recharts chart for one unit group, adapting the existing axis/line logic. Non-bool units get a value axis; bool renders a short dot strip.

```tsx
type SectionTrace = { name: string; type_: TraceType; color: string; dataType: PracticeDataType }

function ChartSection({
  unit, traces, chartData, selectedPractice, onLegendClick,
  averages,
}: {
  unit: ChartUnit
  traces: SectionTrace[]
  chartData: ChartDataRow[]
  selectedPractice: string | null
  onLegendClick: (name: string) => void
  averages: { axis: 'num' | 'time' | 'unit'; value: number; color: string; name: string }[]
}) {
  const isBool = unit === 'bool'
  const height = isBool ? 110 : 220
  const yTickFormatter =
    unit === 'time' ? formatMinutesAsHHMM
    : unit === 'duration' ? (v: number) => `${v} min`
    : (v: number) => String(v)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
        <XAxis
          dataKey="date"
          stroke="rgba(255,255,255,0.15)"
          tick={{ fontSize: 10, fill: 'rgba(238,243,248,0.55)' }}
          tickLine={false} axisLine={false} interval="preserveStartEnd"
        />
        {isBool
          ? <YAxis yAxisId="v" hide domain={[0, 1.1]} />
          : <YAxis yAxisId="v" orientation="left" domain={[0, 'auto']}
              stroke="rgba(255,255,255,0.15)"
              tick={{ fontSize: 10, fill: 'rgba(238,243,248,0.55)' }}
              tickLine={false} axisLine={false} tickFormatter={yTickFormatter} />}
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 10, background: '#151d27', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', color: '#eef3f8' }}
          labelStyle={{ color: '#eef3f8' }} itemStyle={{ color: '#eef3f8' }}
        />
        <Legend
          verticalAlign="bottom" align="center"
          wrapperStyle={{ fontSize: 11, paddingTop: 6, cursor: traces.length > 1 ? 'pointer' : 'default', color: '#eef3f8' }}
          onClick={(d) => { if (traces.length > 1) onLegendClick(d.value as string) }}
          formatter={(value) => (
            <span style={{ color: selectedPractice && selectedPractice !== value ? 'rgba(238,243,248,0.35)' : '#eef3f8' }}>{value}</span>
          )}
        />
        {traces.map(({ name, type_, color }) => {
          if (isBool) {
            return <Line key={name} yAxisId="v" type="monotone" dataKey={name} stroke="none" strokeWidth={0}
              dot={{ r: 4, fill: color, strokeWidth: 0, fillOpacity: 0.85 }} activeDot={{ r: 5, fill: color }} name={name} />
          }
          const label = traceLabel(type_)
          if (label === 'Bar') {
            return <Bar key={name} yAxisId="v" dataKey={name} fill={color} fillOpacity={0.35} radius={[2, 2, 0, 0]} maxBarSize={20} />
          }
          if (label === 'Dot') {
            return <Line key={name} yAxisId="v" type="monotone" dataKey={name} stroke="none" strokeWidth={0}
              dot={{ r: 4, fill: color, strokeWidth: 0, fillOpacity: 0.8 }} activeDot={{ r: 5, fill: color }} name={name} />
          }
          const isSquare = typeof type_ === 'object' && 'Line' in type_ && type_.Line.style === 'Square'
          return <Line key={name} yAxisId="v" type={isSquare ? 'stepAfter' : 'natural'} dataKey={name}
            stroke={color} strokeOpacity={0.85} strokeWidth={2}
            dot={{ r: 2.5, fill: color, strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls name={name} />
        })}
        {averages
          .filter((a) => traces.some((t) => t.name === a.name))
          .map((a, i) => (
            <ReferenceLine key={`avg-${i}`} yAxisId="v" y={a.value} stroke={a.color}
              strokeDasharray="6 4" strokeOpacity={0.8} ifOverflow="extendDomain" />
          ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Render sections from grouped traces in `ChartPanel`**

In `ChartPanel`, after `visibleTraces` is computed, build groups and give `averages` a `name`. Update imports at the top of the file to include `groupTracesByUnit` and `ChartUnit`, and `SURFACE_PANEL`/`ACCENT_LIGHT`.

- In the `averages` map (195-203), also carry the trace name: change the returned object to `{ axis: axisKindFor(t.dataType), value: avg, color: t.color, name: t.name }` and widen the type guard accordingly (`name: string`).
- Compute groups right before the `return`:

```tsx
  const unitGroups = groupTracesByUnit(
    visibleTraces.map((t) => ({ name: t.name, type_: t.type_, color: t.color, dataType: t.dataType })),
  )
  const handleLegendClick = (name: string) =>
    setSelectedPractice((prev) => (prev === name ? null : name))
```

- Replace the chart-body branch that currently renders the single `<ResponsiveContainer>…</ResponsiveContainer>` (lines 259-349, the `: (` … `)` after the `isGridReport` ternary) with a stacked list of sections:

```tsx
        ) : (
          <div className="flex flex-col gap-4">
            {unitGroups.map((g) => (
              <ChartSection
                key={g.unit}
                unit={g.unit}
                traces={g.traces}
                chartData={chartData}
                selectedPractice={selectedPractice}
                onLegendClick={handleLegendClick}
                averages={averages}
              />
            ))}
          </div>
        )}
```

Leave the `isLoading` / empty-data / `isGridReport` branches and the duration strip unchanged in behavior (the grid report still uses `GridTable`). Remove the now-unused `usedAxes` / `numAxisAllDuration` computations (191-193) and the `chartHeight` prop plumbing if it is no longer referenced (sections size themselves); if removing `chartHeight` from `ChartPanelProps` and the `ChartsPage` call sites is noisy, keep the prop but stop using it — either is fine as long as lint passes.

- [ ] **Step 4: Retune the duration strip active color**

In the duration `<button>` style (218-223) the active `background: duration === d.value ? ACCENT` already picks up the new teal — no change needed. Confirm the inactive `rgba(0,0,0,0.05)` still reads on the panel; if it looks invisible, change it to `rgba(255,255,255,0.06)`.

- [ ] **Step 5: Run suite + lint**

Run: `npm test && npm run lint`
Expected: green. Update any chart test that asserted a single chart container to expect one-section-per-unit; keep data/CSV assertions intact.

- [ ] **Step 6: Visual check (the payoff)**

`npm run dev` → Home (embedded charts) and `/charts`:
- "All practices" now shows **separate stacked charts** per unit — a minutes chart, a count chart, a time-of-day (HH:MM) chart, and a boolean dot strip — instead of one tangled overlay.
- Each section has its own legend; clicking a legend entry still isolates that series.
- Panel reads as a clean Deep Ink card; lines are calm and distinct.

- [ ] **Step 7: Commit**

```bash
git add app-react/src/pages/charts/ChartsPage.tsx
git commit -m "feat(app-react): charts as stacked single-unit sections + Deep Ink restyle"
```

---

## Self-Review

**Spec coverage:**
- Deep Ink + Glow surface → Tasks 1 (tokens/backdrop const) + 2 (backdrop swap). ✓
- Photo retired from app, kept for login → Task 2. ✓
- Serif headings + Inter → already in place (TopBar/ChartsPage use `font-serif`; fonts unchanged per constraint). ✓
- Brightened teal accent → Task 1 (cascades). ✓
- Header restyle → Task 3. ✓
- Calendar today marker / quiet labels → Task 4. ✓
- Practice rows: consistent anatomy + logged affordance + surface → Task 4. ✓
- Charts restyle + readability (group by unit; bool as dots; text excluded) → Tasks 5 + 6. ✓
- Non-goals respected: no new features, no IA change, light theme untouched, no backend. ✓
- Testing/lint/visual gates in every task; a11y contrast called out. ✓

**Placeholder scan:** No TBD/TODO; each code step carries concrete code or exact literals. MonthCalendar step (4.4) and the optional `chartHeight` cleanup (6.3) describe a mechanical retune rather than a full diff because their current source wasn't quoted here — the instruction names the exact tokens/values to substitute.

**Type consistency:** `groupTracesByUnit`/`chartUnitFor`/`ChartUnit`/`UnitGroup` names match between Task 5 (produce) and Task 6 (consume). `ChartSection` consumes `ChartDataRow`, `TraceType`, `traceLabel`, `formatMinutesAsHHMM` — all already imported/defined in `ChartsPage.tsx`. `averages` gains a `name: string` field, used by `ChartSection`'s filter.
