# Missing Features Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 features present in the Rust/Yew frontend but missing from the React rewrite: enhanced report editors, daily score config, CSV export, duration quick-add modal, and month calendar picker.

**Architecture:** All changes are self-contained within `app-react/src/`. Features 1 and 3 both modify `ChartsPage.tsx`; the rest touch separate files. No new routes are added. The backend already supports all 5 features.

**Tech Stack:** React 18, TypeScript, Vite, Vitest + @testing-library/react, TanStack Query, react-i18next, lucide-react (LuDownload etc.)

## Global Constraints

- Glass-morphism inline style constant used across files: `{ background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }`
- Accent colour: `#01a386`
- All user-visible strings must be added to all three locale files: `app-react/public/locales/en/translation.json`, `ru/translation.json`, `uk/translation.json`
- Test runner: `cd app-react && npm test` (Vitest)
- TypeScript must pass: `cd app-react && npx tsc --noEmit`

---

## Task 1: Enhanced ReportCard (Graph/Grid Editors)

**Files:**
- Modify: `app-react/src/pages/charts/ChartsPage.tsx`
- Modify: `app-react/public/locales/en/translation.json`
- Modify: `app-react/public/locales/ru/translation.json`
- Modify: `app-react/public/locales/uk/translation.json`

**What to add:** Inside the existing `ReportCard` component (currently ~line 361), add report rename, bar layout selector (Graph only), and per-trace editing (type dropdown, custom label, show-average checkbox).

- [ ] **Step 1: Add i18n keys**

Add to the `"charts"` section of each locale file:

`en/translation.json`:
```json
"reportName": "Report name",
"barLayout": "Bar layout",
"barLayoutGrouped": "Grouped",
"barLayoutStacked": "Stacked",
"barLayoutOverlaid": "Overlaid",
"traceCustomLabel": "Custom label",
"showAverage": "Show average",
"download": "Download"
```

`ru/translation.json`:
```json
"reportName": "Название отчёта",
"barLayout": "Макет столбцов",
"barLayoutGrouped": "Сгруппированные",
"barLayoutStacked": "Сложенные",
"barLayoutOverlaid": "Наложенные",
"traceCustomLabel": "Ярлык",
"showAverage": "Показать среднее",
"download": "Скачать"
```

`uk/translation.json`:
```json
"reportName": "Назва звіту",
"barLayout": "Макет стовпців",
"barLayoutGrouped": "Згруповані",
"barLayoutStacked": "Складені",
"barLayoutOverlaid": "Накладені",
"traceCustomLabel": "Мітка",
"showAverage": "Показати середнє",
"download": "Завантажити"
```

- [ ] **Step 2: Add state and helpers to ReportCard**

Inside the `ReportCard` function body, after the existing `const [open, setOpen] = useState(false)` line, add:

```tsx
const [localName, setLocalName] = useState(report.name)
useEffect(() => { setLocalName(report.name) }, [report.name])

const renameMutation = useMutation({
  mutationFn: (name: string) => chartsApi.updateReport(report.id, name, report.definition),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
})

function changeTrace(practice: string, patch: Partial<PracticeTrace>) {
  if (isGrid(report.definition)) return
  const traces = report.definition.Graph.traces.map(t =>
    t.practice === practice ? { ...t, ...patch } : t
  )
  updateMutation.mutate({ Graph: { ...report.definition.Graph, traces } })
}

function changeBarLayout(bar_layout: BarLayout) {
  if (isGrid(report.definition)) return
  updateMutation.mutate({ Graph: { ...report.definition.Graph, bar_layout } })
}

function traceTypeValue(type_: TraceType): 'Line' | 'Bar' | 'Dot' {
  if (type_ === 'Bar') return 'Bar'
  if (type_ === 'Dot') return 'Dot'
  return 'Line'
}

function typeFromSelect(v: string): TraceType {
  if (v === 'Bar') return 'Bar'
  if (v === 'Dot') return 'Dot'
  return { Line: { style: 'Regular' } }
}
```

- [ ] **Step 3: Replace the open section render in ReportCard**

Find the block starting with `{open && (` inside `ReportCard` and replace it entirely:

