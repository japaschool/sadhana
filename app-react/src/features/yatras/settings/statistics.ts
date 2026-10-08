import type { Aggregation, PracticeDataType, TimeRange, YatraPractice, YatraStatisticConfig } from '../../../types/api'
import { formatDuration } from '../../today/values'
import type { DurationUnits } from '../../today/values'

export const TIME_RANGES: TimeRange[] = [
  'Last7Days', 'Last30Days', 'Last90Days', 'Last365Days', 'ThisWeek', 'ThisMonth', 'ThisQuarter', 'ThisYear',
]

export function aggregationsFor(dt: PracticeDataType): Aggregation[] {
  if (dt === 'Int' || dt === 'Duration') return ['Sum', 'Avg', 'Min', 'Max', 'Count']
  if (dt === 'Time') return ['Avg', 'Min', 'Max', 'Count'] // adding up times of day means nothing
  return ['Count']
}

export function withPractice(stat: YatraStatisticConfig, p: YatraPractice): YatraStatisticConfig {
  return { ...stat, practice_id: p.id, aggregation: aggregationsFor(p.data_type).includes(stat.aggregation) ? stat.aggregation : 'Count' }
}

export function newStatistic(practices: YatraPractice[]): YatraStatisticConfig | null {
  const p = practices.find((x) => x.data_type === 'Int' || x.data_type === 'Duration' || x.data_type === 'Time') ?? practices[0]
  if (!p) return null
  return { label: p.practice, practice_id: p.id, aggregation: aggregationsFor(p.data_type).includes('Avg') ? 'Avg' : 'Count', time_range: 'Last30Days' }
}

/** The server wraps every result in the practice's type, counts included, and averages can be fractional. */
export function statValue(raw: unknown, agg: Aggregation, dt: PracticeDataType, u: DurationUnits): string {
  if (raw === null || raw === undefined) return '—'
  const o = raw as { Int?: number; Duration?: number; Time?: { h: number; m: number } }
  // Time is built as (x / 60, x % 60): h is fractional when x is.
  const n = o.Time ? Math.trunc(o.Time.h) * 60 + o.Time.m : (o.Int ?? o.Duration ?? null)
  if (n === null) return '—'
  if (agg === 'Count' || dt === 'Int') return String(Math.round(n * 10) / 10)
  const mins = Math.round(n)
  if (dt === 'Duration') return formatDuration(mins, u)
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}
