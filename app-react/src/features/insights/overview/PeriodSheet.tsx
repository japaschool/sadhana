import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDeletePeriod, useSavePeriod, type MarkedPeriod, type MarkedPeriodForm } from '../../../api/markedPeriods'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { Toggle } from '../../../ui/primitives/Toggle'
import { toDateStr } from '../../today/date'
import { BTN, FIELD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { SheetHeader } from '../../yatras/settings/mobile/fields'

export const NAME_MAX = 100
const LABEL = 'text-[13px] font-bold text-ui-muted'

/** New or edit a marked period (16m10). `focusEnd` opens with End focused, for "It ended on…". */
export function PeriodSheet({ period, prefill, focusEnd, onClose, onSaved }: {
  period?: MarkedPeriod; prefill?: Partial<MarkedPeriodForm>; focusEnd?: boolean; onClose: () => void
  /** After a successful save, before closing. */
  onSaved?: (form: MarkedPeriodForm) => void
}) {
  const { t } = useTranslation()
  const save = useSavePeriod()
  const remove = useDeletePeriod()
  const init = { ...prefill, ...period }
  const [name, setName] = useState(init.name ?? '')
  const [start, setStart] = useState(init.start_date ?? toDateStr(new Date()))
  const [end, setEnd] = useState(init.end_date ?? '')
  const [exclude, setExclude] = useState(init.exclude_from_usual ?? true)
  const [failed, setFailed] = useState(false)
  const endRef = useRef<HTMLInputElement>(null)

  // After BottomSheet focuses itself: a parent's effect runs after its children's.
  useEffect(() => { if (focusEnd) endRef.current?.focus() }, [focusEnd])

  const trimmed = name.trim()
  const valid = !!trimmed && !!start && (!end || end >= start)
  const busy = save.isPending || remove.isPending
  const done = { onSuccess: onClose, onError: () => setFailed(true) }

  function submit() {
    if (!valid) return
    setFailed(false)
    const form = { name: trimmed, start_date: start, end_date: end || null, exclude_from_usual: exclude }
    save.mutate({ id: period?.id, form }, { ...done, onSuccess: () => { onSaved?.(form); onClose() } })
  }

  const title = period ? period.name : t('insights.overview.newPeriod')
  const footer = (
    <div className="flex flex-col gap-2.5">
      {failed && <p role="alert" className="text-center text-xs font-semibold text-ui-danger">{t('common.error')}</p>}
      <button type="button" onClick={submit} disabled={!valid || busy} aria-busy={save.isPending}
        className={`${BTN} w-full bg-ui-accent-fill text-ui-ink disabled:opacity-50`}>{t('insights.overview.savePeriod')}</button>
      {period && (
        <button type="button" disabled={busy} onClick={() => { setFailed(false); remove.mutate(period.id, done) }}
          className={`${BTN} w-full text-ui-danger disabled:opacity-50`}>{t('common.delete')}</button>
      )}
    </div>
  )

  return (
    <BottomSheet label={title} onClose={onClose} footer={footer}>
      <SheetHeader title={title} onClose={onClose} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="period-name" className={LABEL}>{t('insights.overview.name')}</label>
        <input id="period-name" value={name} maxLength={NAME_MAX} autoComplete="off" onChange={(e) => setName(e.target.value)}
          aria-describedby="period-name-hint" className={FIELD} />
        <p id="period-name-hint" className={HINT}>{t('insights.overview.nameHint')}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="period-start" className={LABEL}>{t('insights.overview.start')}</label>
        <input id="period-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={FIELD} />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="period-end" className={LABEL}>{t('insights.overview.end')}</label>
          {!end && <span className="text-[13px] font-semibold text-ui-ink2">{t('insights.overview.stillGoingValue')}</span>}
        </div>
        <input id="period-end" ref={endRef} type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)}
          aria-invalid={!!end && end < start} aria-describedby="period-end-hint" className={FIELD} />
        <p id="period-end-hint" className={HINT}>{t('insights.overview.endHint')}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold text-ui-ink">{t('insights.overview.leaveOut')}</span>
          <span id="period-exclude-hint" className={HINT}>{t('insights.overview.leaveOutHint')}</span>
        </div>
        <Toggle checked={exclude} onChange={setExclude} label={t('insights.overview.leaveOut')} describedBy="period-exclude-hint" />
      </div>
    </BottomSheet>
  )
}
