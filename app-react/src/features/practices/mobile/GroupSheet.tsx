import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PracticeGroup } from '../../../types/api'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { BTN, CARD, FIELD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { SheetHeader } from '../../yatras/settings/mobile/fields'
import { isDuplicate, NAME_MAX } from '../usePractices'

const LABEL = 'text-[13px] font-bold text-ui-muted'
const SPINNER = 'h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent'

/** Names a new group, or renames one and offers Delete. The default group never opens here. */
export function GroupSheet({ group, count = 0, others, busy, onSave, onClose, onDelete, panel }: {
  /** Absent: a new group. */
  group?: PracticeGroup
  /** Edit: how many practices Delete would move. */
  count?: number
  /** Every other group, so a taken name is caught before saving. */
  others: PracticeGroup[]
  busy: boolean
  /** Resolves when saved; rejects with the server's error. */
  onSave: (name: string) => Promise<unknown>
  onClose: () => void
  onDelete?: () => void
  /** Tablet and desktop: a panel beside the list instead of a sheet. */
  panel?: boolean
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(group?.name ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [takenName, setTakenName] = useState<string | null>(null)

  const trimmed = name.trim()
  const taken = others.some((g) => !g.is_default && g.name === trimmed) || (!!trimmed && trimmed === takenName)
  const nameError = taken ? t('practices.groupNameTaken', { name: trimmed }) : submitted && !trimmed ? t('practices.nameRequired') : null
  const target = t('today.group')

  async function save() {
    setSubmitted(true)
    if (!trimmed || taken) return
    try {
      await onSave(trimmed)
    } catch (e) {
      if (isDuplicate(e)) setTakenName(trimmed)
    }
  }

  const title = group ? group.name : t('practices.newGroup')
  const saveButton = (
    <button type="button" onClick={() => void save()} disabled={busy} aria-busy={busy}
      className={`${BTN} gap-2 bg-ui-accent-fill text-ui-ink disabled:opacity-70 ${panel ? 'px-5' : 'w-full'}`}>
      {busy && <span aria-hidden className={SPINNER} />}
      {busy ? t('practices.saving') : t(group ? 'practices.saveChanges' : 'practices.createGroup')}
    </button>
  )
  const form = (
    <div className="flex flex-col gap-[18px]" aria-busy={busy}>
      {!panel && <SheetHeader title={title} onClose={onClose} />}
      {!panel && !group && <p className="-mt-[18px] text-sm text-ui-muted">{t('practices.newGroupHint')}</p>}
      {panel && !group && <p className={HINT}>{t('practices.newGroupHint')}</p>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="group-name" className={LABEL}>{t('practices.name')}</label>
        <div className="relative">
          <input id="group-name" value={name} maxLength={NAME_MAX} autoComplete="off" aria-invalid={!!nameError}
            aria-describedby={nameError ? 'group-name-error' : undefined} onChange={(e) => setName(e.target.value)}
            className={`${FIELD} pr-20`} />
          <span aria-hidden className={`absolute top-1/2 right-3.5 -translate-y-1/2 font-ui-mono text-xs ${nameError ? 'text-ui-danger' : 'text-ui-muted'}`}>
            {name.length} / {NAME_MAX}
          </span>
        </div>
        {nameError && <p id="group-name-error" role="alert" className="text-xs font-semibold text-ui-danger">{nameError}</p>}
      </div>

      {group && onDelete && (
        <div className={`${CARD} flex items-center gap-3 p-4`}>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold text-ui-danger">{t('practices.deleteGroup')}</span>
            <span className={HINT}>{t('practices.deleteGroupHint', { count, target })}</span>
          </div>
          <button type="button" onClick={onDelete}
            className="min-h-9 shrink-0 rounded-[10px] border border-ui-danger/40 bg-ui-surface px-3.5 text-sm font-bold text-ui-danger">
            {t('practices.deleteEllipsis')}
          </button>
        </div>
      )}
    </div>
  )

  if (!panel) return <BottomSheet label={title} onClose={onClose} footer={saveButton}>{form}</BottomSheet>
  return (
    <section aria-label={title} className="flex h-full flex-col">
      <header className="flex items-start gap-3 border-b border-ui-hairline px-6 pt-[calc(28px+env(safe-area-inset-top))] pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[.1em] text-ui-accent">{t(group ? 'practices.editGroup' : 'practices.newGroup')}</span>
          <h2 className="text-[22px] leading-tight font-extrabold break-words text-ui-ink">{title}</h2>
        </div>
        <button type="button" aria-label={t('yatraSettings.close')} onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-chip text-lg text-ui-muted">×</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{form}</div>
      <footer className="flex justify-end gap-2.5 border-t border-ui-hairline px-6 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <button type="button" onClick={onClose} className={`${BTN} border border-ui-control bg-ui-surface px-5 text-ui-ink`}>{t('common.cancel')}</button>
        {saveButton}
      </footer>
    </section>
  )
}
