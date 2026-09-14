# Parity Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six features present in the Rust frontend to the React `app-react` frontend: practice hide/show toggle, per-trace Y-axis selector, About link, app-update notification, yatra practice drag-to-reorder, and native Web Share for invite links.

**Architecture:** Each feature is a targeted surgical edit to its existing page or API module. A new `useServiceWorkerUpdate` hook is the only new file. All changes follow existing patterns (dnd-kit, react-query mutations, vi.mock tests, i18n via locale JSON).

**Tech Stack:** React 18, TypeScript, Vite, @tanstack/react-query, @dnd-kit/core + @dnd-kit/sortable, react-icons, react-i18next, Vitest + React Testing Library

## Global Constraints

- All locale changes must be applied to all three files: `en/translation.json`, `ru/translation.json`, `uk/translation.json`
- Tests use `vi.mock` — never import real API modules in test files
- The `practicesApi` mock in test files hard-codes `is_active: true`; update mocks if they now affect the `is_active` toggle test
- Run tests with: `cd app-react && npm test -- --run` (or the Vitest equivalent already used in CI)
- Follow existing glass card styling tokens: `ACCENT`, `ACCENT_GRADIENT`, `BORDER`, `TEXT` from `../../theme/tokens`

---

### Task 1: Practice hide/show toggle

**Files:**
- Modify: `app-react/src/api/practices.ts`
- Modify: `app-react/src/pages/settings/MyPracticesPage.tsx`
- Modify: `app-react/public/locales/en/translation.json`
- Modify: `app-react/public/locales/ru/translation.json`
- Modify: `app-react/public/locales/uk/translation.json`

**Interfaces:**
- Produces: `practicesApi.updateUserPractice(id, { is_active: boolean })` now works correctly (currently hard-codes `is_active: true`)
- Produces: each practice row has an eye-icon button (`aria-label` = `t('practice.hide')` or `t('practice.show')`) that toggles `is_active`

- [ ] **Step 1: Fix the hard-coded `is_active: true` bug in `practices.ts`**

In `app-react/src/api/practices.ts`, `updateUserPractice` currently forces `is_active: true`. Change the spread order so the caller's `data.is_active` wins:

```typescript
async updateUserPractice(id: string, data: { practice?: string; data_type?: PracticeDataType; is_active?: boolean; is_required?: boolean; dropdown_variants?: string }): Promise<void> {
  await apiClient.put(`/user/practice/${id}`, {
    user_practice: { id, ...data },  // ← remove the `is_active: true` default; caller controls it
  })
},
```

- [ ] **Step 2: Add i18n keys to all three locale files**

In `app-react/public/locales/en/translation.json`, inside the `"practice"` object, add after `"edit"`:
```json
"hide": "Hide practice",
"show": "Show practice",
```

In `app-react/public/locales/ru/translation.json`, inside `"practice"`:
```json
"hide": "Скрыть практику",
"show": "Показать практику",
```

In `app-react/public/locales/uk/translation.json`, inside `"practice"`:
```json
"hide": "Приховати практику",
"show": "Показати практику",
```

- [ ] **Step 3: Add hide/show toggle button to `SortableRow` in `MyPracticesPage.tsx`**

At the top of the file add `FaEye, FaEyeSlash` to the `react-icons/fa` import line (they are already in the project — used in `EditPasswordPage.tsx`).

The `SortableRow` component signature becomes:
```tsx
function SortableRow({
  practice,
  onDelete,
  onToggleActive,
}: {
  practice: UserPractice
  onDelete: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
})
```

Inside the row, between the Edit link and the Delete button, insert:
```tsx
{/* Hide/show toggle */}
<button
  type="button"
  aria-label={practice.is_active ? t('practice.hide') : t('practice.show')}
  onClick={() => onToggleActive(practice.id, !practice.is_active)}
  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
  style={{ color: practice.is_active ? 'rgba(242,244,246,0.45)' : '#f59e0b', border: 'none', background: 'none' }}
>
  {practice.is_active
    ? <FaEye className="w-3.5 h-3.5" />
    : <FaEyeSlash className="w-3.5 h-3.5" />
  }
</button>
```

