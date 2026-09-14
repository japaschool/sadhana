import { useState, useRef, memo } from 'react'
import { formatTimeInput, parseTime } from './inputFormat'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LuToggleRight, LuHash, LuTimer, LuClock, LuType } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../hooks/useToast'
import { practicesApi } from '../../api/practices'
import type { UserPractice, PracticeValue, DiaryEntry } from '../../types/api'
import { ACCENT, ACCENT_GRADIENT, SURFACE_ELEVATED, ACCENT_LIGHT, ACCENT_RING, BORDER } from '../../theme/tokens'

interface PracticeCardProps {
  practice: UserPractice
  date: string
  currentValue?: PracticeValue
}

const TYPE_META: Record<string, {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  bg: string
}> = {
  Bool:     { icon: LuToggleRight, color: '#e8905a', bg: 'rgba(232,144,90,0.16)'   },
  Int:      { icon: LuHash,        color: '#818cf8', bg: 'rgba(129,140,248,0.16)'  },
  Duration: { icon: LuTimer,       color: '#fbbf24', bg: 'rgba(251,191,36,0.16)'  },
  Time:     { icon: LuClock,       color: '#60a5fa', bg: 'rgba(96,165,250,0.16)'  },
  Text:     { icon: LuType,        color: '#fb7185', bg: 'rgba(251,113,133,0.16)' },
}

/* Format total minutes → "45 min" | "1h" | "1h 30m" */
function fmtDur(min: number): string {
  if (min <= 0) return '0 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const field: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1.5px solid rgba(255,255,255,0.10)',
  borderRadius: '0.625rem',
  outline: 'none',
  fontWeight: 700,
  textAlign: 'center',
  transition: 'border-color 0.15s, background 0.15s',
}

function fieldFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = 'rgba(245,158,11,0.55)'
  e.target.style.background = 'rgba(245,158,11,0.08)'
}
function fieldBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = 'rgba(255,255,255,0.10)'
  e.target.style.background = 'rgba(255,255,255,0.06)'
}


