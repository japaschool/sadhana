import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { ListGroup } from '../../../ui/primitives/ListGroup'
import { fromDateStr } from '../../today/date'
import { PracticeRow } from '../../today/mobile/PracticeRow'
import { DayFailedNote } from '../../today/SyncBanner'
import { useToday } from '../../today/useToday'

interface DaySheetProps { cob: string; names: string[]; onClose: () => void }

/** One day of a table report, editable like the Log screen. Shows the report's practices only. */
export function DaySheet({ cob, names, onClose }: DaySheetProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const date = fromDateStr(cob)
  const today = useToday(date)
  const loading = today.isLoading || today.dayLoading
  const practices = names.flatMap((n) => today.practices.filter((p) => p.practice === n))
  const missing = practices.filter((p) => p.is_required && today.values[p.practice] === undefined).length

  return (
    <BottomSheet label={new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date)} onClose={onClose}>
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="font-ui-mono text-[11px] font-semibold tracking-[.08em] text-ui-faint uppercase">
          {new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)}
        </span>
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-ui-ink">
          {new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date)}
        </h2>
        {!loading && missing > 0 && (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ui-danger">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ui-danger" />
            {t('today.requiredLeft', { count: missing })}
          </span>
        )}
      </div>
      {loading ? (
        <span role="status" aria-label={t('common.loading')}
          className="h-6 w-6 animate-spin self-center rounded-full border-2 border-ui-control border-t-ui-accent" />
      ) : today.isError ? (
        <p role="alert" className="text-sm text-ui-danger">{t('common.error')}</p>
      ) : (
        <>
          {today.dayFailed && <DayFailedNote />}
          <ListGroup label={t('today.group')}>
            {practices.map((p) => (
              <PracticeRow key={p.id} practice={p} value={today.values[p.practice]}
                failed={today.failed === p.practice} onSave={(v) => today.save(p, v)} />
            ))}
          </ListGroup>
        </>
      )}
    </BottomSheet>
  )
}
