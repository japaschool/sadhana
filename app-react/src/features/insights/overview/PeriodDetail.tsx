import { TOOLTIP_TRIGGER } from '../../../ui/tooltipTrigger'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CartesianGrid, ComposedChart, Area, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartsApi } from '../../../api/charts'
import { useMarkedPeriods } from '../../../api/markedPeriods'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { UiLoading } from '../../../layouts/ByLayout'
import { SettingsSubpage } from '../../settings/SettingsSubpage'
import { toDateStr } from '../../today/date'
import { formatDay, formatTick, spansYears } from '../insightsLogic'
import { AXIS, PeriodAreas, PeriodKey, tipDate, TipRow, TipShell } from '../mobile/InsightsChart'
import { periodBands } from '../periodBands'
import type { RowKind } from '../panels/gapLogic'
import { clockText } from '../panels/panelLogic'
import { beforeDuringAfter, changedMost, movingAverage, periodLength } from './bda'
import type { Bda } from './bda'
import { Overlaps, StatusChip, chipText } from './BdaCard'
import { rowName, rowValueText } from './format'
import type { Series } from './series'
import { useInsightRows } from './useInsightRows'
import { useYearData } from './useYearData'
import { leftOutDays, shift, usualAt } from './usual'

const YEAR = 365
/** Report data reaches back about this far from today beyond the Year window before it stops covering a period. */
const YEAR_REACH = 97

/** The data a period's detail needs: Year, or all data when the period began before Year's reach. */
function usePeriodData(period: MarkedPeriod | undefined, todayCob: string) {
  const old = !!period && period.start_date < shift(todayCob, -YEAR + YEAR_REACH)
  const yearQ = useYearData(todayCob, !old)
  const allQ = useQuery({ queryKey: ['report-data', todayCob, 'AllData'], queryFn: () => chartsApi.getReportData(todayCob, 'AllData'), enabled: old })
  return useInsightRows(old ? allQ : yearQ, todayCob)
}

interface Point { d: string; avg: number | null; range: [number, number] | null; median: number | null }

