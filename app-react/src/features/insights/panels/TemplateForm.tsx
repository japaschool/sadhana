import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Counts, Direction, GoalPeriod, PanelsReport, SleepRows } from '../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { CARD, FIELD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { TypeIcon, typeLabelKey } from '../../yatras/settings/mobile/TypeChip'
import { useDebouncedCommit } from '../../yatras/settings/useDebouncedCommit'
import { parseTime } from '../../today/inputFormat'
import { formatDuration, typeTime } from '../../today/values'
import { useReports } from '../useReports'
import { SlotPickerSheet } from './SlotPickerSheet'
import {
  DAYS_SLOT, daysPanels, DURATION_SLOT, durationPanels, fits, GAPS_EVENT_SLOT, GAPS_ROWS_SLOT, gapsPanels, GOAL_SLOT, goalsPanels, JAPA_SLOTS, japaPanels, MAX_DAYS,
  MAX_GOALS, MAX_PRACTICES, MAX_ROWS,
  SLEEP_DEFAULTS, SLEEP_SLOTS, sleepPanels, sleepRowsFor, suggestFor, type Slot,
} from './templates'

export type GoalDraft = { practice: string | null; direction: Direction; amount: number | null; period: GoalPeriod; counts: Counts }

export type TemplateDraft =
  | { kind: 'Sleep'; bedtime: string | null; wake: string | null; nap: string | null; min: number | null; max: number | null }
  | { kind: 'Japa'; total: string | null; target: number | null; morning: string | null }
  | { kind: 'Duration'; practices: string[]; goal: number | null }
  | { kind: 'Days'; practices: string[] }
  | { kind: 'Gaps'; event: string | null; rows: string[]; sleep: SleepRows | null }
  | { kind: 'Goals'; goals: GoalDraft[] }

const newGoal = (): GoalDraft => ({ practice: null, direction: 'AtLeast', amount: null, period: 'Week', counts: 'Total' })

export const NEW_DRAFTS = {
  sleep: (): TemplateDraft => ({ kind: 'Sleep', bedtime: null, wake: null, nap: null, ...SLEEP_DEFAULTS }),
  japa: (): TemplateDraft => ({ kind: 'Japa', total: null, target: null, morning: null }),
  duration: (): TemplateDraft => ({ kind: 'Duration', practices: [], goal: null }),
  days: (): TemplateDraft => ({ kind: 'Days', practices: [] }),
  gaps: (): TemplateDraft => ({ kind: 'Gaps', event: null, rows: [], sleep: null }),
  goals: (): TemplateDraft => ({ kind: 'Goals', goals: [newGoal()] }),
}

const slotsOf = (d: TemplateDraft) => (d.kind === 'Sleep' ? SLEEP_SLOTS : d.kind === 'Japa' ? JAPA_SLOTS : d.kind === 'Gaps' ? [GAPS_EVENT_SLOT] : [])
const MAX = { Duration: MAX_PRACTICES, Days: MAX_DAYS }
const slotValue = (d: TemplateDraft, slot: Slot) => (d as unknown as Record<string, string | null>)[slot.key]

export function draftProblem(d: TemplateDraft): 'required' | 'minMax' | 'tooMany' | null {
  if (d.kind === 'Duration' || d.kind === 'Days') return d.practices.length === 0 ? 'required' : d.practices.length > MAX[d.kind] ? 'tooMany' : null
  if (d.kind === 'Japa') return !d.total || d.target === null ? 'required' : null
  if (d.kind === 'Goals') {
    if (d.goals.length > MAX_GOALS) return 'tooMany'
    const unset = (g: GoalDraft) => !g.practice || g.amount === null || (g.direction === 'AtLeast' && g.amount < 1)
    return d.goals.length === 0 || d.goals.some(unset) ? 'required' : null
  }
  if (d.kind === 'Gaps') return !d.event ? 'required' : d.rows.length + (d.sleep ? 1 : 0) > MAX_ROWS ? 'tooMany' : null
  if (!d.bedtime || !d.wake) return 'required'
  return d.min !== null && d.max !== null && d.min > d.max ? 'minMax' : null
}