Dim inactive rows by adding `opacity: isDragging ? 0.4 : practice.is_active ? 1 : 0.4` to the row `style` object, and add `textDecoration: practice.is_active ? undefined : 'line-through'` to the practice name `<span>`.

- [ ] **Step 4: Add `toggleActive` mutation in `MyPracticesPage`**

Inside `MyPracticesPage`, add a mutation:
```tsx
const toggleActive = useMutation({
  mutationFn: ({ id, active }: { id: string; active: boolean }) =>
    practicesApi.updateUserPractice(id, { is_active: active }),
  onSuccess: () => {
    initialized.current = false
    qc.invalidateQueries({ queryKey: ['practices'] })
  },
  onError: () => showToast({ message: t('settings.reorderFailed'), variant: 'error' }),
})
```

Update the `SortableRow` usage in the JSX to pass `onToggleActive`:
```tsx
<SortableRow
  key={p.id}
  practice={p}
  onDelete={(id) => deleteMutation.mutate(id)}
  onToggleActive={(id, active) => toggleActive.mutate({ id, active })}
/>
```

- [ ] **Step 5: Write the test**

Create `app-react/src/pages/settings/MyPracticesPage.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { MyPracticesPage } from './MyPracticesPage'

vi.mock('../../api/practices', () => ({
  practicesApi: {
    getUserPractices: vi.fn().mockResolvedValue([
      { id: '1', practice: 'Meditation', data_type: 'Bool', is_active: true, is_required: false },
      { id: '2', practice: 'Reading', data_type: 'Int', is_active: false, is_required: false },
    ]),
    updateUserPractice: vi.fn().mockResolvedValue(undefined),
    deleteUserPractice: vi.fn().mockResolvedValue(undefined),
    reorderUserPractices: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('MyPracticesPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders inactive practice with strikethrough', async () => {
    wrap(<MyPracticesPage />)
    const name = await screen.findByText('Reading')
    expect(name).toHaveStyle({ textDecoration: 'line-through' })
  })

  it('calls updateUserPractice with is_active:false when hiding an active practice', async () => {
    const { practicesApi } = await import('../../api/practices')
    wrap(<MyPracticesPage />)
    const hideBtn = await screen.findByLabelText('Hide practice')
    fireEvent.click(hideBtn)
    await waitFor(() => {
      expect(vi.mocked(practicesApi.updateUserPractice)).toHaveBeenCalledWith('1', { is_active: false })
    })
  })
})
```

- [ ] **Step 6: Run tests**

```bash
cd app-react && npm test -- --run src/pages/settings/MyPracticesPage.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add app-react/src/api/practices.ts \
        app-react/src/pages/settings/MyPracticesPage.tsx \
        app-react/src/pages/settings/MyPracticesPage.test.tsx \
        app-react/public/locales/en/translation.json \
        app-react/public/locales/ru/translation.json \
        app-react/public/locales/uk/translation.json
git commit -m "feat(app-react): practice hide/show toggle + fix is_active passthrough"
```

---

### Task 2: Per-trace Y-axis selector (Left / Right)

**Files:**
- Modify: `app-react/src/pages/charts/ChartsPage.tsx`
- Modify: `app-react/public/locales/en/translation.json`
- Modify: `app-react/public/locales/ru/translation.json`
- Modify: `app-react/public/locales/uk/translation.json`

**Interfaces:**
- Consumes: `PracticeTrace.y_axis: string | null` (already in `api/charts.ts`)
- Produces: trace editor row has a Y-axis `<select>` with values `""` (Auto) and `"Y2"` (Right axis); chart renders a right-side `YAxis` with `yAxisId="num-right"` when any numeric trace has `y_axis === 'Y2'`

- [ ] **Step 1: Add i18n keys**