export function DurationQuickAddModal({ onAdd, onClose, isPending }: { onAdd: (minutes: number) => void; onClose: () => void; isPending?: boolean }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isPending) return
    const n = parseInt(value, 10)
    if (!isNaN(n) && n > 0) onAdd(n)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={isPending ? undefined : onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative rounded-2xl p-5 w-72 flex flex-col gap-4"
        style={{ background: '#26313d', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <h3 className="text-sm font-semibold text-base-content">{t('home.addMinutes')}</h3>
        <div className="flex flex-col gap-1">
          <input
            type="number"
            inputMode="numeric"
            min="1"
            aria-label="minutes"
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('home.addMinutesPlaceholder')}
            className="w-full text-center text-lg font-bold rounded-xl h-12 outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}
          />
          {focused && (
            <p className="text-[10px] text-center" style={{ color: 'rgba(242,244,246,0.7)' }}>
              {t('home.durationHint')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.60)', border: 'none' }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: ACCENT_GRADIENT, color: 'white', border: 'none', opacity: isPending ? 0.7 : 1 }}
          >
            {isPending && <span className="loading loading-spinner loading-xs" />}
            {t('common.add')}
          </button>
        </div>
      </form>
    </div>
  )
}

export const PracticeCard = memo(function PracticeCard({ practice, date, currentValue }: PracticeCardProps) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const hasValue = currentValue !== undefined
  const meta = TYPE_META[practice.data_type]

  /* ── Extract values ── */
  const boolVal = currentValue && 'Bool'     in currentValue ? currentValue.Bool      : false
  const intVal  = currentValue && 'Int'      in currentValue ? currentValue.Int       : 0
  const durVal  = currentValue && 'Duration' in currentValue ? currentValue.Duration  : 0
  const textVal = currentValue && 'Text'     in currentValue ? currentValue.Text      : ''
  const timeH   = currentValue && 'Time'     in currentValue
    ? (currentValue as { Time: { h: number; m: number } }).Time.h : 0
  const timeM   = currentValue && 'Time'     in currentValue
    ? (currentValue as { Time: { h: number; m: number } }).Time.m : 0

  /* ── Local state ── */
  const [localBool, setLocalBool]     = useState(boolVal)
  const [flash, setFlash]             = useState(false)
  const [errorFlash, setErrorFlash]   = useState(false)

  const initialTime = (timeH > 0 || timeM > 0)
    ? `${String(timeH).padStart(2, '0')}:${String(timeM).padStart(2, '0')}`
    : ''
  const [timeStr, setTimeStr] = useState(initialTime)

  const isFreeText = practice.data_type === 'Text'

  /* ── Value refs ── */
  const durRef   = useRef(durVal)

  /* ── DOM refs ── */
  const durEl  = useRef<HTMLInputElement>(null)

  const mutation = useMutation({
    mutationFn: (v: PracticeValue) => practicesApi.saveDiaryEntry(date, practice.practice, v),
    onMutate: async (newValue) => {
      await qc.cancelQueries({ queryKey: ['diary', date] })
      const prev = qc.getQueryData<DiaryEntry[]>(['diary', date])
      qc.setQueryData<DiaryEntry[]>(['diary', date], (old = []) => {
        const entry: DiaryEntry = { practice: practice.practice, data_type: practice.data_type, value: newValue }
        const idx = old.findIndex(e => e.practice === practice.practice)
        if (idx >= 0) { const next = [...old]; next[idx] = entry; return next }
        return [...old, entry]
      })
      return { prev }
    },
    onSuccess: () => {
      setFlash(true)
      setTimeout(() => setFlash(false), 1200)
    },
    onError: (_err, _val, ctx) => {
      if (ctx?.prev) qc.setQueryData(['diary', date], ctx.prev)
      setErrorFlash(true)
      setTimeout(() => setErrorFlash(false), 600)
      showToast({ message: t('home.saveFailed'), variant: 'error' })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['diary', date] })
    },
  })

  const save = (v: PracticeValue) => mutation.mutate(v)

  const TypeIcon = meta?.icon

  return (
    <div
      className={`rounded-2xl px-4 py-3.5 gap-3 min-h-[60px] transition-all duration-300 ${isFreeText ? 'flex flex-col items-stretch' : 'flex items-center'}`}
      style={{
        background: SURFACE_ELEVATED,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: errorFlash
          ? '1px solid rgba(225,29,72,0.55)'
          : flash
          ? `1px solid ${ACCENT_LIGHT}`
          : hasValue
          ? `1px solid ${ACCENT_RING}`
          : `1px solid ${BORDER}`,
        boxShadow: errorFlash
          ? '0 2px 12px rgba(225,29,72,0.10)'
          : flash
          ? '0 2px 12px rgba(245,158,11,0.16)'
          : '0 2px 12px rgba(0,0,0,0.20)',
      }}
    >
      {isFreeText ? (
        <div className="flex items-center gap-3">
          {/* Type icon */}
          {TypeIcon && meta && (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: meta.bg }}
            >
              <TypeIcon className="w-4 h-4" style={{ color: meta.color }} />
            </div>
          )}
          {/* Name */}
          <span className="flex-1 min-w-0 text-sm font-semibold text-base-content leading-tight truncate">
            {practice.practice}
            {practice.is_required && (
              <span className="ml-1 text-xs font-bold" style={{ color: ACCENT }}>*</span>
            )}
          </span>
        </div>
      ) : (
        <>
          {/* Type icon */}
          {TypeIcon && meta && (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: localBool && practice.data_type === 'Bool'
                  ? 'rgba(245,158,11,0.18)' : meta.bg,
              }}
            >
              <TypeIcon className="w-4 h-4" style={{ color: meta.color }} />
            </div>
          )}

          {/* Name */}
          <span className="flex-1 min-w-0 text-sm font-semibold text-base-content leading-tight truncate">
            {practice.practice}
            {practice.is_required && (
              <span className="ml-1 text-xs font-bold" style={{ color: ACCENT }}>*</span>
            )}
          </span>
        </>
      )}

      {/* ── Bool ── */}
      {practice.data_type === 'Bool' && (
        <button
          type="button"
          role="switch"
          aria-checked={localBool}
          onClick={() => { const n = !localBool; setLocalBool(n); save({ Bool: n }) }}
          className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
          style={{ backgroundColor: localBool ? ACCENT : 'rgba(255,255,255,0.15)' }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: localBool ? 'translateX(1.25rem)' : 'translateX(0)' }}
          />
        </button>
      )}

      {/* ── Duration ── */}
      {practice.data_type === 'Duration' && (
        <input
          ref={durEl}
          type="text" inputMode="numeric"
          defaultValue={fmtDur(durVal)}
          aria-label={`${practice.practice} duration`}
          placeholder="—"
          className="focus:outline-none text-sm flex-shrink-0"
          style={{ ...field, width: '5.5rem', height: '2.25rem', color: durVal > 0 ? ACCENT : 'rgba(242,244,246,0.7)' }}
          onFocus={(e) => { fieldFocus(e); e.target.value = durRef.current > 0 ? String(durRef.current) : ''; setTimeout(() => e.target.select(), 0) }}
          onBlur={(e) => {
            fieldBlur(e)
            const v = parseInt(e.target.value, 10)
            durRef.current = isNaN(v) || v < 0 ? 0 : v
            e.target.value = fmtDur(durRef.current)
            e.target.style.color = durRef.current > 0 ? ACCENT : 'rgba(242,244,246,0.7)'
            save({ Duration: durRef.current })
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
      )}

      {/* ── Int ── */}
      {practice.data_type === 'Int' && (
        practice.dropdown_variants ? (
          <select
            defaultValue={intVal ? String(intVal) : ''}
            aria-label={practice.practice}
            className="focus:outline-none text-sm cursor-pointer"
            style={{ ...field, width: '5rem', height: '2.25rem', padding: '0 0.5rem', textAlign: 'left', fontWeight: 500, color: intVal > 0 ? ACCENT : 'rgba(242,244,246,0.7)' }}
            onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) save({ Int: n }) }}
          >
            <option value="">—</option>
            {practice.dropdown_variants.split('\n').map(v => v.trim()).filter(Boolean).map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        ) : (
          <input
            type="number" inputMode="numeric" min={0}
            defaultValue={intVal || ''}
            aria-label={practice.practice}
            placeholder="—"
            className="focus:outline-none text-sm flex-shrink-0"
            style={{ ...field, width: '4rem', height: '2.25rem', color: intVal > 0 ? ACCENT : 'rgba(242,244,246,0.7)' }}
            onFocus={fieldFocus}
            onBlur={(e) => {
              fieldBlur(e)
              const n = parseInt(e.target.value, 10)
              save({ Int: isNaN(n) || n < 0 ? 0 : n })
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          />
        )
      )}

      {/* ── Time — single HH:MM field ── */}
      {practice.data_type === 'Time' && (
        <input
          type="text" inputMode="numeric"
          value={timeStr}
          aria-label={practice.practice}
          placeholder="HH:MM"
          className="focus:outline-none text-sm"
          style={{ ...field, width: '5rem', height: '2.25rem', color: timeStr ? ACCENT : 'rgba(242,244,246,0.7)' }}
          onFocus={fieldFocus}
          onChange={(e) => setTimeStr(formatTimeInput(e.target.value))}
          onBlur={(e) => {
            fieldBlur(e)
            const parsed = parseTime(timeStr)
            if (parsed) save({ Time: parsed })   // empty/incomplete → no save (retain prior)
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
      )}

      {/* ── Text — always a free-text textarea (matches Rust; no dropdown) ── */}
      {practice.data_type === 'Text' && (
        <textarea
          defaultValue={textVal}
          placeholder="—"
          aria-label={practice.practice}
          rows={3}
          maxLength={1024}
          className="focus:outline-none text-sm w-full resize-none"
          style={{ ...field, textAlign: 'left', fontWeight: 500, padding: '0.5rem 0.625rem', color: textVal ? ACCENT : 'rgba(242,244,246,0.7)' }}
          onFocus={fieldFocus}
          onBlur={(e) => { fieldBlur(e); save({ Text: e.target.value }) }}
        />
      )}
    </div>
  )
})
