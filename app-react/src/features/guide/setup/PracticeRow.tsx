import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { TypeIcon, typeLabelKey } from '../../yatras/settings/mobile/TypeChip'
import type { NameCheck } from './useSetup'

const LINK = 'flex min-h-11 items-center px-1 text-[13px] font-bold text-ui-accent'
const SMALL = 'flex min-h-9 items-center justify-center rounded-[10px] px-3.5 py-1.5 text-[13px] font-extrabold'

/** A practice the report needs: its name can be changed in place, an optional one has a tick. */
export function PracticeRow({ name, label, type, note, needed, tick, onRename, onRemove, check, options, picked, startEditing = false }: {
  name: string
  /** What the tick is called, whatever the practice is named. */
  label?: string
  type: PracticeDataType
  note?: string
  needed?: boolean
  tick?: { on: boolean; onChange: (on: boolean) => void }
  onRename: (name: string) => void
  onRemove?: () => void
  /** Missing while an optional practice is unticked. */
  check?: NameCheck
  /** The person's practices this one could be; picking one sets the name to theirs. */
  options?: UserPractice[]
  /** The name was picked from a list of the person's practices: no need to ask whether to use it. */
  picked?: boolean
  startEditing?: boolean
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState(name)
  const [used, setUsed] = useState<string | null>(null)
  const [pickedHere, setPickedHere] = useState<string | null>(null)
  const titleId = useId()
  const off = tick && !tick.on
  // The draft is what was typed, spaces and all; the choices get it trimmed. If the name changed from outside (a suggestion tapped) the name wins.
  const shown = draft.trim() === name ? draft : name
  const problem = !off && check?.problem
  const fromList = picked || pickedHere === name
  const usable = !off && !problem && !fromList && check?.existing && name ? check.existing : undefined

  return (
    <div className="bg-ui-surface">
      <div className="flex items-center gap-3 py-2.5 pr-3 pl-3.5">
        {tick && (
          <button type="button" role="checkbox" aria-checked={tick.on} aria-label={label} onClick={() => tick.onChange(!tick.on)}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] ${tick.on ? 'bg-ui-accent-fill' : 'border-[1.8px] border-ui-faint'}`}>
            {tick.on && <span aria-hidden className="-mt-[3px] h-2.5 w-[5px] rotate-45 border-r-2 border-b-2 border-ui-ink" />}
          </button>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {editing && !off ? (
            <div className="flex min-h-11 items-center gap-2 rounded-[10px] border-2 border-ui-accent-fill bg-ui-surface px-3">
              <TypeIcon type={type} />
              <input autoFocus value={shown} aria-label={t('guide.setup.nameField')} aria-invalid={!!problem || !name}
                onChange={(e) => { setDraft(e.target.value); onRename(e.target.value.trim()) }}
                className="min-w-0 flex-1 bg-transparent text-[15px] font-bold outline-none" />
            </div>
          ) : (
            <span className={`flex min-w-0 items-center gap-2 ${off ? 'text-ui-muted' : ''}`}>
              <TypeIcon type={type} />
              <span className="truncate border-b-[1.5px] border-dashed border-ui-faint pb-px text-[15px] leading-snug font-bold">{name || label}</span>
            </span>
          )}
          {needed && <span className="self-start rounded-full bg-ui-accent-soft px-2 py-[3px] text-[11px] leading-tight font-extrabold text-ui-accent">{t('guide.setup.needed')}</span>}
          <span className="text-xs leading-snug text-ui-muted">{note ?? t(typeLabelKey(type))}</span>
          {!off && !editing && !!options?.length && (
            <select aria-label={t('guide.setup.useOne', { name: label ?? name })} value={options.some((o) => o.practice === name) ? name : ''}
              onChange={(e) => { setPickedHere(e.target.value); onRename(e.target.value) }}
              className="mt-1 min-h-9 self-start rounded-[10px] border border-ui-control bg-ui-surface px-2 text-[13px] font-bold">
              <option value="" disabled>{t('guide.setup.usePick')}</option>
              {options.map((o) => <option key={o.id} value={o.practice}>{o.practice}</option>)}
            </select>
          )}
        </div>
        {!off && (editing
          ? <button type="button" onClick={() => setEditing(false)} className={`${LINK} font-extrabold`}>{t('guide.setup.done')}</button>
          : <button type="button" aria-label={t('guide.setup.rename', { name })} onClick={() => { setDraft(name); setEditing(true) }} className={LINK}>{t('guide.setup.renameShort')}</button>)}
        {onRemove && <button type="button" aria-label={t('guide.setup.remove', { name })} onClick={onRemove} className="flex h-11 w-11 shrink-0 items-center justify-center text-lg text-ui-muted">×</button>}
      </div>
      {!off && !editing && !name && <p role="alert" className="mx-3.5 mb-3 text-[13px] font-semibold text-ui-danger">{t('guide.setup.clash.empty')}</p>}
      {problem && problem !== 'empty' && (
        <div role="alert" className="mx-3.5 mb-3 flex flex-col gap-1.5 rounded-xl border border-ui-accent-pill bg-ui-accent-soft px-3.5 py-3">
          {problem !== 'twice' && <span className="text-sm font-extrabold">{t('guide.setup.clash.title')}</span>}
          <span className="text-[13px] leading-normal text-ui-ink2">
            {t(`guide.setup.clash.${problem === 'inUseHidden' ? 'hidden' : problem === 'inUseOtherType' ? 'otherType' : 'twice'}`,
              { name, type: check.have ? t(typeLabelKey(check.have.data_type)) : '' })}
          </span>
        </div>
      )}
      {usable && (
        <div role="group" aria-labelledby={titleId} className="mx-3.5 mb-3 flex flex-col gap-2 rounded-xl border border-ui-accent-pill bg-ui-accent-soft px-3.5 py-3">
          <span id={titleId} className="text-sm font-extrabold">{t('guide.setup.clash.title')}</span>
          <span className="text-[13px] leading-normal text-ui-ink2">{t('guide.setup.clash.usable', { name, type: t(typeLabelKey(usable.data_type)) })}</span>
          {used === name
            ? <span className="text-[13px] font-extrabold text-ui-accent">{t('guide.setup.clash.using', { name })}</span>
            : (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setUsed(name)} className={`${SMALL} bg-ui-accent-fill text-ui-ink`}>{t('guide.setup.clash.use', { name })}</button>
                <button type="button" onClick={() => { setDraft(name); setEditing(true) }} className={`${SMALL} border border-ui-control bg-ui-surface`}>{t('guide.setup.clash.keep')}</button>
              </div>
            )}
        </div>
      )}
    </div>
  )
}

/** A group's heading, with a note to its right ("Required", "Optional"). */
export function Section({ title, tag, accent, children }: { title: string; tag?: string; accent?: boolean; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="text-[11px] leading-snug font-bold tracking-[.1em] text-ui-muted uppercase">{title}</h2>
        {tag && <span className={`text-xs font-bold ${accent ? 'text-ui-accent' : 'text-ui-faint'}`}>{tag}</span>}
      </div>
      {children}
    </section>
  )
}

export const RowList = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col divide-y divide-ui-hairline overflow-hidden rounded-[18px] border border-ui-hairline">{children}</div>
)

/** A suggestion, or "+ Name your own" (dashed). */
export function Chip({ on, dashed, disabled, note, onClick, children }: { on?: boolean; dashed?: boolean; disabled?: boolean; note?: string; onClick: () => void; children: ReactNode }) {
  const noteId = useId()
  return (
    <>
    <button type="button" aria-pressed={dashed ? undefined : !!on} aria-describedby={note ? noteId : undefined} disabled={disabled} onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-3.5 text-sm leading-tight font-bold disabled:opacity-45 ${
        dashed ? 'border-dashed border-ui-control text-ui-accent' : on ? 'border-ui-accent-pill bg-ui-accent-soft' : 'border-ui-hairline bg-ui-surface'}`}>
      {on && <span aria-hidden className="-mt-[2px] h-2 w-1 rotate-45 border-r-[1.6px] border-b-[1.6px] border-ui-accent" />}{children}
    </button>
    {note && <span id={noteId} className="-ml-1 self-center text-xs font-semibold text-ui-muted">{note}</span>}
    </>
  )
}

/** The person's own practices that fit this report, each with Use; a used one says Using and lets go on a second press. */
export function FitList({ options, isOn, disabled, onUse }: { options: UserPractice[]; isOn: (name: string) => boolean; disabled: boolean; onUse: (name: string, on: boolean) => void }) {
  const { t } = useTranslation()
  return (
    <RowList>
      {options.map((o) => {
        const on = isOn(o.practice)
        return (
          <div key={o.id} role="group" aria-label={o.practice} className="flex items-center gap-3 bg-ui-surface py-2.5 pr-3 pl-3.5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-2"><TypeIcon type={o.data_type} /><span className="truncate text-[15px] font-bold">{o.practice}</span></span>
              <span className="text-xs leading-snug text-ui-muted">{t('guide.setup.fitNote', { type: t(typeLabelKey(o.data_type)) })}</span>
            </div>
            <button type="button" disabled={!on && disabled} onClick={() => onUse(o.practice, !on)}
              className={`${SMALL} disabled:opacity-45 ${on ? 'bg-ui-accent-soft text-ui-accent' : 'border border-ui-control bg-ui-surface'}`}>{t(on ? 'guide.setup.usingFit' : 'guide.setup.useFit')}</button>
          </div>
        )
      })}
    </RowList>
  )
}