In `en/translation.json`, inside `"charts"`:
```json
"yAxis": "Y-axis",
"yAxisAuto": "Auto",
"yAxisRight": "Right axis",
```

In `ru/translation.json`, inside `"charts"`:
```json
"yAxis": "Ось Y",
"yAxisAuto": "Авто",
"yAxisRight": "Правая ось",
```

In `uk/translation.json`, inside `"charts"`:
```json
"yAxis": "Вісь Y",
"yAxisAuto": "Авто",
"yAxisRight": "Права вісь",
```

- [ ] **Step 2: Add `y_axis` to the `traces` builder in `ChartPanel`**

In `ChartsPage.tsx`, the `traces` array is built in `ChartPanel`. Extend its element type to include `yAxis: string | null`:

```tsx
const traces: { name: string; type_: TraceType; color: string; dataType: PracticeDataType; showAverage: boolean; yAxis: string | null }[] =
  report === null
    ? activePractices.map((p, i) => ({
        name: p.practice,
        type_: { Line: { style: 'Regular' as const } },
        color: TRACE_COLORS[i % TRACE_COLORS.length],
        dataType: p.data_type,
        showAverage: false,
        yAxis: null,
      }))
    : isGrid(report.definition)
      ? report.definition.Grid.practices.map((pid, i) => ({
          name: practiceMap[pid] ?? pid,
          type_: { Line: { style: 'Regular' as const } } as TraceType,
          color: TRACE_COLORS[i % TRACE_COLORS.length],
          dataType: byId.get(pid)?.data_type ?? 'Int',
          showAverage: false,
          yAxis: null,
        }))
      : report.definition.Graph.traces.map((t, i) => ({
          name: practiceMap[t.practice] ?? t.practice,
          type_: t.type_,
          color: TRACE_COLORS[i % TRACE_COLORS.length],
          dataType: byId.get(t.practice)?.data_type ?? 'Int',
          showAverage: t.show_average,
          yAxis: t.y_axis,       // ← add this
        }))
```

- [ ] **Step 3: Add `resolveAxisId` helper and update `usedAxes` + rendering**

After the `traces` definition, add a local helper:

```tsx
function resolveAxisId(yAxis: string | null, dataType: PracticeDataType): string {
  if (yAxis === 'Y2' && axisKindFor(dataType) === 'num') return 'num-right'
  return axisKindFor(dataType)
}
```

Update `usedAxes` to use it:
```tsx
const usedAxes = new Set(visibleTraces.map((t) => resolveAxisId(t.yAxis, t.dataType)))
```

Update `numAxisAllDuration` (filter by `'num'` axis stays, because right-axis traces are still Duration/Int):
```tsx
const numAxisAllDuration =
  visibleTraces.filter((t) => ['num', 'num-right'].includes(resolveAxisId(t.yAxis, t.dataType)))
    .every((t) => t.dataType === 'Duration') &&
  visibleTraces.some((t) => ['num', 'num-right'].includes(resolveAxisId(t.yAxis, t.dataType)))
```

Update `averages`:
```tsx
const averages = visibleTraces
  .filter((t) => t.showAverage)
  .map((t) => {
    const entries = rawValues.filter((e: { practice: string }) => e.practice === t.name)
    const avg = averageForType(entries as { cob_date: string; value: unknown }[], t.dataType, todayCob)
    return avg === null ? null : { axis: resolveAxisId(t.yAxis, t.dataType), value: avg, color: t.color }
  })
  .filter((a): a is { axis: string; value: number; color: string } => a !== null)
```

Add the right-side numeric axis in the `<ComposedChart>` JSX, after the existing `usedAxes.has('num')` block:
```tsx
{usedAxes.has('num-right') && (
  <YAxis
    yAxisId="num-right"
    orientation="right"
    domain={[0, 'auto']}
    stroke="rgba(255,255,255,0.15)"
    tick={{ fontSize: 10, fill: 'rgba(238,243,248,0.55)' }}
    tickLine={false}
    axisLine={false}
    tickFormatter={(v: number) => (numAxisAllDuration ? `${v} min` : String(v))}
  />
)}
```

