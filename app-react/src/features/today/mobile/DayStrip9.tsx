import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, isFuture, isSameDay, nineDayWindow, toDateStr } from '../date'

const AXIS_PX = 8
// The track holds the previous, current and next windows: 7 + 9 + 7 days.
const DAYS = 23

interface DayStrip9Props { date: Date; incomplete: Set<string>; onSelect: (d: Date) => void }

export function DayStrip9({ date, incomplete, onSelect }: DayStrip9Props) {
  const { i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const drag = useRef<{ x: number; y: number; col: number; axis: 'x' | 'y' | null } | null>(null)
  const weeks = useRef(0)
  const [offset, setOffset] = useState({ px: 0, settling: false })
  const today = new Date()
  const first = addDays(nineDayWindow(date)[0], -7)

  const settle = () => {
    const w = weeks.current
    weeks.current = 0
    setOffset({ px: 0, settling: false })
    if (w) onSelect(addDays(date, w * 7))
  }

  return (
    <div
      data-testid="day-strip"
      className="touch-pan-y overflow-hidden px-2 pt-2 pb-3.5"
      onTouchStart={(e) => {
        drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, col: (e.currentTarget.clientWidth - 16) / 9, axis: null }
      }}
      onTouchMove={(e) => {
        const d = drag.current
        if (!d) return
        const dx = e.touches[0].clientX - d.x
        const dy = e.touches[0].clientY - d.y
        if (!d.axis && Math.max(Math.abs(dx), Math.abs(dy)) > AXIS_PX) d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        if (d.axis === 'x') setOffset({ px: Math.max(-7 * d.col, Math.min(7 * d.col, dx)), settling: false })
      }}
      onTouchEnd={(e) => {
        const d = drag.current
        drag.current = null
        if (d?.axis !== 'x') return
        const dx = e.changedTouches[0].clientX - d.x
        // Past one day the week turns; otherwise it springs back.
        weeks.current = Math.abs(dx) > d.col ? (dx < 0 ? 1 : -1) : 0
        const px = -weeks.current * 7 * d.col
        if (px === offset.px) settle()
        else setOffset({ px, settling: true })
      }}
    >
      <div
        data-testid="day-track"
        className={`grid ${offset.settling ? 'transition-transform duration-300 ease-out' : ''}`}
        style={{
          gridTemplateColumns: `repeat(${DAYS}, 1fr)`,
          width: `${(DAYS / 9) * 100}%`,
          transform: `translateX(calc(${(-7 / DAYS) * 100}% + ${offset.px}px))`,
        }}
        onTransitionEnd={(e) => { if (e.target === e.currentTarget) settle() }}
      >
        {Array.from({ length: DAYS }, (_, j) => addDays(first, j)).map((d, j) => {
          const ds = toDateStr(d)
          const selected = isSameDay(d, date)
          const edge = j === 7 || j === 15
          const missing = incomplete.has(ds)
          const numTone = selected && isSameDay(d, today)
            ? 'bg-ui-selected text-ui-on-selected'
            : selected ? 'border-[1.5px] border-ui-selected text-ui-ink'
            : isFuture(d, today) || edge ? 'text-ui-faint' : 'text-ui-ink'
          const visible = j >= 7 && j < 16
          return (
            <button key={ds} type="button" onClick={() => onSelect(d)} aria-label={full.format(d)}
              aria-hidden={visible ? undefined : true} tabIndex={visible ? undefined : -1}
              aria-current={selected ? 'date' : undefined} className="flex flex-col items-center gap-1">
              <span className={`text-[11px] font-semibold ${edge ? 'text-ui-faint' : 'text-ui-faint2'}`}>{weekday.format(d)}</span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-[11px] font-ui-mono text-[15px] font-medium ${numTone}`}>
                {d.getDate()}
              </span>
              <span data-testid={missing && visible ? 'incomplete-dot' : undefined}
                className={`h-[5px] w-[5px] rounded-full ${missing ? 'bg-ui-danger' : ''}`} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