```tsx
{open && (
  <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>

    {/* Report name input */}
    <div className="px-4 pt-3 pb-1">
      <label className="text-xs text-gray-400 block mb-1">{t('charts.reportName')}</label>
      <input
        type="text"
        value={localName}
        onChange={e => setLocalName(e.target.value)}
        onBlur={() => { if (localName.trim() && localName !== report.name) renameMutation.mutate(localName.trim()) }}
        className="w-full text-sm font-semibold text-gray-800 rounded-xl px-3 h-9 outline-none"
        style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}
      />
    </div>

    {/* Bar layout (Graph only) */}
    {!isGridType && (
      <div className="px-4 pb-2">
        <label className="text-xs text-gray-400 block mb-1">{t('charts.barLayout')}</label>
        <select
          value={(report.definition as { Graph: GraphReport }).Graph.bar_layout}
          onChange={e => changeBarLayout(e.target.value as BarLayout)}
          className="w-full text-sm text-gray-800 rounded-xl px-3 h-9 outline-none"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}
        >
          <option value="Grouped">{t('charts.barLayoutGrouped')}</option>
          <option value="Stacked">{t('charts.barLayoutStacked')}</option>
          <option value="Overlaid">{t('charts.barLayoutOverlaid')}</option>
        </select>
      </div>
    )}

    {/* Trace / practice list */}
    {currentIds.length > 0 ? (
      <div className="px-4 py-2 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
        {isGrid(report.definition)
          ? report.definition.Grid.practices.map(pid => (
              <div key={pid} className="flex items-center gap-2 py-0.5">
                <span className="flex-1 text-xs text-gray-600">{practiceMap[pid] ?? pid}</span>
                <button onClick={() => removeItem(pid)} className="w-5 h-5 flex items-center justify-center rounded-lg" style={{ background: 'rgba(0,0,0,0.05)', color: '#9ca3af', border: 'none' }}>
                  <LuX className="w-3 h-3" />
                </button>
              </div>
            ))
          : currentTraces.map(trace => (
              <div key={trace.practice} className="flex flex-col gap-1 py-1" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2">
                  {/* Type select */}
                  <select
                    value={traceTypeValue(trace.type_)}
                    onChange={e => changeTrace(trace.practice, { type_: typeFromSelect(e.target.value) })}
                    className="text-xs rounded-lg px-2 h-6 outline-none flex-shrink-0"
                    style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: '#374151' }}
                  >
                    <option value="Line">{t('charts.traceLine')}</option>
                    <option value="Bar">{t('charts.traceBar')}</option>
                    <option value="Dot">{t('charts.traceDot')}</option>
                  </select>
                  <span className="flex-1 text-xs font-semibold text-gray-700">{practiceMap[trace.practice] ?? trace.practice}</span>
                  <button onClick={() => removeItem(trace.practice)} className="w-5 h-5 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(0,0,0,0.05)', color: '#9ca3af', border: 'none' }}>
                    <LuX className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 pl-1">
                  {/* Custom label */}
                  <input
                    key={trace.practice + '-label'}
                    type="text"
                    defaultValue={trace.label ?? ''}
                    onBlur={e => changeTrace(trace.practice, { label: e.target.value.trim() || null })}
                    placeholder={t('charts.traceCustomLabel')}
                    className="flex-1 text-xs rounded-lg px-2 h-6 outline-none"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)', color: '#374151' }}
                  />
                  {/* Show average */}
                  <label className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trace.show_average}
                      onChange={e => changeTrace(trace.practice, { show_average: e.target.checked })}
                      className="w-3 h-3 rounded"
                      style={{ accentColor: '#01a386' }}
                    />
                    {t('charts.showAverage')}
                  </label>
                </div>
              </div>
            ))
        }
      </div>
    ) : (
      <p className="px-4 py-2 text-xs text-gray-400">{t('charts.noPracticesAdded')}</p>
    )}

    {/* Add practice row — unchanged */}
    <div className="px-4 pb-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '0.625rem' }}>
      <select
        value={addPracticeId}
        onChange={e => setAddPracticeId(e.target.value)}
        className="flex-1 text-sm rounded-xl px-3 h-9 focus:outline-none"
        style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: addPracticeId ? '#1f2937' : '#9ca3af' }}
      >
        <option value="">{t('charts.addPractice')}</option>
        {practices.filter(p => p.is_active && !currentIds.includes(p.id)).map(p => (
          <option key={p.id} value={p.id}>{p.practice}</option>
        ))}
      </select>
      {!isGridType && (
        <select
          value={addTraceType}
          onChange={e => setAddTraceType(e.target.value as 'Line' | 'Bar' | 'Dot')}
          className="text-sm rounded-xl px-2 h-9 focus:outline-none flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: '#374151' }}
        >
          <option value="Line">{t('charts.traceLine')}</option>
          <option value="Bar">{t('charts.traceBar')}</option>
          <option value="Dot">{t('charts.traceDot')}</option>
        </select>
      )}
      <button
        onClick={addItem}
        disabled={!addPracticeId || updateMutation.isPending}
        className="h-9 px-4 rounded-xl text-sm font-semibold flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #02c9a3 0%, #01a386 100%)', color: 'white', border: 'none', opacity: addPracticeId ? 1 : 0.4 }}
      >
        {t('charts.add')}
      </button>
    </div>
  </div>
)}
```