export function draftToDefinition(d: TemplateDraft): { Panels: PanelsReport } | null {
  if (draftProblem(d)) return null
  if (d.kind === 'Duration') return { Panels: durationPanels({ practices: d.practices, goal: d.goal }) }
  if (d.kind === 'Days') return { Panels: daysPanels({ practices: d.practices }) }
  if (d.kind === 'Goals') return { Panels: goalsPanels({ goals: d.goals.map((g) => ({ ...g, practice: g.practice!, amount: g.amount! })) }) }
  if (d.kind === 'Gaps') return { Panels: gapsPanels({ event: d.event!, rows: d.rows, sleep: d.sleep }) }
  if (d.kind === 'Japa') {
    // Quality and done markers are no longer drawn, so a saved report drops its old ones.
    return { Panels: japaPanels({ total: d.total!, target: d.target!, morning: d.morning, quality: null, attunement: null }) }
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
  if ('Days' in template) {
    return { kind: 'Days', practices: template.Days.practices.filter((id) => practices.some((p) => p.id === id && fits(DAYS_SLOT, p))) }
  }
  if ('Goals' in template) {
    // Each goal keeps its place, so a gone practice shows as missing in its own card.
    return { kind: 'Goals', goals: template.Goals.goals.map((g) => {
      const p = practices.find((x) => x.id === g.practice && fits(GOAL_SLOT, x))
      return { ...g, practice: p ? g.practice : null, counts: p?.data_type === 'Duration' ? g.counts : 'Total' }
    }) }
  }
  if ('Gaps' in template) {
    const { event, rows, sleep } = template.Gaps
    const ok = (slot: Slot, id: string) => practices.some((p) => p.id === id && fits(slot, p))
    return {
      kind: 'Gaps',
      event: ok(GAPS_EVENT_SLOT, event) ? event : null,
      rows: rows.filter((id) => ok(GAPS_ROWS_SLOT, id)),
      sleep: sleep && ok(SLEEP_SLOTS[0], sleep.bedtime) && ok(SLEEP_SLOTS[1], sleep.wake) ? sleep : null,
    }
  }
  const draft: TemplateDraft = 'Sleep' in template ? { kind: 'Sleep', ...template.Sleep } : {
    kind: 'Japa', total: template.Japa.total, target: template.Japa.target, morning: template.Japa.morning,
  }
  const empty = slotsOf(draft).filter((s) => s.required && !practices.some((p) => p.id === slotValue(draft, s) && fits(s, p)))
  return { ...draft, ...Object.fromEntries(empty.map((s) => [s.key, null])) }
}

/** Empty is no limit; `6:` is 6:00. */
function parseHours(text: string): number | null {
  const hm = parseTime(text)
  return hm ? hm.h * 60 + hm.m : null
}
/** Hours with no 24h cap, for an amount of time: `30:00`, `30` (30h) or `3000` (the last two digits minutes). */
function parseLongHours(text: string): number | null {
  if (!text) return null
  const [h, m] = text.includes(':') ? text.split(':') : text.length > 2 ? [text.slice(0, -2), text.slice(-2)] : [text, '']
  return (parseInt(h, 10) || 0) * 60 + Math.min(59, parseInt(m, 10) || 0)
}
/** Digits and one colon: up to 999 hours and two minute digits. */
const typeLongHours = (next: string) => {
  const [h, ...m] = next.replace(/[^\d:]/g, '').split(':')
  return m.length ? `${h.slice(0, 3)}:${m.join('').slice(0, 2)}` : h.slice(0, 5)
}
const hoursText = (v: number | null) => (v === null ? '' : `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`)

const GROUP = 'px-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted'

const parseRounds = (text: string) => (text ? Number(text) : null)
const roundsText = (v: number | null) => (v === null ? '' : String(v))
// ponytail: four digits (six for a goal's count, 10000 steps a day) keeps it inside the server's i32 without a range check.
const typeRounds = (next: string, max: number) => next.replace(/\D/g, '').slice(0, max)

/**
 * A number typed as text. Time limits (hh:mm) by default; with `duration`, minutes typed like Today's Duration row and
 * shown as 2h 20m; with `suffix` or `count`, a required whole number that has no clear button; with `hours`, h:mm with
 * no 23:59 cap, for an amount of time rather than a time of day.
 */
export function LimitField({ id, label, placeholder, value, onChange, suffix, duration, count, hours }: {
  id: string; label: string; placeholder: string; value: number | null; onChange: (v: number | null) => void; suffix?: string; duration?: boolean; count?: boolean; hours?: boolean
}) {
  const { t } = useTranslation()
  const required = !!suffix || !!count
  const digits = required || duration
  const [parseLimit, limitText] = digits ? [parseRounds, roundsText] : hours ? [parseLongHours, hoursText] : [parseHours, hoursText]
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
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const shown = duration && !focused && parsed !== null ? formatDuration(parsed, units) : text
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-xs leading-snug font-bold text-ui-muted">{label}</label>}
      <div className="relative">
        <input id={id} value={shown} placeholder={placeholder} inputMode="numeric" autoComplete="off"
          className={`${FIELD} ${required ? '' : 'pr-11'} font-ui-mono placeholder:font-[Manrope] placeholder:text-[15px] placeholder:font-semibold`}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); flush() }}
          onChange={(e) => { setText(digits ? typeRounds(e.target.value, count ? 6 : 4) : hours ? typeLongHours(e.target.value) : typeTime(e.target.value, text)); schedule() }} />
        {suffix && <span className="absolute inset-y-0 right-3.5 my-auto flex items-center text-sm font-semibold text-ui-muted">{suffix}</span>}
        {duration && focused && text && (
          <span className="pointer-events-none absolute inset-y-0 right-12 my-auto flex items-center text-sm font-semibold text-ui-muted">{units.min}</span>
        )}
        {text && !required && (
          <button type="button" aria-label={t('templateForm.clear', { label })} onClick={() => { setText(''); onChange(null) }}
            className="absolute inset-y-0 right-0.5 my-auto flex h-11 w-11 items-center justify-center">
            <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-ui-chip text-[15px] leading-none text-ui-ink2">×</span>
          </button>
        )}
      </div>
    </div>
  )
}

