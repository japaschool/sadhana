import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import type { BarLayout } from '../../../api/charts'
import { formatMinutesAsHHMM, resolveAxisId, type AxisId, type ChartDataRow, type Trace } from '../../../pages/charts/chartLogic'
import { barPlacement, formatDurationTick, seriesRows, formatTick, spansYears, type AverageLine } from '../insightsLogic'

const TICK = { fontSize: 11, fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fill: 'var(--ui-muted)' }
const AXIS = { tick: TICK, tickLine: false, axisLine: false } as const

interface InsightsChartProps { rows: ChartDataRow[]; traces: Trace[]; barLayout: BarLayout; averages: AverageLine[]; height?: number }

// Colours are var(--ui-chart-n) strings in SVG attributes. If iOS Safari ignores them (Task 8 check),
// resolve them with getComputedStyle on the .ui-root ancestor instead.
export function InsightsChart({ rows, traces, barLayout, averages, height = 170 }: InsightsChartProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const units = { h: t('today.unitH'), min: t('insights.tickMin') }
  const axisOf = (tr: Trace) => resolveAxisId(tr.yAxis, tr.dataType)
  const used = new Set(traces.map(axisOf))
  const numTick = (axis: AxisId) =>
    traces.filter((tr) => axisOf(tr) === axis).every((tr) => tr.dataType === 'Duration')
      ? (v: number) => formatDurationTick(v, units)
      : (v: number) => String(v)
  const xTicks = rows.length
    ? [...new Set([rows[0], rows[Math.floor((rows.length - 1) / 2)], rows[rows.length - 1]].map((r) => r.cob))]
    : []
  const timeLeft = used.has('time') && !used.has('num')
  const hasLeft = used.has('num') || timeLeft
  const hasRight = used.has('num-right') || (used.has('time') && !timeLeft)
  const multiYear = rows.length > 0 && spansYears(rows[0].cob, rows[rows.length - 1].cob)
  const placement = barPlacement(traces, barLayout)
  const data = seriesRows(rows, traces)
  const overlayAxes = placement.flatMap((p) => (p?.xAxisId ? [p.xAxisId] : []))

  return (
    <ResponsiveContainer width="100%" height={height}>
      {/* Without a Y axis on a side, leave room for the end date ticks there. */}
      <ComposedChart data={data} barGap={1} margin={{ top: 6, right: hasRight ? 0 : 16, bottom: 0, left: hasLeft ? 0 : 16 }}>
        <CartesianGrid vertical={false} stroke="var(--ui-hairline)" />
        <XAxis dataKey="cob" ticks={xTicks} interval={0} tickFormatter={(c: string) => formatTick(c, locale, multiYear)} {...AXIS} />
        {overlayAxes.map((id) => <XAxis key={id} xAxisId={id} dataKey="cob" hide />)}
        {used.has('num') && <YAxis yAxisId="num" orientation="left" width={40} domain={[0, 'auto']} tickFormatter={numTick('num')} {...AXIS} />}
        {used.has('num-right') && <YAxis yAxisId="num-right" orientation="right" width={40} domain={[0, 'auto']} tickFormatter={numTick('num-right')} {...AXIS} />}
        {used.has('time') && (
          <YAxis yAxisId="time" orientation={timeLeft ? 'left' : 'right'} width={44} domain={['auto', 'auto']}
            tickFormatter={formatMinutesAsHHMM} {...AXIS} />
        )}
        {used.has('unit') && <YAxis yAxisId="unit" hide domain={[0, 1.1]} />}
        {traces.map((tr, i) => {
          const axis = axisOf(tr)
          const bar = placement[i]
          if (bar) {
            return (
              <Bar key={i} yAxisId={axis} xAxisId={bar.xAxisId} dataKey={`t${i}`} fill={tr.color} fillOpacity={bar.fillOpacity}
                stackId={bar.stackId} radius={bar.rounded ? [3, 3, 0, 0] : 0} maxBarSize={16} isAnimationActive={false} />
            )
          }
          if (tr.type_ === 'Dot') {
            return (
              <Line key={i} yAxisId={axis} dataKey={`t${i}`} stroke="none" isAnimationActive={false}
                dot={{ r: 4, fill: tr.color, strokeWidth: 0 }} activeDot={false} />
            )
          }
          return (
            <Line key={i} yAxisId={axis} dataKey={`t${i}`} type={typeof tr.type_ === 'object' && tr.type_.Line.style === 'Square' ? 'stepAfter' : 'monotone'}
              stroke={tr.color} strokeWidth={2} dot={{ r: 2.5, fill: tr.color, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
          )
        })}
        {averages.map((a, i) => (
          <ReferenceLine key={i} yAxisId={a.axis} y={a.value} stroke={a.color} strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
