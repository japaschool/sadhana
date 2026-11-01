import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PanelsReport } from '../../../api/charts'
import type { UserPractice } from '../../../types/api'
import { CARD, FIELD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { TypeIcon, typeLabelKey } from '../../yatras/settings/mobile/TypeChip'
import { useDebouncedCommit } from '../../yatras/settings/useDebouncedCommit'
import { parseTime } from '../../today/inputFormat'
import { typeTime } from '../../today/values'
import { SlotPickerSheet } from './SlotPickerSheet'
import { DURATION_SLOT, durationPanels, fits, JAPA_SLOTS, japaPanels, MAX_PRACTICES, SLEEP_DEFAULTS, SLEEP_SLOTS, sleepPanels, suggestFor, type Slot } from './templates'

export type TemplateDraft =
  | { kind: 'Sleep'; bedtime: string | null; wake: string | null; nap: string | null; min: number | null; max: number | null }
  | { kind: 'Japa'; total: string | null; target: number | null; morning: string | null; quality: string | null; attunement: string | null }
  | { kind: 'Duration'; practices: string[]; goal: number | null }

export const NEW_DRAFTS = {
  sleep: (): TemplateDraft => ({ kind: 'Sleep', bedtime: null, wake: null, nap: null, ...SLEEP_DEFAULTS }),
  japa: (): TemplateDraft => ({ kind: 'Japa', total: null, target: null, morning: null, quality: null, attunement: null }),
  duration: (): TemplateDraft => ({ kind: 'Duration', practices: [], goal: null }),
}

const slotsOf = (d: TemplateDraft) => (d.kind === 'Sleep' ? SLEEP_SLOTS : d.kind === 'Japa' ? JAPA_SLOTS : [])
const slotValue = (d: TemplateDraft, slot: Slot) => (d as unknown as Record<string, string | null>)[slot.key]

export function draftProblem(d: TemplateDraft): 'required' | 'minMax' | 'tooMany' | null {
  if (d.kind === 'Duration') return d.practices.length === 0 ? 'required' : d.practices.length > MAX_PRACTICES ? 'tooMany' : null
  if (d.kind === 'Japa') return !d.total || d.target === null ? 'required' : null
  if (!d.bedtime || !d.wake) return 'required'
  return d.min !== null && d.max !== null && d.min > d.max ? 'minMax' : null
}

export function draftToDefinition(d: TemplateDraft): { Panels: PanelsReport } | null {
  if (draftProblem(d)) return null
  if (d.kind === 'Duration') return { Panels: durationPanels({ practices: d.practices, goal: d.goal }) }
  if (d.kind === 'Japa') {
    const { kind: _, ...t } = d
    return { Panels: japaPanels({ ...t, total: d.total!, target: d.target! }) }
  }
  return { Panels: sleepPanels({ bedtime: d.bedtime!, wake: d.wake!, nap: d.nap, min: d.min, max: d.max }) }
}

/**
 * The form's view of a saved report; `practices` must have loaded. A required practice that can't be used loads empty,
 * so it shows as missing and holds saves back. An optional one keeps its id, so a limit change still saves.
 */
export function draftOf(def: PanelsReport, practices: UserPractice[]): TemplateDraft | null {
  const template = def.template
  if (!template) return null
  // Unlike a single slot, the list can drop what's gone and carry on with the rest.
  if ('Duration' in template) {
    const { practices: ids, goal } = template.Duration
    return { kind: 'Duration', goal, practices: ids.filter((id) => practices.some((p) => p.id === id && fits(DURATION_SLOT, p))) }
  }
  const draft: TemplateDraft = 'Sleep' in template ? { kind: 'Sleep', ...template.Sleep } : { kind: 'Japa', ...template.Japa }
  const empty = slotsOf(draft).filter((s) => s.required && !practices.some((p) => p.id === slotValue(draft, s) && fits(s, p)))
  return { ...draft, ...Object.fromEntries(empty.map((s) => [s.key, null])) }
}

/** Empty is no limit; `6:` is 6:00. */
function parseHours(text: string): number | null {
  const hm = parseTime(text)
  return hm ? hm.h * 60 + hm.m : null
}
const hoursText = (v: number | null) => (v === null ? '' : `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`)

const GROUP = 'px-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted'

const parseRounds = (text: string) => (text ? Number(text) : null)
const roundsText = (v: number | null) => (v === null ? '' : String(v))
// ponytail: four digits keeps a target inside the server's i32 without a range check.
const typeRounds = (next: string) => next.replace(/\D/g, '').slice(0, 4)

/** A number typed as text. Time limits by default; with `suffix`, a required whole number that has no clear button. */
function LimitField({ id, label, placeholder, value, onChange, suffix }: {
  id: string; label: string; placeholder: string; value: number | null; onChange: (v: number | null) => void; suffix?: string
}) {
  const { t } = useTranslation()
  const [parseLimit, limitText] = suffix ? [parseRounds, roundsText] : [parseHours, hoursText]
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
    if (parsed !== value) onChange(parsed)
  })
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-xs leading-snug font-bold text-ui-muted">{label}</label>}
      <div className="relative">
        <input id={id} value={text} placeholder={placeholder} inputMode="numeric" autoComplete="off"
          className={`${FIELD} ${suffix ? '' : 'pr-11'} font-ui-mono placeholder:font-[Manrope] placeholder:text-[15px] placeholder:font-semibold`}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); flush() }}
          onChange={(e) => { setText(suffix ? typeRounds(e.target.value) : typeTime(e.target.value, text)); schedule() }} />
        {suffix && <span className="absolute inset-y-0 right-3.5 my-auto flex items-center text-sm font-semibold text-ui-muted">{suffix}</span>}
        {text && !suffix && (
          <button type="button" aria-label={t('templateForm.clear', { label })} onClick={() => { setText(''); onChange(null) }}
            className="absolute inset-y-0 right-0.5 my-auto flex h-11 w-11 items-center justify-center">
            <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-ui-chip text-[15px] leading-none text-ui-ink2">×</span>
          </button>
        )}
      </div>
    </div>
  )
}

