import type { TFunction } from 'i18next'
import type {
  ChartPanel, End, Format, Label, Panel, PanelsReport, ReportDataEntry, Required, Scope, Series, Source, Stat, StatValue, Target,
} from '../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { formatMinutesAsHHMM, valueToNumber } from '../chartLogic'
import { formatDuration, parseOptions, type DurationUnits } from '../../today/values'
// A function-only cycle: gapLogic reads resolve/scalar from here, at call time.
import { rowKind } from './gapLogic'

export interface Lookup {
  /** Numeric value on a day; null when empty, or the practice is unavailable. */
  value(practice: string, cob: string): number | null
  /** In the practices list, active, and the type the source needs. */
  available(practice: string, type?: PracticeDataType): boolean
  type(practice: string): PracticeDataType | undefined
  name(practice: string): string | undefined
  /** The trimmed Text value; null when empty, not Text, or unavailable. */
  text(practice: string, cob: string): string | null
  /** A dropdown practice's options, else []. */
  options(practice: string): string[]
}
export type Resolved = number | [number, number] | null
export type BarState = 'ok' | 'under' | 'over' | 'neutral'

const DAY = 1440
/** Text counts only where a number can be read from it (a numeric dropdown); `valueToNumber` keeps its meaning elsewhere. */
const rawText = (raw: unknown): string | null => {
  const s = typeof raw === 'string' ? raw : (raw as { Text?: unknown } | null | undefined)?.Text
  return typeof s === 'string' && s.trim() ? s.trim() : null
}
function textNumber(raw: unknown): number | null {
  const s = rawText(raw)
  if (s === null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
const mod = (x: number) => ((x % DAY) + DAY) % DAY

export function makeLookup(
  entries: ReportDataEntry[], previous: ReportDataEntry[] | undefined, practices: UserPractice[],
): Lookup {
  const byId = new Map(practices.map((p) => [p.id, p]))
  const raw = new Map<string, unknown>()
  for (const x of [...(previous ?? []), ...entries]) raw.set(`${x.practice}\u0000${x.cob_date}`, x.value)
  const available = (practice: string, type?: PracticeDataType) => {
    const p = byId.get(practice)
    return !!p && p.is_active && (type === undefined || p.data_type === type)
  }
  return {
    available,
    type: (practice) => byId.get(practice)?.data_type,
    name: (practice) => byId.get(practice)?.practice,
    text(practice, cob) {
      const p = byId.get(practice)
      return p && available(practice, 'Text') ? rawText(raw.get(`${p.practice}\u0000${cob}`)) : null
    },
    options: (practice) => parseOptions(byId.get(practice)?.dropdown_variants),
    value(practice, cob) {
      const p = byId.get(practice)
      if (!p || !p.is_active) return null
      const v = raw.get(`${p.practice}\u0000${cob}`)
      return p.data_type === 'Text' ? textNumber(v) : valueToNumber(v, p.data_type)
    },
  }
}

/** Sorted unique days of the current window (not the previous one). */
export function windowDays(entries: ReportDataEntry[]): string[] {
  return [...new Set(entries.map((x) => x.cob_date))].sort()
}

const shift = (cob: string, offset: number) => toDateStr(addDays(fromDateStr(cob), offset))

export function resolve(source: Source, cob: string, l: Lookup): Resolved {
  if ('Practice' in source) return l.value(source.Practice.practice, cob)

  if ('Range' in source) {
    const { from, to } = source.Range
    if (!l.available(from.practice, 'Time') || !l.available(to.practice, 'Time')) return null
    const a = l.value(from.practice, shift(cob, from.day_offset))
    const b = l.value(to.practice, shift(cob, to.day_offset))
    if (a === null || b === null) return null
    const d = mod(b - a)
    if (d === 0) return null
    const start = mod(a - 720)
    return [start, start + d]
  }

  // Calc. Guarded so a retyped practice never yields a guessed number.
  const used: { sign: number; type: PracticeDataType; value: number; optional: boolean }[] = []
  for (const t of source.Calc.terms) {
    if (!l.available(t.practice)) {
      if (t.optional) continue
      return null
    }
    const type = l.type(t.practice)!
    if (t.sign < 0 && type !== 'Time') return null
    const v = l.value(t.practice, shift(cob, t.day_offset))
    if (v === null) {
      if (t.optional) continue
      return null
    }
    used.push({ sign: t.sign, type, value: v, optional: t.optional })
  }
  // A retyped optional term counts as 0: the night or the day's total is still known.
  const kept = used.filter((u) => !u.optional || u.type === 'Duration')
  const time = kept.filter((u) => u.type === 'Time')
  if (time.length === 0) return kept.reduce((s, u) => s + u.sign * u.value, 0)
  if (time.reduce((s, u) => s + u.sign, 0) !== 0) return null
  const rest = kept.filter((u) => u.type !== 'Time')
  if (rest.some((u) => u.type !== 'Duration')) return null
  const clock = mod(time.reduce((s, u) => s + u.sign * u.value, 0))
  if (clock === 0) return null
  return clock + rest.reduce((s, u) => s + u.sign * u.value, 0)
}

export function stateOf(value: number | null, target: Pick<Target, 'min' | 'max'> | null): BarState | null {
  if (value === null) return null
  if (!target || (target.min === null && target.max === null)) return 'neutral'
  if (target.min !== null && value < target.min) return 'under'
  if (target.max !== null && value > target.max) return 'over'
  return 'ok'
}

export function scalar(r: Resolved, pick: End | null): number | null {
  if (!Array.isArray(r)) return r
  return pick === 'From' ? r[0] : pick === 'To' ? r[1] : r[1] - r[0]
}

interface StatParams { of: Source; scope: Scope; pick?: End | null; min?: number | null; max?: number | null }
const statParts = (v: StatValue): [keyof StatValue, StatParams] => {
  const kind = Object.keys(v)[0] as keyof StatValue
  return [kind, (v as Record<string, StatParams>)[kind]]
}

export function statResult(
  v: StatValue, days: string[], l: Lookup, todayCob: string,
): { value: number | null; of?: number } {
  const [kind, p] = statParts(v)
  const past = days.filter((d) => p.scope.today || d !== todayCob)
  const values = past.map((d) => scalar(resolve(p.of, d, l), p.pick ?? null))
  // With missing_zero a zero and a gap are the same day, so a window of them reads as no data.
  const logged = values.filter((x): x is number => x !== null && !(p.scope.missing_zero && x === 0))

  switch (kind) {
    case 'Logged':
      return { value: logged.length, of: past.length }
    case 'CountTrue':
      return { value: logged.length, of: past.length }
    case 'OnTarget': {
      const ok = logged.filter((x) => stateOf(x, { min: p.min ?? null, max: p.max ?? null }) !== 'under'
        && stateOf(x, { min: p.min ?? null, max: p.max ?? null }) !== 'over')
      return { value: ok.length, of: p.scope.missing_zero && logged.length ? past.length : logged.length }
    }
    case 'Average': {
      if (logged.length === 0) return { value: null }
      const sum = logged.reduce((s, x) => s + x, 0)
      return { value: Math.floor(sum / (p.scope.missing_zero ? past.length : logged.length)) }
    }
  }
  return { value: null }
}

const refsOk = (s: Source, l: Lookup): boolean => {
  if ('Practice' in s) return l.available(s.Practice.practice)
  if ('Range' in s) return l.available(s.Range.from.practice, 'Time') && l.available(s.Range.to.practice, 'Time')
  return s.Calc.terms.every((t) => t.optional || l.available(t.practice)) && s.Calc.terms.some((t) => l.available(t.practice))
}

const typedOk = (s: Source, want: PracticeDataType[] | null, l: Lookup) =>
  !('Practice' in s) || !want || want.some((type) => l.available(s.Practice.practice, type))

/** The types a practice may have to be read by this series. A retyped one reads as missing, never as a guessed number. */
function seriesTypes(s: Series, format: Format): PracticeDataType[] | null {
  if (s.mark === 'Dot') return ['Bool']
  if (format === 'Duration') return ['Duration']
  if (format === 'Count') return s.mark === 'Line' ? ['Int', 'Text'] : ['Int']
  return null
}

function statTypes(v: StatValue): PracticeDataType[] | null {
  if ('CountTrue' in v) return ['Bool']
  if ('OnTarget' in v) return ['Int', 'Duration']
  if ('Average' in v) return v.Average.format === 'Duration' ? ['Duration'] : v.Average.format === 'Count' ? ['Int', 'Text'] : null
  return null
}

function visibleStat(s: Stat, l: Lookup): Stat | null {
  const { of } = statParts(s.value)[1]
  if (!refsOk(of, l) || !typedOk(of, statTypes(s.value), l)) return null
  return { ...s, under: s.under ? visibleStat(s.under, l) : null }
}

/** A Gaps or Around event: a true Bool or a non-empty Text. */
const eventOk = (event: string, l: Lookup) => l.available(event, 'Bool') || l.available(event, 'Text')

export function visiblePanels(def: PanelsReport, l: Lookup): Panel[] {
  const out: Panel[] = []
  for (const panel of def.panels) {
    if (panel.kind === 'Gaps') {
      if (eventOk(panel.event, l)) out.push(panel)
      continue
    }
    if (panel.kind === 'Around') {
      const rows = panel.rows.filter((r) => rowKind(r.source, l) !== null)
      if (eventOk(panel.event, l) && rows.length) out.push({ ...panel, rows })
      continue
    }
    if (panel.kind === 'Month') {
      if (l.available(panel.practice, 'Bool')) out.push(panel)
      continue
    }
    if (panel.kind === 'Stats') {
      const stats = panel.stats.map((s) => visibleStat(s, l)).filter((s): s is Stat => s !== null)
      if (stats.length) out.push({ ...panel, stats })
      continue
    }
    const keep = panel.series.map((s) => refsOk(s.source, l) && typedOk(s.source, seriesTypes(s, panel.format), l))
    // only_with points at a series index; drop dependants of dropped series and renumber.
    const newIndex = new Map<number, number>()
    keep.forEach((k, i) => { if (k) newIndex.set(i, newIndex.size) })
    const series: Series[] = []
    panel.series.forEach((s, i) => {
      if (!keep[i]) return
      if (s.only_with === null) { series.push(s); return }
      const idx = newIndex.get(s.only_with)
      if (idx !== undefined) series.push({ ...s, only_with: idx })
    })
    if (!series.length) continue
    out.push({
      ...panel,
      series,
      target: panel.target && refsOk(panel.target.of, l) ? panel.target : null,
      lines: panel.lines.filter((r) => refsOk(r.of, l)),
    })
  }
  return out
}

function panelSources(def: PanelsReport): Source[] {
  const ofStat = (s: Stat): Source[] => [statParts(s.value)[1].of, ...(s.under ? ofStat(s.under) : [])]
  return def.panels.flatMap((p) => (p.kind === 'Month' || p.kind === 'Gaps' ? [] : p.kind === 'Around'
    ? p.rows.map((r) => r.source)
    : p.kind === 'Stats'
      ? p.stats.flatMap(ofStat)
      : [...p.series.map((s) => s.source), ...(p.target ? [p.target.of] : []), ...p.lines.map((r) => r.of)]))
}

/** Deleted, hidden, or retyped so that a Range can no longer use it as a time. */
export function missingRequired(def: PanelsReport, l: Lookup): Required[] {
  const ends = new Set(panelSources(def).flatMap((s) => ('Range' in s ? [s.Range.from.practice, s.Range.to.practice] : [])))
  const charted = def.panels.flatMap((p) => (p.kind === 'Chart' ? p.series.map((s) => ({ s, want: seriesTypes(s, p.format) })) : []))
  const months = new Set(def.panels.flatMap((p) => (p.kind === 'Month' ? [p.practice] : [])))
  const events = new Set(def.panels.flatMap((p) => (p.kind === 'Gaps' || p.kind === 'Around' ? [p.event] : [])))
  return def.required.filter((r) => !l.available(r.practice)
    || (months.has(r.practice) && !l.available(r.practice, 'Bool'))
    || (events.has(r.practice) && !eventOk(r.practice, l))
    || (ends.has(r.practice) && !l.available(r.practice, 'Time'))
    || charted.some(({ s, want }) => 'Practice' in s.source && s.source.Practice.practice === r.practice && !typedOk(s.source, want, l)))
}

/** Whole hours around the data, in minutes. */
export function fitHours(values: number[]): [number, number] {
  if (values.length === 0) return [0, 720]
  const lo = Math.floor(Math.min(...values) / 60) * 60
  const hi = (Math.floor(Math.max(...values) / 60) + 1) * 60
  return [lo, hi]
}

/** Where a sleep-length axis starts: 3h, so close limits stand apart, lower only to fit a shorter value. */
export function durationFloor(values: number[]): number {
  return Math.min(180, ...values.map((v) => Math.floor(v / 60) * 60))
}

export function labelText(label: Label | null, t: TFunction, fallback = ''): string {
  if (!label) return fallback
  return 'Key' in label ? t(label.Key) : label.Text
}

/** A series without a label goes by its practice's name. */
export function seriesName(s: Series, l: Lookup, t: TFunction): string {
  return labelText(s.label, t, 'Practice' in s.source ? l.name(s.source.Practice.practice) : undefined)
}

/** Bars take a palette colour by position; a bar drawn inside another is ink; a line or dot stands apart from the bars. */
export function seriesColour(s: Series, i: number, layout: ChartPanel['bar_layout']): string {
  if (s.mark === 'Dot' || s.mark === 'Line') return 'var(--ui-state-over)'
  return layout === 'Overlaid' && i > 0 ? 'var(--ui-ink)' : `var(--ui-chart-${i + 1})`
}

export const clockText = (afterNoon: number) => formatMinutesAsHHMM(afterNoon + 720)

export function formatValue(v: number, format: Format, u: DurationUnits): string {
  if (format === 'Duration') return formatDuration(v, u)
  return format === 'NoonClock' ? clockText(v) : String(v)
}

/** A figure tile's duration: the short form that fits a tile on one line (15m6, 15m24). */
export function figureDuration(total: number, t: TFunction): string {
  const h = Math.floor(total / 60)
  const m = String(total % 60).padStart(2, '0')
  if (h === 0) return t('reportPanels.figMinutes', { m: total })
  return total % 60 === 0 ? t('reportPanels.figHours', { h }) : t('reportPanels.figHoursMinutes', { h, m })
}

export type PanelRow = { cob: string; state: BarState | null } & Record<`s${number}`, Resolved>

/** A row per day with one column per series (s0, s1, …) and the day's state against the target. */
export function chartRows(panel: ChartPanel, days: string[], l: Lookup): PanelRow[] {
  return days.map((cob) => {
    const values = panel.series.map((s) => resolve(s.source, cob, l))
    const row: PanelRow = { cob, state: panel.target ? stateOf(scalar(resolve(panel.target.of, cob, l), null), panel.target) : null }
    panel.series.forEach((s, i) => {
      // A dependent series has nothing to add without its base, and a zero would draw as a line.
      const drop = s.only_with !== null && (values[s.only_with] === null || values[i] === 0)
      row[`s${i}`] = drop ? null : values[i]
    })
    return row
  })
}

export interface TipLine { key: string; name: string; text: string; state: BarState | null; colour?: string }

/** What a tapped day shows: every chart's series on that day, then the value the target judges. */
export function tipLines(panels: Panel[], cob: string, l: Lookup, t: TFunction, u: DurationUnits): TipLine[] {
  const charts = panels.filter((p): p is Extract<Panel, { kind: 'Chart' }> => p.kind === 'Chart')
  const lines = charts.flatMap((panel, c) => {
    const row = chartRows(panel, [cob], l)[0]
    return panel.series.flatMap((s, i): TipLine[] => {
      const v = row[`s${i}`]
      if (v === null) return []
      const text = Array.isArray(v) ? `${clockText(v[0])} → ${clockText(v[1])}` : s.mark === 'Dot' ? '✓' : formatValue(v, panel.format, u)
      return [{
        key: `${c}.${i}`, name: seriesName(s, l, t), text, state: row.state,
        ...(panel.target?.colour ? {} : { colour: seriesColour(s, i, panel.bar_layout) }),
      }]
    })
  })
  const judged = charts.find((p) => p.target)
  const total = judged?.target ? scalar(resolve(judged.target.of, cob, l), null) : null
  if (!judged?.target || total === null || !lines.length) return lines
  // A target over one practice judges a row already shown.
  const of = judged.target.of
  if ('Practice' in of || ('Calc' in of && of.Calc.terms.length === 1)) return lines
  // A clock chart still judges a length.
  const format = judged.format === 'NoonClock' ? 'Duration' : judged.format
  const { min } = judged.target
  const met = min === null || judged.target.colour ? null : total >= min
  const goal: TipLine[] = met === null ? [] : [{
    key: 'goal', text: '', state: null, colour: 'transparent',
    name: met ? t('reportPanels.goalMet') : t('reportPanels.goalShort', { value: formatValue(min! - total, judged.format, u) }),
  }]
  return [...lines, {
    key: 'target',
    name: t('reportPanels.total'),
    text: formatValue(total, format, u),
    state: stateOf(total, judged.target),
  }, ...goal]
}

const monthOf = (cob: string) => cob.slice(0, 7)

/** A month's grid, Monday first: leading blanks, then every day, with those after today marked. */
export function monthCells(month: string, todayCob: string): { blanks: number; days: { cob: string; future: boolean }[] } {
  const [y, m] = month.split('-').map(Number)
  return {
    blanks: (new Date(y, m - 1, 1).getDay() + 6) % 7,
    days: Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => {
      const cob = `${month}-${String(i + 1).padStart(2, '0')}`
      return { cob, future: cob > todayCob }
    }),
  }
}

/** Done days (value above 0) in the 90 days ending at `end`, counted for the shown month, the one before, and all 90. */
export function monthCounts(practice: string, month: string, end: string, l: Lookup) {
  const [y, m] = month.split('-').map(Number)
  const prev = monthOf(toDateStr(new Date(y, m - 2, 1)))
  const done = new Set<string>()
  for (let i = 0; i < 90; i++) {
    const cob = shift(end, -i)
    if ((l.value(practice, cob) ?? 0) > 0) done.add(cob)
  }
  const inMonth = (mo: string) => [...done].filter((d) => monthOf(d) === mo).length
  return { thisMonth: inMonth(month), lastMonth: inMonth(prev), last90: done.size, done }
}

/** The day a month's data runs to: its last day, or today while it is still going. */
export function monthEnd(month: string, todayCob: string): string {
  const [y, m] = month.split('-').map(Number)
  const last = toDateStr(new Date(y, m, 0))
  return last < todayCob ? last : todayCob
}

/** "October 2026" (capitalised where the language lowercases months). */
export function monthName(month: string, locale: string, withYear = true): string {
  const [y, m] = month.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', ...(withYear && { year: 'numeric' }) })
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
}
