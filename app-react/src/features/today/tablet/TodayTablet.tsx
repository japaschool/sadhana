import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useNetworkStatus from '../../../hooks/useNetworkStatus'
import { useToast } from '../../../hooks/useToast'
import { TabletShell } from '../../../layouts/tablet/TabletShell'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import type { UserPractice } from '../../../types/api'
import { copyShareLink, downloadCsv } from '../actions'
import { toDateStr } from '../date'
import { NoPractices } from '../NoPractices'
import { useToday } from '../useToday'
import { capitalize } from '../values'
import { CalendarSheet } from '../mobile/CalendarSheet'
import { DayStrip9 } from '../mobile/DayStrip9'
import { PracticeRow } from '../mobile/PracticeRow'

const CARD = 'flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline'

export function TodayTablet() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isOnline = useNetworkStatus()
  const [date, setDate] = useState(() => new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const today = useToday(date)
  const dateStr = toDateStr(date)

  const title = capitalize(new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date), locale)
  const line = t('today.filledOf', { filled: today.summary.filled, total: today.summary.total })
    + (today.summary.requiredLeft ? ` · ${t('today.requiredLeft', { count: today.summary.requiredLeft })}` : '')

  const more = [
    { label: t('home.addPractice'), onSelect: () => navigate('/user/practice/new') },
    { label: t('charts.downloadCsv'), onSelect: () => void downloadCsv() },
    {
      label: t('charts.shareLink'),
      onSelect: () => { if (copyShareLink()) showToast({ message: t('charts.copied'), variant: 'success' }) },
    },
  ]

  // ponytail: one hardcoded group, so the two columns are its halves (down the left, then the right).
  const half = Math.ceil(today.practices.length / 2)
  const column = (ps: UserPractice[]) => (
    <div className={CARD}>
      {ps.map((p) => (
        <PracticeRow key={`${p.id}-${dateStr}`} practice={p} value={today.values[p.practice]}
          failed={today.failed === p.practice} onSave={(v) => today.save(p, v)} />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-[22px] px-9 pt-[calc(36px+env(safe-area-inset-top))] pb-9">
      <header className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-[34px] leading-tight font-extrabold tracking-[-0.02em]">
            <button type="button" aria-haspopup="dialog" title={t('today.openCalendar')} onClick={() => setCalendarOpen(true)}
              className="text-left">
              {title}
            </button>
          </h1>
          <span className="text-sm text-ui-muted">{line}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/user/practices"
            className="rounded-full border border-ui-accent-pill px-3.5 py-2 text-[13px] font-bold text-ui-accent">
            {t('home.editPractices')}
          </Link>
          <button type="button" aria-label={t('today.more')} aria-haspopup="menu" onClick={(e) => setMoreAnchor(e.currentTarget)}
            className="flex h-11 w-11 items-center justify-center gap-[3px] rounded-[14px]">
            {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-ui-ink" />)}
          </button>
        </div>
      </header>

      {!isOnline && (
        <p role="status" className="rounded-xl bg-ui-accent-soft px-3 py-2 text-xs font-semibold text-ui-accent">{t('home.offline')}</p>
      )}

      <div className="rounded-[20px] border border-ui-hairline bg-ui-surface">
        <DayStrip9 date={date} incomplete={today.incomplete} onSelect={setDate} />
      </div>

      {today.isLoading ? (
        <div className={CARD}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex h-[50px] items-center bg-ui-surface px-4">
              <div className="h-3.5 w-1/2 animate-pulse rounded-full bg-ui-field" />
            </div>
          ))}
        </div>
      ) : today.isError ? (
        <p role="alert" className="rounded-2xl bg-ui-surface px-4 py-3 text-sm text-ui-danger">{t('common.error')}</p>
      ) : today.practices.length === 0 ? (
        <NoPractices onSeed={today.seedStarters} seeding={today.isSeeding} />
      ) : (
        <section aria-label={t('today.group')} className="flex flex-col gap-2">
          <h2 className="px-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{t('today.group')}</h2>
          {/* Two columns only from 768px: at the 640px tablet minimum inline inputs need the full width. */}
          <div className="grid items-start gap-4 md:grid-cols-2">
            {column(today.practices.slice(0, half))}
            {today.practices.length > 1 && column(today.practices.slice(half))}
          </div>
        </section>
      )}

      {moreAnchor && (
        <AnchoredMenu anchor={moreAnchor} label={t('today.more')} onClose={() => setMoreAnchor(null)}>
          {more.map((a) => (
            <MenuItem key={a.label} onSelect={() => { setMoreAnchor(null); a.onSelect() }}>{a.label}</MenuItem>
          ))}
        </AnchoredMenu>
      )}
      {calendarOpen && <CalendarSheet date={date} onSelect={setDate} onClose={() => setCalendarOpen(false)} />}
    </div>
  )
}

export function TodayTabletScreen() {
  return (
    <TabletShell>
      <TodayTablet />
    </TabletShell>
  )
}
