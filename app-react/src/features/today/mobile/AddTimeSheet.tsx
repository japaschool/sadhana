import { useEffect, useReducer, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { PanelPopover } from '../../../ui/primitives/PanelPopover'
import { Keypad, type KeypadKey } from '../../../ui/primitives/Keypad'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import type { PracticeValue } from '../../../types/api'
import { formatDuration } from '../values'

export type TimeMode = 'add' | 'set'

const CHIPS = [5, 10, 15, 30, 60]
const MAX_MINUTES = 9999

interface Amount { mode: TimeMode; minutes: number; typing: boolean }
type Action =
  | { type: 'key'; key: KeypadKey }
  | { type: 'chip'; minutes: number }
  | { type: 'mode'; mode: TimeMode; current: number }

const init = (mode: TimeMode, current: number): Amount => ({ mode, minutes: mode === 'set' ? current : 0, typing: false })

// Chips stack; the first typed digit replaces whatever the chips built up.
function reducer(s: Amount, a: Action): Amount {
  switch (a.type) {
    case 'mode':
      return init(a.mode, a.current)
    case 'chip':
      return { ...s, minutes: Math.min(MAX_MINUTES, s.minutes + a.minutes), typing: false }
    case 'key': {
      if (a.key === 'C') return { ...s, minutes: 0, typing: false }
      if (a.key === '⌫') return { ...s, minutes: Math.floor(s.minutes / 10), typing: true }
      const minutes = s.typing ? s.minutes * 10 + Number(a.key) : Number(a.key)
      return minutes > MAX_MINUTES ? s : { ...s, minutes, typing: true }
    }
  }
}

interface AddTimeSheetProps {
  /** The ＋ that opened it: inside the desktop log panel the pad pops over the panel next to it, elsewhere it's a bottom sheet. */
  anchor?: HTMLElement | null
  practice: string
  current: number
  initialMode: TimeMode
  onSave: (v: PracticeValue | null) => void
  onClose: () => void
}

export function AddTimeSheet({ anchor, practice, current, initialMode, onSave, onClose }: AddTimeSheetProps) {
  const { t } = useTranslation()
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const [s, dispatch] = useReducer(reducer, init(initialMode, current))
  const total = s.mode === 'add' ? current + s.minutes : s.minutes
  const clearing = s.mode === 'set' && s.minutes === 0
  const disabled = s.mode === 'add' && s.minutes === 0
  const label = clearing
    ? t('today.clear')
    : s.mode === 'add'
      ? t('today.addAmount', { amount: formatDuration(s.minutes, units) })
      : t('today.setAmount', { amount: formatDuration(total, units) })

  function submit() {
    onSave(clearing ? null : { Duration: total })
    onClose()
  }

  // Physical keyboard mirrors the on-screen keypad; Enter submits.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(undefined)
  useEffect(() => {
    onKeyRef.current = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) dispatch({ type: 'key', key: e.key as KeypadKey })
      else if (e.key === 'Backspace') dispatch({ type: 'key', key: '⌫' })
      else if (e.key === 'Delete') dispatch({ type: 'key', key: 'C' })
      else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && !disabled) submit()
      else return
      e.preventDefault()
    }
  })
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyRef.current?.(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="truncate text-xl font-extrabold">{practice}</h2>
          <p className="text-[13px] text-ui-muted">
            {t('today.logged')} <span className="font-ui-mono text-ui-ink">{formatDuration(current, units)}</span>
          </p>
        </div>
        <SegmentedControl
          label={t('today.mode')}
          value={s.mode}
          onChange={(mode) => dispatch({ type: 'mode', mode, current })}
          options={[{ value: 'add', label: t('today.modeAdd') }, { value: 'set', label: t('today.modeSet') }]}
        />
      </div>

      <div className="flex items-end justify-between rounded-[20px] bg-ui-field px-5 py-[18px]">
        <div data-testid="amount" className="flex items-baseline gap-1.5 text-ui-accent">
          <span className="font-ui-mono text-5xl leading-none font-medium">{s.mode === 'add' ? `+${s.minutes}` : s.minutes}</span>
          <span className="text-base font-semibold">{units.min}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[.08em] text-ui-muted">{t('today.newTotal')}</span>
          <span data-testid="new-total" className="font-ui-mono text-xl font-semibold">{formatDuration(total, units)}</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {CHIPS.map((m) => (
          <button key={m} type="button" onClick={() => dispatch({ type: 'chip', minutes: m })}
            className="h-10 rounded-xl border border-ui-control font-ui-mono text-sm font-semibold">
            +{m}
          </button>
        ))}
      </div>

      <Keypad onKey={(key) => dispatch({ type: 'key', key })} />

      <div className="grid grid-cols-[1fr_2fr] gap-2.5">
        <button type="button" onClick={onClose} className="h-[52px] rounded-2xl text-[15px] font-bold text-ui-muted">
          {t('common.cancel')}
        </button>
        <button type="button" onClick={submit} disabled={disabled}
          className="h-[52px] rounded-2xl bg-ui-primary text-[15px] font-bold text-ui-on-primary disabled:opacity-40">
          {label}
        </button>
      </div>
    </>
  )
  return anchor?.closest('[data-popover-bounds]')
    ? <PanelPopover anchor={anchor} label={practice} onClose={onClose}>{body}</PanelPopover>
    : <BottomSheet label={practice} onClose={onClose}>{body}</BottomSheet>
}
