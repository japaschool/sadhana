import { useTranslation } from 'react-i18next'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import type { UserPractice } from '../../../types/api'
import { formatDay } from '../insightsLogic'
import { monthCells, monthName } from '../panels/panelLogic'
import { rowName, rowValueText } from './format'
import { RowLabel, OV_CARD } from './MeVsNormal'
import type { InsightRow, Series } from './series'
import { monthCount, runs, type Run } from './streaks'
import { leftOutDays, shift, usualWindowCount } from './usual'

const AVERAGE_DAYS = 90
const DAY = 'flex h-[34px] items-center justify-center rounded-lg font-ui-mono text-xs font-medium'
const TITLE = 'text-lg font-extrabold text-ui-ink'
const NOTE = 'text-xs leading-[1.45] text-ui-muted'

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null)

/** "29–31 Oct": the run's first and last day. */
function runDates(r: Run, locale: string): string {
  return r.start === r.end ? formatDay(r.end, locale) : `${formatDay(r.start, locale)} – ${formatDay(r.end, locale)}`
}

function RunFigure({ label, run, locale }: { label: string; run: Run | null; locale: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs leading-[1.3] font-bold text-ui-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="font-ui-mono text-[26px] font-semibold tracking-[-0.02em] text-ui-ink">{run?.length ?? 0}</span>
        <span className="text-[13px] font-semibold text-ui-muted">{t('insights.overview.daysUnit', { count: run?.length ?? 0 })}</span>
      </span>
      {run && <span className="font-ui-mono text-[11px] leading-[1.35] text-ui-faint2">{runDates(run, locale)}</span>}
    </div>
  )
}

/** For a new or less regular user: days practised this month, optional streaks, and plain averages (16m12, 16m14). */
export function LessRegular({ logged, todayCob, streaks, rows, series, practices, periods }: {
  periods: MarkedPeriod[]; logged: string[]; todayCob: string; streaks: boolean; rows: InsightRow[]; series: Map<string, Series>; practices: UserPractice[]
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const month = todayCob.slice(0, 7)
  const count = monthCount(logged, month)
  const loggedSet = new Set(logged)
  const { blanks, days } = monthCells(month, todayCob)
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 5 + i).toLocaleDateString(locale, { weekday: 'narrow' }))
  // Past days only: today isn't in the Int, Duration or Total averages, so it isn't counted either.
  const from = shift(todayCob, -AVERAGE_DAYS)
  const recent = logged.filter((d) => d >= from && d < todayCob)
  const soFar = usualWindowCount(logged, todayCob, leftOutDays(periods, todayCob))
  const averages = rows.map((row) => {
    const s = series.get(row.key)
    return { row, value: mean(recent.flatMap((d) => (s?.has(d) ? [s.get(d)!] : []))) }
  })
  const run = streaks ? runs(logged, todayCob) : null

  return (
    <>
      <section aria-labelledby="days-practised" className={`${OV_CARD} gap-3`}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="days-practised" className={TITLE}>{t('insights.overview.daysPractised')}</h2>
          <span className="font-ui-mono text-xs font-medium text-ui-muted">{monthName(month, locale, false)}</span>
        </div>
        <span className="flex items-baseline gap-1.5">
          <span data-testid="month-count" className="font-ui-mono text-[30px] font-semibold tracking-[-0.02em] text-ui-ink">{count}</span>
          <span className="text-sm font-semibold text-ui-muted">{t('insights.overview.daysUnit', { count })}</span>
        </span>
        <div role="img" aria-label={t('insights.overview.daysThisMonth', { count, month: monthName(month, locale) })} className="flex flex-col gap-1.5">
          <div className="grid grid-cols-7 gap-1.5">
            {weekdays.map((w, i) => <span key={i} className="text-center text-[11px] font-bold text-ui-faint2">{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
            {days.map(({ cob, future }) => {
              const on = !future && loggedSet.has(cob)
              const tone = future ? 'text-ui-faint opacity-60 shadow-[inset_0_0_0_1px_var(--ui-hairline)]'
                : on ? 'bg-ui-done text-ui-on-done' : 'bg-ui-heat-0 text-ui-muted'
              return (
                <span key={cob} data-logged={on} aria-current={cob === todayCob ? 'date' : undefined}
                  className={`${DAY} ${tone} ${cob === todayCob ? 'outline-2 outline-offset-1 outline-ui-ink' : ''}`}>
                  {Number(cob.slice(8))}
                </span>
              )
            })}
          </div>
        </div>
        {run && (
          <div className="grid grid-cols-2 gap-3 border-t border-ui-chip pt-3">
            <RunFigure label={t('insights.overview.currentRun')} run={run.current} locale={locale} />
            <RunFigure label={t('insights.overview.longestRun')} run={run.longest} locale={locale} />
          </div>
        )}
        <p className={NOTE}>{t(run ? 'insights.overview.neverResetsRuns' : 'insights.overview.neverResets')}</p>
      </section>

      <section aria-labelledby="on-days" className={`${OV_CARD} gap-3`}>
        <div className="flex flex-col gap-1">
          <h2 id="on-days" className={TITLE}>{t('insights.overview.onDays')}</h2>
          <p className="text-[13px] leading-[1.45] text-ui-muted">{t('insights.overview.onDaysText', { count: recent.length })}</p>
        </div>
        <div className="flex flex-col">
          {averages.map(({ row, value }) => (
            <div key={row.key} role="group" aria-label={rowName(row, practices, t)}
              className="flex min-h-[46px] items-center justify-between gap-3 border-t border-ui-chip first:border-0">
              <RowLabel n={{ row }} practices={practices} />
              <span className="font-ui-mono text-[17px] font-semibold text-ui-ink">{rowValueText(row.kind, value, units)}</span>
            </div>
          ))}
        </div>
        <p className={`${NOTE} border-t border-ui-chip pt-2`}>{t('insights.overview.showsUpAt', { n: soFar })}</p>
      </section>
    </>
  )
}
