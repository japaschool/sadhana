import { useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { Toggle } from '../../../ui/primitives/Toggle'
import { onRadioKeys, radioTabIndex } from '../../../ui/radioKeys'
import { addDays, toDateStr } from '../../today/date'
import { parseOptions } from '../../today/values'
import { BTN, CARD, FIELD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { SheetHeader } from '../../yatras/settings/mobile/fields'
import { TypeIcon } from '../../yatras/settings/mobile/TypeChip'
import { isDuplicate, LIST_MAX, NAME_MAX } from '../usePractices'
import type { PracticeDraft } from '../usePractices'

const TYPES: PracticeDataType[] = ['Int', 'Time', 'Duration', 'Bool', 'Text']
const LABEL = 'text-[13px] font-bold text-ui-muted'
const ERROR = 'text-xs font-semibold text-ui-danger'
const SPINNER = 'h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent'

/** Only numbers and text can be picked from a list on Today. */
const hasList = (type: PracticeDataType | null) => type === 'Int' || type === 'Text'

export function PracticeSheet({ practice, others, busy, onSave, onClose, onDelete, panel }: {
  /** Absent: a new practice. */
  practice?: UserPractice
  /** Every other practice, so a taken name is caught before saving. */
  others: UserPractice[]
  busy: boolean
  /** Resolves when saved; rejects with the server's error. */
  onSave: (d: PracticeDraft) => Promise<unknown>
  onClose: () => void
  onDelete?: () => void
  /** Tablet and desktop: a panel beside the list instead of a sheet. */
  panel?: boolean
}) {
  const { t } = useTranslation()
  const saved = parseOptions(practice?.dropdown_variants)
  // ?name= pre-fills a new practice (Import CSV's "+" on an unmatched column).
  const [params] = useSearchParams()
  const [name, setName] = useState(practice?.practice ?? params.get('name') ?? '')
  const [type, setType] = useState<PracticeDataType | null>(practice?.data_type ?? null)
  const [required, setRequired] = useState(!!practice?.is_required)
  // Hide and Show wait for Save, like every other field here.
  const [active, setActive] = useState(practice?.is_active ?? true)
  const [listOn, setListOn] = useState(saved.length > 0)
  const [values, setValues] = useState(saved)
  const [submitted, setSubmitted] = useState(false)
  const [takenName, setTakenName] = useState<string | null>(null)

  const trimmed = name.trim()
  const taken = others.some((p) => p.practice === trimmed) || (!!trimmed && trimmed === takenName)
  const nameError = taken ? t('practices.nameTaken', { name: trimmed }) : submitted && !trimmed ? t('practices.nameRequired') : null
  const typeError = submitted && !type ? t('practices.typeRequired') : null

  async function save() {
    setSubmitted(true)
    if (!trimmed || !type || taken) return
    const list = listOn && hasList(type) && values.length ? values.join(', ') : null
    try {
      await onSave({ practice: trimmed, data_type: type, is_active: active, is_required: required, dropdown_variants: list })
    } catch (e) {
      if (isDuplicate(e)) setTakenName(trimmed)
    }
  }

  const title = practice ? practice.practice : t('practices.newTitle')
  const saveButton = (
    <button type="button" onClick={() => void save()} disabled={busy} aria-busy={busy}
      className={`${BTN} gap-2 bg-ui-accent-fill text-ui-ink disabled:opacity-70 ${panel ? 'px-5' : 'w-full'}`}>
      {busy && <span aria-hidden className={SPINNER} />}
      {busy ? t('practices.saving') : t(practice ? 'practices.saveChanges' : 'practices.addButton')}
    </button>
  )
  const form = (
    <div className="flex flex-col gap-[18px]" aria-busy={busy}>
      {!panel && <SheetHeader title={title} onClose={onClose} />}
      {!panel && practice && <p className="-mt-[18px] text-sm text-ui-muted">{t('practices.editTitle')}</p>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="practice-name" className={LABEL}>{t('practices.name')}</label>
        <div className="relative">
          <input id="practice-name" value={name} maxLength={NAME_MAX} autoComplete="off" aria-invalid={!!nameError}
            aria-describedby={nameError ? 'practice-name-error' : undefined} onChange={(e) => setName(e.target.value)}
            className={`${FIELD} pr-20`} />
          <span aria-hidden className={`absolute top-1/2 right-3.5 -translate-y-1/2 font-ui-mono text-xs ${nameError ? 'text-ui-danger' : 'text-ui-muted'}`}>
            {name.length} / {NAME_MAX}
          </span>
        </div>
        {nameError && <p id="practice-name-error" role="alert" className={ERROR}>{nameError}</p>}
      </div>

      {practice ? <FixedType type={practice.data_type} /> : <TypePicker value={type} onChange={setType} error={typeError} />}

      {hasList(type) && (
        <ListCard on={listOn} onToggle={setListOn} values={values} onValues={setValues} numbers={type === 'Int'}
          name={trimmed || t('practices.thisPractice')} dropping={!!practice && saved.length > 0 && !listOn ? saved.length : 0} />
      )}

      <RequiredCard on={required} onToggle={setRequired} name={trimmed || t('practices.thisPractice')} />

      {practice && onDelete && (
        <section aria-labelledby="hide-or-delete" className="flex flex-col gap-2.5 border-t border-dashed border-ui-control pt-5">
          <h3 id="hide-or-delete" className="px-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{t('practices.hideOrDelete')}</h3>
          <div className={`${CARD} flex flex-col divide-y divide-ui-hairline`}>
            <DangerRow title={t(active ? 'practices.hideTitle' : 'practices.showTitle')}
              text={active === practice.is_active ? t(active ? 'practices.hideText' : 'practices.showText') : t(active ? 'practices.showOnSave' : 'practices.hideOnSave')}>
              <button type="button" onClick={() => setActive(!active)}
                className="min-h-9 rounded-[10px] border border-ui-control bg-ui-surface px-3.5 text-sm font-bold text-ui-ink">
                {t(active ? 'practices.hide' : 'practices.show')}
              </button>
            </DangerRow>
            <DangerRow title={t('practices.deleteTitle')} text={t('practices.deleteText')} danger>
              <button type="button" onClick={onDelete}
                className="min-h-9 rounded-[10px] border border-ui-danger/40 bg-ui-surface px-3.5 text-sm font-bold text-ui-danger">
                {t('practices.deleteEllipsis')}
              </button>
            </DangerRow>
          </div>
        </section>
      )}
    </div>
  )

  if (!panel) return <BottomSheet label={title} onClose={onClose} footer={saveButton}>{form}</BottomSheet>
  return (
    <section aria-label={title} className="flex h-full flex-col">
      <header className="flex items-start gap-3 border-b border-ui-hairline px-6 pt-[calc(28px+env(safe-area-inset-top))] pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[.1em] text-ui-accent">{t(practice ? 'practices.editTitle' : 'practices.newTitle')}</span>
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

/** Each type as it looks on Today. */
function Sample({ type }: { type: PracticeDataType }) {
  const { t } = useTranslation()
  const chip = 'rounded-lg bg-ui-chip px-2.5 py-1 font-ui-mono text-[15px] font-semibold text-ui-ink'
  if (type === 'Int') return <span className={chip}>16</span>
  if (type === 'Time') return <span className={chip}>04:30</span>
  if (type === 'Bool') return <span className="flex h-[26px] w-11 justify-end rounded-full bg-ui-accent-fill p-[3px]"><span className="h-5 w-5 rounded-full bg-ui-toggle-on-knob" /></span>
  if (type === 'Text') return <span className="w-[72px] rounded-lg border border-ui-control bg-ui-field px-2 py-1.5 text-xs text-ui-faint2">Aa…</span>
  return (
    <span className="flex items-center gap-2 font-ui-mono text-[15px] font-semibold text-ui-ink">
      45 {t('today.unitMin')}
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ui-accent-soft font-ui text-ui-accent">+</span>
    </span>
  )
}

function TypePicker({ value, onChange, error }: { value: PracticeDataType | null; onChange: (t: PracticeDataType) => void; error: string | null }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <div>
        <span id="practice-type" className={LABEL}>{t('practices.type')}</span>
        <p className="text-[13px] text-ui-ink2">{t('practices.typeCareful')}</p>
      </div>
      <div role="radiogroup" aria-labelledby="practice-type" aria-invalid={!!error}
        className={`flex flex-col divide-y divide-ui-hairline overflow-hidden rounded-[18px] border bg-ui-surface ${error ? 'border-ui-danger' : 'border-ui-hairline'}`}
        onKeyDown={(e) => onRadioKeys(e, TYPES, value ?? TYPES[0], onChange)}>
        {TYPES.map((ty) => {
          const on = value === ty
          return (
            <button key={ty} type="button" role="radio" aria-checked={on} tabIndex={value ? radioTabIndex(TYPES, value, ty) : ty === TYPES[0] ? 0 : -1}
              onClick={() => onChange(ty)} className={`flex min-h-16 items-center gap-3 px-3.5 py-2.5 text-left ${on ? 'bg-ui-accent-soft' : ''}`}>
              <span aria-hidden className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-ui-accent-fill' : 'border-ui-faint'}`}>
                {on && <span className="h-2.5 w-2.5 rounded-full bg-ui-accent-fill" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-base font-bold text-ui-ink"><TypeIcon type={ty} />{t(`practices.type${ty}`)}</span>
                <span className="text-xs text-ui-muted">{t(`practices.typeDesc${ty}`)}</span>
              </span>
              <span aria-hidden className="shrink-0"><Sample type={ty} /></span>
            </button>
          )
        })}
      </div>
      {error && <p role="alert" className={`flex items-center gap-1.5 ${ERROR}`}><span className="h-1.5 w-1.5 rounded-full bg-ui-danger" />{error}</p>}
    </div>
  )
}

function FixedType({ type }: { type: PracticeDataType }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL}>{t('practices.type')}</span>
      <div className="flex items-center gap-3 rounded-[14px] border border-ui-hairline bg-ui-field px-3.5 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ui-chip text-ui-ink2"><TypeIcon type={type} /></span>
        <span className="flex min-w-0 flex-col">
          <span className="text-base font-bold text-ui-ink">{t(`practices.type${type}`)}</span>
          <span className="text-xs text-ui-muted">{t('practices.typeFixed')}</span>
        </span>
      </div>
    </div>
  )
}

function ToggleCard({ title, hint, on, onToggle, children }: { title: string; hint: string; on: boolean; onToggle: (v: boolean) => void; children?: ReactNode }) {
  return (
    <section className={`${CARD} flex flex-col gap-3 p-4`}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-[17px] font-extrabold text-ui-ink">{title}</h3>
          <p className={HINT}>{hint}</p>
        </div>
        <Toggle label={title} checked={on} onChange={onToggle} />
      </div>
      {children}
    </section>
  )
}

function ListCard({ on, onToggle, values, onValues, numbers, name, dropping }: {
  on: boolean; onToggle: (v: boolean) => void; values: string[]; onValues: (v: string[]) => void
  numbers: boolean; name: string
  /** Edit: saved values that Save will remove now the list is off. */
  dropping: number
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const length = values.join(', ').length
  const add = (raw: string) => {
    const next = raw.split(/[,\n]/).map((s) => s.trim())
      .filter((s) => s && !values.includes(s) && (!numbers || Number.isFinite(Number(s))))
    const all = [...values, ...new Set(next)]
    if (all.join(', ').length <= LIST_MAX) onValues(all)
    setDraft('')
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); add(draft) }
    else if (e.key === 'Backspace' && !draft && values.length) onValues(values.slice(0, -1))
  }
  return (
    <ToggleCard title={t('practices.listTitle')} hint={t('practices.listHint')} on={on} onToggle={onToggle}>
      {dropping > 0 && (
        <p role="status" className="flex gap-2 rounded-xl bg-ui-danger/10 px-3.5 py-2.5 text-[13px] text-ui-ink2">
          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ui-danger" />{t('practices.listDropping', { count: dropping })}
        </p>
      )}
      {on && (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-ui-control bg-ui-surface p-2 focus-within:border-ui-accent">
            {values.map((v) => (
              <span key={v} className="flex items-center gap-1 rounded-full bg-ui-chip py-1.5 pr-2 pl-3 text-sm font-bold text-ui-ink">
                {v}
                <button type="button" aria-label={t('practices.removeValue', { value: v })} onClick={() => onValues(values.filter((x) => x !== v))}
                  className="flex h-5 w-5 items-center justify-center text-ui-muted">×</button>
              </span>
            ))}
            <input value={draft} aria-label={t('practices.addValue')} placeholder={t('practices.addValuePlaceholder')} inputMode={numbers ? 'decimal' : undefined}
              onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setDraft(e.target.value))}
              onKeyDown={onKeyDown} onBlur={() => draft.trim() && add(draft)}
              className="min-h-8 min-w-24 flex-1 bg-transparent px-1.5 text-sm text-ui-ink outline-none placeholder:text-ui-muted" />
          </div>
          <p className="text-xs text-ui-muted">{t('practices.listCount', { n: length, max: LIST_MAX })}</p>
          {values.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{t('practices.onToday')}</span>
              <label className="flex min-h-[50px] items-center justify-between gap-3 rounded-[14px] border border-ui-hairline bg-ui-surface px-3.5">
                <span className="min-w-0 truncate text-[15px] font-medium text-ui-ink">{name}</span>
                <select className="max-w-[50%] bg-transparent text-right text-[15px] font-semibold text-ui-ink outline-none">
                  {values.map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
            </div>
          )}
        </>
      )}
    </ToggleCard>
  )
}

