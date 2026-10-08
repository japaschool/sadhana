import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PracticeValue, UserPractice } from '../../../types/api'
import { Toggle } from '../../../ui/primitives/Toggle'
import { AnchoredMenu, MenuDivider, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { parseTime } from '../../../pages/home/inputFormat'
import { formatDuration, formatTime, parseOptions, typeTime } from '../values'
import { useOnAppHidden } from '../useOnAppHidden'
import { AddTimeSheet } from './AddTimeSheet'
import { TextRow } from './TextRow'
import { Chevron, EmptyValue } from './rowParts'

interface PracticeRowProps {
  practice: UserPractice
  value?: PracticeValue
  failed: boolean
  onSave: (v: PracticeValue | null) => void
}

export function PracticeRow(props: PracticeRowProps) {
  const { practice, value } = props
  const options = choiceOptions(practice)
  if (options.length) return <ChoiceRow {...props} options={options} />
  switch (practice.data_type) {
    case 'Bool':
      return <BoolRow {...props} />
    case 'Text':
      return (
        <TextRow label={practice.practice} value={value && 'Text' in value ? value.Text : ''}
          required={!!practice.is_required} failed={props.failed} onSave={props.onSave} />
      )
    default:
      return <InlineInputRow {...props} />
  }
}

/** Int and Text practices can have options; Int options must be numbers. */
function choiceOptions(p: UserPractice): string[] {
  if (p.data_type === 'Text') return parseOptions(p.dropdown_variants)
  if (p.data_type === 'Int') return parseOptions(p.dropdown_variants).filter((o) => Number.isFinite(Number(o)))
  return []
}

function RowShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[50px] items-center justify-between gap-3 bg-ui-surface pr-2 pl-4">
      <span className="min-w-0 text-[15px] font-medium">{label}</span>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

const SAVE_DEBOUNCE_MS = 300

/** Time, Int and Duration (in minutes) edit inline; a set Duration also gets a ＋ that opens the add sheet. */
function InlineInputRow({ practice, value, failed, onSave }: PracticeRowProps) {
  const { t } = useTranslation()
  const kind = practice.data_type
  const isTime = kind === 'Time'
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const minutes = value && 'Duration' in value ? value.Duration : 0
  const editText = value && 'Time' in value ? formatTime(value.Time)
    : value && 'Int' in value ? String(value.Int)
    : value && 'Duration' in value ? String(value.Duration) : ''
  const shown = value && 'Duration' in value ? formatDuration(minutes, units) : editText
  const [draft, setDraft] = useState<string | null>(null) // null = not editing
  const [adding, setAdding] = useState<HTMLElement | null>(null) // the ＋ that opened the add pad

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function change(raw: string) {
    let next = raw.replace(/\D/g, '')
    if (isTime) next = typeTime(raw, draft ?? '')
    setDraft(next)
    // Save while typing: a closed home-screen app often never gets to send the commit's save.
    // Empty or half-typed times ("07:") wait for the commit.
    clearTimeout(timer.current)
    if (next && (!isTime || next.length === 5)) timer.current = setTimeout(() => save(next), SAVE_DEBOUNCE_MS)
  }

  function commit() {
    clearTimeout(timer.current)
    if (draft === null) return
    setDraft(null)
    save(draft.trim())
  }

  function save(text: string) {
    if (!text) return onSave(null)
    if (isTime) {
      const time = parseTime(text)
      if (time) onSave({ Time: time })
      return
    }
    const n = parseInt(text, 10)
    if (isNaN(n) || n < 0) return
    onSave(kind === 'Duration' ? { Duration: n } : { Int: n })
  }
  useOnAppHidden(commit)

  return (
    <RowShell label={practice.practice}>
      {draft !== null ? (
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          aria-label={practice.practice}
          placeholder={isTime ? 'HH:MM' : undefined}
          value={draft}
          onChange={(e) => change(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="mr-1 h-9 w-20 rounded-[10px] border-[1.5px] border-ui-accent-fill bg-ui-field px-2 text-right font-ui-mono font-medium outline-none"
        />
      ) : shown ? (
        <>
          <button type="button" aria-label={t('today.editValue', { name: practice.practice })} onClick={() => setDraft(editText)}
            className={`font-ui-mono text-[15px] font-medium ${kind === 'Duration' ? '' : 'pr-2'} ${failed ? 'text-ui-danger' : ''}`}>
            {shown}
          </button>
          {kind === 'Duration' && (
            <button type="button" aria-label={t('today.addTimeFor', { name: practice.practice })} onClick={(e) => setAdding(e.currentTarget)}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-ui-accent-soft text-xl leading-none font-semibold text-ui-accent">
              +
            </button>
          )}
        </>
      ) : (
        <EmptyValue required={!!practice.is_required} name={practice.practice} onClick={() => setDraft('')} />
      )}
      {adding && (
        <AddTimeSheet anchor={adding} practice={practice.practice} current={minutes} initialMode="add" onSave={onSave} onClose={() => setAdding(null)} />
      )}
    </RowShell>
  )
}

function BoolRow({ practice, value, onSave }: PracticeRowProps) {
  const checked = !!value && 'Bool' in value && value.Bool
  return (
    <RowShell label={practice.practice}>
      <span className="pr-2">
        <Toggle label={practice.practice} checked={checked} onChange={(v) => onSave({ Bool: v })} />
      </span>
    </RowShell>
  )
}

function ChoiceRow({ practice, value, failed, onSave, options }: PracticeRowProps & { options: string[] }) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const current = value && 'Int' in value ? String(value.Int) : value && 'Text' in value ? value.Text : ''

  function pick(option: string | null) {
    setAnchor(null)
    if (option === null) onSave(null)
    else onSave(practice.data_type === 'Int' ? { Int: Number(option) } : { Text: option })
  }

  return (
    <RowShell label={practice.practice}>
      {current ? (
        <button type="button" aria-haspopup="menu" aria-expanded={!!anchor}
          aria-label={t('today.editValue', { name: practice.practice })}
          onClick={(e) => setAnchor(e.currentTarget)}
          className={`flex items-center gap-2 pr-2.5 text-[15px] font-semibold ${failed ? 'text-ui-danger' : ''}`}>
          {current}
          <Chevron />
        </button>
      ) : (
        <EmptyValue required={!!practice.is_required} name={practice.practice} onClick={(e) => setAnchor(e.currentTarget)} />
      )}
      {anchor && (
        <AnchoredMenu anchor={anchor} label={practice.practice} onClose={() => setAnchor(null)}>
          {options.map((o) => (
            <MenuItem key={o} selected={o === current} onSelect={() => pick(o)}>{o}</MenuItem>
          ))}
          <MenuDivider />
          <MenuItem muted onSelect={() => pick(null)}>{t('today.clear')}</MenuItem>
        </AnchoredMenu>
      )}
    </RowShell>
  )
}
