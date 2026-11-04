import type { AroundRow, Source } from '../../../api/charts'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { resolve, scalar, type Lookup } from './panelLogic'

/** One event in the window. `gap`: calendar days since the previous event of any option; null when there is none. */
export interface GapEvent { cob: string; option: string | null; prev: string | null; gap: number | null }

export const TYPICAL_MIN = 5
export const AROUND_MIN = 10
export const OFFSETS = [-1, 0, 1, 2] as const

const shift = (cob: string, offset: number) => toDateStr(addDays(fromDateStr(cob), offset))
/** Rounded, so a DST day of 23 or 25 hours still counts as one. */
const daysBetween = (a: string, b: string) => Math.round((fromDateStr(b).getTime() - fromDateStr(a).getTime()) / 86_400_000)

/** An event is a true Bool or a non-empty Text. */
function isEvent(event: string, cob: string, l: Lookup): boolean {
  if (l.available(event, 'Bool')) return l.value(event, cob) !== null
  return l.text(event, cob) !== null
}

/** Events within `days`, oldest first; `prevDays` is only looked back through for the first gap. */
export function gapEvents(event: string, days: string[], prevDays: string[], l: Lookup): GapEvent[] {
  const inWindow = new Set(days)
  const dropdown = l.options(event).length > 0
  const out: GapEvent[] = []
  let prev: string | null = null
  for (const cob of [...new Set([...prevDays, ...days])].sort()) {
    if (!isEvent(event, cob, l)) continue
    if (inWindow.has(cob)) {
      out.push({ cob, option: dropdown ? l.text(event, cob) : null, prev, gap: prev === null ? null : daysBetween(prev, cob) })
    }
    prev = cob
  }
  return out
}

/** The practice's current options that occur, in their order, then any retired ones as first seen. */
export function eventOptions(event: string, events: GapEvent[], l: Lookup): string[] {
  const seen = new Set(events.flatMap((x) => (x.option === null ? [] : [x.option])))
  const current = l.options(event).filter((o) => seen.has(o))
  return [...current, ...[...seen].filter((o) => !current.includes(o))]
}

export function gapFigures(events: GapEvent[]): { typical: number | null; longest: GapEvent | null; latest: GapEvent | null } {
  const withGap = events.filter((x) => x.gap !== null)
  const sorted = withGap.map((x) => x.gap!).sort((a, b) => a - b)
  const mid = sorted.length >> 1
  const typical = events.length < TYPICAL_MIN || !sorted.length ? null
    : sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  const longest = withGap.reduce<GapEvent | null>((best, x) => (best === null || x.gap! >= best.gap! ? x : best), null)
  return { typical, longest, latest: withGap.at(-1) ?? null }
}

export type RowKind = 'Count' | 'Duration' | 'Clock'

export function rowKind(source: Source, l: Lookup): RowKind | null {
  if ('Calc' in source) return source.Calc.terms.every((t) => t.optional || l.available(t.practice)) ? 'Duration' : null
  if (!('Practice' in source)) return null
  const p = source.Practice.practice
  if (l.available(p, 'Int')) return 'Count'
  if (l.available(p, 'Duration')) return 'Duration'
  if (l.available(p, 'Time')) return 'Clock'
  return null
}

export type Step = -3 | -2 | -1 | 0 | 1 | 2 | 3
export interface AroundCell { value: number | null; step: Step }
export interface AroundLine { row: AroundRow; kind: RowKind; usual: number | null; cells: AroundCell[] }

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
const EPS = 1e-9

function stepOf(z: number): Step {
  const a = Math.abs(z) + EPS
  const n = a >= 1 ? 3 : a >= 0.6 ? 2 : a >= 0.3 ? 1 : 0
  return (n === 0 ? 0 : Math.sign(z) * n) as Step
}

/**
 * Each row's mean on the days around `events` (pass only the selected option's), against its usual over `days`.
 * Null values are skipped, never read as 0.
 * ponytail: the spec's "empty Int counts as 0 when the day has other values" isn't applied; a skipped null can't turn a
 * gap into a collapse. Add it when the Overview's shared value function exists.
 */
export function aroundTable(rows: AroundRow[], events: GapEvent[], days: string[], l: Lookup, todayCob: string): AroundLine[] {
  return rows.flatMap((row): AroundLine[] => {
    const kind = rowKind(row.source, l)
    if (kind === null) return []
    // An Int or a logged Duration isn't complete until the day is over; a clock or a night is.
    const todayIn = kind === 'Clock' || 'Calc' in row.source
    const at = (cob: string): number | null => {
      if (cob > todayCob || (cob === todayCob && !todayIn)) return null
      const v = scalar(resolve(row.source, cob, l), null)
      if (v === null) return null
      // Minutes after noon, so 23:30 and 00:30 average to midnight.
      return kind === 'Clock' ? ((v - 720) % 1440 + 1440) % 1440 : v
    }
    const values = days.map(at).filter((v): v is number => v !== null)
    const usual = values.length >= 2 ? mean(values) : null
    const sd = usual === null ? 0 : Math.sqrt(mean(values.map((v) => (v - usual) ** 2)))
    const cells = OFFSETS.map((off): AroundCell => {
      const vs = events.map((x) => at(shift(x.cob, off))).filter((v): v is number => v !== null)
      const value = vs.length ? mean(vs) : null
      if (value === null || usual === null || sd === 0) return { value, step: 0 }
      const z = (value - usual) / sd
      return { value, step: stepOf(kind === 'Clock' ? -z : z) }
    })
    return [{ row, kind, usual, cells }]
  })
}
