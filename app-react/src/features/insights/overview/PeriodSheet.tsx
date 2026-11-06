import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDeletePeriod, useSavePeriod, type MarkedPeriod, type MarkedPeriodForm } from '../../../api/markedPeriods'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { Toggle } from '../../../ui/primitives/Toggle'
import { CalendarSheet } from '../../today/mobile/CalendarSheet'
import { fromDateStr, toDateStr } from '../../today/date'
import { formatDay } from '../insightsLogic'
import { BTN, FIELD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { ConfirmSheet, SheetHeader } from '../../yatras/settings/mobile/fields'

export const NAME_MAX = 100
const LABEL = 'text-[13px] font-bold text-ui-muted'

/** New or edit a marked period (16m10). `focusEnd` opens with End focused, for "It ended on…". */
export function PeriodSheet({ period, prefill, focusEnd, onClose, onSaved }: {
  period?: MarkedPeriod; prefill?: Partial<MarkedPeriodForm>; focusEnd?: boolean; onClose: () => void
  /** After a successful save, before closing. */
  onSaved?: (form: MarkedPeriodForm) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const save = useSavePeriod()
  const remove = useDeletePeriod()
  const init = { ...prefill, ...period }
  const [name, setName] = useState(init.name ?? '')
  const [start, setStart] = useState(init.start_date ?? toDateStr(new Date()))
  const [end, setEnd] = useState(init.end_date ?? '')
  const [exclude, setExclude] = useState(init.exclude_from_usual ?? true)
  const [failed, setFailed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [picking, setPicking] = useState<'start' | 'end' | null>(null)
  const endRef = useRef<HTMLButtonElement>(null)

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
        <button type="button" disabled={busy} onClick={() => setConfirming(true)}
          className={`${BTN} w-full text-ui-danger disabled:opacity-50`}>{t('common.delete')}</button>
      )}
    </div>
  )

  return (
    <>
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
          <button id="period-start" type="button" onClick={() => setPicking('start')} className={`${FIELD} text-left`}>
            {formatDay(start, locale, true)}
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="period-end" className={LABEL}>{t('insights.overview.end')}</label>
            {!end && <span className="text-[13px] font-semibold text-ui-ink2">{t('insights.overview.stillGoingValue')}</span>}
          </div>
          <div className="flex gap-2">
            <button id="period-end" ref={endRef} type="button" onClick={() => setPicking('end')}
              aria-invalid={!!end && end < start} aria-describedby="period-end-hint" className={`${FIELD} min-w-0 flex-1 text-left`}>
              {end ? formatDay(end, locale, true) : <span className="text-ui-faint2">—</span>}
            </button>
            {end && (
              <button type="button" aria-label={t('templateForm.clear', { label: t('insights.overview.end') })} onClick={() => setEnd('')}
                className="min-h-12 w-12 shrink-0 rounded-xl border border-ui-control bg-ui-surface text-center text-base text-ui-ink outline-none focus:border-ui-accent">×</button>
            )}
          </div>
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
      {picking && (
        <CalendarSheet date={fromDateStr(picking === 'start' ? start : end || start)} onClose={() => setPicking(null)}
          disabled={picking === 'end' ? (d) => toDateStr(d) < start : () => false}
          onSelect={(d) => (picking === 'start' ? setStart : setEnd)(toDateStr(d))} />
      )}
      {period && confirming && (
        <ConfirmSheet title={t('insights.periods.deleteTitle', { name: period.name })} text={t('insights.periods.deleteText')}
          confirm={t('common.delete')} busy={remove.isPending} onClose={() => setConfirming(false)}
          onConfirm={() => { setFailed(false); remove.mutate(period.id, { onSuccess: onClose, onError: () => { setConfirming(false); setFailed(true) } }) }} />
      )}
    </>
  )
}