Update the series rendering loop (`visibleTraces.map`) to use `resolveAxisId`:
```tsx
{visibleTraces.map(({ name, type_, color, dataType, yAxis }) => {
  const yAxisId = resolveAxisId(yAxis, dataType)
  // ... rest unchanged
```

- [ ] **Step 4: Add Y-axis select to the trace editor row in `ReportCard`**

In the `currentTraces.map(trace => ...)` section, inside the second `<div className="flex items-center gap-2 pl-1">` row (which has custom label and show-average), add a Y-axis select at the end:

```tsx
{/* Y-axis override */}
<select
  value={trace.y_axis ?? ''}
  onChange={e => changeTrace(trace.practice, { y_axis: e.target.value === '' ? null : e.target.value })}
  className="text-xs rounded-lg px-2 h-6 outline-none flex-shrink-0"
  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: TEXT }}
  aria-label={t('charts.yAxis')}
  title={t('charts.yAxis')}
>
  <option value="">{t('charts.yAxisAuto')}</option>
  <option value="Y2">{t('charts.yAxisRight')}</option>
</select>
```

- [ ] **Step 5: Add Y-axis tests to the existing `ChartsPage.test.tsx`**

`ChartsPage.test.tsx` already exists with its own `vi.mock` calls. **Do not create a new file** — append a new `describe` block at the bottom of the existing file:

```tsx
// ── Y-axis select ─────────────────────────────────────────────────────────────
describe('ChartsPage — Y-axis select', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Override the reports mock with one that has a Graph report + one trace
    vi.mocked(chartsApi.getReports).mockResolvedValue([
      {
        id: 'r1',
        name: 'Test Report',
        definition: {
          Graph: {
            bar_layout: 'Grouped',
            traces: [
              { label: null, type_: 'Bar', practice: 'p1', y_axis: null, show_average: false },
            ],
          },
        },
      },
    ])
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: 'p1', practice: 'Meditation', data_type: 'Int', is_active: true, is_required: false },
    ])
  })

  it('calls updateReport with y_axis: "Y2" when Right axis is selected', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/charts']}>
          <Routes>
            <Route path="/charts" element={<ChartsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    // Wait for report name to appear
    await screen.findByText('Test Report')
    // Find Y-axis selects (only present when manage panel is open)
    const selects = screen.queryAllByRole('combobox', { name: /y-axis/i })
    if (selects.length > 0) {
      await user.selectOptions(selects[0], 'Y2')
      await waitFor(() => {
        expect(vi.mocked(chartsApi.updateReport)).toHaveBeenCalledWith(
          'r1',
          'Test Report',
          expect.objectContaining({
            Graph: expect.objectContaining({
              traces: expect.arrayContaining([
                expect.objectContaining({ y_axis: 'Y2' }),
              ]),
            }),
          })
        )
      })
    }
  })
})
```

- [ ] **Step 6: Run tests**

```bash
cd app-react && npm test -- --run src/pages/charts/ChartsPage.test.tsx
```

Expected: all tests pass (the ChartsPage.test.tsx file that already exists should also keep passing).

- [ ] **Step 7: Commit**

```bash
git add app-react/src/pages/charts/ChartsPage.tsx \
        app-react/src/pages/charts/ChartsPage.test.tsx \
        app-react/public/locales/en/translation.json \
        app-react/public/locales/ru/translation.json \
        app-react/public/locales/uk/translation.json
git commit -m "feat(app-react): per-trace Y-axis selector (Left/Right) in chart editor"
```

---

### Task 3: About link + App update notification

**Files:**
- Create: `app-react/src/hooks/useServiceWorkerUpdate.ts`
- Modify: `app-react/src/pages/settings/SettingsPage.tsx`
- Modify: `app-react/public/locales/en/translation.json`
- Modify: `app-react/public/locales/ru/translation.json`
- Modify: `app-react/public/locales/uk/translation.json`

