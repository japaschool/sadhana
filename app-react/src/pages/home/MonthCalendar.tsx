import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../api/practices'
import { ACCENT, ACCENT_GRADIENT, ACCENT_SHADOW, BORDER, SURFACE_PANEL } from '../../theme/tokens'

interface MonthCalendarProps {
  selectedDate: Date
  onSelect: (date: Date) => void
  onClose: () => void
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function lastDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

// Monday = 0 offset (ISO week)
function monthStartOffset(monthStart: Date): number {
  const day = monthStart.getDay() // 0=Sun
  return (day + 6) % 7            // Mon=0, Sun=6
}

const glass: React.CSSProperties = {
  background: SURFACE_PANEL,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
}

export function MonthCalendar({ selectedDate, onSelect, onClose }: MonthCalendarProps) {
  const { i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const today = new Date()
  const [monthStart, setMonthStart] = useState(() => startOfMonth(selectedDate))

  const monthEnd = lastDayOfMonth(monthStart)
  const from = isoDate(monthStart)
  const to = isoDate(monthEnd)

  const { data: incompleteDays = [] } = useQuery({
    queryKey: ['incomplete-days', from, to],
    queryFn: () => practicesApi.getIncompleteDays(from, to),
  })

  const incompleteSet = new Set(incompleteDays)
  const offset = monthStartOffset(monthStart)
  const daysInMonth = monthEnd.getDate()

  // Weekday labels Mon–Sun
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i) // 2024-01-01 was Monday
    return d.toLocaleDateString(locale, { weekday: 'narrow' })
  })

  function isToday(day: number): boolean {
    return today.getFullYear() === monthStart.getFullYear() &&
      today.getMonth() === monthStart.getMonth() &&
      today.getDate() === day
  }

  function isSelected(day: number): boolean {
    return selectedDate.getFullYear() === monthStart.getFullYear() &&
      selectedDate.getMonth() === monthStart.getMonth() &&
      selectedDate.getDate() === day
  }

  function isIncomplete(day: number): boolean {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day)
    return incompleteSet.has(isoDate(d))
  }

  function selectDay(day: number) {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day)
    onSelect(d)
    onClose()
  }

  function selectToday() {
    onSelect(today)
    onClose()
  }

  const monthLabel = monthStart.toLocaleDateString(locale, { month: 'long', year: 'numeric' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      {/* Calendar card */}
      <div className="relative rounded-2xl p-4 w-full max-w-sm" style={glass}>

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-bold text-base-content">{monthLabel}</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMonthStart(prev => addMonths(prev, -1))}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.60)' }}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setMonthStart(prev => addMonths(prev, 1))}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.60)' }}
            >
              ›
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 mb-1">
          {weekdays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-base-content/60 py-1">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {/* Blank leading cells */}
          {Array.from({ length: offset }, (_, i) => <div key={`blank-${i}`} />)}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const sel = isSelected(day)
            const tod = isToday(day)
            const inc = isIncomplete(day)
            return (
              <div key={day} className="relative flex items-center justify-center h-9">
                {inc && !sel && (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: '#ef4444' }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => selectDay(day)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all"
                  style={
                    sel
                      ? { background: ACCENT_GRADIENT, color: '#fff', boxShadow: `0 2px 8px ${ACCENT_SHADOW}`, border: 'none' }
                      : tod
                      ? { color: ACCENT, fontWeight: 700, background: 'transparent', border: 'none' }
                      : { color: '#f2f4f6', background: 'transparent', border: 'none' }
                  }
                >
                  {day}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button
            type="button"
            onClick={selectToday}
            className="text-sm font-bold"
            style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Today
          </button>
        </div>
      </div>
    </div>
  )
}
