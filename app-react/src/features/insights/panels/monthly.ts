import type { ChartPanel, PanelsReport } from '../../../api/charts'
import { percentile } from '../overview/usual'
import type { Range } from '../useInsights'
import { resolve, scalar, stateOf, type Lookup } from './panelLogic'

export interface MonthRow {
  /** yyyy-mm */
  month: string
  /** Days counted: the month's days in the window, from the first logged day, today only once logged. */
  days: number
  /** Days done: on target where the panel has one, else logged. */
  done: number
  /** done of days, 0–100. */
  pct: number
  /** Median of what the target judges on logged days; a missing day isn't a 0. */
  median: number | null
  /** A Range panel's median start → median end (NoonClock); null for other panels or a month without one. */
  range: [number, number] | null
  /** The current month, still going. */
  soFar: boolean
}

/** 1y and All draw a Japa, Time spent or Sleep chart month by month. */
export const isMonthly = (def: PanelsReport, range: Range | undefined) =>
  (range === '1y' || range === 'all') && !!def.template && ('Japa' in def.template || 'Duration' in def.template || 'Sleep' in def.template)

const median = (xs: number[]) => (xs.length ? percentile([...xs].sort((a, b) => a - b), 0.5) : null)

/** The chart's days as months: how often (pct) apart from how much (median). Months before `firstLog` are left out. */
export function monthRows(panel: ChartPanel, days: string[], l: Lookup, todayCob: string, firstLog: string | null): MonthRow[] {
  const of = panel.target?.of ?? panel.series[0].source
  const span = 'Range' in panel.series[0].source ? panel.series[0].source : null
  const acc = new Map<string, { days: number; done: number; values: number[]; from: number[]; to: number[] }>()
  for (const cob of days) {
    if (firstLog === null || cob < firstLog || cob > todayCob) continue
    const v = scalar(resolve(of, cob, l), null)
    const logged = v !== null && v > 0
    // ponytail: today joins once logged, so a morning not yet written doesn't read as a missed day.
    if (cob === todayCob && !logged) continue
    const m = cob.slice(0, 7)
    const a = acc.get(m) ?? { days: 0, done: 0, values: [], from: [], to: [] }
    acc.set(m, a)
    a.days++
    if (logged) {
      a.values.push(v)
      const s = stateOf(v, panel.target)
      if (s === 'ok' || s === 'neutral') a.done++
    }
    const r = span && resolve(span, cob, l)
    if (Array.isArray(r)) { a.from.push(r[0]); a.to.push(r[1]) }
  }
  return [...acc].map(([month, a]) => {
    const from = median(a.from)
    const to = median(a.to)
    return {
      month, days: a.days, done: a.done, pct: Math.round((a.done / a.days) * 100), median: median(a.values),
      range: from === null || to === null ? null : [from, to], soFar: month === todayCob.slice(0, 7),
    }
  })
}
