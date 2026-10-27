import { useTranslation } from 'react-i18next'
import type { TodaySummary } from '../useToday'
import { capitalize } from '../values'

interface DateHeaderProps { date: Date; summary: TodaySummary; onOpenCalendar: (anchor: HTMLElement) => void; dayLoading?: boolean }

export function DateHeader({ date, summary, onOpenCalendar, dayLoading }: DateHeaderProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const title = capitalize(new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'long' }).format(date), locale)
  const line = t('today.filledOf', { filled: summary.filled, total: summary.total })
    + (summary.requiredLeft ? ` · ${t('today.requiredLeft', { count: summary.requiredLeft })}` : '')
  return (
    <button type="button" aria-haspopup="dialog" title={t('today.openCalendar')} onClick={(e) => onOpenCalendar(e.currentTarget)}
      className="flex flex-col gap-px text-left">
      <span className="flex items-center gap-1.5 text-xl font-extrabold tracking-[-0.01em]">
        <span>{title}</span>
        <span aria-hidden className="-mt-1 ml-1 h-[7px] w-[7px] rotate-45 border-r-2 border-b-2 border-ui-accent" />
      </span>
      <span aria-busy={dayLoading || undefined} className={`text-xs text-ui-muted transition-opacity ${dayLoading ? 'opacity-40' : ''}`}>{line}</span>
    </button>
  )
}