/** Every practice that fits the slot, ticked in or out (15m14): one or more, so no picker to open. */
function PracticeChecks({ slot, max, none, hint, value, onChange, practices, flagMissing, optional, heading = 'practicesSelected', extra }: {
  slot: Slot; max: number; none: string; hint: string
  value: string[]; onChange: (ids: string[]) => void; practices: UserPractice[]; flagMissing?: boolean
  /** Shows Optional, and an empty list is never missing. */
  optional?: boolean
  heading?: string
  /** A calculated row listed first, counted with the rest. */
  extra?: { label: string; checked: boolean; onChange: (on: boolean) => void } | null
}) {
  const { t } = useTranslation()
  const list = practices.filter((p) => fits(slot, p))
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  const count = value.length + (extra?.checked ? 1 : 0)
  const row = 'flex min-h-[52px] items-center gap-3 px-3.5 py-1.5'
  const box = 'h-5 w-5 shrink-0 accent-[var(--ui-accent-fill)]'
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className={GROUP.replace('px-1 ', '')}>{t(`templateForm.${heading}`, { count })}</h2>
        <span className={`text-xs font-bold whitespace-nowrap ${optional ? 'text-ui-faint' : 'text-ui-accent'}`}>{t(optional ? 'templateForm.optional' : 'templateForm.required')}</span>
      </div>
      {list.length === 0 && !extra ? (
        <div className={`${CARD} flex flex-col gap-1 p-4`}>
          <p className="text-sm leading-snug font-semibold text-ui-muted">{t(`templateForm.${none}`)}</p>
          <Link to="/settings/practices" className="text-[13px] leading-snug font-bold text-ui-accent">{t('templateForm.addOne')}</Link>
        </div>
      ) : (
        <div className={`${CARD} flex flex-col divide-y divide-ui-hairline overflow-hidden`}>
          {extra && (
            <label className={row}>
              <input type="checkbox" checked={extra.checked} onChange={() => extra.onChange(!extra.checked)} className={box} />
              <span className="text-ui-ink2"><TypeIcon type="Duration" /></span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ui-ink">{extra.label}</span>
            </label>
          )}
          {list.map((p) => (
            <label key={p.id} className={row}>
              <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} className={box} />
              <span className="text-ui-ink2"><TypeIcon type={p.data_type} /></span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ui-ink">{p.practice}</span>
            </label>
          ))}
        </div>
      )}
      {flagMissing && !optional && value.length === 0 && <p className="px-1 text-[13px] leading-snug font-bold text-ui-danger">{t('templateForm.missing')}</p>}
      {count > max && <p role="alert" className="px-1 text-[13px] font-semibold text-ui-danger">{t('templateForm.tooMany', { count: max })}</p>}
      <p className={`${HINT} px-1`}>{t(`templateForm.${hint}`)}</p>
    </section>
  )
}

