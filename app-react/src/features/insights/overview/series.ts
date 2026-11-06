import type { ReportDataEntry, SleepRows } from '../../../api/charts'
import type { PracticeGroup, UserPractice } from '../../../types/api'
import { groupPractices } from '../../practices/groups'
import { sleepSource } from '../panels/templates'
import type { RowKind } from '../panels/gapLogic'
import { makeLookup, resolve, scalar, windowDays } from '../panels/panelLogic'

export interface InsightRow {
  key: string; kind: RowKind; practice: string | null; special: 'sleep' | 'total' | null
  /** A group total's Duration practices. */
  members?: string[]
  groupName?: string
}
/** cob -> value. Clock values are minutes after noon. */
export type Series = Map<string, number>

/** A row with the group it's listed under and whether it shows when the user hasn't chosen. */
export interface OverviewRow extends InsightRow { group: PracticeGroup; defaultVisible: boolean }

const KIND: Partial<Record<UserPractice['data_type'], RowKind>> = { Time: 'Clock', Int: 'Count', Duration: 'Duration' }

/** Every row the overview can show, in diary order: each group's practices, then its total, with Sleep last.
 *  A named group with 2+ active Duration practices gets a total and hides them by default. */
export function overviewRows(practices: UserPractice[], groups: PracticeGroup[], sleep: SleepRows | null): OverviewRow[] {
  const sections = groupPractices(groups, practices.filter((p) => p.is_active))
  const rows: OverviewRow[] = []
  for (const { group, practices: ps } of sections) {
    const own: OverviewRow[] = ps.flatMap((p) => {
      const kind = KIND[p.data_type]
      return kind ? [{ key: p.id, kind, practice: p.id, special: null, group, defaultVisible: true }] : []
    })
    const durations = own.filter((r) => r.kind === 'Duration')
    if (!group.is_default && durations.length >= 2) {
      durations.forEach((r) => { r.defaultVisible = false })
      own.push({
        key: `total:${group.id}`, kind: 'Duration', practice: null, special: 'total',
        members: durations.map((r) => r.practice!), groupName: group.name, group, defaultVisible: true,
      })
    }
    rows.push(...own)
  }
  if (sleep) rows.push({ key: 'sleep', kind: 'Duration', practice: null, special: 'sleep', group: sections.find((x) => x.group.is_default)!.group, defaultVisible: true })
  return rows
}

/** The rows the user sees: their choice, else the default. Sleep has its own setting and always stays. */
export function insightRows(
  practices: UserPractice[], groups: PracticeGroup[], sleep: SleepRows | null, visibility: Record<string, boolean>,
): InsightRow[] {
  return overviewRows(practices, groups, sleep).filter((r) => r.special === 'sleep' || (visibility[r.key] ?? r.defaultVisible))
}

/** Sorted days with at least one non-null value. */
export function loggedDays(entries: ReportDataEntry[], _todayCob: string): string[] {
  return [...new Set(entries.filter((x) => x.value !== null && x.value !== undefined).map((x) => x.cob_date))].sort()
}

const afterNoon = (minutes: number) => (((minutes - 720) % 1440) + 1440) % 1440

export function rowSeries(
  rows: InsightRow[], entries: ReportDataEntry[], practices: UserPractice[], sleep: SleepRows | null, todayCob: string,
): Map<string, Series> {
  const l = makeLookup(entries, undefined, practices)
  const days = windowDays(entries)
  const active = practices.filter((p) => p.is_active)
  const counted = active.filter((p) => p.data_type === 'Int' || p.data_type === 'Duration')
  const filled = new Set(counted.filter((p) => days.some((d) => l.value(p.id, d) !== null)).map((p) => p.id))
  // A count's empty is 0 only on a past day that has some count value, for a practice filled in elsewhere.
  const count = (id: string, cob: string): number | null => {
    if (cob === todayCob) return null
    const v = l.value(id, cob)
    if (v !== null) return v
    return filled.has(id) && counted.some((p) => l.value(p.id, cob) !== null) ? 0 : null
  }
  const sleepSrc = sleep ? sleepSource(sleep) : null

  const out = new Map<string, Series>()
  for (const row of rows) {
    const s: Series = new Map()
    for (const cob of days) {
      let v: number | null = null
      if (row.special === 'sleep') v = sleepSrc ? scalar(resolve(sleepSrc, cob, l), null) : null
      else if (row.special === 'total') {
        const parts = (row.members ?? []).map((id) => count(id, cob))
        v = parts.some((x) => x !== null) ? parts.reduce<number>((a, x) => a + (x ?? 0), 0) : null
      } else if (row.kind === 'Clock') {
        const t = l.value(row.practice!, cob)
        v = t === null ? null : afterNoon(t)
      } else v = count(row.practice!, cob)
      if (v !== null) s.set(cob, v)
    }
    out.set(row.key, s)
  }
  return out
}
