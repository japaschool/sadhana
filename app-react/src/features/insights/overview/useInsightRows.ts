import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Report, ReportDataEntry, SleepRows } from '../../../api/charts'
import type { UserPractice } from '../../../types/api'
import { sleepRowsFor } from '../panels/templates'
import { practicesApi } from '../../../api/practices'
import { failedWithoutData } from '../../../api/queryState'
import { useReports } from '../useReports'
import { useInsightPrefs } from './prefs'
import { insightRows, rowSeries } from './series'

const NONE: never[] = []

/** The Time practices that make up calculated Sleep: the stored choice, else a guess; null when skipped, stale or not found. */
export function resolveSleep(stored: SleepRows | 'skip' | null, practices: UserPractice[], reports: Report[]): SleepRows | null {
  if (stored === 'skip') return null
  if (stored) {
    const active = (id: string) => practices.some((p) => p.id === id && p.is_active && p.data_type === 'Time')
    if (active(stored.bedtime) && active(stored.wake)) {
      return { ...stored, nap: stored.nap && active(stored.nap) ? stored.nap : null }
    }
    return null // a stale choice: Sleep disappears and the sheet asks again
  }
  return sleepRowsFor(reports, practices)
}

/** Rows and their daily series from a report-data query, with the practices, reports and sleep choice they depend on. */
export function useInsightRows(dataQ: UseQueryResult<ReportDataEntry[]>, todayCob: string) {
  const [prefs, setPrefs, prefsReady] = useInsightPrefs()
  const reportsQ = useReports()
  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const reports = reportsQ.data ?? NONE
  const practices = practicesQ.data ?? NONE
  const entries = dataQ.data ?? NONE

  const sleep = useMemo(() => resolveSleep(prefs.sleep, practices, reports), [prefs.sleep, practices, reports])
  const rows = useMemo(() => insightRows(practices, sleep), [practices, sleep])
  const series = useMemo(() => rowSeries(rows, entries, practices, sleep, todayCob), [rows, entries, practices, sleep, todayCob])
  return {
    rows, series, entries, practices, sleep, prefs, setPrefs, prefsReady,
    reportsPending: reportsQ.isPending, practicesPending: practicesQ.isPending,
    isLoading: dataQ.isLoading || practicesQ.isLoading || reportsQ.isLoading,
    isError: failedWithoutData(dataQ) || failedWithoutData(practicesQ) || failedWithoutData(reportsQ),
  }
}
