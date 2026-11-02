import { useTranslation } from 'react-i18next'
import { toDateStr } from '../../today/date'
import { formatDay } from '../insightsLogic'
import { monthName } from '../panels/panelLogic'

interface MonthNavProps { month: string; todayCob: string; onChange: (month: string) => void }

const ARROW = 'flex h-11 w-11 items-center justify-center text-xl text-ui-ink2 disabled:opacity-35'
const step = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number)
  return toDateStr(new Date(y, m - 1 + n, 1)).slice(0, 7)
}

/** Replaces the range and end-date controls on a month report. Forward stops at the current month. */
export function MonthNav({ month, todayCob, onChange }: MonthNavProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const current = month >= todayCob.slice(0, 7)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center">
        <button type="button" aria-label={t('today.prevMonth')} onClick={() => onChange(step(month, -1))} className={ARROW}>‹</button>
        <span className="text-base font-extrabold text-ui-ink">{monthName(month, locale)}</span>
        <button type="button" aria-label={t('today.nextMonth')} disabled={current} onClick={() => onChange(step(month, 1))} className={ARROW}>›</button>
      </div>
      {current && <span className="pr-1.5 text-[13px] font-semibold text-ui-muted">{t('insights.upToToday', { date: formatDay(todayCob, locale) })}</span>}
    </div>
  )
}
