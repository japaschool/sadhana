import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiClient } from '../../api/client'
import { UiLoading } from '../../layouts/ByLayout'
import { SegmentedControl } from '../../ui/primitives/SegmentedControl'
import { addDays, fromDateStr, toDateStr } from '../today/date'

interface Week { week: string; signups: number; active: number }
type Metric = 'signups' | 'active'

/** Same labels as the Insights range picker (insights.range*). */
const RANGES = { '30d': 30, '90d': 91, '1y': 365, all: Infinity } as const
type Range = keyof typeof RANGES

const TICK = { fontSize: 11, fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fill: 'var(--ui-muted)' }
const AXIS = { tick: TICK, tickLine: false, axisLine: false } as const

/** One metric: last complete week, its change on the week before, and every week as bars (the current one faded). */
function MetricCard({ weeks, metric, color }: { weeks: Week[]; metric: Metric; color: string }) {
  const { t, i18n } = useTranslation()
  const date = (w: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(i18n.language, o).format(fromDateStr(w))
  // The last row is the week in progress.
  const last = weeks.at(-2)?.[metric] ?? 0
  const delta = last - (weeks.at(-3)?.[metric] ?? 0)
  // The week in progress is its own (faded) series.
  const rows = weeks.map((w, i) => i < weeks.length - 1 ? { week: w.week, done: w[metric] } : { week: w.week, now: w[metric] })
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-ui-surface p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-bold text-ui-ink">{t(`stats.${metric}`)}</h2>
        <p className="text-xs text-ui-muted">{t(`stats.${metric}Hint`)}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-ui-mono text-[28px] font-semibold text-ui-ink">{last}</span>
        <span className="text-xs text-ui-muted">{t('stats.lastWeek')}</span>
        <span className={`font-ui-mono text-xs font-semibold ${delta > 0 ? 'text-ui-good' : delta < 0 ? 'text-ui-danger' : 'text-ui-muted'}`}>
          {delta > 0 ? `+${delta}` : delta === 0 ? '±0' : delta}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={rows} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap={weeks.length > 30 ? 1 : '20%'}>
          <CartesianGrid vertical={false} stroke="var(--ui-hairline)" />
          <XAxis dataKey="week" minTickGap={28} tickFormatter={(w: string) => date(w, weeks.length > 14 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })} {...AXIS} />
          <YAxis width={36} allowDecimals={false} {...AXIS} />
          <Tooltip isAnimationActive={false} cursor={{ fill: 'var(--ui-hairline)' }}
            content={({ active, label, payload }) => active && typeof label === 'string' && payload?.length ? (
              <div className="flex flex-col gap-1 rounded-xl border border-ui-hairline bg-ui-surface px-3 py-2 shadow-lg">
                <span className="font-ui-mono text-[11px] font-semibold text-ui-muted">
                  {t('stats.weekOf', { date: date(label, { day: 'numeric', month: 'short', year: 'numeric' }) })}
                </span>
                <span className="font-ui-mono text-xs text-ui-ink">{String(payload.find((p) => p.value != null)?.value ?? 0)}</span>
              </div>
            ) : null} />
          <Bar dataKey="done" stackId="w" fill={color} isAnimationActive={false} />
          <Bar dataKey="now" stackId="w" fill={color} fillOpacity={0.35} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  )
}

/** Public, unlinked usage stats: weekly sign-ups and active users. Aggregates only (server/src/app/stats.rs). */
export function Stats() {
  const { t } = useTranslation()
  const [range, setRange] = useState<Range>('all')
  const q = useQuery({
    queryKey: ['stats'],
    queryFn: async () => (await apiClient.get<{ weeks: Week[] }>('/stats')).data.weeks,
  })
  if (q.isPending) return <UiLoading />
  // Weeks that end inside the range. The headline stays on last week whatever the range.
  const from = RANGES[range] === Infinity ? '' : toDateStr(addDays(new Date(), -RANGES[range] - 6))
  const weeks = q.data?.filter((w) => w.week >= from) ?? []
  return (
    <div className="ui-root min-h-dvh bg-ui-bg text-ui-ink">
      <div className="mx-auto flex max-w-[900px] flex-col gap-4 px-4 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(32px+env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h1 className="text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-ui-ink">{t('stats.title')}</h1>
          <div className="font-ui-mono [&_button]:px-2.5 [&_button]:text-xs">
            <SegmentedControl label={t('insights.range')} value={range} onChange={setRange}
              options={Object.keys(RANGES).map((r) => ({ value: r as Range, label: t(`insights.range${r}`) }))} />
          </div>
        </div>
        {q.isError ? <p className="px-1 text-sm text-ui-danger">{t('stats.loadFailed')}</p> : (
          <>
            <MetricCard weeks={weeks} metric="active" color="var(--ui-chart-1)" />
            <MetricCard weeks={weeks} metric="signups" color="var(--ui-chart-5)" />
          </>
        )}
      </div>
    </div>
  )
}
