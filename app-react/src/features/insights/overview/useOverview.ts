import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { chartsApi } from '../../../api/charts'
import type { SleepRows } from '../../../api/charts'
import { useMarkedPeriods } from '../../../api/markedPeriods'
import { practicesApi } from '../../../api/practices'
import { failedWithoutData } from '../../../api/queryState'
import { toDateStr } from '../../today/date'
import { sleepRowsFor } from '../panels/templates'
import { useReports } from '../useReports'
import { useInsightPrefs } from './prefs'
import { insightRows, loggedDays, rowSeries } from './series'
import { detectChange, openPeriodToAsk } from './suggest'
import { isRegular, meVsNormal } from './usual'

const NONE: never[] = []

/** Everything the Overview shows, from the year of data to today. Shares its cache entries with useInsights. */
export function useOverview() {
  const [prefs, setPrefs] = useInsightPrefs()
  const todayCob = toDateStr(new Date())
  const reportsQ = useReports()
  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const dataQ = useQuery({
    queryKey: ['report-data', todayCob, 'Year'],
    queryFn: () => chartsApi.getReportData(todayCob, 'Year'),
  })
  const { periods } = useMarkedPeriods()
  const reports = reportsQ.data ?? NONE
  const practices = practicesQ.data ?? NONE
  const entries = dataQ.data ?? NONE

  const timePractices = useMemo(() => practices.filter((p) => p.is_active && p.data_type === 'Time'), [practices])

  const sleep = useMemo<SleepRows | null>(() => {
    const stored = prefs.sleep
    if (stored === 'skip') return null
    if (stored) {
      const active = (id: string) => timePractices.some((p) => p.id === id)
      if (active(stored.bedtime) && active(stored.wake)) {
        return { ...stored, nap: stored.nap && active(stored.nap) ? stored.nap : null }
      }
      return null // a stale choice: Sleep disappears and the sheet asks again
    }
    return sleepRowsFor(reports, practices)
  }, [prefs.sleep, timePractices, reports, practices])

  const askSleep = !reportsQ.isLoading && !practicesQ.isLoading && !sleep && prefs.sleep !== 'skip' && timePractices.length >= 2

  const rows = useMemo(() => insightRows(practices, sleep), [practices, sleep])
  const series = useMemo(() => rowSeries(rows, entries, practices, sleep, todayCob), [rows, entries, practices, sleep, todayCob])
  const logged = useMemo(() => loggedDays(entries, todayCob), [entries, todayCob])
  const normal = useMemo(() => meVsNormal(rows, series, periods, todayCob), [rows, series, periods, todayCob])
  const regular = useMemo(() => isRegular(normal, logged, todayCob), [normal, logged, todayCob])
  const suggestion = useMemo(
    () => (prefs.suggest ? detectChange(series, rows, logged, periods, prefs.dismissed, todayCob) : null),
    [prefs.suggest, prefs.dismissed, series, rows, logged, periods, todayCob],
  )
  const openPeriod = useMemo(() => openPeriodToAsk(periods, prefs.openAsked, todayCob), [periods, prefs.openAsked, todayCob])

  return {
    isLoading: dataQ.isLoading || practicesQ.isLoading || reportsQ.isLoading,
    isError: failedWithoutData(dataQ) || failedWithoutData(practicesQ) || failedWithoutData(reportsQ),
    todayCob, rows, series, logged, normal, regular, suggestion, openPeriod, periods,
    askSleep, timePractices, prefs, setPrefs,
  }
}