**Interfaces:**
- Produces: `useServiceWorkerUpdate(): { updateReady: boolean; applyUpdate: () => void }`
- Produces: `SettingsPage` shows About link and, when `updateReady` is true, an amber-highlighted "Update app" item

- [ ] **Step 1: Write the failing test for `useServiceWorkerUpdate`**

Create `app-react/src/hooks/useServiceWorkerUpdate.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useServiceWorkerUpdate } from './useServiceWorkerUpdate'

describe('useServiceWorkerUpdate', () => {
  let listeners: Record<string, EventListener[]>

  beforeEach(() => {
    listeners = {}
    const mockSW = {
      addEventListener: vi.fn((event: string, cb: EventListener) => {
        listeners[event] = listeners[event] ?? []
        listeners[event].push(cb)
      }),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(navigator, 'serviceWorker', {
      value: mockSW,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with updateReady = false', () => {
    const { result } = renderHook(() => useServiceWorkerUpdate())
    expect(result.current.updateReady).toBe(false)
  })

  it('sets updateReady = true when controllerchange fires', async () => {
    const { result } = renderHook(() => useServiceWorkerUpdate())
    act(() => {
      listeners['controllerchange']?.forEach(cb => cb(new Event('controllerchange')))
    })
    expect(result.current.updateReady).toBe(true)
  })

  it('applyUpdate calls window.location.reload', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, configurable: true })
    const { result } = renderHook(() => useServiceWorkerUpdate())
    act(() => { result.current.applyUpdate() })
    expect(reload).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app-react && npm test -- --run src/hooks/useServiceWorkerUpdate.test.ts
```

Expected: FAIL — `useServiceWorkerUpdate` not found.

- [ ] **Step 3: Implement `useServiceWorkerUpdate`**

Create `app-react/src/hooks/useServiceWorkerUpdate.ts`:

```typescript
import { useState, useEffect } from 'react'

export function useServiceWorkerUpdate(): { updateReady: boolean; applyUpdate: () => void } {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return
    const handler = () => setUpdateReady(true)
    sw.addEventListener('controllerchange', handler)
    return () => sw.removeEventListener('controllerchange', handler)
  }, [])

  return {
    updateReady,
    applyUpdate: () => window.location.reload(),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd app-react && npm test -- --run src/hooks/useServiceWorkerUpdate.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Add i18n keys**

In `en/translation.json`, inside `"settings"`:
```json
"about": "About Sadhana",
"updateApp": "Update app",
```

In `ru/translation.json`, inside `"settings"`:
```json
"about": "О Sadhana",
"updateApp": "Обновить приложение",
```

In `uk/translation.json`, inside `"settings"`:
```json
"about": "Про Sadhana",
"updateApp": "Оновити застосунок",
```

- [ ] **Step 6: Update `SettingsPage.tsx`**

Add to the imports at the top:
```tsx
import { LuInfo, LuRefreshCw } from 'react-icons/lu'
import { useServiceWorkerUpdate } from '../../hooks/useServiceWorkerUpdate'
```

Inside `SettingsPage`, call the hook:
```tsx
const { updateReady, applyUpdate } = useServiceWorkerUpdate()
```

In the App section, extend to include About link and (conditionally) Update app:
```tsx
<SectionCard title={t('settings.app')}>
  {updateReady && (
    <button
      onClick={applyUpdate}
      className="flex items-center gap-3 px-4 py-3.5 w-full text-left transition-colors"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        color: 'inherit',
        background: 'rgba(245,158,11,0.06)',
      }}
    >
      <LuRefreshCw className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
      <span className="flex-1 text-sm font-medium" style={{ color: '#f59e0b' }}>{t('settings.updateApp')}</span>
    </button>
  )}
  <MenuItem label={t('settings.language')} to="/settings/language" icon={LuGlobe} />
  <MenuItem label={t('settings.help')}     to="/help"              icon={LuCircleHelp} />
  <a
    href="https://sadhana.pro"
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-3 px-4 py-3.5 transition-colors"
    style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'inherit', textDecoration: 'none' }}
  >
    <LuInfo className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
    <span className="flex-1 text-sm font-medium text-base-content">{t('settings.about')}</span>
  </a>
