import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SleepRows } from '../../../api/charts'
import type { UserPractice } from '../../../types/api'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { BTN, FIELD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { SheetHeader } from '../../yatras/settings/mobile/fields'

const LABEL = 'text-xs font-bold text-ui-muted'

/** Asks once which two Time practices are bedtime and wake-up, so Sleep can be worked out (16m15). */
export function SleepSetupSheet({ practices, current, onSave, onSkip, onClose }: {
  /** Active Time practices. Only a saved pair is preselected: no guessed pair. */
  practices: UserPractice[]; current?: SleepRows | null; onSave: (rows: SleepRows) => void; onSkip: () => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const [bedtime, setBedtime] = useState(current?.bedtime ?? '')
  const [wake, setWake] = useState(current?.wake ?? '')
  const title = t('insights.overview.sleepTitle')
  const picker = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <select id={id} value={value} onChange={(e) => set(e.target.value)} aria-describedby={`${id}-hint`} className={`${FIELD} font-semibold`}>
        <option value="" disabled>{t('insights.overview.choose')}</option>
        {practices.map((p) => <option key={p.id} value={p.id}>{p.practice}</option>)}
      </select>
      <p id={`${id}-hint`} className="text-xs text-ui-muted">{t('insights.overview.timePractice')}</p>
    </div>
  )
  return (
    <BottomSheet label={title} onClose={onClose}>
      <div className="flex flex-col gap-1">
        <SheetHeader title={title} onClose={onClose} />
        <p className="text-sm leading-[1.45] text-ui-muted">{t('insights.overview.sleepText')}</p>
      </div>
      {picker('sleep-bedtime', t('insights.overview.bedtime'), bedtime, setBedtime)}
      {picker('sleep-wake', t('insights.overview.wake'), wake, setWake)}
      <div className="flex flex-col gap-1.5">
        <button type="button" disabled={!bedtime || !wake || bedtime === wake} onClick={() => onSave({ bedtime, wake, nap: current?.nap ?? null })}
          className={`${BTN} bg-ui-accent-fill text-ui-ink disabled:opacity-50`}>{t('common.save')}</button>
        <button type="button" onClick={onSkip} className={`${BTN} text-ui-accent`}>{t('insights.overview.skip')}</button>
      </div>
      <p className={`${HINT} text-center text-xs`}>{t('insights.overview.skipHint')}</p>
    </BottomSheet>
  )
}