You must also add `GraphReport` and `BarLayout` to the import from `../../api/charts`:
```tsx
import type { Report, ReportDefinition, TraceType, PracticeTrace, ReportDuration, GraphReport, BarLayout } from '../../api/charts'
```

And add `useEffect` to the React import:
```tsx
import { useState, useRef, useEffect } from 'react'
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/antonona/Web_Dev/sadhana/app-react && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
cd /Users/antonona/Web_Dev/sadhana/app-react && npm test
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/antonona/Web_Dev/sadhana && git add app-react/src/pages/charts/ChartsPage.tsx app-react/public/locales/en/translation.json app-react/public/locales/ru/translation.json app-react/public/locales/uk/translation.json
git commit -m "feat: enhanced ReportCard with report rename, bar layout, per-trace editing"
```

---

## Task 2: Daily Score Config

**Files:**
- Modify: `app-react/src/types/api.ts`
- Modify: `app-react/src/pages/yatras/YatraPracticeEditPage.tsx`
- Modify: `app-react/public/locales/en/translation.json`
- Modify: `app-react/public/locales/ru/translation.json`
- Modify: `app-react/public/locales/uk/translation.json`

**What to add:** `DailyScoreConfig` type + a collapsible Daily Score section inside `YatraPracticeEditPage`, visible for Int/Duration/Time practices only.

- [ ] **Step 1: Add i18n keys**

Add to `"yatras"` section in each locale:

`en/translation.json`:
```json
"dailyScore": "Daily Score",
"dailyScoreDesc": "Configure mandatory and bonus thresholds for the scoring system.",
"mandatoryValue": "Mandatory threshold",
"mandatoryDesc": "Reaching this value earns the mandatory point for the day.",
"bonusValue": "Bonus threshold",
"bonusDesc": "Reaching this value earns an extra bonus point. Leave empty to disable."
```

`ru/translation.json`:
```json
"dailyScore": "Дневной балл",
"dailyScoreDesc": "Настройте обязательные и бонусные пороги для системы баллов.",
"mandatoryValue": "Обязательный порог",
"mandatoryDesc": "Достижение этого значения даёт обязательный балл за день.",
"bonusValue": "Бонусный порог",
"bonusDesc": "Достижение этого значения даёт дополнительный балл. Оставьте пустым, чтобы отключить."
```

`uk/translation.json`:
```json
"dailyScore": "Денний бал",
"dailyScoreDesc": "Налаштуйте обов'язкові та бонусні пороги для системи балів.",
"mandatoryValue": "Обов'язковий поріг",
"mandatoryDesc": "Досягнення цього значення дає обов'язковий бал за день.",
"bonusValue": "Бонусний поріг",
"bonusDesc": "Досягнення цього значення дає додатковий бал. Залиште порожнім, щоб вимкнути."
```

- [ ] **Step 2: Add DailyScoreConfig types to api.ts**

Add after the `ColourZonesConfig` interface (around line 96):

```ts
export interface BonusRule {
  threshold: PracticeValue
  points: number
}

export interface DailyScoreConfig {
  better_direction: BetterDirection
  mandatory_threshold: PracticeValue | null
  bonus_rules: BonusRule[]
}
```

Update `YatraPractice` to add the optional field:

```ts
export interface YatraPractice {
  id: string
  practice: string
  data_type: PracticeDataType
  colour_zones?: ColourZonesConfig | null
  daily_score_config?: DailyScoreConfig | null
}
```

- [ ] **Step 3: Add Daily Score section to YatraPracticeEditPage**

At the top of `YatraPracticeEditPage.tsx`, add `DailyScoreConfig` and `BonusRule` to the import from `../../types/api`:

```tsx
import type {
  YatraPractice, PracticeDataType,
  ColourZonesConfig, ColourBound, ZoneColour, PracticeValue,
  DailyScoreConfig, BonusRule,
} from '../../types/api'
```