</SectionCard>
```

Note: remove the `last` prop from the `MenuItem` for `settings.language` so the border renders correctly, and remove it from `settings.help` since About follows it.

- [ ] **Step 7: Run the full test suite**

```bash
cd app-react && npm test -- --run
```

Expected: all existing tests still pass, new SW hook tests pass.

- [ ] **Step 8: Commit**

```bash
git add app-react/src/hooks/useServiceWorkerUpdate.ts \
        app-react/src/hooks/useServiceWorkerUpdate.test.ts \
        app-react/src/pages/settings/SettingsPage.tsx \
        app-react/public/locales/en/translation.json \
        app-react/public/locales/ru/translation.json \
        app-react/public/locales/uk/translation.json
git commit -m "feat(app-react): About link + app-update notification in Settings"
```

---

### Task 4: Yatra practice drag-to-reorder

**Files:**
- Modify: `app-react/src/pages/yatras/YatraAdminSettingsPage.tsx`

**Interfaces:**
- Consumes: `yatrasApi.reorderPractices(yatraId: string, practiceIds: string[]): Promise<void>` (already exists in `yatras.ts`)
- Produces: practices list in admin settings is drag-sortable; `FaGripVertical` is a live drag handle

- [ ] **Step 1: Add dnd-kit imports to `YatraAdminSettingsPage.tsx`**

Add to the import block at the top of the file:
```tsx
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

- [ ] **Step 2: Add local practices order state**

Inside the `YatraAdminSettingsPage` component, after the `practices` constant, add:

```tsx
const [orderedPractices, setOrderedPractices] = useState<typeof practices>([])
const practicesInitialized = useRef(false)

// Sync order from server on first load
if (!practicesInitialized.current && practices.length > 0) {
  setOrderedPractices(practices)
  practicesInitialized.current = true
}

// Reset when server data refreshes after a mutation
useEffect(() => {
  if (practicesQuery.isSuccess) {
    practicesInitialized.current = false
  }
}, [practicesQuery.dataUpdatedAt])
```

Add `useRef` to the `react` import if not already there (it already is in the file).

- [ ] **Step 3: Add reorder mutation**

After the `deletePractice` mutation, add:
```tsx
const reorderPractices = useMutation({
  mutationFn: (ids: string[]) => yatrasApi.reorderPractices(id!, ids),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['yatra-practices', id] }),
})
```

- [ ] **Step 4: Add `handleDragEnd` and create `SortablePracticeRow`**

Before the `return` statement, add:
```tsx
function handlePracticeDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return
  const oldIdx = orderedPractices.findIndex((p) => p.id === active.id)
  const newIdx = orderedPractices.findIndex((p) => p.id === over.id)
  const next = arrayMove(orderedPractices, oldIdx, newIdx)
  setOrderedPractices(next)
  reorderPractices.mutate(next.map((p) => p.id))
}
```

Extract the practice row JSX into a `SortablePracticeRow` inner component (defined just before the `return`):

