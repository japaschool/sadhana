import { fromDateStr } from '../../today/date'
import type { Step } from '../panels/gapLogic'
import { eachDay, mean, percentile, shift } from './usual'
import type { InsightRow, Series } from './series'

export interface MapCell { week: string; mean: number | null; days: number; step: Step }

/** The Monday of cob's Mon–Sun week. */
export const mondayOf = (cob: string) => shift(cob, -((fromDateStr(cob).getDay() + 6) % 7))

/** Mondays, oldest first, the last one this week's. */
export function weekStarts(n: 26 | 52, todayCob: string): string[] {
  const last = mondayOf(todayCob)
  return Array.from({ length: n }, (_, i) => shift(last, -7 * (n - 1 - i)))
}

const median = (xs: number[]) => percentile([...xs].sort((a, b) => a - b), 0.5)

function stepOfK(k: number): Step {
  const a = Math.abs(k)
  const n = a >= 3 ? 3 : a >= 1.5 ? 2 : a >= 0.5 ? 1 : 0
  return (n === 0 ? 0 : Math.sign(k) * n) as Step
}

export function yearMap(
  rows: InsightRow[], series: Map<string, Series>, n: 26 | 52, todayCob: string,
): { row: InsightRow; median: number | null; cells: MapCell[] }[] {
  const weeks = weekStarts(n, todayCob)
  return rows.map((row) => {
    const s = series.get(row.key) ?? new Map<string, number>()
    const raw = weeks.map((week) => {
      const end = shift(week, 6) < todayCob ? shift(week, 6) : todayCob
      const vs = eachDay(week, end).filter((d) => s.has(d)).map((d) => s.get(d)!)
      return { week, days: vs.length, mean: vs.length ? mean(vs) : null }
    })
    const means = raw.flatMap((c) => (c.mean === null ? [] : [c.mean]))
    const med = means.length ? median(means) : null
    const mad = med === null ? 0 : median(means.map((m) => Math.abs(m - med)))
    return {
      row, median: med,
      cells: raw.map((c) => ({
        ...c,
        step: c.mean === null || med === null || mad === 0 ? 0
          : stepOfK(((row.kind === 'Clock' ? -1 : 1) * (c.mean - med)) / mad),
      })),
    }
  })
}
