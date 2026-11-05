import type { MarkedPeriod } from '../../../api/markedPeriods'
import type { UserPractice } from '../../../types/api'
import { fromDateStr } from '../../today/date'
import { stepOf, type Step } from '../panels/gapLogic'
import type { InsightRow, Series } from './series'
import { eachDay, leftOutDays, mean, shift } from './usual'
import { mondayOf } from './yearMap'

const WINDOW_DAYS = 180
const MIN_WEEKS = 8

/** Int practices and each Duration practice separately: no Time, Sleep or Total. */
export function fingerprintRows(practices: UserPractice[]): InsightRow[] {
  return practices.flatMap((p): InsightRow[] => {
    if (!p.is_active) return []
    if (p.data_type === 'Int') return [{ key: p.id, kind: 'Count', practice: p.id, special: null }]
    if (p.data_type === 'Duration') return [{ key: p.id, kind: 'Duration', practice: p.id, special: null }]
    return []
  })
}

export function fingerprint(
  rows: InsightRow[], series: Map<string, Series>, periods: MarkedPeriod[], todayCob: string,
): { row: InsightRow; typical: number; days: { avg: number | null; step: Step }[] }[] | null {
  const leftOut = leftOutDays(periods, todayCob)
  const window = eachDay(shift(todayCob, -(WINDOW_DAYS - 1)), todayCob).filter((d) => !leftOut.has(d))
  const weeks = new Set(window.filter((d) => rows.some((r) => series.get(r.key)?.has(d))).map(mondayOf))
  if (weeks.size < MIN_WEEKS) return null
  return rows.map((row) => {
    const s = series.get(row.key) ?? new Map<string, number>()
    const byDay: number[][] = Array.from({ length: 7 }, () => [])
    const all: number[] = []
    for (const d of window) {
      if (!s.has(d)) continue
      byDay[(fromDateStr(d).getDay() + 6) % 7].push(s.get(d)!)
      all.push(s.get(d)!)
    }
    const typical = all.length ? mean(all) : 0
    const sd = all.length ? Math.sqrt(mean(all.map((v) => (v - typical) ** 2))) : 0
    return {
      row, typical,
      days: byDay.map((vs) => {
        const avg = vs.length ? mean(vs) : null
        return { avg, step: avg === null || sd === 0 ? 0 : stepOf((avg - typical) / sd) }
      }),
    }
  })
}