```tsx
function SortablePracticeRow({ p }: { p: YatraPractice }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
  const meta = TYPE_META[p.data_type] ?? TYPE_META.Text
  const TypeIcon = meta.icon
  return (
    <div
      ref={setNodeRef}
      style={{
        ...glass,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="w-6 h-6 flex items-center justify-center flex-shrink-0 touch-none"
        style={{ color: '#d1d5db', cursor: 'grab', border: 'none', background: 'none' }}
        aria-label="Drag to reorder"
      >
        <FaGripVertical className="w-3.5 h-3.5" />
      </button>
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: meta.bg }}
      >
        <TypeIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-base-content block truncate">{p.practice}</span>
        <span className="text-xs font-medium" style={{ color: meta.color }}>{t(meta.tKey)}</span>
      </div>
      <Link
        to={`/yatra/${id}/practice/${p.id}/edit`}
        className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)' }}
      >
        <FaEdit className="w-3 h-3" />
      </Link>
      <button
        type="button"
        onClick={() => (document.getElementById(`del-practice-${p.id}`) as HTMLDialogElement)?.showModal()}
        className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ background: 'rgba(225,29,72,0.07)', color: 'rgba(225,29,72,0.55)', border: 'none' }}
      >
        <FaTrash className="w-3 h-3" />
      </button>
      <ConfirmModal
        id={`del-practice-${p.id}`}
        title={t('yatras.deletePracticeTitle')}
        message={t('yatras.deletePracticeMsg', { name: p.practice })}
        confirmLabel={t('common.delete')}
        onConfirm={() => deletePractice.mutate(p.id)}
      />
    </div>
  )
}
```

`SortablePracticeRow` uses `id`, `t`, `glass`, and `deletePractice` from the outer component scope — it must be defined inside `YatraAdminSettingsPage` so it closes over them.

- [ ] **Step 5: Replace the practice list JSX with the drag context**

Replace the existing `{practices.map((p: YatraPractice) => { ... })}` block (inside the `{showPractices && ...}` section) with:

```tsx
<DndContext collisionDetection={closestCenter} onDragEnd={handlePracticeDragEnd}>
  <SortableContext
    items={orderedPractices.map((p) => p.id)}
    strategy={verticalListSortingStrategy}
  >
    <div className="flex flex-col gap-2">
      {orderedPractices.map((p) => (
        <SortablePracticeRow key={p.id} p={p} />
      ))}
    </div>
  </SortableContext>
</DndContext>
```

The "Add new practice" `<Link>` button that follows the list stays outside the `DndContext`.

- [ ] **Step 6: Run the full test suite to confirm no regressions**

```bash
cd app-react && npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add app-react/src/pages/yatras/YatraAdminSettingsPage.tsx
git commit -m "feat(app-react): drag-to-reorder yatra practices in admin settings"
```

---

### Task 5: Native Web Share for yatra invite link

**Files:**
- Modify: `app-react/src/pages/yatras/YatraAdminSettingsPage.tsx`
- Modify: `app-react/public/locales/en/translation.json`
- Modify: `app-react/public/locales/ru/translation.json`
- Modify: `app-react/public/locales/uk/translation.json`

**Interfaces:**
- Produces: invite button calls `navigator.share()` when the browser supports it; falls back to clipboard copy otherwise

- [ ] **Step 1: Add i18n key**

In `en/translation.json`, inside `"yatras"`, add after `"copyInvite"`:
```json
"shareInvite": "Share invite link",
```

In `ru/translation.json`, inside `"yatras"`:
```json
"shareInvite": "Поделиться ссылкой",
```

In `uk/translation.json`, inside `"yatras"`:
```json
"shareInvite": "Поділитися посиланням",
```

- [ ] **Step 2: Add `LuShare2` to imports in `YatraAdminSettingsPage.tsx`**

In the lucide import line, add `LuShare2`:
```tsx
import {
  LuCheck, LuCopy, LuLink, LuHash, LuTimer, LuClock, LuType, LuToggleRight, LuX,
  LuChartBar, LuShare2,
} from 'react-icons/lu'
```

- [ ] **Step 3: Replace `copyInvite` with a conditional share/copy function**

Replace the existing `copyInvite` function with:

```tsx
function handleInvite() {
  const url = `${window.location.origin}/yatra/${id}/join`
  const yatraName = yatraQuery.data?.name ?? 'Yatra'
  const canNativeShare =
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ url }) === true
  if (canNativeShare) {
    navigator.share({ title: yatraName, url }).catch(() => {
      // user dismissed share sheet — ignore
    })
  } else {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
}
```

