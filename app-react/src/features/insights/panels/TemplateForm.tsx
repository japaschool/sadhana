import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PanelsReport } from '../../../api/charts'
import type { UserPractice } from '../../../types/api'
import { CARD, FIELD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { TypeIcon, typeLabelKey } from '../../yatras/settings/mobile/TypeChip'
import { useDebouncedCommit } from '../../yatras/settings/useDebouncedCommit'
import { SlotPickerSheet } from './SlotPickerSheet'
import { fits, SLEEP_DEFAULTS, SLEEP_SLOTS, sleepPanels, suggestFor, type Slot } from './templates'

export type TemplateDraft = { kind: 'Sleep'; bedtime: string | null; wake: string | null; nap: string | null; min: number | null; max: number | null }
type SlotKey = 'bedtime' | 'wake' | 'nap'
const keyOf = (s: Slot) => s.key as SlotKey

export const newSleepDraft = (): TemplateDraft => ({ kind: 'Sleep', bedtime: null, wake: null, nap: null, ...SLEEP_DEFAULTS })

export function draftProblem(d: TemplateDraft): 'required' | 'minMax' | null {
  if (!d.bedtime || !d.wake) return 'required'
  return d.min !== null && d.max !== null && d.min > d.max ? 'minMax' : null
}

export function draftToDefinition(d: TemplateDraft): { Panels: PanelsReport } | null {
  if (draftProblem(d)) return null
  return { Panels: sleepPanels({ bedtime: d.bedtime!, wake: d.wake!, nap: d.nap, min: d.min, max: d.max }) }
}

/**
 * The form's view of a saved report; `practices` must have loaded. A required practice that can't be used loads empty,
 * so it shows as missing and holds saves back. The optional nap keeps its id, so a limit change still saves.
 */
export function draftOf(def: PanelsReport, practices: UserPractice[]): TemplateDraft | null {
  const sleep = def.template?.Sleep
  if (!sleep) return null
  const usable = (slot: Slot) => practices.some((p) => p.id === sleep[keyOf(slot)] && fits(slot, p))
  const [bedtime, wake] = SLEEP_SLOTS
  return { kind: 'Sleep', ...sleep, bedtime: usable(bedtime) ? sleep.bedtime : null, wake: usable(wake) ? sleep.wake : null }
}

/** Empty is no limit; `6` is 6:00. */
function parseLimit(text: string): number | null | 'invalid' {
  const s = text.trim()
  if (!s) return null
  const hm = /^(\d{1,2})(?::([0-5]\d))?$/.exec(s)
  return hm ? Number(hm[1]) * 60 + Number(hm[2] ?? 0) : 'invalid'
}
const limitText = (v: number | null) => (v === null ? '' : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`)

const GROUP = 'px-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted'

function LimitField({ id, label, placeholder, value, onChange }: {
  id: string; label: string; placeholder: string; value: number | null; onChange: (v: number | null) => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(limitText(value))
  const [focused, setFocused] = useState(false)
  const [seen, setSeen] = useState(value)
  // Follow outside changes (Undo), but never over what's being typed.
  if (value !== seen) {
    setSeen(value)
    if (!focused) setText(limitText(value))
  }
  const parsed = parseLimit(text)
  const { schedule, flush } = useDebouncedCommit(() => {
    if (parsed !== 'invalid' && parsed !== value) onChange(parsed)
  })
  const bad = parsed === 'invalid' && !focused
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs leading-snug font-bold text-ui-muted">{label}</label>
      <div className="relative">
        <input id={id} value={text} placeholder={placeholder} inputMode="numeric" autoComplete="off" aria-invalid={bad}
          className={`${FIELD} pr-11 font-ui-mono placeholder:font-[Manrope] placeholder:text-[15px] placeholder:font-semibold`}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); flush() }}
          onChange={(e) => { setText(e.target.value); schedule() }} />
        {text && (
          <button type="button" aria-label={t('templateForm.clear', { label })} onClick={() => { setText(''); onChange(null) }}
            className="absolute inset-y-0 right-0.5 my-auto flex h-11 w-11 items-center justify-center">
            <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-ui-chip text-[15px] leading-none text-ui-ink2">×</span>
          </button>
        )}
      </div>
      {bad && <p role="alert" className="text-xs font-semibold text-ui-danger">{t('templateForm.limitFormat')}</p>}
    </div>
  )
}

const SLOT_BOX = 'flex items-center gap-2.5 rounded-xl'

function SlotRow({ slot, chosen, suggestion, none, missing, onOpen, onUse }: {
  slot: Slot; chosen?: UserPractice; suggestion: UserPractice | null; none: boolean; missing: boolean
  onOpen: () => void; onUse: (p: UserPractice) => void
}) {
  const { t } = useTranslation()
  const label = t(`templateForm.${slot.key}`)
  const type = slot.types[0]
  const hint = missing ? <p className="text-[13px] leading-snug font-bold text-ui-danger">{t('templateForm.missing')}</p>
    : none ? <Link to="/settings/practices" className="text-[13px] leading-snug font-bold text-ui-accent">{t('templateForm.addOne')}</Link>
    : <p className="text-xs leading-snug text-ui-muted">{t(`templateForm.hint_${slot.key}`)}</p>
  let box: ReactNode
  if (chosen) box = (
    <button type="button" onClick={onOpen} aria-label={`${label}: ${chosen.practice}`}
      className={`${SLOT_BOX} min-h-[52px] w-full border border-ui-control bg-ui-surface py-1.5 pr-3 pl-3.5 text-left`}>
      <span className="text-ui-ink2"><TypeIcon type={type} /></span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ui-ink">{chosen.practice}</span>
      <span className="shrink-0 text-xs text-ui-faint">{t(typeLabelKey(type))}</span>
      <span aria-hidden className="text-ui-muted">⌄</span>
    </button>
  )
  else if (suggestion) box = (
    <div className={`${SLOT_BOX} min-h-[60px] border-[1.5px] border-dashed border-ui-accent bg-ui-accent-soft p-1.5 pl-3.5`}>
      <button type="button" onClick={onOpen} aria-label={`${label}: ${t('templateForm.choose')}`} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="text-ui-accent"><TypeIcon type={type} /></span>
        <span className="flex min-w-0 flex-col gap-px">
          <span className="text-[11px] font-bold text-ui-accent">{t('templateForm.suggested')}</span>
          <span className="truncate text-[15px] font-bold text-ui-ink">{suggestion.practice}</span>
        </span>
      </button>
      <button type="button" onClick={() => onUse(suggestion)} aria-label={t('templateForm.useName', { name: suggestion.practice })}
        className="flex min-h-11 shrink-0 items-center rounded-xl bg-ui-accent-fill px-4 text-sm font-bold text-ui-ink">{t('templateForm.use')}</button>
    </div>
  )
  else if (none) box = (
    <div className={`${SLOT_BOX} min-h-[52px] border-[1.5px] border-dashed border-ui-control px-3.5 py-2 text-sm leading-snug font-semibold text-ui-muted`}>
      <span className="text-ui-faint"><TypeIcon type={type} /></span>
      <span className="flex-1">{t(`templateForm.none${type}`)}</span>
    </div>
  )
  else box = (
    <button type="button" onClick={onOpen} aria-label={`${label}: ${t('templateForm.choose')}`}
      className={`${SLOT_BOX} min-h-[52px] w-full border-[1.5px] border-dashed px-3.5 py-1.5 text-left text-[15px] font-bold ${slot.required ? 'border-ui-accent text-ui-accent' : 'border-ui-control text-ui-ink2'}`}>
      <TypeIcon type={type} />
      <span className="flex-1">{t('templateForm.choose')}</span>
      <span aria-hidden>⌄</span>
    </button>
  )
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-extrabold text-ui-ink">{label}</span>
        <span className={`text-xs font-bold whitespace-nowrap ${slot.required ? 'text-ui-accent' : 'text-ui-faint'}`}>
          {t(slot.required ? 'templateForm.required' : 'templateForm.optional')}
        </span>
      </div>
      {box}
      {hint}
    </div>
  )
}

/**
 * A template's settings (15m2–15m5, 15d13); the parent keeps the draft and decides what to do with it. `name` is the
 * name field, which goes under the no-practices banner. `flagMissing` is for a saved report, whose empty required
 * slot means its practice has gone.
 */
export function TemplateForm({ value, onChange, practices, name, flagMissing }: {
  value: TemplateDraft; onChange: (d: TemplateDraft) => void; practices: UserPractice[]; name?: ReactNode; flagMissing?: boolean
}) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState<Slot | null>(null)
  const chosen = (slot: Slot) => practices.find((p) => p.id === value[keyOf(slot)] && fits(slot, p))
  // In slot order, so one practice is never offered twice.
  const taken = new Set(SLEEP_SLOTS.flatMap((s) => chosen(s)?.id ?? []))
  const suggestions = new Map(SLEEP_SLOTS.filter((s) => !chosen(s)).map((s) => {
    const p = suggestFor(s, practices, taken)
    if (p) taken.add(p.id)
    return [s.key, p]
  }))
  const hasType = (s: Slot) => practices.some((p) => fits(s, p))
  const noTime = !hasType(SLEEP_SLOTS[0])

  return (
    <>
      {noTime && (
        <section className={`${CARD} flex flex-col gap-2 border-ui-accent bg-ui-accent-soft p-4`}>
          <h2 className="text-base leading-snug font-extrabold text-ui-ink">{t('templateForm.noTimeTitle')}</h2>
          <p className="text-sm leading-normal text-ui-ink2">{t('templateForm.noTimeBody')}</p>
          <Link to="/settings/practices/new" className="flex min-h-10 items-center self-start rounded-xl border border-ui-control bg-ui-surface px-4 text-sm font-bold text-ui-ink">
            {t('templateForm.addPractice')}
          </Link>
        </section>
      )}
      {name}
      <section className="flex flex-col gap-2">
        <h2 className={GROUP}>{t('templateForm.practices')}</h2>
        <div className={`${CARD} flex flex-col gap-4 p-4`}>
          {SLEEP_SLOTS.map((slot) => (
            <SlotRow key={slot.key} slot={slot} chosen={chosen(slot)} suggestion={suggestions.get(slot.key) ?? null}
              none={slot.required && !hasType(slot)} missing={!!flagMissing && slot.required && !chosen(slot)}
              onOpen={() => setPicking(slot)} onUse={(p) => onChange({ ...value, [slot.key]: p.id })} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className={GROUP}>{t('templateForm.sleepRange')}</h2>
        <div className={`${CARD} flex flex-col gap-4 p-4`}>
          <div className="grid grid-cols-2 gap-2.5">
            <LimitField id="sleep-min" label={t('templateForm.min')} placeholder={t('templateForm.noMin')} value={value.min} onChange={(min) => onChange({ ...value, min })} />
            <LimitField id="sleep-max" label={t('templateForm.max')} placeholder={t('templateForm.noMax')} value={value.max} onChange={(max) => onChange({ ...value, max })} />
          </div>
          {draftProblem(value) === 'minMax' && <p role="alert" className="text-[13px] font-semibold text-ui-danger">{t('templateForm.minMax')}</p>}
          <p className={HINT}>{t('templateForm.rangeHint')}</p>
        </div>
      </section>
      {picking && (
        <SlotPickerSheet slot={picking} value={value[keyOf(picking)]} suggested={suggestions.get(picking.key) ?? null} practices={practices} onClose={() => setPicking(null)}
          onPick={(id) => { onChange({ ...value, [picking.key]: id }); setPicking(null) }} />
      )}
    </>
  )
}
