import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarSheet } from '../../today/mobile/CalendarSheet'
import { toDateStr } from '../../today/date'
import { formatDay } from '../insightsLogic'

interface EndDateControlProps { end: Date | null; onChange: (d: Date | null) => void }

export function EndDateControl({ end, onChange }: EndDateControlProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      {end ? (
        <span className="flex shrink-0 items-center rounded-full bg-ui-accent-pill text-[13px] font-bold text-ui-accent">
          <button type="button" onClick={() => setOpen(true)} className="min-h-9 pr-1 pl-3">
            {t('insights.endingOn', { date: formatDay(toDateStr(end), i18n.language || 'en') })}
          </button>
          <button type="button" aria-label={t('insights.resetEnd')} onClick={() => onChange(null)}
            className="flex h-9 w-9 items-center justify-center text-base">×</button>
        </span>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="flex min-h-9 shrink-0 items-center gap-1 text-[13px] font-bold text-ui-muted">
          {t('insights.endingToday')} <span aria-hidden>⌄</span>
        </button>
      )}
      {open && <CalendarSheet date={end ?? new Date()} onSelect={onChange} onClose={() => setOpen(false)} />}
    </>
  )
}
