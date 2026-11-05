import type { ReactNode } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import type { BarLayout } from '../../../api/charts'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { periodBands, type Band } from '../periodBands'
import { formatMinutesAsHHMM, type ChartDataRow, type Trace } from '../chartLogic'
import { assignAxes, AXES, isLeft, type Axis } from '../axes'
import { barPlacement, seriesRows, formatTick, spansYears, type AverageLine } from '../insightsLogic'
import { fromDateStr } from '../../today/date'
import { formatDuration, type DurationUnits } from '../../today/values'

export const TICK = { fontSize: 11, fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fill: 'var(--ui-muted)' }
export const AXIS = { tick: TICK, tickLine: false, axisLine: false } as const

interface InsightsChartProps {
  rows: ChartDataRow[]; traces: Trace[]; barLayout: BarLayout; averages: AverageLine[]; height?: number
  /** Trace positions switched off in the legend. Remount the chart when this changes (see the screens' key). */
  hidden?: Set<number>
  /** The signed-in user's marked periods, drawn as bands behind the series. Shared pages pass none. */
  periods?: MarkedPeriod[]
}

/** Bands behind the series: render these before them. */
export function PeriodAreas({ bands, yAxisId, xAxisId }: { bands: Band[]; yAxisId?: string | number; xAxisId?: string | number }) {
  return bands.map((b, i) => (
    <ReferenceArea key={i} xAxisId={xAxisId} yAxisId={yAxisId} x1={b.x1} x2={b.x2} fill="var(--ui-chip)" fillOpacity={0.6} ifOverflow="hidden"
      label={{ value: b.name, position: 'insideTopLeft', fontSize: 10, fontFamily: TICK.fontFamily, fill: 'var(--ui-ink2)' }} />
  ))
}

/** The legend swatch for a band (16m11). */
export function PeriodKey() {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1.5 text-xs leading-[1.3] font-bold text-ui-ink2">
      <span aria-hidden className="h-3 w-3 shrink-0 rounded-[2px] bg-ui-chip" />{t('reportPanels.markedPeriod')}
    </span>
  )
}

const NONE = new Set<number>()
const NO_PERIODS: MarkedPeriod[] = []

function pointText(v: number, dt: Trace['dataType'], u: DurationUnits): string {
  if (dt === 'Bool' || dt === 'Text') return '✓'
  if (dt === 'Duration') return formatDuration(v, u)
  return dt === 'Time' ? formatMinutesAsHHMM(v) : String(v)
}

interface TipProps { active?: boolean; label?: string | number; payload?: readonly { dataKey?: unknown; value?: unknown }[] }

/** A chart tooltip: the day, then a row per value. */
export function TipShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-ui-hairline bg-ui-surface px-3 py-2 shadow-lg">
      <span className="font-ui-mono text-[11px] font-semibold text-ui-muted">{title}</span>
      {children}
    </div>
  )
}

export function TipRow({ color, name, value }: { color: string; name: string; value: string }) {
  return (
    <span className="flex items-center gap-2 text-xs text-ui-ink2">
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: color }} />
      <span className="max-w-[140px] truncate">{name}</span>
      <span className="ml-auto pl-2 font-ui-mono text-ui-ink">{value}</span>
    </span>
  )
}

