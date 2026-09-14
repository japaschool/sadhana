import { useState, useEffect, lazy, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { LuWifiOff } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { practicesApi } from '../../api/practices'
import { ACCENT, ACCENT_GRADIENT } from '../../theme/tokens'
import { PracticeCard } from './PracticeCard'
import { Spinner } from '../../components/ui/Spinner'
import { WeekCalendar, getWeekDays } from './WeekCalendar'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import useNetworkStatus from '../../hooks/useNetworkStatus'
import type { PracticeDataType } from '../../types/api'

// Charts pull in recharts (~116 KB gzip). Lazy-load them so the practices
// column paints without waiting on that chunk.
const ChartsPage = lazy(() =>
  import('../charts/ChartsPage').then((m) => ({ default: m.ChartsPage })),
)

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

const STARTER_PRACTICES: { practice: string; data_type: PracticeDataType }[] = [
  { practice: 'Wake up time',     data_type: 'Time'     },
  { practice: 'Go to sleep time', data_type: 'Time'     },
  { practice: 'Reading',          data_type: 'Bool'     },
  { practice: 'Meditation',       data_type: 'Duration' },
  { practice: 'Yoga',             data_type: 'Duration' },
]

export function DashboardPanel() {
  const { t } = useTranslation()
  const [date, setDate] = useState(new Date())
  const isOnline = useNetworkStatus()
  const qc = useQueryClient()

  const dateStr = toDateStr(date)

  const practicesQuery = useQuery({
    queryKey: ['practices'],
    queryFn: practicesApi.getUserPractices,
  })
  const diaryQuery = useQuery({
    queryKey: ['diary', dateStr],
    queryFn: () => practicesApi.getDiaryEntries(dateStr),
  })

  const seedMutation = useMutation({
    mutationFn: async () => {
      for (const p of STARTER_PRACTICES) {
        await practicesApi.createUserPractice(p).catch(() => {})
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practices'] }),
  })

  const activePractices = (practicesQuery.data ?? []).filter((p) => p.is_active)
  const valueMap = Object.fromEntries(
    (diaryQuery.data ?? []).map((e) => [e.practice, e.value]),
  )

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        qc.invalidateQueries({ queryKey: ['diary', dateStr] })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [qc, dateStr])

  useEffect(() => {
    const week = getWeekDays(date)
    for (const day of week) {
      const ds = toDateStr(day)
      if (ds !== dateStr) {
        qc.prefetchQuery({
          queryKey: ['diary', ds],
          queryFn: () => practicesApi.getDiaryEntries(ds),
          staleTime: 60_000,
        })
      }
    }
  }, [date, qc, dateStr])

  const required = activePractices.filter((p) => p.is_required)
  const optional = activePractices.filter((p) => !p.is_required)

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start lg:max-w-[1400px] lg:mx-auto lg:px-6 lg:py-4">
      <div className="px-4 py-4 max-w-lg sm:max-w-2xl mx-auto w-full lg:max-w-none lg:mx-0 lg:px-0 lg:py-0 lg:col-span-1 flex flex-col gap-3">
        {/* Offline banner */}
        {!isOnline && (
          <div
            className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
            style={{
              background: 'rgba(251,191,36,0.10)',
              border: '1px solid rgba(251,191,36,0.25)',
              color: '#fbbf24',
            }}
          >
            <LuWifiOff className="w-4 h-4 flex-shrink-0" style={{ color: '#fbbf24' }} />
            {t('home.offline')}
          </div>
        )}

        {/* Week calendar */}
        <WeekCalendar date={date} onDateChange={setDate} />

        {/* Practice cards — skeletons hold layout while loading to prevent jump */}
        <div className="flex flex-col gap-3">
          {(practicesQuery.isLoading || diaryQuery.isLoading) ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl px-4 min-h-[60px] flex items-center gap-3 animate-pulse"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                }}
              >
                <div className="w-8 h-8 rounded-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="h-3.5 rounded-full flex-1" style={{ background: 'rgba(255,255,255,0.08)', maxWidth: '55%' }} />
                <div className="w-12 h-6 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
              </div>
            ))
          ) : (diaryQuery.isError || practicesQuery.isError) ? (
            <ErrorBanner message={t('common.error')} />
          ) : (
            <>
              {required.map((p) => (
                <PracticeCard key={p.id + '-' + dateStr} practice={p} date={dateStr} currentValue={valueMap[p.practice]} />
              ))}
              {optional.map((p) => (
                <PracticeCard key={p.id + '-' + dateStr} practice={p} date={dateStr} currentValue={valueMap[p.practice]} />
              ))}
            </>
          )}

          {/* Empty state */}
          {!practicesQuery.isLoading && !practicesQuery.isError && activePractices.length === 0 && (
            <div className="text-center py-12 flex flex-col items-center gap-4">
              <p className="text-base-content/60 text-sm">{t('home.noPractices')}</p>

              {/* Seed defaults */}
              <button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="px-6 h-11 rounded-full text-sm font-semibold flex items-center gap-2"
                style={{
                  background: ACCENT_GRADIENT,
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
                }}
              >
                {seedMutation.isPending && <span className="loading loading-spinner loading-xs" />}
                {t('home.addStarters')}
              </button>

              <Link to="/user/practice/new" className="text-sm font-medium" style={{ color: ACCENT }}>
                {t('home.addCustom')}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Charts (2/3) — desktop only; top-aligned with the practices column.
          Lazy so recharts stays off the initial home critical path.
          `isolate` confines ChartsPage's internal z-indexes so they can't
          paint over the fixed header while scrolling. */}
      <div className="hidden lg:block lg:col-span-2 isolate">
        <Suspense fallback={<Spinner />}>
          <ChartsPage embedded />
        </Suspense>
      </div>
    </div>
  )
}