function RequiredCard({ on, onToggle, name }: { on: boolean; onToggle: (v: boolean) => void; name: string }) {
  const { t } = useTranslation()
  const today = new Date()
  const days = [-3, -2, -1, 0].map((n) => addDays(today, n))
  return (
    <ToggleCard title={t('practices.required')} hint={t('practices.requiredHint', { name })} on={on} onToggle={onToggle}>
      <div aria-hidden className="flex gap-2">
        {days.map((d, i) => (
          <span key={toDateStr(d)} className="flex flex-col items-center gap-[3px]">
            <span className={`flex h-[34px] w-[38px] items-center justify-center rounded-[10px] font-ui-mono text-sm ${i === 3 ? 'bg-ui-selected font-semibold text-ui-on-selected' : 'bg-ui-chip text-ui-ink2'}`}>
              {d.getDate()}
            </span>
            {/* Like the calendar: a missed day's dot sits under its date. */}
            <span className={`h-[5px] w-[5px] rounded-full ${on && i === 1 ? 'bg-ui-danger' : ''}`} />
          </span>
        ))}
      </div>
    </ToggleCard>
  )
}

function DangerRow({ title, text, danger, children }: { title: string; text: string; danger?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-[15px] font-bold ${danger ? 'text-ui-danger' : 'text-ui-ink'}`}>{title}</span>
        <span className={HINT}>{text}</span>
      </div>
      {children}
    </div>
  )
}
