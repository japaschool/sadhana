import { useMemo } from 'react'
import { useMarkedPeriods } from '../../../api/markedPeriods'
import { toDateStr } from '../../today/date'
import { resolveSleep, useInsightRows } from './useInsightRows'
import { loggedDays } from './series'
import { useYearData } from './useYearData'
import { detectChange, openPeriodToAsk } from './suggest'
import { isRegular, meVsNormal } from './usual'

// Callers import it from here.
export { resolveSleep }

/** Everything the Overview shows, from the year of data to today. Shares its cache entries with useInsights. */
export function useOverview() {
  const todayCob = toDateStr(new Date())
  const dataQ = useYearData(todayCob)
  const { periods, isLoading: periodsLoading, isError: periodsFailed } = useMarkedPeriods()
  // Until the marked periods are known, suggesting a stretch or asking about a period could repeat one already marked.
  const periodsKnown = !periodsLoading && !periodsFailed
  const { rows, series, entries, practices, sleep, prefs, setPrefs, reportsPending, practicesPending, isLoading, isError } = useInsightRows(dataQ, todayCob)

  const timePractices = useMemo(() => practices.filter((p) => p.is_active && p.data_type === 'Time'), [practices])

  const askSleep = !reportsPending && !practicesPending && !sleep && prefs.sleep !== 'skip' && timePractices.length >= 2

  const logged = useMemo(() => loggedDays(entries, todayCob), [entries, todayCob])
  const normal = useMemo(() => meVsNormal(rows, series, periods, todayCob), [rows, series, periods, todayCob])
  const regular = useMemo(() => isRegular(normal, logged, todayCob), [normal, logged, todayCob])
  const suggestion = useMemo(
    () => (prefs.suggest && periodsKnown ? detectChange(series, rows, logged, periods, prefs.dismissed, todayCob) : null),
    [prefs.suggest, periodsKnown, prefs.dismissed, series, rows, logged, periods, todayCob],
  )
  const openPeriod = useMemo(() => (periodsKnown ? openPeriodToAsk(periods, prefs.openAsked, todayCob) : null), [periodsKnown, periods, prefs.openAsked, todayCob])

  return {
    isLoading, isError, todayCob, rows, series, logged, normal, regular, suggestion, openPeriod, periods,
    sleep, askSleep, timePractices, practices, prefs, setPrefs,
  }
}
