import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MonthCalendar } from './MonthCalendar'
import { ACCENT, ACCENT_GRADIENT, ACCENT_SHADOW, BORDER, SURFACE_PANEL } from '../../theme/tokens'

interface WeekCalendarProps {
  date: Date
  onDateChange: (d: Date) => void
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(d.getDate() + n)
  return result
}

export function getWeekDays(date: Date): Date[] {
  const day = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function WeekCalendar({ date, onDateChange }: WeekCalendarProps) {
  const { i18n, t } = useTranslation()
  const locale = i18n.language || 'en'
  const today = new Date()
  const week = getWeekDays(date)
  const prevWeekDay = addDays(week[0], -1)
  const nextWeekDay = addDays(week[6], 1)

  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const [translateX, setTranslateX] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const goToPrevWeek = () => {
    onDateChange(date.getDay() === 1 ? addDays(date, -1) : addDays(date, -7))
  }
  const goToNextWeek = () => {
    onDateChange(date.getDay() === 0 ? addDays(date, 1) : addDays(date, 7))
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setAnimating(false)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (Math.abs(dx) < Math.abs(dy)) return
    setTranslateX(Math.max(-100, Math.min(100, dx)))
  }
  const onTouchEnd = () => {
    setAnimating(true)
    if (translateX > 60) goToPrevWeek()
    else if (translateX < -60) goToNextWeek()
    setTranslateX(0)
    touchStartX.current = null
    touchStartY.current = null
  }

  const renderDay = (d: Date, isOutside: boolean, onClick: () => void) => {
    const selected = isSameDay(d, date)
    const isToday = isSameDay(d, today)
    const narrowDay = d.toLocaleDateString(locale, { weekday: 'narrow' })

    return (
      <button
        key={d.toISOString()}
        type="button"
        onClick={onClick}
        className="flex flex-col items-center gap-1 py-1 w-full focus:outline-none"
        style={{ opacity: isOutside ? 0.28 : 1 }}
      >
        <span
          className="text-xs leading-none"
          style={{
            fontWeight: selected ? 700 : 400,
            color: selected ? ACCENT : 'rgba(242,244,246,0.7)',
          }}
        >
          {narrowDay}
        </span>
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-150"
          style={
            selected
              ? {
                  background: ACCENT_GRADIENT,
                  color: '#fff',
                  boxShadow: `0 2px 8px ${ACCENT_SHADOW}`,
                }
              : isToday
              ? { color: ACCENT, fontWeight: 600 }
              : { color: '#f2f4f6' }
          }
        >
          {d.getDate()}
        </div>
      </button>
    )
  }

  const monthYear = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const shortDate = date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div
      className="rounded-2xl select-none overflow-hidden"
      style={{
        background: SURFACE_PANEL,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${BORDER}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="text-xs font-semibold tracking-wide uppercase focus:outline-none"
          style={{ color: 'rgba(242,244,246,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {monthYear}
        </button>
        <div className="flex items-center gap-2">
          {!isSameDay(date, today) && (
            <button
              type="button"
              onClick={() => onDateChange(new Date())}
              aria-label="Go to today"
              className="text-xs font-semibold px-2 py-0.5 rounded-full focus:outline-none"
              style={{ color: ACCENT, background: 'rgba(245,158,11,0.08)', border: 'none', cursor: 'pointer' }}
            >
              {t('home.today')}
            </button>
          )}
          <span className="text-xs font-semibold" style={{ color: '#f2f4f6' }}>
            {shortDate}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 16px' }} />

      {/* Week grid */}
      <div className="px-1 pb-3 pt-1 touch-pan-y">
        <div
          className={`grid grid-cols-9 items-end ${animating ? 'transition-transform duration-250 ease-out' : ''}`}
          style={{ transform: `translateX(${translateX}px)` }}
        >
          <div className="flex justify-center">
            {renderDay(prevWeekDay, true, goToPrevWeek)}
          </div>
          {week.map((d) => (
            <div key={d.toISOString()} className="flex justify-center">
              {renderDay(d, false, () => onDateChange(d))}
            </div>
          ))}
          <div className="flex justify-center">
            {renderDay(nextWeekDay, true, goToNextWeek)}
          </div>
        </div>
      </div>

      {calendarOpen && (
        <MonthCalendar
          selectedDate={date}
          onSelect={onDateChange}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  )
}