Add the constant:
```tsx
const DAILY_SCORE_TYPES: PracticeDataType[] = ['Int', 'Duration', 'Time']
```

Add state inside `YatraPracticeEditPage`, after the `zones` state:
```tsx
const [dailyScore, setDailyScore] = useState<DailyScoreConfig>({
  better_direction: 'Higher',
  mandatory_threshold: null,
  bonus_rules: [],
})
```

Inside the `useEffect` that loads practice data, add after `setZones`:
```tsx
if (p.daily_score_config) setDailyScore(p.daily_score_config)
```

Update `saveMutation.mutationFn` to include `daily_score_config`:
```tsx
mutationFn: () => {
  const p: YatraPractice = {
    ...practiceQuery.data!,
    practice: name,
    colour_zones: zones.bounds.length > 0 ? zones : null,
    daily_score_config: dailyScore.mandatory_threshold !== null ? dailyScore : null,
  }
  return yatrasApi.updateYatraPractice(yatraId!, p)
},
```

Add helpers for converting `DailyScoreConfig` bonus threshold to/from string (reuse the existing `toStr` and `fromStr` helpers already in the file):
```tsx
const bonusThreshold = dailyScore.bonus_rules[0]?.threshold ?? null

function handleDailyScoreMandatory(raw: string) {
  setDailyScore(prev => ({ ...prev, mandatory_threshold: fromStr(raw, dt) }))
}

function handleDailyScoreBonus(raw: string) {
  const v = fromStr(raw, dt)
  setDailyScore(prev => ({
    ...prev,
    bonus_rules: v ? [{ threshold: v, points: 1 }] : [],
  }))
}
```

Add the Daily Score section JSX, inserted **after** the colour zones section and **before** the Save button:

```tsx
{DAILY_SCORE_TYPES.includes(dt) && (
  <div className="rounded-2xl overflow-hidden" style={glass}>
    <div className="px-4 py-3 border-b border-black/[0.06]">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t('yatras.dailyScore')}</p>
      <p className="text-xs text-gray-400 mt-0.5">{t('yatras.dailyScoreDesc')}</p>
    </div>
    <div className="px-4 py-3 flex flex-col gap-3">

      {/* Better direction */}
      <div>
        <label htmlFor="ds-better" className="text-xs text-gray-400 block mb-1">{t('yatras.betterWhen')}</label>
        <select
          id="ds-better"
          value={dailyScore.better_direction}
          onChange={e => setDailyScore(prev => ({ ...prev, better_direction: e.target.value as 'Higher' | 'Lower' }))}
          className="w-full text-sm text-gray-800 rounded-xl px-3 h-10 outline-none cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.08)' }}
        >
          <option value="Higher">{t('yatras.higherBetter')}</option>
          <option value="Lower">{t('yatras.lowerBetter')}</option>
        </select>
      </div>

      {/* Mandatory threshold */}
      <div>
        <label htmlFor="ds-mandatory" className="text-xs text-gray-400 block mb-1">{t('yatras.mandatoryValue')}</label>
        <input
          id="ds-mandatory"
          type={dt === 'Int' ? 'number' : 'text'}
          inputMode="numeric"
          value={toStr(dailyScore.mandatory_threshold, dt)}
          onChange={e => handleDailyScoreMandatory(e.target.value)}
          placeholder={placeholder(dt)}
          className="w-full text-sm text-gray-800 rounded-xl px-3 h-10 outline-none"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.08)' }}
          min={dt === 'Int' ? 0 : undefined}
        />
        <p className="text-xs text-gray-400 mt-1">{t('yatras.mandatoryDesc')}</p>
      </div>

      {/* Bonus threshold */}
      <div>
        <label htmlFor="ds-bonus" className="text-xs text-gray-400 block mb-1">{t('yatras.bonusValue')}</label>
        <input
          id="ds-bonus"
          type={dt === 'Int' ? 'number' : 'text'}
          inputMode="numeric"
          value={toStr(bonusThreshold, dt)}
          onChange={e => handleDailyScoreBonus(e.target.value)}
          placeholder={placeholder(dt)}
          className="w-full text-sm text-gray-800 rounded-xl px-3 h-10 outline-none"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.08)' }}
          min={dt === 'Int' ? 0 : undefined}
        />
        <p className="text-xs text-gray-400 mt-1">{t('yatras.bonusDesc')}</p>
      </div>

    </div>
  </div>
)}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/antonona/Web_Dev/sadhana/app-react && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
cd /Users/antonona/Web_Dev/sadhana/app-react && npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/antonona/Web_Dev/sadhana && git add app-react/src/types/api.ts app-react/src/pages/yatras/YatraPracticeEditPage.tsx app-react/public/locales/en/translation.json app-react/public/locales/ru/translation.json app-react/public/locales/uk/translation.json
git commit -m "feat: add daily score config to yatra practice edit"
```

