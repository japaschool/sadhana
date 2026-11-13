import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartsApi } from '../../../api/charts'
import { useMarkedPeriods } from '../../../api/markedPeriods'
import { UiLoading } from '../../../layouts/ByLayout'
import { useLayout } from '../../../layouts/useLayout'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { useChartTooltip } from '../../../ui/tooltipTrigger'
import { SettingsSubpage } from '../../settings/SettingsSubpage'
import { fromDateStr, toDateStr } from '../../today/date'
import { formatDay, formatTick, spansYears } from '../insightsLogic'
import { AXIS, TipRow, TipShell } from '../mobile/InsightsChart'
import type { RowKind } from '../panels/gapLogic'
import { rowName, rowValueText } from './format'
import { RowLabel } from './MeVsNormal'
import { loggedDays } from './series'
import { useInsightRows } from './useInsightRows'
import { leftOutDays } from './usual'
import { enoughHistory, hourTicks, offeredRanges, openingRange, rangeStart, rangeSummary, usualWeeks } from './usualOverTime'
import type { UsualRange, Week } from './usualOverTime'

function UsualChart({ weeks, kind, label }: { weeks: Week[]; kind: RowKind; label: string }) {
  const { t, i18n } = useTranslation()
  const tip = useChartTooltip()
  const locale = i18n.language || 'en'
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const text = (v: number) => rowValueText(kind, v, units)
  const years = spansYears(weeks[0].week, weeks[weeks.length - 1].week)
  const hours = kind === 'Duration' ? hourTicks(weeks) : null
  const yTick = (v: number) => (kind === 'Count' ? String(Math.round(v * 10) / 10) : text(v))
  return (
    <div role="img" aria-label={label} className="h-[140px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart {...tip.chart} data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--ui-hairline)" />
          <XAxis dataKey="week" minTickGap={36} tickFormatter={(d: string) => formatTick(d, locale, years)} {...AXIS} />
          <YAxis width={kind === 'Duration' && !hours ? 56 : 44} domain={hours ? [hours[0], hours[hours.length - 1]] : ['auto', 'auto']}
            ticks={hours ?? undefined} tickFormatter={yTick} {...AXIS} />
          <Area dataKey={(w: Week) => (w.usual ? [w.usual.p25, w.usual.p75] : null)} stroke="none" fill="var(--ui-chart-1)" fillOpacity={0.3}
            connectNulls={false} isAnimationActive={false} activeDot={false} />
          <Line dataKey={(w: Week) => w.usual?.median ?? null} stroke="var(--ui-chart-1)" strokeWidth={2} connectNulls={false} dot={false} isAnimationActive={false} />
          <Tooltip {...tip.tooltip} isAnimationActive={false} cursor={{ stroke: 'var(--ui-hairline)' }}
            content={({ active, label: d }) => {
              const u = active ? weeks.find((w) => w.week === d)?.usual : undefined
              if (!u || typeof d !== 'string') return null
              return (
                <TipShell title={formatDay(d, locale, true)}>
                  <TipRow color="var(--ui-chart-1)" name={t('insights.usualOverTime.title')}
                    value={t('insights.usualOverTime.tip', { median: text(u.median), p25: text(u.p25), p75: text(u.p75) })} />
                </TipShell>
              )
            }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** /insights/usual: each row's rolling 90-day usual, week by week. */
export function UsualOverTime() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const wide = useLayout() !== 'mobile'
  const todayCob = toDateStr(new Date())
  const { periods } = useMarkedPeriods()
  const dataQ = useQuery({ queryKey: ['report-data', todayCob, 'AllData'], queryFn: () => chartsApi.getReportData(todayCob, 'AllData') })
  const data = useInsightRows(dataQ, todayCob)
  const first = useMemo(() => loggedDays(data.entries, todayCob)[0] ?? todayCob, [data.entries, todayCob])
  // ponytail: whole history once, clipped per range; ~250k map reads for 5y × 10 rows.
  const all = useMemo(() => {
    const leftOut = leftOutDays(periods, todayCob)
    return data.rows.map((row) => ({ row, weeks: usualWeeks(data.series.get(row.key) ?? new Map(), leftOut, todayCob, first) }))
  }, [data.rows, data.series, periods, todayCob, first])
  const offered = offeredRanges(first, todayCob)
  const [picked, setPicked] = useState<UsualRange | null>(null)
  const range = picked && offered.includes(picked) ? picked : openingRange(offered)
  const from = rangeStart(range, todayCob, first)
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const month = (d: string) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(fromDateStr(d))

  let body
  if (dataQ.isLoading || data.isLoading) body = <UiLoading />
  else if (data.isError) body = <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('insights.loadFailed')}</p>
  else body = (
    <>
      <SegmentedControl label={t('insights.range')} value={range} onChange={setPicked}
        options={offered.map((r) => ({ value: r, label: t(`insights.range${r}`) }))} />
      <p className="text-[13px] leading-[1.45] text-ui-muted">{t('insights.usualOverTime.intro')}</p>
      <div className={`grid gap-x-6 gap-y-5 ${wide ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {all.map(({ row, weeks }) => {
          const value = (v: number) => rowValueText(row.kind, v, units)
          const shown = weeks.filter((w) => w.week >= from)
          const s = enoughHistory(weeks) ? rangeSummary(shown) : null
          const line = !enoughHistory(weeks) ? t('insights.usualOverTime.notEnough')
            : !s ? t('insights.usualOverTime.noneInRange')
            : s.now ? t('insights.usualOverTime.now', { now: value(s.last.usual.median), start: value(s.start.median) })
            : t('insights.usualOverTime.last', { value: value(s.last.usual.median), month: month(s.last.week) })
          return (
            <div key={row.key} className="flex min-w-0 flex-col gap-1">
              <RowLabel n={{ row }} practices={data.practices} />
              <span className="font-ui-mono text-xs text-ui-muted">{line}</span>
              {s && <UsualChart weeks={shown} kind={row.kind} label={t('insights.usualOverTime.chart', { name: rowName(row, data.practices, t) })} />}
            </div>
          )
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-bold text-ui-ink2">
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-[18px] rounded-[5px] bg-[var(--ui-chart-1)] opacity-30" />{t('insights.overview.usualRange')}</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-[18px] bg-[var(--ui-chart-1)]" />{t('insights.usualOverTime.median')}</li>
      </ul>
    </>
  )
  return <SettingsSubpage wide title={t('insights.usualOverTime.title')} back={{ to: '/charts', label: t('insights.overview.overview') }}>{body}</SettingsSubpage>
}