/** The row's 7-day average with the usual range as it stood on each day. */
function RowChart({ series, periods, focus, todayCob, from, kind, label }: {
  series: Series; periods: MarkedPeriod[]; /** The period on this page, drawn stronger. */ focus: string; todayCob: string; from: string; kind: RowKind; label: string
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const clock = kind === 'Clock'
  const { points, bands } = useMemo(() => {
    const avg = movingAverage(series, from, todayCob)
    const leftOut = leftOutDays(periods, todayCob)
    const points: Point[] = [...avg].map(([d, v]) => {
      const u = usualAt(series, d, leftOut)
      return { d, avg: v, range: u ? [u.p25, u.p75] : null, median: u?.median ?? null }
    })
    return { points, bands: periodBands(periods, points.map((p) => p.d)) }
  }, [series, periods, todayCob, from])
  const text = (v: number) => rowValueText(kind, v, units)
  return (
    <div className="flex flex-col gap-2.5">
      <div role="img" aria-label={label} className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--ui-hairline)" />
            <XAxis dataKey="d" minTickGap={36} tickFormatter={(d: string) => formatTick(d, locale, spansYears(points[0].d, points[points.length - 1].d))} {...AXIS} />
            <YAxis width={44} domain={['auto', 'auto']} tickFormatter={(v: number) => (clock ? clockText(Math.round(v)) : String(Math.round(v * 10) / 10))} {...AXIS} />
            <PeriodAreas bands={bands} focus={focus} />
            <Area dataKey={(r: Point) => r.range} stroke="none" fill="var(--ui-div-0)" fillOpacity={1} isAnimationActive={false} activeDot={false} />
            <Line dataKey="median" stroke="var(--ui-faint2)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={false} isAnimationActive={false} />
            <Line dataKey="avg" stroke="var(--ui-ink)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Tooltip trigger={TOOLTIP_TRIGGER} isAnimationActive={false} cursor={{ stroke: 'var(--ui-hairline)' }}
              content={({ active, label: d }) => {
                const p = active ? points.find((x) => x.d === d) : undefined
                if (!p || typeof d !== 'string') return null
                return (
                  <TipShell title={tipDate(d, locale)}>
                    {p.avg !== null && <TipRow color="var(--ui-ink)" name={t('insights.period.average')} value={text(p.avg)} />}
                    {p.range && <TipRow color="var(--ui-div-0)" name={t('insights.overview.usualRange')} value={`${text(p.range[0])}–${text(p.range[1])}`} />}
                    {p.median !== null && <TipRow color="var(--ui-faint2)" name={t('insights.overview.usual')} value={text(p.median)} />}
                  </TipShell>
                )
              }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-bold text-ui-ink2">
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-[18px] bg-ui-ink" />{t('insights.period.average')}</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-[18px] rounded-[5px] bg-[var(--ui-div-0)]" />{t('insights.overview.usualRange')}</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="w-[18px] border-t-[1.5px] border-dashed border-ui-faint2" />{t('insights.overview.usual')}</li>
        {bands.length > 0 && <li><PeriodKey /></li>}
      </ul>
    </div>
  )
}

function EachRow({ bda, practices }: { bda: Bda; practices: Parameters<typeof rowName>[1] }) {
  const { t } = useTranslation()
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  return (
    <section aria-labelledby="each-row" className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3 pb-1">
        <h2 id="each-row" className="text-lg font-extrabold text-ui-ink">{t('insights.period.eachRow')}</h2>
        <span className="font-ui-mono text-[11px] font-bold tracking-[.08em] text-ui-faint2 uppercase">
          {t('insights.period.before')} → {t('insights.period.during')} → {t('insights.period.after')}
        </span>
      </div>
      {bda.rows.map((r) => (
        <div key={r.row.key} role="group" aria-label={rowName(r.row, practices, t)} className="flex flex-col gap-1 border-t border-ui-chip py-3 first:border-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-[15px] font-extrabold text-ui-ink">{rowName(r.row, practices, t)}</span>
            <span className="font-ui-mono text-[14px] font-semibold whitespace-nowrap text-ui-ink">
              {[r.before, r.during, r.after].map((v) => rowValueText(r.row.kind, v, units)).join(' → ')}
            </span>
          </div>
          {r.chip && <span className="text-[13px] font-semibold text-ui-muted">{chipText(r.chip, t)}</span>}
        </div>
      ))}
    </section>
  )
}

/** /insights/period/:id: one marked period's before, during and after (16m4–16m6). */
export function PeriodDetail() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const todayCob = toDateStr(new Date())
  const { periods, isLoading: periodsLoading } = useMarkedPeriods()
  const period = periods.find((p) => p.id === id)
  const data = usePeriodData(period, todayCob)
  const [picked, setPicked] = useState<string | null>(null)
  const bda = useMemo(
    () => (period ? beforeDuringAfter(period, data.rows, data.series, periods, todayCob) : null),
    [period, data.rows, data.series, periods, todayCob],
  )
  const back = { to: '/charts', label: t('insights.overview.overview') }
  const title = period?.name ?? ''

  let body
  if (periodsLoading || data.isLoading) body = <UiLoading />
  else if (!period || !bda) body = <p role="alert" className="py-10 text-center text-sm text-ui-muted">{t('insights.period.notFound')}</p>
  else if (data.isError) body = <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('insights.loadFailed')}</p>
  else {
    const key = picked ?? changedMost(bda) ?? data.rows[0]?.key
    const row = data.rows.find((r) => r.key === key)
    const yearStart = shift(todayCob, -YEAR + 1)
    const from = period.start_date < yearStart ? shift(period.start_date, -28) : yearStart
    const n = periodLength(period, todayCob)
    const dates = period.end_date
      ? `${formatDay(period.start_date, locale, true)} – ${formatDay(period.end_date, locale, true)}`
      : t('insights.periods.ongoing', { date: formatDay(period.start_date, locale, true) })
    body = (
      <>
        <div className="flex flex-col gap-2">
          <p className="font-ui-mono text-xs font-medium text-ui-muted">{t('insights.period.dateLine', { dates, count: n })}</p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {bda.chip && <StatusChip chip={bda.chip} />}
            <Overlaps periods={bda.overlaps} />
          </div>
        </div>
        {row && (
          <>
            <div role="group" aria-label={t('insights.period.row')} className="flex flex-wrap gap-2">
              {data.rows.map((r) => (
                <button key={r.key} type="button" aria-pressed={r.key === row.key} onClick={() => setPicked(r.key)}
                  className={`min-h-9 rounded-full px-3.5 text-[13px] font-bold ${r.key === row.key ? 'bg-ui-ink text-ui-bg' : 'bg-ui-chip text-ui-ink2'}`}>
                  {rowName(r, data.practices, t)}
                </button>
              ))}
            </div>
            <RowChart series={data.series.get(row.key) ?? new Map()} periods={periods} focus={period.id} todayCob={todayCob} from={from}
              kind={row.kind} label={`${rowName(row, data.practices, t)}, ${formatDay(from, locale, true)} – ${formatDay(todayCob, locale, true)}`} />
          </>
        )}
        <EachRow bda={bda} practices={data.practices} />
        <p className="text-xs leading-[1.4] text-ui-muted">{t('insights.period.footnote')}</p>
      </>
    )
  }
  return <SettingsSubpage title={title} back={back}>{body}</SettingsSubpage>
}