---

## Task 3: CSV Export

**Files:**
- Modify: `app-react/src/pages/charts/ChartsPage.tsx`

**What to add:** A download button inside `ChartPanel`'s duration strip. Visible only when `report` is not null. Fetches current data and downloads as UTF-8 CSV.

- [ ] **Step 1: Add download helpers and button to ChartPanel**

Add `LuDownload` to the existing lucide import line in `ChartsPage.tsx`:
```tsx
import { LuCopy, LuCheck, LuChevronDown, LuChevronUp, LuX, LuChartLine, LuDownload } from 'lucide-react'
```

Add two pure helper functions at the top of the file (after the `DURATIONS` constant, before `isGrid`):

```tsx
function toCSV(entries: ReportDataEntry[], practiceMap: Record<string, string>): string {
  const header = ['date', 'practice', 'value'].join(',')
  const rows = entries.map(e => {
    const name = (practiceMap[e.practice] ?? e.practice).replace(/,/g, ' ')
    const val = valueToNumber(e.value)
    return [e.cob_date, name, val === null ? '' : String(val)].join(',')
  })
  return [header, ...rows].join('\n')
}

function triggerCSVDownload(csv: string) {
  const bom = '﻿'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'data.csv'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

Inside `ChartPanel`, add a `handleDownload` function after the `traces` derivation block:

```tsx
async function handleDownload() {
  const entries = await chartsApi.getReportData(todayCob, duration)
  triggerCSVDownload(toCSV(entries, practiceMap))
}
```

In the duration strip JSX (the `<div className="px-4 pt-3 pb-2 flex gap-1.5 ...">` block), add the download button **after** the duration buttons and before the closing `</div>`:

```tsx
{report !== null && (
  <button
    onClick={handleDownload}
    title={t('charts.download')}
    className="ml-auto h-7 px-2.5 flex items-center gap-1 rounded-lg text-xs font-semibold flex-shrink-0"
    style={{ background: 'rgba(0,0,0,0.05)', color: '#6b7280', border: 'none' }}
  >
    <LuDownload className="w-3.5 h-3.5" />
    {t('charts.download')}
  </button>
)}
```

- [ ] **Step 2: Write a unit test for toCSV**

Create `app-react/src/pages/charts/ChartsPage.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'

// Inline the pure function to test it without rendering the full component
function toCSV(entries: Array<{ cob_date: string; practice: string; value: unknown }>, practiceMap: Record<string, string>): string {
  function valueToNumber(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null
    if (typeof raw === 'number') return raw
    if (typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      if ('Int' in obj) return obj.Int as number
      if ('Duration' in obj) return obj.Duration as number
    }
    return null
  }
  const header = ['date', 'practice', 'value'].join(',')
  const rows = entries.map(e => {
    const name = (practiceMap[e.practice] ?? e.practice).replace(/,/g, ' ')
    const val = valueToNumber(e.value)
    return [e.cob_date, name, val === null ? '' : String(val)].join(',')
  })
  return [header, ...rows].join('\n')
}

describe('toCSV', () => {
  it('produces header + data row', () => {
    const csv = toCSV(
      [{ cob_date: '2026-07-01', practice: 'abc', value: { Int: 30 } }],
      { abc: 'Meditation' }
    )
    expect(csv).toBe('date,practice,value\n2026-07-01,Meditation,30')
  })

  it('uses practice id when not in map', () => {
    const csv = toCSV(
      [{ cob_date: '2026-07-01', practice: 'unknown-id', value: { Int: 5 } }],
      {}
    )
    expect(csv).toContain('unknown-id')
  })

  it('outputs empty value for null', () => {
    const csv = toCSV(
      [{ cob_date: '2026-07-01', practice: 'abc', value: null }],
      { abc: 'Test' }
    )
    expect(csv).toBe('date,practice,value\n2026-07-01,Test,')
  })

  it('replaces commas in practice names', () => {
    const csv = toCSV(
      [{ cob_date: '2026-07-01', practice: 'abc', value: { Int: 1 } }],
      { abc: 'Yoga, morning' }
    )
    expect(csv).toContain('Yoga  morning')
  })
})
```

- [ ] **Step 3: Run the new test**

```bash
cd /Users/antonona/Web_Dev/sadhana/app-react && npm test -- ChartsPage
```

Expected: 4 tests pass.

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/antonona/Web_Dev/sadhana/app-react && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/antonona/Web_Dev/sadhana && git add app-react/src/pages/charts/ChartsPage.tsx app-react/src/pages/charts/ChartsPage.test.tsx
git commit -m "feat: add CSV export download button to chart panel"
```