/** Every duration practice, ticked in or out (15m14): one or more, so no picker to open. */
function PracticeChecks({ value, onChange, practices, flagMissing }: {
  value: string[]; onChange: (ids: string[]) => void; practices: UserPractice[]; flagMissing?: boolean
}) {
  const { t } = useTranslation()
  const list = practices.filter((p) => fits(DURATION_SLOT, p))
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className={GROUP.replace('px-1 ', '')}>{t('templateForm.practicesSelected', { count: value.length })}</h2>
        <span className="text-xs font-bold whitespace-nowrap text-ui-accent">{t('templateForm.required')}</span>
      </div>
      {list.length === 0 ? (
        <div className={`${CARD} flex flex-col gap-1 p-4`}>
          <p className="text-sm leading-snug font-semibold text-ui-muted">{t('templateForm.noneDuration')}</p>
          <Link to="/settings/practices" className="text-[13px] leading-snug font-bold text-ui-accent">{t('templateForm.addOne')}</Link>
        </div>
      ) : (
        <div className={`${CARD} flex flex-col divide-y divide-ui-hairline overflow-hidden`}>
          {list.map((p) => (
            <label key={p.id} className="flex min-h-[52px] items-center gap-3 px-3.5 py-1.5">
              <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} className="h-5 w-5 shrink-0 accent-[var(--ui-accent-fill)]" />
              <span className="text-ui-ink2"><TypeIcon type="Duration" /></span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ui-ink">{p.practice}</span>
            </label>
          ))}
        </div>
      )}
      {flagMissing && value.length === 0 && <p className="px-1 text-[13px] leading-snug font-bold text-ui-danger">{t('templateForm.missing')}</p>}
      {value.length > MAX_PRACTICES && <p role="alert" className="px-1 text-[13px] font-semibold text-ui-danger">{t('templateForm.tooMany', { count: MAX_PRACTICES })}</p>}
      <p className={`${HINT} px-1`}>{t('templateForm.onlyDurationHint')}</p>
    </section>
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
  const slots = slotsOf(value)
  const chosen = (slot: Slot) => practices.find((p) => p.id === slotValue(value, slot) && fits(slot, p))
  // In slot order, so one practice is never offered twice.
  const taken = new Set(slots.flatMap((s) => chosen(s)?.id ?? []))
  const suggestions = new Map(slots.filter((s) => !chosen(s)).map((s) => {
    const p = suggestFor(s, practices, taken)
    if (p) taken.add(p.id)
    return [s.key, p]
  }))
  const hasType = (s: Slot) => practices.some((p) => fits(s, p))
  const noTime = value.kind === 'Sleep' && !hasType(SLEEP_SLOTS[0])
  const rows = (only: Slot[]) => (
    <div className={`${CARD} flex flex-col gap-4 p-4`}>
      {only.map((slot) => (
        <SlotRow key={slot.key} slot={slot} chosen={chosen(slot)} suggestion={suggestions.get(slot.key) ?? null}
          none={slot.required && !hasType(slot)} missing={!!flagMissing && slot.required && !chosen(slot)}
          onOpen={() => setPicking(slot)} onUse={(p) => onChange({ ...value, [slot.key]: p.id })} />
      ))}
    </div>
  )

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
      {value.kind === 'Sleep' && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className={GROUP}>{t('templateForm.practices')}</h2>
            {rows(SLEEP_SLOTS)}
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
        </>
      )}
      {value.kind === 'Japa' && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className={GROUP}>{t('templateForm.practices')}</h2>
            {rows(JAPA_SLOTS.filter((s) => s.required))}
          </section>
          <section className="flex flex-col gap-2">
            <h2 className={GROUP}>{t('templateForm.targetGroup')}</h2>
            <div className={`${CARD} flex flex-col gap-1.5 p-4`}>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="japa-target" className="text-[15px] font-extrabold text-ui-ink">{t('templateForm.target')}</label>
                <span className="text-xs font-bold whitespace-nowrap text-ui-accent">{t('templateForm.required')}</span>
              </div>
              <LimitField id="japa-target" label="" placeholder="" suffix={t('templateForm.targetSuffix')} value={value.target} onChange={(target) => onChange({ ...value, target })} />
              <p className={HINT}>{t('templateForm.targetHint')}</p>
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className={GROUP}>{t('templateForm.extras')}</h2>
            {rows(JAPA_SLOTS.filter((s) => !s.required))}
          </section>
        </>
      )}
      {value.kind === 'Duration' && (
        <>
          <PracticeChecks value={value.practices} practices={practices} flagMissing={flagMissing} onChange={(ids) => onChange({ ...value, practices: ids })} />
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h2 className={GROUP.replace('px-1 ', '')}>{t('templateForm.dailyGoal')}</h2>
              <span className="text-xs font-bold whitespace-nowrap text-ui-faint">{t('templateForm.optional')}</span>
            </div>
            <div className={`${CARD} flex flex-col gap-2 p-4`}>
              <LimitField id="duration-goal" label={t('templateForm.goal')} placeholder={t('templateForm.noGoal')} value={value.goal} onChange={(goal) => onChange({ ...value, goal })} />
              <p className={HINT}>{t('templateForm.goalHint')}</p>
            </div>
          </section>
        </>
      )}
      {picking && (
        <SlotPickerSheet slot={picking} value={slotValue(value, picking)} suggested={suggestions.get(picking.key) ?? null} practices={practices} onClose={() => setPicking(null)}
          onPick={(id) => { onChange({ ...value, [picking.key]: id }); setPicking(null) }} />
      )}
    </>
  )
}
