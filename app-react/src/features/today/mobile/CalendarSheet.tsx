import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../../api/practices'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { isFuture, isSameDay, monthGrid, toDateStr } from '../date'
import { capitalize } from '../values'

const FIRST_YEAR = 2015
const PILL = 'rounded-[10px] border border-ui-control bg-ui-surface px-2.5 py-1.5 text-xl font-extrabold'
const SQUARE = 'flex h-10 w-10 items-center justify-center rounded-xl border border-ui-control bg-ui-surface font-bold'

interface CalendarSheetProps { date: Date; onSelect: (d: Date) => void; onClose: () => void }

export function CalendarSheet({ date, onSelect, onClose }: CalendarSheetProps) {
  const { t } = useTranslation()
  return (
    <BottomSheet label={t('today.calendar')} onClose={onClose}>
      <CalendarMonth date={date} onPick={(d) => { onSelect(d); onClose() }} />
    </BottomSheet>
  )
}

/** The month grid with its pickers and footer; the bottom sheet and the desktop log popover both wrap it. */
export function CalendarMonth({ date, onPick: pick }: { date: Date; onPick: (d: Date) => void }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const [view, setView] = useState({ y: date.getFullYear(), m: date.getMonth() })
  const [picker, setPicker] = useState<{ kind: 'month' | 'year'; anchor: HTMLElement } | null>(null)

  const from = toDateStr(new Date(view.y, view.m, 1))
  const to = toDateStr(new Date(view.y, view.m + 1, 0))
  const { data = [] } = useQuery({ queryKey: ['incomplete-days', from, to], queryFn: () => practicesApi.getIncompleteDays(from, to) })
  const incomplete = new Set(data)

  const today = new Date()
  const monthName = (m: number) => capitalize(new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, m, 1)), locale)
  const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  const weekdays = Array.from({ length: 7 }, (_, i) => narrow.format(new Date(2024, 0, 1 + i))) // 1 Jan 2024 is a Monday
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const years = Array.from({ length: today.getFullYear() - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)

  const shift = (n: number) => setView((v) => {
    const d = new Date(v.y, v.m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button type="button" aria-haspopup="menu" className={PILL}
            onClick={(e) => setPicker({ kind: 'month', anchor: e.currentTarget })}>
            {monthName(view.m)} ▾
          </button>
          <button type="button" aria-haspopup="menu" className={PILL}
            onClick={(e) => setPicker({ kind: 'year', anchor: e.currentTarget })}>
            {view.y} ▾
          </button>
        </div>
        <div className="flex gap-1.5">
          <button type="button" aria-label={t('today.prevMonth')} onClick={() => shift(-1)} className={SQUARE}>‹</button>
          <button type="button" aria-label={t('today.nextMonth')} onClick={() => shift(1)} className={SQUARE}>›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((w, i) => <span key={i} className="text-[11px] font-bold text-ui-faint">{w}</span>)}
        {monthGrid(view.y, view.m).map((d, i) => {
          if (!d) return <span key={`blank-${i}`} />
          const ds = toDateStr(d)
          const selected = isSameDay(d, date)
          const future = isFuture(d, today)
          const missing = incomplete.has(ds)
          return (
            <button key={ds} type="button" disabled={future} onClick={() => pick(d)} aria-label={full.format(d)}
              aria-current={selected ? 'date' : undefined} className="flex h-[46px] flex-col items-center justify-center gap-[3px]">
              <span className={`flex h-[34px] w-[38px] items-center justify-center rounded-[10px] font-ui-mono text-sm ${selected ? 'bg-ui-selected font-semibold text-ui-on-selected' : future ? 'text-ui-faint' : ''}`}>
                {d.getDate()}
              </span>
              <span data-testid={missing ? 'incomplete-dot' : undefined}
                className={`h-[5px] w-[5px] rounded-full ${missing ? 'bg-ui-danger' : ''}`} />
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t border-ui-control pt-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ui-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ui-danger" />
          {t('today.legendMissing')}
        </span>
        <button type="button" onClick={() => pick(new Date())} className="text-sm font-bold text-ui-accent">{t('today.goToday')}</button>
      </div>

      {picker && (
        <AnchoredMenu anchor={picker.anchor} label={t(picker.kind === 'month' ? 'today.month' : 'today.year')} onClose={() => setPicker(null)}>
          {picker.kind === 'month'
            ? Array.from({ length: 12 }, (_, m) => (
                <MenuItem key={m} selected={m === view.m} onSelect={() => { setView((v) => ({ ...v, m })); setPicker(null) }}>
                  {monthName(m)}
                </MenuItem>
              ))
            : years.map((y) => (
                <MenuItem key={y} selected={y === view.y} onSelect={() => { setView((v) => ({ ...v, y })); setPicker(null) }}>
                  {y}
                </MenuItem>
              ))}
        </AnchoredMenu>
      )}
    </>
  )
}
