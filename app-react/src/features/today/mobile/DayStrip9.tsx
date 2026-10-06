import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, isFuture, isSameDay, nineDayWindow, toDateStr } from '../date'

const SWIPE_PX = 60

interface DayStrip9Props { date: Date; incomplete: Set<string>; onSelect: (d: Date) => void }

export function DayStrip9({ date, incomplete, onSelect }: DayStrip9Props) {
  const { i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const start = useRef<{ x: number; y: number } | null>(null)
  const today = new Date()

  return (
    <div
      data-testid="day-strip"
      className="grid touch-pan-y grid-cols-9 px-2 pt-2 pb-3.5"
      onTouchStart={(e) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
      onTouchEnd={(e) => {
        const s = start.current
        start.current = null
        if (!s) return
        const dx = e.changedTouches[0].clientX - s.x
        const dy = e.changedTouches[0].clientY - s.y
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return
        onSelect(addDays(date, dx < 0 ? 7 : -7))
      }}
    >
      {nineDayWindow(date).map((d, i) => {
        const ds = toDateStr(d)
        const selected = isSameDay(d, date)
        const edge = i === 0 || i === 8
        const missing = incomplete.has(ds)
        const numTone = selected
          ? 'bg-ui-selected text-ui-on-selected'
          : isFuture(d, today) || edge ? 'text-ui-faint' : 'text-ui-ink'
        return (
          <button key={ds} type="button" onClick={() => onSelect(d)} aria-label={full.format(d)}
            aria-current={selected ? 'date' : undefined} className="flex flex-col items-center gap-1">
            <span className={`text-[11px] font-semibold ${edge ? 'text-ui-faint' : 'text-ui-faint2'}`}>{weekday.format(d)}</span>
            <span className={`flex h-9 w-9 items-center justify-center rounded-[11px] font-ui-mono text-[15px] font-medium ${numTone}`}>
              {d.getDate()}
            </span>
            <span data-testid={missing ? 'incomplete-dot' : undefined}
              className={`h-[5px] w-[5px] rounded-full ${missing ? 'bg-ui-danger' : ''}`} />
          </button>
        )
      })}
    </div>
  )
}
