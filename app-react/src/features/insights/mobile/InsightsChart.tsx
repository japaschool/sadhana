import { useChartTooltip } from '../../../ui/tooltipTrigger'
import type { ReactNode } from 'react'
import { Bar, CartesianGrid, ComposedChart, DefaultZIndexes, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, usePlotArea, useXAxisScale, XAxis, YAxis, ZIndexLayer } from 'recharts'
import { useTranslation } from 'react-i18next'
import type { BarLayout } from '../../../api/charts'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { labelSpots, periodBands, type Band } from '../periodBands'
import { formatMinutesAsHHMM, type ChartDataRow, type Trace } from '../chartLogic'
import { assignAxes, AXES, isLeft, type Axis } from '../axes'
import { barPlacement, seriesRows, formatTick, spansYears, traceAverageLabel, type AverageLine } from '../insightsLogic'
import type { ReportDataEntry } from '../../../api/charts'
import { FigureGrid } from '../panels/StatsPanelView'
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
  /** Makes legend items toggle their series; shared pages pass none. */
  onToggle?: (i: number) => void
}

/** IBM Plex Mono at 10px: 6px a character. */
const CHAR_W = 6
const LANE_H = 13

/** Every band's full name at the top of the plot, laid out by labelSpots. */
function BandLabels({ bands, xAxisId, at, focus }: { bands: Band[]; xAxisId?: string | number; at?: (cob: string) => number; focus?: string }) {
  const scale = useXAxisScale(xAxisId)
  const plot = usePlotArea()
  if (!scale || !plot) return null
  const items = bands.map((b) => {
    const x1 = scale(at ? at(b.x1) : b.x1, { position: 'start' }) ?? plot.x
    const x2 = scale(at ? at(b.x2) : b.x2, { position: 'end' }) ?? plot.x + plot.width
    return { x1: Math.max(x1, plot.x), x2: Math.min(x2, plot.x + plot.width), w: b.name.length * CHAR_W }
  })
  const spots = labelSpots(items, plot.x, plot.x + plot.width)
  return (
    // Above bands and series; a halo in the card's colour keeps names readable over bars.
    <ZIndexLayer zIndex={DefaultZIndexes.label}>
      <g aria-hidden>
        {bands.map((b, i) => (
          <text key={b.id} x={spots[i].x} y={plot.y + 11 + spots[i].lane * LANE_H} textAnchor={spots[i].anchor}
            fontSize={10} fontFamily={TICK.fontFamily} fill={b.id === focus ? 'var(--ui-accent)' : 'var(--ui-ink2)'}
            stroke="var(--ui-surface)" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke">{b.name}</text>
        ))}
      </g>
    </ZIndexLayer>
  )
}

/** Bands behind the series: render these before them. Edges keep back-to-back periods apart; `focus` (a period id) stands out. */
export function PeriodAreas({ bands, yAxisId, xAxisId, at, focus }: {
  bands: Band[]; yAxisId?: string | number; xAxisId?: string | number
  /** For a numeric x axis: a day to its x value. */ at?: (cob: string) => number
  focus?: string
}) {
  return (
    <>
      {bands.map((b) => {
        const strong = b.id === focus
        return (
          <ReferenceArea key={b.id} xAxisId={xAxisId} yAxisId={yAxisId} x1={at ? at(b.x1) : b.x1} x2={at ? at(b.x2) : b.x2} ifOverflow="hidden"
            fill={strong ? 'var(--ui-accent-pill)' : 'var(--ui-chip)'} fillOpacity={strong ? 1 : 0.6}
            stroke={strong ? 'var(--ui-accent)' : 'var(--ui-faint2)'} strokeOpacity={strong ? 0.6 : 0.35} strokeDasharray="3 3" />
        )
      })}
      <BandLabels bands={bands} xAxisId={xAxisId} at={at} focus={focus} />
    </>
  )
}

export interface LegendItem { key: string; glyph: ReactNode; text: string; toggle?: number }

/** A chart's legend, as report panels draw it; an item with `toggle` shows or hides that series. */
export function LegendList({ items, hidden = NONE, onToggle }: { items: LegendItem[]; hidden?: Set<number>; onToggle?: (i: number) => void }) {
  const { t } = useTranslation()
  if (!items.length) return null
  return (
    <ul aria-label={t('reportPanels.legend')} className="flex flex-wrap gap-x-3.5 gap-y-1.5">
      {items.map((x) => (
        <li key={x.key} className="inline-flex items-center gap-1.5 text-xs leading-[1.3] font-bold text-ui-ink2">
          {x.toggle === undefined || !onToggle ? <>{x.glyph}<span>{x.text}</span></> : (
            <button type="button" aria-pressed={!hidden.has(x.toggle)} onClick={() => onToggle(x.toggle!)}
              className={`-my-2 inline-flex items-center gap-1.5 py-2 ${hidden.has(x.toggle) ? 'line-through opacity-40' : ''}`}>
              {x.glyph}<span>{x.text}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}


function TraceGlyph({ tr }: { tr: Trace }) {
  if (tr.type_ === 'Bar') return <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: tr.color }} />
  if (tr.type_ === 'Dot') return <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: tr.color }} />
  return <span aria-hidden className="h-0 w-4 shrink-0 border-t-2" style={{ borderColor: tr.color }} />
}

/** Each series' average over the window, as a report's figures block. */
export function TraceAverages({ traces, entries, todayCob, cols }: { traces: Trace[]; entries: ReportDataEntry[]; todayCob: string; cols: 2 | 4 }) {
  const { t } = useTranslation()
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  if (!traces.length) return null
  return (
    <section aria-label={t('insights.legend')}>
      <FigureGrid cols={cols} items={traces.map((tr) => ({ label: tr.name, text: traceAverageLabel(tr, entries, todayCob, units) }))} />
    </section>
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
export function InsightsChart({ rows, traces, barLayout, averages, height = 170, hidden = NONE, periods = NO_PERIODS, onToggle }: InsightsChartProps) {
  const { t, i18n } = useTranslation()
  const tip = useChartTooltip()
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

  const legend: LegendItem[] = [
    ...traces.map((tr, i) => ({ key: `t${i}`, glyph: <TraceGlyph tr={tr} />, text: tr.name, toggle: i })),
  ]

  return (
    <div className="flex flex-col gap-3">
    <ResponsiveContainer width="100%" height={height}>
      {/* Without a Y axis on a side, leave room for the end date ticks there. */}
      <ComposedChart {...tip.chart} data={data} barGap={1} margin={{ top: 6, right: hasRight ? 0 : 16, bottom: 0, left: hasLeft ? 0 : 16 }}>
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
        <Tooltip {...tip.tooltip} isAnimationActive={false} cursor={{ fill: 'var(--ui-hairline)', stroke: 'var(--ui-hairline)' }}
          content={(p) => <PointTip {...p} traces={traces} units={{ h: t('today.unitH'), min: t('today.unitMin') }} locale={locale} />} />
        {averages.map((a, i) => (
          <ReferenceLine key={i} yAxisId={a.axis} y={a.value} stroke={a.color} strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
    <LegendList items={legend} hidden={hidden} onToggle={onToggle} />
    </div>
  )
}
