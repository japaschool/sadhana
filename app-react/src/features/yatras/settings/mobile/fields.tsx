import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import { onRadioKeys, radioTabIndex } from '../../../../ui/radioKeys'
import { useDebouncedCommit } from '../useDebouncedCommit'
import { BTN, FIELD, HINT } from './AdminPage'

/** A text field that saves while you type (after a pause) and on blur; invalid text stays local and says why. */
export function AutosaveText({ id, label, hint, value, validate, onCommit, placeholder }: {
  id: string; label: string; hint?: string; value: string; placeholder?: string
  validate?: (v: string) => string | null; onCommit: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const [seen, setSeen] = useState(value)
  // Errors wait for a pause in typing, so they aren't announced on every keystroke.
  const [settled, setSettled] = useState(true)
  // Follow outside changes (Undo, a refetch), but never over what's being typed.
  if (value !== seen) {
    setSeen(value)
    if (!focused) setDraft(value)
  }
  const error = validate?.(draft) ?? null
  const { schedule, flush } = useDebouncedCommit(() => {
    setSettled(true)
    if (!error && draft !== value) onCommit(draft)
  })
  const shown = settled ? error : null
  const msgId = `${id}-msg`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold text-ui-muted">{label}</label>
      <input id={id} value={draft} placeholder={placeholder} aria-invalid={!!shown} aria-describedby={shown || hint ? msgId : undefined} className={FIELD}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          flush()
          setSettled(true)
          // What's saved is trimmed; show it that way.
          if (!error) setDraft((d) => d.trim())
        }}
        onChange={(e) => { setDraft(e.target.value); setSettled(false); schedule() }} />
      {shown
        ? <p id={msgId} role="alert" className="text-xs font-semibold text-ui-danger">{shown}</p>
        : hint && <p id={msgId} className={HINT}>{hint}</p>}
    </div>
  )
}

export function SheetHeader({ title, onClose, children }: { title: string; onClose: () => void; children?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3">
      {children}
      <h2 className="min-w-0 flex-1 text-xl font-extrabold break-words text-ui-ink">{title}</h2>
      <button type="button" aria-label={t('yatraSettings.close')} onClick={onClose}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-chip text-lg text-ui-muted">×</button>
    </div>
  )
}

/** Asks before something that can't be undone. */
export function ConfirmSheet({ title, text, confirm, busy, disabled, onConfirm, onClose, children }: {
  title: string; text: string; confirm: string; busy?: boolean; disabled?: boolean
  onConfirm: () => void; onClose: () => void; children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet label={title} onClose={onClose}>
      <h2 className="text-xl font-extrabold break-words text-ui-ink">{title}</h2>
      <p className="text-sm leading-normal text-ui-ink2">{text}</p>
      {children}
      <div className="flex flex-col gap-2.5">
        <button type="button" disabled={busy || disabled} onClick={onConfirm} className={`${BTN} bg-ui-danger text-white disabled:opacity-50`}>{confirm}</button>
        <button type="button" onClick={onClose} className={`${BTN} border border-ui-control text-ui-ink`}>{t('common.cancel')}</button>
      </div>
    </BottomSheet>
  )
}

/** A wrapping set of chips; picks one. */
export function ChoiceChips<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  const values = options.map((o) => o.value)
  return (
    <div className="flex flex-col gap-2">
      <span aria-hidden className="text-[13px] font-bold text-ui-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2" onKeyDown={(e) => onRadioKeys(e, values, value, onChange)}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} tabIndex={radioTabIndex(values, value, o.value)}
            onClick={() => onChange(o.value)}
            className={`min-h-9 rounded-full px-3.5 text-[13px] font-bold ${o.value === value ? 'bg-ui-selected text-ui-on-selected' : 'bg-ui-chip text-ui-ink2'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
