import { useTranslation } from 'react-i18next'
import { useMarkedPeriods, type MarkedPeriod } from '../../api/markedPeriods'
import { UiLoading } from '../../layouts/ByLayout'
import { formatDay } from '../insights/insightsLogic'
import { OpenPeriodCard } from '../insights/overview/OpenPeriodCard'
import { PeriodSheet } from '../insights/overview/PeriodSheet'
import { useOverview } from '../insights/overview/useOverview'
import { useOverviewActions } from '../insights/overview/useOverviewActions'
import { AddPill, ROWS, SettingsSubpage } from './SettingsSubpage'

/** /settings/periods: every marked period, to open, change or delete (16m9). */
export function MarkedPeriods() {
  const { t, i18n } = useTranslation()
  const { periods, isLoading } = useMarkedPeriods()
  const actions = useOverviewActions(useOverview())
  const { sheet, setSheet, openPeriodProps } = actions
  const locale = i18n.language || 'en'
  const dates = (p: MarkedPeriod) => p.end_date
    ? `${formatDay(p.start_date, locale, true)} – ${formatDay(p.end_date, locale, true)}`
    : t('insights.periods.ongoing', { date: formatDay(p.start_date, locale) })

  return (
    <SettingsSubpage title={t('insights.periods.title')}>
      <p className="px-1 text-sm leading-[1.45] text-ui-muted">{t('insights.periods.intro')}</p>
      {openPeriodProps && <OpenPeriodCard {...openPeriodProps} />}
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-[15px] font-extrabold text-ui-ink">{t('insights.periods.yours')}</h2>
        <AddPill label={t('insights.overview.newPeriod')} onClick={() => setSheet({})} />
      </div>
      {isLoading ? <UiLoading /> : (
        <ul aria-label={t('insights.periods.yours')} className={ROWS}>
          {periods.map((p) => (
            <li key={p.id} className="bg-ui-surface">
              <button type="button" onClick={() => setSheet({ period: p })} className="flex min-h-[52px] w-full flex-col gap-0.5 px-4 py-3 text-left">
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
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-xs leading-[1.4] text-ui-muted">{t('insights.periods.footer')}</p>
      {sheet && <PeriodSheet {...sheet} onClose={() => setSheet(null)} />}
    </SettingsSubpage>
  )
}
