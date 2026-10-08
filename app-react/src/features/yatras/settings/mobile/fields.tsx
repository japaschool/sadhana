import { useState } from 'react'
import { useDebouncedCommit } from '../useDebouncedCommit'
import { FIELD, HINT } from './AdminPage'

/** A text field that saves while you type (after a pause) and on blur; invalid text stays local and says why. */
export function AutosaveText({ id, label, hint, value, validate, onCommit, placeholder }: {
  id: string; label: string; hint?: string; value: string; placeholder?: string
  validate?: (v: string) => string | null; onCommit: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const [seen, setSeen] = useState(value)
  // Follow outside changes (Undo, a refetch), but never over what's being typed.
  if (value !== seen) {
    setSeen(value)
    if (!focused) setDraft(value)
  }
  const error = validate?.(draft) ?? null
  const { schedule, flush } = useDebouncedCommit(() => { if (!error && draft !== value) onCommit(draft) })
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold text-ui-muted">{label}</label>
      <input id={id} value={draft} placeholder={placeholder} aria-invalid={!!error} className={FIELD}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); flush() }}
        onChange={(e) => { setDraft(e.target.value); schedule() }} />
      {error ? <p role="alert" className="text-xs font-semibold text-ui-danger">{error}</p> : hint && <p className={HINT}>{hint}</p>}
    </div>
  )
}
