import { useMemo } from 'react'
import { useMarkedPeriods } from '../../../api/markedPeriods'
import { toDateStr } from '../../today/date'
import { resolveSleep, useInsightRows } from './useInsightRows'
import { loggedDays } from './series'
import { useYearData } from './useYearData'
import { detectChange, openPeriodToAsk } from './suggest'
import { isRegular, leftOutDays, meVsNormal } from './usual'
import { enoughHistory, usualWeeks } from './usualOverTime'

// Callers import it from here.
export { resolveSleep }

/** Everything the Overview shows, from the year of data to today. Shares its cache entries with useInsights. */
export function useOverview() {
  const todayCob = toDateStr(new Date())
  const dataQ = useYearData(todayCob)
  const { periods, isLoading: periodsLoading, isError: periodsFailed } = useMarkedPeriods()
  // Until the marked periods are known, suggesting a stretch or asking about a period could repeat one already marked.
  const periodsKnown = !periodsLoading && !periodsFailed
  const { rows, series, entries, practices, sleep, prefs, setPrefs, prefsReady, reportsPending, practicesPending, isLoading, isError } = useInsightRows(dataQ, todayCob)

  const timePractices = useMemo(() => practices.filter((p) => p.is_active && p.data_type === 'Time'), [practices])

  const askSleep = prefsReady && !reportsPending && !practicesPending && !sleep && prefs.sleep !== 'skip' && timePractices.length >= 2

  const logged = useMemo(() => loggedDays(entries, todayCob), [entries, todayCob])
  const normal = useMemo(() => meVsNormal(rows, series, periods, todayCob), [rows, series, periods, todayCob])
  const regular = useMemo(() => isRegular(normal, logged, todayCob), [normal, logged, todayCob])
  const suggestion = useMemo(
    () => (prefs.suggest && periodsKnown && prefsReady ? detectChange(series, rows, logged, periods, prefs.dismissed, todayCob) : null),
    [prefs.suggest, periodsKnown, prefsReady, prefs.dismissed, series, rows, logged, periods, todayCob],
  )
  // Year data is enough: 26 weekly usuals need ~7 months. The Overview never fetches All data.
  const usualHistory = useMemo(() => {
    if (!logged.length) return false
    const leftOut = leftOutDays(periods, todayCob)
    return rows.some((row) => enoughHistory(usualWeeks(series.get(row.key) ?? new Map(), leftOut, todayCob, logged[0])))
  }, [rows, series, periods, todayCob, logged])
  // Until prefs are loaded, a dismissed suggestion or an answered ask would come back.
  const openPeriod = useMemo(() => (periodsKnown && prefsReady ? openPeriodToAsk(periods, prefs.openAsked, todayCob) : null), [periodsKnown, prefsReady, periods, prefs.openAsked, todayCob])

  return {
    isLoading, isError, todayCob, rows, series, logged, normal, regular, suggestion, openPeriod, periods,
    sleep, askSleep, timePractices, practices, prefs, setPrefs, usualHistory,
  }
}
