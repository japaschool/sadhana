import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { chartsApi } from '../../../api/charts'
import { useMarkedPeriods } from '../../../api/markedPeriods'
import { toDateStr } from '../../today/date'
import { resolveSleep, useInsightRows } from './useInsightRows'
import { loggedDays } from './series'
import { detectChange, openPeriodToAsk } from './suggest'
import { isRegular, meVsNormal } from './usual'

// Callers import it from here.
export { resolveSleep }

/** Everything the Overview shows, from the year of data to today. Shares its cache entries with useInsights. */
export function useOverview() {
  const todayCob = toDateStr(new Date())
  const dataQ = useQuery({
    queryKey: ['report-data', todayCob, 'Year'],
    queryFn: () => chartsApi.getReportData(todayCob, 'Year'),
  })
  const { periods } = useMarkedPeriods()
  const { rows, series, entries, practices, sleep, prefs, setPrefs, reportsPending, practicesPending, isLoading, isError } = useInsightRows(dataQ, todayCob)

  const timePractices = useMemo(() => practices.filter((p) => p.is_active && p.data_type === 'Time'), [practices])

  const askSleep = !reportsPending && !practicesPending && !sleep && prefs.sleep !== 'skip' && timePractices.length >= 2

  const logged = useMemo(() => loggedDays(entries, todayCob), [entries, todayCob])
  const normal = useMemo(() => meVsNormal(rows, series, periods, todayCob), [rows, series, periods, todayCob])
  const regular = useMemo(() => isRegular(normal, logged, todayCob), [normal, logged, todayCob])
  const suggestion = useMemo(
    () => (prefs.suggest ? detectChange(series, rows, logged, periods, prefs.dismissed, todayCob) : null),
    [prefs.suggest, prefs.dismissed, series, rows, logged, periods, todayCob],
  )
  const openPeriod = useMemo(() => openPeriodToAsk(periods, prefs.openAsked, todayCob), [periods, prefs.openAsked, todayCob])

  return {
    isLoading, isError, todayCob, rows, series, logged, normal, regular, suggestion, openPeriod, periods,
    sleep, askSleep, timePractices, practices, prefs, setPrefs,
  }
}
