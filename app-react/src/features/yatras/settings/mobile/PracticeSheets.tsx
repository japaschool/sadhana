import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PracticeDataType, YatraPractice } from '../../../../types/api'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import { BTN, FIELD, HINT } from './AdminPage'
import { AutosaveText, ConfirmSheet, SheetHeader } from './fields'
import { practiceNameError } from './summaries'
import { TypeIcon, typeLabelKey } from './TypeChip'

const TYPES: { type: PracticeDataType; example: string }[] = [
  { type: 'Int', example: '16' }, { type: 'Bool', example: '' }, { type: 'Time', example: '05:30' },
  { type: 'Duration', example: '1:30' }, { type: 'Text', example: 'Aa' },
]

export function AddPracticeSheet({ others, busy, onAdd, onClose }: {
  others: YatraPractice[]; busy: boolean; onAdd: (name: string, type: PracticeDataType) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [type, setType] = useState<PracticeDataType>('Int')
  const title = t('yatraSettings.newPractice')
  const error = name.trim() ? practiceNameError(t, name, others) : null
  return (
    <BottomSheet label={title} onClose={onClose}>
      <SheetHeader title={title} onClose={onClose} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-practice" className="text-[13px] font-bold text-ui-muted">{t('yatraSettings.name')}</label>
        <input id="new-practice" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!error} className={FIELD} />
        {error && <p role="alert" className="text-xs font-semibold text-ui-danger">{error}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <span id="new-practice-kind" className="text-[13px] font-bold text-ui-muted">{t('yatraSettings.whatKind')}</span>
        <div role="radiogroup" aria-labelledby="new-practice-kind" className="flex flex-col gap-2">
          {TYPES.map(({ type: ty, example }) => (
            <button key={ty} type="button" role="radio" aria-checked={type === ty} onClick={() => setType(ty)}
              className={`flex min-h-14 items-center gap-3 rounded-[14px] border bg-ui-surface px-3.5 py-2 text-left ${type === ty ? 'border-ui-ink' : 'border-ui-control'}`}>
              <TypeIcon type={ty} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-bold text-ui-ink">{t(typeLabelKey(ty))}</span>
                <span className="text-xs text-ui-muted">{t(`yatraSettings.typeDesc${ty}`)}</span>
              </span>
              <span className="shrink-0 font-ui-mono text-sm text-ui-muted">{ty === 'Bool' ? t('yatraSettings.exampleYes') : example}</span>
            </button>
          ))}
        </div>
      </div>
      <p className={HINT}>{t('yatraSettings.typeFixed')}</p>
      <button type="button" disabled={!name.trim() || !!error || busy} onClick={() => onAdd(name.trim(), type)}
        className={`${BTN} bg-ui-primary text-ui-on-primary disabled:opacity-50`}>
        {t('yatraSettings.addPracticeButton')}
      </button>
    </BottomSheet>
  )
}

export function RenamePracticeSheet({ practice, others, onRename, onClose }: {
  practice: YatraPractice; others: YatraPractice[]; onRename: (name: string) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const title = t('yatraSettings.renameTitle')
  return (
    <BottomSheet label={title} onClose={onClose}>
      <SheetHeader title={title} onClose={onClose} />
      <AutosaveText id="rename-practice" label={t('yatraSettings.name')} value={practice.practice}
        validate={(v) => practiceNameError(t, v, others)} onCommit={(v) => onRename(v.trim())} />
      <button type="button" onClick={onClose} className={`${BTN} bg-ui-primary text-ui-on-primary`}>{t('yatraSettings.done')}</button>
    </BottomSheet>
  )
}

export function DeletePracticeSheet({ practice, statCount, busy, onConfirm, onClose }: {
  practice: YatraPractice; statCount: number; busy: boolean; onConfirm: () => void; onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <ConfirmSheet title={t('yatraSettings.deletePracticeTitle', { name: practice.practice })}
      text={statCount ? t('yatraSettings.deletePracticeText', { count: statCount }) : t('yatraSettings.deletePracticeTextNoStats')}
      confirm={t('yatraSettings.deletePractice')} busy={busy} onConfirm={onConfirm} onClose={onClose} />
  )
}
