import { useTranslation } from 'react-i18next'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { HINT } from '../../yatras/settings/mobile/AdminPage'
import { TypeIcon, typeLabelKey } from '../../yatras/settings/mobile/TypeChip'
import { pickerGroups, type Slot } from './templates'

const GROUP = 'px-3 pt-2.5 pb-0.5 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted'

function Dot({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-ui-accent-fill' : 'border-ui-faint2'}`}>
      {on && <span className="h-2.5 w-2.5 rounded-full bg-ui-accent-fill" />}
    </span>
  )
}

/** Compatible active practices to pick from, and the others with why they can't be used (15m3). */
export function SlotPickerSheet({ slot, value, suggested, practices, onPick, onClose }: {
  slot: Slot; value: string | null; suggested: UserPractice | null; practices: UserPractice[]
  onPick: (id: string | null) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const { compatible, cant } = pickerGroups(slot, practices)
  const type: PracticeDataType = slot.types[0]
  const label = t(`templateForm.${slot.key}`)
  return (
    <BottomSheet label={label} onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-extrabold tracking-[-0.01em] text-ui-ink">{label}</h2>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ui-muted">
            <TypeIcon type={type} />{t(`templateForm.only${type}`)}
          </p>
        </div>
        <button type="button" aria-label={t('yatraSettings.close')} onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-chip text-lg text-ui-muted">×</button>
      </div>
      <div role="radiogroup" aria-label={label} className="-mx-3 flex flex-col gap-0.5">
        <h3 className={GROUP}>{t(typeLabelKey(type))}</h3>
        {compatible.map((p) => {
          const on = p.id === value
          const hint = p.id === suggested?.id
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => onPick(p.id)}
              className={`flex min-h-[58px] items-center gap-3 rounded-[14px] px-3 py-1.5 text-left ${on ? 'bg-ui-accent-soft' : ''}`}>
              <Dot on={on} />
              <span className="text-ui-ink2"><TypeIcon type={p.data_type} /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-bold text-ui-ink">{p.practice}</span>
                {hint && <span className="text-xs font-semibold text-ui-accent">{t('templateForm.suggested')}</span>}
              </span>
            </button>
          )
        })}
        {!slot.required && (
          <button type="button" role="radio" aria-checked={!compatible.some((p) => p.id === value)} onClick={() => onPick(null)}
            className="flex min-h-12 items-center gap-3 rounded-[14px] px-3 py-1.5 text-left">
            <Dot on={!compatible.some((p) => p.id === value)} />
            <span className="text-[15px] font-bold text-ui-ink">{t(`templateForm.no_${slot.key}`)}</span>
          </button>
        )}
        {cant.length > 0 && <h3 className={GROUP}>{t(`templateForm.cant_${slot.key}`)}</h3>}
        {cant.map(({ practice: p }) => (
          <div key={p.id} className="flex min-h-12 items-center gap-3 px-3 py-1.5">
            <span className="text-ui-faint2"><TypeIcon type={p.data_type} /></span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-bold text-ui-faint">{p.practice}</span>
              <span className="text-xs leading-snug font-semibold text-ui-muted">{t(typeLabelKey(p.data_type))} · {t(`templateForm.why_${slot.key}`)}</span>
            </span>
          </div>
        ))}
      </div>
      <p className={HINT}>{t('templateForm.hiddenNote')}</p>
    </BottomSheet>
  )
}
