import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DayFailedNote, SyncBanner } from '../SyncBanner'
import { InstallSheet } from '../InstallSheet'
import { TabletShell } from '../../../layouts/tablet/TabletShell'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import type { UserPractice } from '../../../types/api'
import { groupName } from '../../practices/groups'
import { toDateStr } from '../date'
import { NoPractices } from '../NoPractices'
import { useToday } from '../useToday'
import { useLogDate } from '../useLogDate'
import { capitalize } from '../values'
import { CalendarSheet } from '../mobile/CalendarSheet'
import { DayStrip9 } from '../mobile/DayStrip9'
import { PracticeRow } from '../mobile/PracticeRow'

const CARD = 'flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline'

export function TodayTablet() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const navigate = useNavigate()
  const [date, setDate] = useLogDate()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const today = useToday(date)
  const dateStr = toDateStr(date)

  const title = capitalize(new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date), locale)
  const line = t('today.filledOf', { filled: today.summary.filled, total: today.summary.total })
    + (today.summary.requiredLeft ? ` · ${t('today.requiredLeft', { count: today.summary.requiredLeft })}` : '')

  const more = [
    { label: t('home.addPractice'), onSelect: () => navigate('/settings/practices/new') },
    { label: t('home.editPractices'), onSelect: () => navigate('/settings/practices') },
  ]

  const half = Math.ceil(today.practices.length / 2)
  const row = (p: UserPractice) => (
    <PracticeRow key={`${p.id}-${dateStr}`} practice={p} value={today.values[p.practice]}
      failed={today.failed === p.practice} onSave={(v) => today.save(p, v)} />
  )

  return (
    <div className="flex flex-col gap-[22px] px-9 pt-[calc(36px+env(safe-area-inset-top))] pb-9">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-[34px] leading-tight font-extrabold tracking-[-0.02em]">
            <button type="button" aria-haspopup="dialog" title={t('today.openCalendar')} onClick={() => setCalendarOpen(true)}
              className="text-left">
              {title}
            </button>
          </h1>
          <span aria-busy={today.dayLoading || undefined} className={`text-sm text-ui-muted transition-opacity ${today.dayLoading ? 'opacity-40' : ''}`}>{line}</span>
        </div>
        <button type="button" aria-label={t('today.more')} aria-haspopup="menu" onClick={(e) => setMoreAnchor(e.currentTarget)}
          className="flex h-11 w-11 shrink-0 items-center justify-center gap-[3px] rounded-full border border-ui-hairline bg-ui-surface">
          {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-ui-ink" />)}
        </button>
      </header>

      <SyncBanner />

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
        <>
          {today.dayFailed && <DayFailedNote />}
          {/* Two columns only from 768px: at the 640px tablet minimum inline inputs need the full width. */}
          {today.sections.length === 1 ? (
            // One group: its rows split into two balanced halves (down the left, then the right).
            <section aria-label={groupName(today.sections[0].group, t)} className="flex flex-col gap-2">
              <h2 className="truncate px-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{groupName(today.sections[0].group, t)}</h2>
              <div className="grid items-start gap-4 md:grid-cols-2">
                {[today.practices.slice(0, half), today.practices.slice(half)].map((ps, i) => (ps.length > 0 || i === 0) && (
                  <div key={i} className={CARD}>{ps.map(row)}</div>
                ))}
              </div>
            </section>
          ) : (
            // Several groups flow down the columns and never split.
            <div className="gap-4 md:columns-2">
              {today.sections.map((sec) => {
                const label = groupName(sec.group, t)
                return (
                  <section key={sec.group.id ?? 'default'} aria-label={label} className="mb-4 flex break-inside-avoid flex-col gap-2">
                    <h2 className="truncate px-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{label}</h2>
                    <div className={CARD}>{sec.practices.map(row)}</div>
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}

      {moreAnchor && (
        <AnchoredMenu anchor={moreAnchor} label={t('today.more')} onClose={() => setMoreAnchor(null)}>
          {more.map((a) => (
            <MenuItem key={a.label} onSelect={() => { setMoreAnchor(null); a.onSelect() }}>{a.label}</MenuItem>
          ))}
        </AnchoredMenu>
      )}
      {calendarOpen && <CalendarSheet date={date} onSelect={setDate} onClose={() => setCalendarOpen(false)} />}
      <InstallSheet ready={!today.isLoading} />
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
