import type {
  End, Panel, PanelsReport, ReportDataEntry, Required, Scope, Series, Source, Stat, StatValue, Target,
} from '../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { valueToNumber } from '../chartLogic'

export interface Lookup {
  /** Numeric value on a day; null when empty, or the practice is unavailable. */
  value(practice: string, cob: string): number | null
  /** In the practices list, active, and the type the source needs. */
  available(practice: string, type?: PracticeDataType): boolean
  type(practice: string): PracticeDataType | undefined
  name(practice: string): string | undefined
}
export type Resolved = number | [number, number] | null
export type BarState = 'ok' | 'under' | 'over' | 'neutral'

const DAY = 1440
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
    value(practice, cob) {
      const p = byId.get(practice)
      if (!p || !p.is_active) return null
      return valueToNumber(raw.get(`${p.practice}\u0000${cob}`), p.data_type)
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
  const used: { sign: number; type: PracticeDataType; value: number }[] = []
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
    used.push({ sign: t.sign, type, value: v })
  }
  const time = used.filter((u) => u.type === 'Time')
  if (time.length === 0) return used.reduce((s, u) => s + u.sign * u.value, 0)
  if (time.reduce((s, u) => s + u.sign, 0) !== 0) return null
  const rest = used.filter((u) => u.type !== 'Time')
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

function scalar(r: Resolved, pick: End | null): number | null {
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
  const logged = values.filter((x): x is number => x !== null)

  switch (kind) {
    case 'Logged':
    case 'CountTrue':
      return { value: logged.length }
    case 'OnTarget': {
      const ok = logged.filter((x) => stateOf(x, { min: p.min ?? null, max: p.max ?? null }) !== 'under'
        && stateOf(x, { min: p.min ?? null, max: p.max ?? null }) !== 'over')
      return { value: ok.length, of: logged.length }
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
  return s.Calc.terms.every((t) => t.optional || l.available(t.practice))
}

function visibleStat(s: Stat, l: Lookup): Stat | null {
  if (!refsOk(statParts(s.value)[1].of, l)) return null
  return { ...s, under: s.under ? visibleStat(s.under, l) : null }
}

export function visiblePanels(def: PanelsReport, l: Lookup): Panel[] {
  const out: Panel[] = []
  for (const panel of def.panels) {
    if (panel.kind === 'Stats') {
      const stats = panel.stats.map((s) => visibleStat(s, l)).filter((s): s is Stat => s !== null)
      if (stats.length) out.push({ ...panel, stats })
      continue
    }
    const keep = panel.series.map((s) => refsOk(s.source, l)
      && !(panel.format === 'Duration' && 'Practice' in s.source && !l.available(s.source.Practice.practice, 'Duration')))
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

export function missingRequired(def: PanelsReport, l: Lookup): Required[] {
  return def.required.filter((r) => !l.available(r.practice))
}

/** Whole hours around the data, in minutes. */
export function fitHours(values: number[]): [number, number] {
  if (values.length === 0) return [0, 720]
  const lo = Math.floor(Math.min(...values) / 60) * 60
  const hi = (Math.floor(Math.max(...values) / 60) + 1) * 60
  return [lo, hi]
}
