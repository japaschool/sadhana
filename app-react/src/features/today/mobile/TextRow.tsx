import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PracticeValue } from '../../../types/api'
import { EmptyValue } from './rowParts'

const DEBOUNCE_MS = 600

interface TextRowProps {
  label: string
  value: string
  required: boolean
  failed: boolean
  onSave: (v: PracticeValue | null) => void
}

export function TextRow({ label, value, required, failed, onSave }: TextRowProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const area = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<string | null>(null)
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave })

  const flush = () => {
    clearTimeout(timer.current)
    if (pending.current === null) return
    const text = pending.current
    pending.current = null
    onSaveRef.current(text.trim() ? { Text: text } : null)
  }
  // Leaving the day (row unmounts) must not drop what was typed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => flush, [])

  function change(text: string) {
    setDraft(text)
    pending.current = text
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, DEBOUNCE_MS)
  }

  function start() {
    setDraft(value)
    setEditing(true)
  }

  function finish() {
    flush()
    setEditing(false)
  }

  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft, editing])

  useEffect(() => {
    if (!editing) return
    const el = area.current
    el?.focus()
    const keepVisible = () => el?.scrollIntoView?.({ block: 'nearest' })
    keepVisible()
    window.visualViewport?.addEventListener('resize', keepVisible)
    return () => window.visualViewport?.removeEventListener('resize', keepVisible)
  }, [editing])

  return (
    <div className={`flex flex-col bg-ui-surface px-4 ${editing || value ? 'pb-3.5' : ''}`}>
      <div className="flex min-h-[50px] items-center justify-between gap-3">
        <span className="text-[15px] font-medium">{label}</span>
        {editing ? (
          <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={finish} className="text-sm font-bold text-ui-accent">
            {t('today.done')}
          </button>
        ) : !value ? (
          <EmptyValue required={required} name={label} onClick={start} />
        ) : (
          <button type="button" onClick={start} className="text-xs font-semibold text-ui-muted">{t('today.edit')}</button>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            ref={area}
            aria-label={label}
            value={draft}
            maxLength={1024}
            rows={3}
            onChange={(e) => change(e.target.value)}
            onBlur={finish}
            className="min-h-[120px] resize-none rounded-xl border-[1.5px] border-ui-accent-fill bg-ui-surface px-3.5 py-3 text-[15px] leading-[1.55] shadow-[0_0_0_4px_var(--ui-accent-soft)] outline-none"
          />
          <p className="mt-2 text-xs text-ui-muted">{t('today.savedAsYouType')}</p>
        </>
      ) : value ? (
        <button
          type="button"
          onClick={start}
          className={`whitespace-pre-wrap rounded-xl bg-ui-field px-3 py-2.5 text-left text-sm leading-normal ${failed ? 'text-ui-danger' : 'text-ui-ink2'}`}
        >
          {value}
        </button>
      ) : null}
    </div>
  )
}