/** The compare rows, with calculated Sleep first when its practices can be found. */
function GapsRows({ value, onChange, practices }: {
  value: Extract<TemplateDraft, { kind: 'Gaps' }>; onChange: (d: TemplateDraft) => void; practices: UserPractice[]
}) {
  const { t } = useTranslation()
  const sleep = sleepRowsFor(useReports().data ?? [], practices)
  return (
    <PracticeChecks slot={GAPS_ROWS_SLOT} max={MAX_ROWS} none="noneCompare" hint="compareHint" heading="compare" optional
      value={value.rows} practices={practices} onChange={(rows) => onChange({ ...value, rows })}
      extra={sleep || value.sleep ? {
        label: t('templateForm.sleepCalculated'), checked: !!value.sleep,
        onChange: (on) => onChange({ ...value, sleep: on ? sleep : null }),
      } : null} />
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
  const noneKey = slot.types.length > 1 ? `templateForm.none_${slot.key}` : `templateForm.none${type}`
  const hint = missing ? <p className="text-[13px] leading-snug font-bold text-ui-danger">{t('templateForm.missing')}</p>
    : none ? <Link to="/settings/practices" className="text-[13px] leading-snug font-bold text-ui-accent">{t('templateForm.addOne')}</Link>
    : <p className="text-xs leading-snug text-ui-muted">{t(`templateForm.hint_${slot.key}`)}</p>
  let box: ReactNode
  if (chosen) box = (
    <button type="button" onClick={onOpen} aria-label={`${label}: ${chosen.practice}`}
      className={`${SLOT_BOX} min-h-[52px] w-full border border-ui-control bg-ui-surface py-1.5 pr-3 pl-3.5 text-left`}>
      <span className="text-ui-ink2"><TypeIcon type={chosen.data_type} /></span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ui-ink">{chosen.practice}</span>
      <span className="shrink-0 text-xs text-ui-faint">{t(typeLabelKey(chosen.data_type))}</span>
      <span aria-hidden className="text-ui-muted">⌄</span>
    </button>
  )
  else if (suggestion) box = (
    <div className={`${SLOT_BOX} min-h-[60px] border-[1.5px] border-dashed border-ui-accent bg-ui-accent-soft p-1.5 pl-3.5`}>
      <button type="button" onClick={onOpen} aria-label={`${label}: ${t('templateForm.choose')}`} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="text-ui-accent"><TypeIcon type={suggestion.data_type} /></span>
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
      <span className="flex-1">{t(noneKey)}</span>
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

const amountMode = (type: PracticeDataType | undefined, counts: Counts) =>
  !type ? null : type !== 'Duration' ? 'count' : counts === 'Days' ? 'days' : 'time'

/** One goal (16m3): its practice, direction, Counts for a Duration practice, amount and period. */
function GoalCard({ goal, n, practices, onChange, onRemove, onPick, flagMissing }: {
  goal: GoalDraft; n: number; practices: UserPractice[]; onChange: (g: GoalDraft) => void; onRemove: (() => void) | null; onPick: () => void; flagMissing?: boolean
}) {
  const { t } = useTranslation()
  const chosen = practices.find((p) => p.id === goal.practice && fits(GOAL_SLOT, p))
  const mode = amountMode(chosen?.data_type, goal.counts)
  // The amount field remounts when the unit changes, and its unmount sends a pending edit made in the old unit with
  // the old goal (iOS doesn't blur on a tap): that would undo the change, so the old field's edits are dropped.
  const modeNow = useRef(mode)
  useLayoutEffect(() => { modeNow.current = mode })
  const title = t('templateForm.goalN', { n })
  const label = 'text-xs leading-snug font-bold text-ui-muted'
  const hint = mode === 'time' ? 'goalHintTime' : mode === 'days' ? 'goalHintDays' : !chosen ? 'goalPickFirst' : chosen.data_type === 'Bool' ? 'goalHintBool' : 'goalHintInt'
  const amountLabel = t('templateForm.amount')
  return (
    <section aria-label={title} className={`${CARD} flex flex-col gap-3.5 px-4 pt-3 pb-4`}>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h3 className="text-[15px] font-extrabold text-ui-ink">{title}</h3>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`${t('templateForm.removeGoal')}: ${title}`} className="-mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center">
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-ui-chip text-base leading-none text-ui-ink2">×</span>
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>{t('templateForm.goalPractice')}</span>
        <button type="button" onClick={onPick} aria-label={`${t('templateForm.goalPracticeN', { n })}: ${chosen?.practice ?? t('templateForm.choose')}`}
          className={`${SLOT_BOX} min-h-[52px] w-full py-1.5 pr-3 pl-3.5 text-left text-[15px] font-bold ${chosen ? 'border border-ui-control bg-ui-surface text-ui-ink' : 'border-[1.5px] border-dashed border-ui-control text-ui-ink2'}`}>
          {chosen && <span className="text-ui-ink2"><TypeIcon type={chosen.data_type} /></span>}
          <span className="min-w-0 flex-1 truncate">{chosen?.practice ?? t('templateForm.choose')}</span>
          {chosen && <span className="shrink-0 text-xs font-normal text-ui-faint">{t(typeLabelKey(chosen.data_type))}</span>}
          <span aria-hidden className="text-ui-muted">⌄</span>
        </button>
        {flagMissing && !chosen && <p className="text-[13px] leading-snug font-bold text-ui-danger">{t('templateForm.missing')}</p>}
      </div>
      <SegmentedControl fill label={t('templateForm.goalDirection')} value={goal.direction} onChange={(direction) => onChange({ ...goal, direction })}
        options={[{ value: 'AtLeast', label: t('templateForm.atLeast') }, { value: 'AtMost', label: t('templateForm.atMost') }]} />
      {chosen?.data_type === 'Duration' && (
        <div className="flex flex-col gap-1.5">
          <span className={label}>{t('templateForm.counts')}</span>
          {/* Minutes and days don't convert, so the amount starts over. */}
          <SegmentedControl fill label={t('templateForm.counts')} value={goal.counts} onChange={(counts) => onChange({ ...goal, counts, amount: null })}
            options={[{ value: 'Total', label: t('templateForm.countsTime') }, { value: 'Days', label: t('templateForm.countsDays') }]} />
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-0 flex-[1_1_120px] flex-col">
          {mode ? (
            <LimitField key={mode} id={`goal-${n}-amount`} label={amountLabel} placeholder={mode === 'time' ? t('templateForm.hmm') : ''} value={goal.amount}
              count={mode !== 'time'} hours={mode === 'time'} suffix={mode === 'days' ? t('templateForm.unitDays') : undefined} onChange={(amount) => { if (modeNow.current === mode) onChange({ ...goal, amount }) }} />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className={label}>{amountLabel}</span>
              <span aria-hidden className="flex min-h-12 items-center rounded-xl border border-ui-hairline bg-ui-chip px-3.5 font-ui-mono text-[17px] text-ui-faint">—</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-[2_1_220px] flex-col gap-1.5">
          <span className={label}>{t('templateForm.period')}</span>
          <SegmentedControl fill label={t('templateForm.period')} value={goal.period} onChange={(period) => onChange({ ...goal, period })}
            options={(['Day', 'Week', 'Month'] as const).map((value) => ({ value, label: t(`templateForm.period${value}`) }))} />
        </div>
      </div>
      {goal.direction === 'AtLeast' && goal.amount === 0 && <p role="alert" className="text-[13px] font-semibold text-ui-danger">{t('templateForm.atLeastOne')}</p>}
      {flagMissing && chosen && goal.amount === null && <p role="alert" className="text-[13px] font-semibold text-ui-danger">{t('templateForm.amountMissing')}</p>}
      <p className={HINT}>{t(`templateForm.${hint}`)}</p>
    </section>
  )
}

/** The goal cards, Add goal up to the limit, and the note that the report stays private. */
function GoalsSection({ value, onChange, practices, flagMissing }: {
  value: Extract<TemplateDraft, { kind: 'Goals' }>; onChange: (d: TemplateDraft) => void; practices: UserPractice[]; flagMissing?: boolean
}) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState<number | null>(null)
  const set = (goals: GoalDraft[]) => onChange({ ...value, goals })
  const setGoal = (i: number, g: GoalDraft) => set(value.goals.map((x, j) => (j === i ? g : x)))
  const pick = (i: number, id: string) => {
    const g = value.goals[i]
    const was = practices.find((p) => p.id === g.practice && fits(GOAL_SLOT, p))?.data_type
    const type = practices.find((p) => p.id === id)?.data_type
    const counts = type === 'Duration' ? g.counts : 'Total'
    // An amount in another unit (minutes, days, a count) would mean something else, so it starts over.
    const same = amountMode(was, g.counts) === amountMode(type, counts)
    setGoal(i, { ...g, practice: id, counts, amount: same ? g.amount : null })
  }
  return (
    <>
      <h2 className={GROUP}>{t('templateForm.goalsHeading', { n: value.goals.length })}</h2>
      {value.goals.map((g, i) => (
        // ponytail: index keys; a card's fields follow its value, so removing one above is fine.
        <GoalCard key={i} goal={g} n={i + 1} practices={practices} flagMissing={flagMissing} onPick={() => setPicking(i)}
          onChange={(next) => setGoal(i, next)} onRemove={value.goals.length > 1 ? () => set(value.goals.filter((_, j) => j !== i)) : null} />
      ))}
      {value.goals.length < MAX_GOALS && (
        <button type="button" onClick={() => set([...value.goals, newGoal()])}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-ui-control text-[15px] font-extrabold text-ui-accent">
          <span aria-hidden className="text-lg leading-none">+</span>{t('templateForm.addGoal')}
        </button>
      )}
      <p className={`${HINT} px-1`}>{t('templateForm.goalsPrivate')}</p>
      {picking !== null && (
        <SlotPickerSheet slot={GOAL_SLOT} value={value.goals[picking]?.practice ?? null} suggested={null} practices={practices} onClose={() => setPicking(null)}
          onPick={(id) => { if (id) pick(picking, id); setPicking(null) }} />
      )}
    </>
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
              {flagMissing && value.target === null && <p role="alert" className="text-[13px] font-semibold text-ui-danger">{t('templateForm.targetMissing')}</p>}
              <p className={HINT}>{t('templateForm.targetHint')}</p>
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className={GROUP}>{t('templateForm.extras')}</h2>
            {rows(slots.filter((s) => !s.required))}
          </section>
        </>
      )}
      {value.kind === 'Duration' && (
        <>
          <PracticeChecks slot={DURATION_SLOT} max={MAX_PRACTICES} none="noneDuration" hint="onlyDurationHint" value={value.practices} practices={practices} flagMissing={flagMissing}
            onChange={(ids) => onChange({ ...value, practices: ids })} />
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h2 className={GROUP.replace('px-1 ', '')}>{t('templateForm.dailyGoal')}</h2>
              <span className="text-xs font-bold whitespace-nowrap text-ui-faint">{t('templateForm.optional')}</span>
            </div>
            <div className={`${CARD} flex flex-col gap-2 p-4`}>
              <LimitField id="duration-goal" duration label={t('templateForm.goal')} placeholder={t('templateForm.noGoal')} value={value.goal} onChange={(goal) => onChange({ ...value, goal })} />
              <p className={HINT}>{t('templateForm.goalHint')}</p>
            </div>
          </section>
        </>
      )}
      {value.kind === 'Days' && (
        <PracticeChecks slot={DAYS_SLOT} max={MAX_DAYS} none="noneBool" hint="onlyDaysHint" value={value.practices} practices={practices} flagMissing={flagMissing}
          onChange={(ids) => onChange({ ...value, practices: ids })} />
      )}
      {value.kind === 'Gaps' && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className={GROUP}>{t('templateForm.practices')}</h2>
            {rows([GAPS_EVENT_SLOT])}
          </section>
          <GapsRows value={value} onChange={onChange} practices={practices} />
        </>
      )}
      {value.kind === 'Goals' && <GoalsSection value={value} onChange={onChange} practices={practices} flagMissing={flagMissing} />}
      {picking && (
        <SlotPickerSheet slot={picking} value={slotValue(value, picking)} suggested={suggestions.get(picking.key) ?? null} practices={practices} onClose={() => setPicking(null)}
          onPick={(id) => { onChange({ ...value, [picking.key]: id }); setPicking(null) }} />
      )}
    </>
  )
}
