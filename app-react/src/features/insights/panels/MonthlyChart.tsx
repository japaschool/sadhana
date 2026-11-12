import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChartPanel } from '../../../api/charts'
import { useChartTooltip } from '../../../ui/tooltipTrigger'
import type { Band } from '../periodBands'
import { AXIS, BandGlyph, LegendList, PeriodAreas, TICK, TipRow, TipShell, type LegendItem } from '../mobile/InsightsChart'
import { formatDuration } from '../../today/values'
import { clockText, fitHours, monthName } from './panelLogic'
import type { MonthRow } from './monthly'

export const LINE_LABEL = { fontSize: 10, fontFamily: TICK.fontFamily, fill: 'var(--ui-ink)', stroke: 'var(--ui-surface)', strokeWidth: 3, paintOrder: 'stroke' }

export interface Limit { key: string; value: number; text: string; position: 'insideTopRight' | 'insideBottomRight' }

const BAR = 'var(--ui-chart-1)'
const LINE = 'var(--ui-ink)'
/** The month still going is drawn lighter. */
const opacity = (r: MonthRow) => (r.soFar ? 0.4 : 0.85)

/** What the bars count, worded as the template's own stat. */
function barKey(panel: ChartPanel): string {
  const tg = panel.target
  const limited = !!tg && (tg.min !== null || tg.max !== null)
  const key = tg?.label && 'Key' in tg.label ? tg.label.Key : null
  if (tg && !key) return limited ? 'nightsInRange' : 'nightsLogged'
  if (limited) return key === 'reportPanels.goal' ? 'daysOnGoal' : 'daysOnTarget'
  return 'daysLogged'
}

