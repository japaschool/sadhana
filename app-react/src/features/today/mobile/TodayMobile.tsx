import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useNetworkStatus from '../../../hooks/useNetworkStatus'
import { AppBar, type AppBarAction } from '../../../layouts/mobile/AppBar'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { ListGroup } from '../../../ui/primitives/ListGroup'
import { toDateStr } from '../date'
import { NoPractices } from '../NoPractices'
import { useToday } from '../useToday'
import { useLogDate } from '../useLogDate'
import { CalendarSheet } from './CalendarSheet'
import { DateHeader } from './DateHeader'
import { DayStrip9 } from './DayStrip9'
import { PracticeRow } from './PracticeRow'

export function TodayMobile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isOnline = useNetworkStatus()
  const [date, setDate] = useLogDate()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const today = useToday(date)
  const dateStr = toDateStr(date)

  const actions: AppBarAction[] = [
    { label: t('home.addPractice'), onSelect: () => navigate('/settings/practices/new') },
    { label: t('home.editPractices'), onSelect: () => navigate('/settings/practices') },
  ]

  return (
    <>
      <AppBar title={<DateHeader date={date} summary={today.summary} onOpenCalendar={() => setCalendarOpen(true)} />} actions={actions} />
      {!isOnline && (
        <p role="status" className="mx-4 mb-2 rounded-xl bg-ui-accent-soft px-3 py-2 text-xs font-semibold text-ui-accent">
          {t('home.offline')}
        </p>
      )}
      <DayStrip9 date={date} incomplete={today.incomplete} onSelect={setDate} />
      <div className="flex flex-col gap-4 px-4 pb-6">
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
      {calendarOpen && <CalendarSheet date={date} onSelect={setDate} onClose={() => setCalendarOpen(false)} />}
    </>
  )
}

export function TodayMobileScreen() {
  return (
    <MobileShell>
      <TodayMobile />
    </MobileShell>
  )
}