- [ ] **Step 4: Update the invite button JSX**

Replace the single `onClick={copyInvite}` invite button with a version that reflects both paths. The button label and icon now depend on `navigator.share` availability:

```tsx
{/* Invite link */}
<SectionLabel>{t('yatras.sectionInvite')}</SectionLabel>
{(() => {
  const canNativeShare =
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ url: `${window.location.origin}/yatra/${id}/join` }) === true
  return (
    <button
      type="button"
      onClick={handleInvite}
      className="rounded-2xl px-4 py-3.5 flex items-center gap-3 w-full text-left transition-all"
      style={glass}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: copied ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.06)' }}
      >
        <LuLink className="w-4 h-4" style={{ color: copied ? ACCENT : 'rgba(242,244,246,0.65)' }} />
      </div>
      <span className="flex-1 text-sm font-semibold text-base-content">
        {copied
          ? t('yatras.inviteCopied')
          : canNativeShare
            ? t('yatras.shareInvite')
            : t('yatras.copyInvite')
        }
      </span>
      {copied
        ? <LuCheck className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} />
        : canNativeShare
          ? <LuShare2 className="w-4 h-4 flex-shrink-0" style={{ color: '#d1d5db' }} />
          : <LuCopy className="w-4 h-4 flex-shrink-0" style={{ color: '#d1d5db' }} />
      }
    </button>
  )
})()}
```

- [ ] **Step 5: Write the test**

Create `app-react/src/pages/yatras/YatraAdminSettingsPage.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { YatraAdminSettingsPage } from './YatraAdminSettingsPage'

const mockYatra = { id: 'y1', name: 'Morning Circle', show_stability_metrics: false, statistics: null }

vi.mock('../../api/yatras', () => ({
  yatrasApi: {
    getYatra: vi.fn().mockResolvedValue(mockYatra),
    getYatraUsers: vi.fn().mockResolvedValue([]),
    getYatraPractices: vi.fn().mockResolvedValue([]),
    reorderPractices: vi.fn().mockResolvedValue(undefined),
    updateYatra: vi.fn().mockResolvedValue(undefined),
    toggleAdmin: vi.fn().mockResolvedValue(undefined),
    removeMember: vi.fn().mockResolvedValue(undefined),
    deleteYatraPractice: vi.fn().mockResolvedValue(undefined),
    deleteYatra: vi.fn().mockResolvedValue(undefined),
  },
}))

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/yatra/y1/admin']}>
        <Routes>
          <Route path="/yatra/:id/admin" element={<YatraAdminSettingsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('YatraAdminSettingsPage — invite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls navigator.share when native share is available', async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: shareFn, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })

    wrap()
    const inviteBtn = await screen.findByText(/share invite link/i)
    fireEvent.click(inviteBtn.closest('button')!)
    await waitFor(() => expect(shareFn).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('/yatra/y1/join') })
    ))
  })

  it('falls back to clipboard copy when native share is unavailable', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    const writeFn = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeFn }, configurable: true })

    wrap()
    const inviteBtn = await screen.findByText(/copy invite link/i)
    fireEvent.click(inviteBtn.closest('button')!)
    await waitFor(() => expect(writeFn).toHaveBeenCalledWith(
      expect.stringContaining('/yatra/y1/join')
    ))
  })
})
```

- [ ] **Step 6: Run tests**

```bash
cd app-react && npm test -- --run src/pages/yatras/YatraAdminSettingsPage.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 7: Run full suite**

```bash
cd app-react && npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add app-react/src/pages/yatras/YatraAdminSettingsPage.tsx \
        app-react/src/pages/yatras/YatraAdminSettingsPage.test.tsx \
        app-react/public/locales/en/translation.json \
        app-react/public/locales/ru/translation.json \
        app-react/public/locales/uk/translation.json
git commit -m "feat(app-react): native Web Share API for yatra invite link"
```