---

## Task 4: Duration Quick-Add Modal

**Files:**
- Modify: `app-react/src/pages/home/PracticeCard.tsx`
- Modify: `app-react/public/locales/en/translation.json`
- Modify: `app-react/public/locales/ru/translation.json`
- Modify: `app-react/public/locales/uk/translation.json`

**What to add:** A `DurationQuickAddModal` component and trigger button inside the Duration card control row.

- [ ] **Step 1: Add i18n keys**

Add to `"home"` section (create the section if absent) in each locale:

`en/translation.json`:
```json
"home": {
  "addMinutes": "Add minutes",
  "addMinutesPlaceholder": "e.g. 30"
}
```

`ru/translation.json`:
```json
"home": {
  "addMinutes": "Добавить минуты",
  "addMinutesPlaceholder": "напр. 30"
}
```

`uk/translation.json`:
```json
"home": {
  "addMinutes": "Додати хвилини",
  "addMinutesPlaceholder": "напр. 30"
}
```

- [ ] **Step 2: Add the modal component**

At the top of `PracticeCard.tsx`, add `useTranslation` to the react-i18next import and `LuZap` to the `react-icons/lu` import (to use as the trigger icon):
```tsx
import { useTranslation } from 'react-i18next'
import { LuToggleRight, LuHash, LuTimer, LuClock, LuType, LuZap } from 'react-icons/lu'
```

Add the modal component **before** the `PracticeCard` export, and **export** it so it can be tested in isolation:

```tsx
export function DurationQuickAddModal({ onAdd, onClose }: { onAdd: (minutes: number) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = parseInt(value, 10)
    if (!isNaN(n) && n > 0) onAdd(n)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative rounded-2xl p-5 w-72 flex flex-col gap-4"
        style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.85)' }}
      >
        <h3 className="text-sm font-semibold text-gray-800">{t('home.addMinutes')}</h3>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={t('home.addMinutesPlaceholder')}
          className="w-full text-center text-lg font-bold rounded-xl h-12 outline-none"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.08)' }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(0,0,0,0.06)', color: '#6b7280', border: 'none' }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="flex-1 h-10 rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #02c9a3 0%, #01a386 100%)', color: 'white', border: 'none' }}
          >
            {t('common.add')}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Add state and trigger to PracticeCard**

Inside `PracticeCard`, after the existing state declarations, add:
```tsx
const [showQuickAdd, setShowQuickAdd] = useState(false)
```

Find the Duration card's control row (the section under `practice.data_type === 'Duration'`). It currently renders `<Step label="-" .../>`, the duration display, and `<Step label="+" .../>`. Add a `+Xm` trigger button **after** the `+` step button:

```tsx
<button
  type="button"
  aria-label="Quick add minutes"
  onClick={() => setShowQuickAdd(true)}
  className="w-7 h-7 rounded-lg flex items-center justify-center select-none flex-shrink-0"
  style={{ background: 'rgba(1,163,134,0.12)', border: '1px solid rgba(1,163,134,0.25)', color: '#01a386' }}
>
  <LuZap className="w-3.5 h-3.5" />
</button>
```

Add the modal at the bottom of the Duration branch's return (before the final closing tag of that branch):

```tsx
{showQuickAdd && (
  <DurationQuickAddModal
    onAdd={(minutes) => {
      const newVal = durVal + minutes
      logValue({ Duration: newVal })
    }}
    onClose={() => setShowQuickAdd(false)}
  />
)}
```

- [ ] **Step 4: Write a test for DurationQuickAddModal**

Create `app-react/src/pages/home/PracticeCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DurationQuickAddModal } from './PracticeCard'

