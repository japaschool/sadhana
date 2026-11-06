import type { TFunction } from 'i18next'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import type { UserPractice } from '../../../types/api'
import { formatDuration } from '../../today/values'
import type { DurationUnits } from '../../today/values'
import { formatDay } from '../insightsLogic'
import type { RowKind } from '../panels/gapLogic'
import { clockText } from '../panels/panelLogic'
import type { InsightRow } from './series'

/** A row value as text; Clock values are minutes after noon. */
export function rowValueText(kind: RowKind, v: number | null, units: DurationUnits): string {
  if (v === null) return '—'
  if (kind === 'Clock') return clockText(Math.round(v))
  if (kind === 'Duration') return formatDuration(Math.round(v), units)
  return String(Math.round(v * 10) / 10)
}

export function rowName(row: InsightRow, practices: UserPractice[], t: TFunction): string {
  if (row.special === 'sleep') return t('insights.overview.sleep')
  if (row.special === 'total') return t('insights.overview.groupTotal', { group: row.groupName })
  return practices.find((p) => p.id === row.practice)?.practice ?? ''
}

/** "Oct 9 – Oct 18", or "since Oct 9" while it's going. */
export function periodDates(p: MarkedPeriod, locale: string, t: TFunction): string {
  const start = formatDay(p.start_date, locale)
  return p.end_date ? `${start} – ${formatDay(p.end_date, locale)}` : t('insights.overview.since', { date: start })
}

/** "A, B and C" in the reader's language. */
export const listText = (items: string[], locale: string) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(items)