/** A Japa, Time spent or Sleep panel at 1y or All: % of the month's days done as bars, the median on those days as a line (a Range panel: one median range a month). */
export function MonthlyChart({ panel, rows, bands, limits, height, interactive }: {
  panel: ChartPanel; rows: MonthRow[]; bands: Band[]; limits: Limit[]; height: number; interactive: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const tip = useChartTooltip()
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const clock = panel.format === 'NoonClock'
  const duration = panel.format !== 'Count'
  const fmt = (v: number) => (duration ? formatDuration(Math.round(v), units) : String(Math.round(v * 10) / 10))
  const multiYear = rows.length > 0 && rows[0].month.slice(0, 4) !== rows[rows.length - 1].month.slice(0, 4)
  const tick = (m: string) => {
    const [y, mo] = m.split('-').map(Number)
    return new Date(y, mo - 1, 1).toLocaleDateString(locale, multiYear ? { month: 'short', year: '2-digit' } : { month: 'short' })
  }

  const [lo, hi] = fitHours(rows.flatMap((r) => r.range ?? []))
  const every = (hi - lo) / 60 > 6 ? 2 : 1
  const clockTicks = Array.from({ length: (hi - lo) / 60 / every + 1 }, (_, k) => lo + k * every * 60)
  const maxHour = Math.ceil(Math.max(0, ...rows.map((r) => r.median ?? 0), ...limits.map((l) => l.value)) / 60)
  const step = Math.ceil(maxHour / 4) || 1
  const hourTicks = Array.from({ length: Math.ceil(maxHour / step) + 1 }, (_, k) => k * step * 60)

  const items: LegendItem[] = clock
    ? [{ key: 'range', glyph: <span aria-hidden className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: BAR }} />, text: t('reportPanels.monthSleepRange') }]
    : [
      { key: 'pct', glyph: <span aria-hidden className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: BAR }} />, text: t('reportPanels.monthPct', { label: t(`reportPanels.${barKey(panel)}`) }) },
      { key: 'median', glyph: <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: LINE }} />, text: t('reportPanels.monthMedian') },
    ]
  for (const l of limits) items.push({ key: l.key, glyph: <span aria-hidden className="h-0 w-4 shrink-0 border-t-2 border-dashed border-ui-ink" />, text: l.text })
  if (rows.some((r) => r.soFar)) {
    items.push({ key: 'soFar', glyph: <span aria-hidden className="h-3 w-3 shrink-0 rounded-[2px] opacity-40" style={{ background: BAR }} />, text: t('reportPanels.monthSoFarKey') })
  }
  if (bands.length) items.push({ key: 'period', glyph: <BandGlyph />, text: t('reportPanels.markedPeriod') })

  return (
    <>
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart {...tip.chart} data={rows} barCategoryGap="18%" margin={{ top: 8, right: clock ? 16 : 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--ui-hairline)" yAxisId={clock ? undefined : 'pct'} />
            <XAxis dataKey="month" tickFormatter={tick} interval={Math.max(0, Math.ceil(rows.length / 6) - 1)} {...AXIS} />
            {clock ? (
              <YAxis width={44} domain={[lo, hi]} ticks={clockTicks} interval={0} tickFormatter={clockText} {...AXIS} />
            ) : (
              <>
                <YAxis yAxisId="pct" width={40} domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v: number) => `${v}%`} {...AXIS} />
                <YAxis yAxisId="v" orientation="right" width={44} domain={duration ? [0, hourTicks[hourTicks.length - 1]] : [0, 'auto']} tickFormatter={fmt}
                  {...(duration ? { ticks: hourTicks, interval: 0 as const } : {})} {...AXIS} />
              </>
            )}
            <PeriodAreas bands={bands} yAxisId={clock ? undefined : 'pct'} />
            <Bar dataKey={clock ? 'range' : 'pct'} yAxisId={clock ? undefined : 'pct'} fill={BAR} radius={2} isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.month} fillOpacity={opacity(r)} />)}
            </Bar>
            {!clock && (
              <Line dataKey="median" yAxisId="v" stroke={LINE} strokeWidth={1.5} activeDot={false} isAnimationActive={false}
                dot={(d: { key?: Key | null; index?: number; cx?: number; cy?: number | null }) => (d.cx === undefined || d.cy === undefined || d.cy === null
                  ? <g key={d.key} />
                  : <circle key={d.key} cx={d.cx} cy={d.cy} r={2.6} fill={LINE} opacity={rows[d.index ?? 0]?.soFar ? 0.4 : 1} />)} />
            )}
            {limits.map((l) => (
              <ReferenceLine key={l.key} y={l.value} yAxisId={clock ? undefined : 'v'} ifOverflow="extendDomain" stroke="var(--ui-ink)" strokeWidth={1.3} strokeDasharray="4 3"
                label={{ ...LINE_LABEL, value: l.text, position: l.position }} />
            ))}
            {interactive && <Tooltip {...tip.tooltip} isAnimationActive={false} cursor={{ fill: 'var(--ui-hairline)', stroke: 'var(--ui-hairline)' }}
              content={({ active, label }) => {
                const r = active ? rows.find((x) => x.month === label) : undefined
                if (!r) return null
                return (
                  <TipShell title={r.soFar ? `${monthName(r.month, locale)} · ${t('reportPanels.monthSoFar')}` : monthName(r.month, locale)}>
                    <TipRow color={BAR} name={t('reportPanels.monthDone')} value={t('reportPanels.monthDoneOf', { done: r.done, count: r.days, pct: r.pct })} />
                    {r.range
                      ? <TipRow color={BAR} name={t('reportPanels.monthSleepRange')} value={`${clockText(Math.round(r.range[0]))} → ${clockText(Math.round(r.range[1]))}`} />
                      : r.median !== null && <TipRow color={LINE} name={t('reportPanels.monthMedian')} value={fmt(r.median)} />}
                  </TipShell>
                )
              }} />}
          </ComposedChart>
        </ResponsiveContainer>
        {rows.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center pb-6 text-sm font-extrabold text-ui-ink">{t('insights.noData')}</p>
        )}
      </div>
      <LegendList items={items} />
    </>
  )
}
