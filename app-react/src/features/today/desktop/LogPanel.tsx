import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useNetworkStatus from '../../../hooks/useNetworkStatus'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { ListGroup } from '../../../ui/primitives/ListGroup'
import { PanelPopover } from '../../../ui/primitives/PanelPopover'
import { addDays, toDateStr } from '../date'
import { NoPractices } from '../NoPractices'
import { useToday } from '../useToday'
import { CalendarMonth } from '../mobile/CalendarSheet'
import { DateHeader } from '../mobile/DateHeader'
import { DayStrip9 } from '../mobile/DayStrip9'
import { PracticeRow } from '../mobile/PracticeRow'

const STEP = 'flex h-9 w-9 items-center justify-center rounded-[10px] text-lg text-ui-muted'

function isEditable(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/** The desktop's always-open day log: date + 9-day strip on top, the day's practices below, month popover inside the panel. */
export function LogPanel({ date, onDate }: { date: Date; onDate: (d: Date) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isOnline = useNetworkStatus()
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(null)
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const today = useToday(date)
  const dateStr = toDateStr(date)

  // ⌘/Ctrl + ↑↓ steps a day, unless the keys belong to a field being edited.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || isEditable(e.target)) return
      e.preventDefault()
      onDate(addDays(date, e.key === 'ArrowUp' ? -1 : 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [date, onDate])

  const more = [
    { label: t('home.addPractice'), onSelect: () => navigate('/settings/practices/new') },
    { label: t('home.editPractices'), onSelect: () => navigate('/settings/practices') },
  ]

  return (
    <aside aria-label={t('today.tabLog')} data-popover-bounds
      className="sticky top-0 flex h-dvh w-[360px] shrink-0 flex-col border-l border-ui-control bg-ui-surface xl:w-[400px]">
      <div className="flex flex-col gap-2 border-b border-ui-hairline px-3 pt-[22px]">
        <div className="flex items-start justify-between gap-3 pl-3">
          <DateHeader date={date} summary={today.summary} onOpenCalendar={setCalendarAnchor} />
          <div className="flex shrink-0 items-center">
            <button type="button" aria-label={t('today.prevWeek')} onClick={() => onDate(addDays(date, -7))} className={STEP}>‹</button>
            <button type="button" aria-label={t('today.nextWeek')} onClick={() => onDate(addDays(date, 7))} className={STEP}>›</button>
            <button type="button" aria-label={t('today.more')} aria-haspopup="menu" onClick={(e) => setMoreAnchor(e.currentTarget)}
              className="ml-1 flex h-9 w-9 items-center justify-center gap-[3px] rounded-full border border-ui-hairline bg-ui-surface">
              {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-ui-ink" />)}
            </button>
          </div>
        </div>
        <DayStrip9 date={date} incomplete={today.incomplete} onSelect={onDate} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto bg-ui-bg px-5 py-4">
        {!isOnline && (
          <p role="status" className="rounded-xl bg-ui-accent-soft px-3 py-2 text-xs font-semibold text-ui-accent">{t('home.offline')}</p>
        )}
        {today.isLoading ? (
          <ListGroup label={t('today.group')}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex h-[50px] items-center bg-ui-surface px-4">
                <div className="h-3.5 w-1/2 animate-pulse rounded-full bg-ui-field" />
              </div>
            ))}
          </ListGroup>
        ) : today.isError ? (
          <p role="alert" className="rounded-2xl bg-ui-surface px-4 py-3 text-sm text-ui-danger">{t('common.error')}</p>
        ) : today.practices.length === 0 ? (
          <NoPractices onSeed={today.seedStarters} seeding={today.isSeeding} />
        ) : (
          <ListGroup label={t('today.group')}>
            {today.practices.map((p) => (
              <PracticeRow key={`${p.id}-${dateStr}`} practice={p} value={today.values[p.practice]}
                failed={today.failed === p.practice} onSave={(v) => today.save(p, v)} />
            ))}
          </ListGroup>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-ui-hairline px-6 py-3.5 text-xs text-ui-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-ui-good" />
          {t('today.savedAsYouType')}
        </span>
        <span className="font-ui-mono">⌘ ↑↓ {t('today.changeDay')}</span>
      </div>

      {calendarAnchor && (
        <PanelPopover anchor={calendarAnchor} label={t('today.calendar')} onClose={() => setCalendarAnchor(null)}>
          <CalendarMonth date={date} onPick={(d) => { onDate(d); setCalendarAnchor(null) }} />
        </PanelPopover>
      )}
      {moreAnchor && (
        <AnchoredMenu anchor={moreAnchor} label={t('today.more')} onClose={() => setMoreAnchor(null)}>
          {more.map((a) => (
            <MenuItem key={a.label} onSelect={() => { setMoreAnchor(null); a.onSelect() }}>{a.label}</MenuItem>
          ))}
        </AnchoredMenu>
      )}
    </aside>
  )
}