export const tipDate = (cob: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(fromDateStr(cob))

/** The tapped day: one row per series with a value there. */
function PointTip({ active, label, payload, traces, units, locale }: TipProps & { traces: Trace[]; units: DurationUnits; locale: string }) {
  const items = (payload ?? []).flatMap((p) => {
    const i = Number(String(p.dataKey).slice(1))
    return typeof p.value === 'number' && traces[i] ? [{ i, tr: traces[i], v: p.value }] : []
  })
  if (!active || typeof label !== 'string' || !items.length) return null
  return (
    <TipShell title={tipDate(label, locale)}>
      {items.map(({ i, tr, v }) => <TipRow key={i} color={tr.color} name={tr.name} value={pointText(v, tr.dataType, units)} />)}
    </TipShell>
  )
}

// Colours are var(--ui-chart-n) strings in SVG attributes. If iOS Safari ignores them (Task 8 check),
// resolve them with getComputedStyle on the .ui-root ancestor instead.
export function InsightsChart({ rows, traces, barLayout, averages, height = 170, hidden = NONE, periods = NO_PERIODS }: InsightsChartProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const axes = assignAxes(traces)
  const used = AXES.filter((a) => axes.includes(a))
  const on = (a: Axis) => traces.filter((_, i) => axes[i] === a)
  const isUnit = (a: Axis) => ['Bool', 'Text'].includes(on(a)[0].dataType)
  // ponytail: one axis with ticks per side; Left 2, Right 2, … keep their own scale but no ticks.
  // An axis whose series are all hidden in the legend gives its ticks to the next one.
  const shown = (a: Axis) => traces.some((_, i) => axes[i] === a && !hidden.has(i))
  const left = used.find((a) => isLeft(a) && !isUnit(a) && shown(a))
  const right = used.find((a) => !isLeft(a) && !isUnit(a) && shown(a))
  const tickFormat = (a: Axis) => {
    const dt = on(a)[0].dataType
    if (dt === 'Time') return formatMinutesAsHHMM
    return dt === 'Duration' ? (v: number) => formatDuration(v, units) : (v: number) => String(v)
  }
  const xTicks = rows.length
    ? [...new Set([rows[0], rows[Math.floor((rows.length - 1) / 2)], rows[rows.length - 1]].map((r) => r.cob))]
    : []
  const hasLeft = !!left
  const hasRight = !!right
  const multiYear = rows.length > 0 && spansYears(rows[0].cob, rows[rows.length - 1].cob)
  const placement = barPlacement(traces, barLayout, hidden)
  const data = seriesRows(rows, traces)
  const overlayAxes = placement.flatMap((p) => (p?.xAxisId ? [p.xAxisId] : []))
  const bands = periodBands(periods, rows.map((r) => r.cob))

  return (
    <>
    <ResponsiveContainer width="100%" height={height}>
      {/* Without a Y axis on a side, leave room for the end date ticks there. */}
      <ComposedChart data={data} barGap={1} margin={{ top: 6, right: hasRight ? 0 : 16, bottom: 0, left: hasLeft ? 0 : 16 }}>
        <CartesianGrid vertical={false} stroke="var(--ui-hairline)" />
        <XAxis dataKey="cob" ticks={xTicks} interval={0} tickFormatter={(c: string) => formatTick(c, locale, multiYear)} {...AXIS} />
        {overlayAxes.map((id) => <XAxis key={id} xAxisId={id} dataKey="cob" hide />)}
        {used.map((a) => {
          const dt = on(a)[0].dataType
          const single = on(a).length === 1 ? on(a)[0].color : undefined
          return (
            <YAxis key={a} yAxisId={a} orientation={isLeft(a) ? 'left' : 'right'} hide={a !== left && a !== right} width={a !== left && a !== right ? 0 : dt === 'Time' ? 44 : 40}
              domain={isUnit(a) ? [0, 1.1] : dt === 'Time' ? ['auto', 'auto'] : [0, 'auto']} tickFormatter={tickFormat(a)}
              {...AXIS} tick={{ ...TICK, fill: single ?? TICK.fill }} />
          )
        })}
        <PeriodAreas bands={bands} yAxisId={used[0]} />
        {traces.map((tr, i) => {
          if (hidden.has(i)) return null
          const axis = axes[i]
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
        <Tooltip isAnimationActive={false} cursor={{ fill: 'var(--ui-hairline)', stroke: 'var(--ui-hairline)' }}
          content={(p) => <PointTip {...p} traces={traces} units={{ h: t('today.unitH'), min: t('today.unitMin') }} locale={locale} />} />
        {averages.map((a, i) => (
          <ReferenceLine key={i} yAxisId={a.axis} y={a.value} stroke={a.color} strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
    {bands.length > 0 && <PeriodKey />}
    </>
  )
}