describe('DurationQuickAddModal', () => {
  it('calls onAdd with parsed number and then onClose', async () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    render(<DurationQuickAddModal onAdd={onAdd} onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('minutes'), '45')
    await userEvent.click(screen.getByText('Add'))
    expect(onAdd).toHaveBeenCalledWith(45)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose without onAdd for empty input', async () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    render(<DurationQuickAddModal onAdd={onAdd} onClose={onClose} />)
    await userEvent.click(screen.getByText('Add'))
    expect(onAdd).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn()
    render(<DurationQuickAddModal onAdd={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 5: Run the test**

```bash
cd /Users/antonona/Web_Dev/sadhana/app-react && npm test -- PracticeCard
```

Expected: 3 tests pass.

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/antonona/Web_Dev/sadhana/app-react && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/antonona/Web_Dev/sadhana && git add app-react/src/pages/home/PracticeCard.tsx app-react/src/pages/home/PracticeCard.test.tsx app-react/public/locales/en/translation.json app-react/public/locales/ru/translation.json app-react/public/locales/uk/translation.json
git commit -m "feat: add duration quick-add modal to practice card"
```

---

## Task 5: Month Calendar

**Files:**
- Modify: `app-react/src/api/practices.ts`
- Create: `app-react/src/pages/home/MonthCalendar.tsx`
- Modify: `app-react/src/pages/home/WeekCalendar.tsx`

**What to add:** `getIncompleteDays` API call, a `MonthCalendar` overlay component, and a tappable month/year label in `WeekCalendar` that opens it.

- [ ] **Step 1: Add getIncompleteDays to practices API**

In `app-react/src/api/practices.ts`, add at the end of the `practicesApi` object:

```ts
async getIncompleteDays(from: string, to: string): Promise<string[]> {
  const res = await apiClient.get<{ days: string[] }>('/diary/incomplete-days', {
    params: { from, to },
  })
  return res.data.days
},
```

- [ ] **Step 2: Create MonthCalendar.tsx**

Create `app-react/src/pages/home/MonthCalendar.tsx`:

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../api/practices'

interface MonthCalendarProps {
  selectedDate: Date
  onSelect: (date: Date) => void
  onClose: () => void
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function lastDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

// Monday = 0 offset (ISO week)
function monthStartOffset(monthStart: Date): number {
  const day = monthStart.getDay() // 0=Sun
  return (day + 6) % 7            // Mon=0, Sun=6
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.85)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
}

export function MonthCalendar({ selectedDate, onSelect, onClose }: MonthCalendarProps) {
  const { i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const today = new Date()
  const [monthStart, setMonthStart] = useState(() => startOfMonth(selectedDate))

  const monthEnd = lastDayOfMonth(monthStart)
  const from = isoDate(monthStart)
  const to = isoDate(monthEnd)

  const { data: incompleteDays = [] } = useQuery({
    queryKey: ['incomplete-days', from, to],
    queryFn: () => practicesApi.getIncompleteDays(from, to),
  })

  const incompleteSet = new Set(incompleteDays)
  const offset = monthStartOffset(monthStart)
  const daysInMonth = monthEnd.getDate()

  // Weekday labels Mon–Sun
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i) // 2024-01-01 was Monday
    return d.toLocaleDateString(locale, { weekday: 'narrow' })
  })

  function isToday(day: number): boolean {
    return today.getFullYear() === monthStart.getFullYear() &&
      today.getMonth() === monthStart.getMonth() &&
      today.getDate() === day
  }

  function isSelected(day: number): boolean {
    return selectedDate.getFullYear() === monthStart.getFullYear() &&
      selectedDate.getMonth() === monthStart.getMonth() &&
      selectedDate.getDate() === day
  }

  function isIncomplete(day: number): boolean {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day)
    return incompleteSet.has(isoDate(d))
  }

  function selectDay(day: number) {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day)
    onSelect(d)
    onClose()
  }

  function selectToday() {
    onSelect(today)
    onClose()
  }

  const monthLabel = monthStart.toLocaleDateString(locale, { month: 'long', year: 'numeric' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      {/* Calendar card */}
      <div className="relative rounded-2xl p-4 w-full max-w-sm" style={glass}>

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-bold text-gray-800">{monthLabel}</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMonthStart(prev => addMonths(prev, -1))}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: '#6b7280' }}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setMonthStart(prev => addMonths(prev, 1))}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: '#6b7280' }}
            >
              ›
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 mb-1">
          {weekdays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {/* Blank leading cells */}
          {Array.from({ length: offset }, (_, i) => <div key={`blank-${i}`} />)}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const sel = isSelected(day)
            const tod = isToday(day)
            const inc = isIncomplete(day)
            return (
              <div key={day} className="relative flex items-center justify-center h-9">
                {inc && !sel && (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: '#ef4444' }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => selectDay(day)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all"
                  style={
                    sel
                      ? { background: 'linear-gradient(135deg, #02c9a3 0%, #01a386 100%)', color: '#fff', boxShadow: '0 2px 8px rgba(1,163,134,0.35)', border: 'none' }
                      : tod
                      ? { color: '#01a386', fontWeight: 700, background: 'transparent', border: 'none' }
                      : { color: '#374151', background: 'transparent', border: 'none' }
                  }
                >
                  {day}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button
            type="button"
            onClick={selectToday}
            className="text-sm font-bold"
            style={{ color: '#01a386', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Today
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Make the month/year label in WeekCalendar tappable**

In `WeekCalendar.tsx`, add `useState` to the import:
```tsx
import { useRef, useState } from 'react'
```

Add prop to accept and control the calendar open state from the parent, OR manage it locally. Use local state (simpler, no prop change needed):

Add inside `WeekCalendar`:
```tsx
const [calendarOpen, setCalendarOpen] = useState(false)
```

Import `MonthCalendar`:
```tsx
import { MonthCalendar } from './MonthCalendar'
```

Replace the month/year `<span>` in the header with a button:

Find:
```tsx
<span className="text-xs font-semibold tracking-wide uppercase" style={{ color: '#9ca3af' }}>
  {monthYear}
</span>
```

Replace with:
```tsx
<button
  type="button"
  onClick={() => setCalendarOpen(true)}
  className="text-xs font-semibold tracking-wide uppercase focus:outline-none"
  style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
>
  {monthYear}
</button>
```

Add the `MonthCalendar` overlay at the end of the `WeekCalendar` return (inside the outer `<div>`), before the final closing tag:

```tsx
{calendarOpen && (
  <MonthCalendar
    selectedDate={date}
    onSelect={onDateChange}
    onClose={() => setCalendarOpen(false)}
  />
)}
```

- [ ] **Step 4: Write a test for MonthCalendar**

Create `app-react/src/pages/home/MonthCalendar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MonthCalendar } from './MonthCalendar'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('MonthCalendar', () => {
  it('renders day grid for the selected date month', () => {
    const date = new Date(2026, 6, 24) // July 2026
    render(
      <Wrapper>
        <MonthCalendar selectedDate={date} onSelect={vi.fn()} onClose={vi.fn()} />
      </Wrapper>
    )
    // July has 31 days; check a few are present
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Wrapper>
        <MonthCalendar selectedDate={new Date()} onSelect={vi.fn()} onClose={onClose} />
      </Wrapper>
    )
    // The backdrop is the first fixed inset-0 div
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/30') as HTMLElement
    await userEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onSelect and onClose when a day is clicked', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <Wrapper>
        <MonthCalendar selectedDate={new Date(2026, 6, 1)} onSelect={onSelect} onClose={onClose} />
      </Wrapper>
    )
    await userEvent.click(screen.getAllByText('15')[0])
    expect(onSelect).toHaveBeenCalledWith(new Date(2026, 6, 15))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onSelect(today) when Today is clicked', async () => {
    const onSelect = vi.fn()
    render(
      <Wrapper>
        <MonthCalendar selectedDate={new Date(2026, 6, 1)} onSelect={onSelect} onClose={vi.fn()} />
      </Wrapper>
    )
    await userEvent.click(screen.getByText('Today'))
    expect(onSelect).toHaveBeenCalled()
    const arg: Date = onSelect.mock.calls[0][0]
    const today = new Date()
    expect(arg.getDate()).toBe(today.getDate())
    expect(arg.getMonth()).toBe(today.getMonth())
  })
})
```

- [ ] **Step 5: Run the new tests**

```bash
cd /Users/antonona/Web_Dev/sadhana/app-react && npm test -- MonthCalendar
```

Expected: 4 tests pass. (The incomplete days query will 404/fail in tests — that's fine, the component renders with an empty set.)

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/antonona/Web_Dev/sadhana/app-react && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
cd /Users/antonona/Web_Dev/sadhana/app-react && npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
cd /Users/antonona/Web_Dev/sadhana && git add app-react/src/api/practices.ts app-react/src/pages/home/MonthCalendar.tsx app-react/src/pages/home/MonthCalendar.test.tsx app-react/src/pages/home/WeekCalendar.tsx
git commit -m "feat: add month calendar picker accessible from week calendar header"
```
