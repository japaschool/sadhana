import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMarkedPeriods, type MarkedPeriod } from '../../api/markedPeriods'
import { UiLoading } from '../../layouts/ByLayout'
import { formatDay } from '../insights/insightsLogic'
import { hasDetail } from '../insights/overview/bda'
import { OpenPeriodCard } from '../insights/overview/OpenPeriodCard'
import { PeriodSheet } from '../insights/overview/PeriodSheet'
import { useInsightPrefs } from '../insights/overview/prefs'
import { openPeriodToAsk } from '../insights/overview/suggest'
import { useOverviewActions } from '../insights/overview/useOverviewActions'
import { toDateStr } from '../today/date'
import { AddPill, ROWS, SettingsSubpage } from './SettingsSubpage'

/** /settings/periods: every marked period, to open, change or delete (16m9). */
export function MarkedPeriods() {
  const { t, i18n } = useTranslation()
  const { periods, isLoading } = useMarkedPeriods()
  const [prefs, setPrefs, prefsReady] = useInsightPrefs()
  const locale = i18n.language || 'en'
  const todayCob = toDateStr(new Date())
  const openPeriod = isLoading || !prefsReady ? null : openPeriodToAsk(periods, prefs.openAsked, todayCob)
  const { sheet, setSheet, openPeriodProps, onSheetSaved } = useOverviewActions({
    suggestion: null, openPeriod, rows: [], practices: [], prefs, setPrefs, todayCob,
  })
  const dates = (p: MarkedPeriod) => p.end_date
    ? `${formatDay(p.start_date, locale, true)} – ${formatDay(p.end_date, locale, true)}`
    : t('insights.periods.ongoing', { date: formatDay(p.start_date, locale) })

  return (
    <SettingsSubpage title={t('insights.periods.title')} back={{ to: '/settings/charts', label: t('insights.title') }}>
      <p className="px-1 text-sm leading-[1.45] text-ui-muted">{t('insights.periods.intro')}</p>
      {openPeriodProps && <OpenPeriodCard {...openPeriodProps} />}
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-[15px] font-extrabold text-ui-ink">{t('insights.periods.yours')}</h2>
        <AddPill label={t('insights.overview.newPeriod')} onClick={() => setSheet({})} />
      </div>
      {isLoading ? <UiLoading /> : (
        <ul aria-label={t('insights.periods.yours')} className={ROWS}>
          {periods.map((p) => (
            <li key={p.id} className="flex items-stretch bg-ui-surface">
              <button type="button" onClick={() => setSheet({ period: p })} className="flex min-h-[52px] min-w-0 flex-1 flex-col gap-0.5 px-4 py-3 text-left">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-[15px] font-semibold text-ui-ink">{p.name}</span>
                  {!p.end_date && (
                    <span className="shrink-0 rounded-full bg-ui-accent-pill px-2 py-0.5 text-[11px] font-bold text-ui-ink">{t('insights.periods.inProgress')}</span>
                  )}
                </span>
                <span className="text-xs font-medium text-ui-muted">
                  {dates(p)} · {t(p.exclude_from_usual ? 'insights.periods.leftOut' : 'insights.periods.counted')}
                </span>
              </button>
              {hasDetail(p, todayCob) && (
                <Link to={`/insights/period/${p.id}`} aria-label={t('insights.period.detailsOf', { name: p.name })}
                  className="flex min-w-11 shrink-0 items-center justify-center pr-2 text-sm font-bold text-ui-accent">
                  {t('insights.period.open')}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-xs leading-[1.4] text-ui-muted">{t('insights.periods.footer')}</p>
      {sheet && <PeriodSheet {...sheet} onClose={() => setSheet(null)} onSaved={onSheetSaved} />}
    </SettingsSubpage>
  )
}
