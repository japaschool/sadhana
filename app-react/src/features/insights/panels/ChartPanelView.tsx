import { useId, type Key, type ReactNode } from 'react'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import type { ChartPanel, Panel, Series } from '../../../api/charts'
import type { Trace } from '../chartLogic'
import { barPlacement, formatDurationTick, formatTick, spansYears } from '../insightsLogic'
import { AXIS, TICK, tipDate, TipRow, TipShell } from '../mobile/InsightsChart'
import { formatDuration } from '../../today/values'
import {
  chartRows, clockText, fitHours, labelText, seriesColour, seriesName, statResult, tipLines, type BarState, type Lookup, type PanelRow, type Resolved,
} from './panelLogic'

interface ChartPanelProps {
  panel: ChartPanel
  /** All the report's panels: a tapped day shows them together. */
  panels: Panel[]
  days: string[]
  lookup: Lookup
  todayCob: string
  height: number
  /** The first chart carries the states legend and the no-data note. */
  first: boolean
  compact: boolean
  /** Off in examples: no tooltip. */
  interactive?: boolean
}

/** About 1px a bar: outlines and stripes can't render (15m8). */
const THIN_FROM = 120
/** Recharts takes this off each side of a bar, so 19% leaves the design's 62% bar. */
const BAR_GAP = '19%'

const FILL: Record<BarState, string> = {
  ok: 'var(--ui-state-ok)', under: 'var(--ui-state-under-fill)', over: 'var(--ui-state-over)', neutral: 'var(--ui-state-none)',
}
const SOLID: Record<BarState, string> = {
  ok: 'var(--ui-state-ok-solid)', under: 'var(--ui-state-under-solid)', over: 'var(--ui-state-over-solid)', neutral: 'var(--ui-state-none)',
}

/** A labelled target words itself from its key (`…Met`, `…Line`); Sleep's limits have no label and word themselves by range. */
const targetKey = (panel: ChartPanel) => {
  const label = panel.target?.label
  return label && 'Key' in label ? label.Key : null
}

function stateCell(state: BarState, thin: boolean, stripes: string) {
  if (thin) return { fill: SOLID[state] }
  if (state === 'under') return { fill: FILL.under, stroke: 'var(--ui-state-under)', strokeWidth: 1.6 }
  return { fill: state === 'over' ? `url(#${stripes})` : FILL[state] }
}

const asTrace = (mark: string): Trace => ({
  name: '', dataType: 'Int', color: '', showAverage: false, yAxis: null, type_: mark === 'Bar' || mark === 'Range' ? 'Bar' : 'Dot',
})

function Swatch({ state }: { state: BarState }) {
  const style = state === 'over'
    ? { background: 'repeating-linear-gradient(45deg, var(--ui-state-over-stripe) 0 1.2px, var(--ui-state-over) 1.2px 2.8px)' }
    : state === 'under'
      ? { background: FILL.under, boxShadow: 'inset 0 0 0 1.5px var(--ui-state-under)' }
      : { background: FILL[state] }
  return <span aria-hidden className="h-3 w-3 shrink-0 rounded-[2px]" style={style} />
}

function LineGlyph({ dashed }: { dashed: boolean }) {
  return <span aria-hidden className={`h-0 w-4 shrink-0 border-t-2 border-ui-ink ${dashed ? 'border-dashed' : 'border-solid'}`} />
}

/** The bar inside a bar, in its slot's middle (15m12). */
function InnerBar({ x = 0, y = 0, width = 0, height = 0 }: { x?: number; y?: number; width?: number; height?: number }) {
  const w = Math.max(2, width * 0.4)
  return <rect x={x + (width - w) / 2} y={y} width={w} height={height} rx={1} fill="var(--ui-ink)" opacity={0.78} />
}

function MarkGlyph({ mark }: { mark: Series['mark'] }) {
  if (mark === 'Dot' || mark === 'Line') return <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--ui-state-over)' }} />
  return (
    <span aria-hidden className="flex h-3 w-3 shrink-0 items-end justify-center rounded-[2px]" style={{ background: FILL.ok }}>
      <span className="h-2 w-[5px] bg-ui-ink opacity-[.78]" />
    </span>
  )
}

function PanelLegend({ panel, first, lookup }: { panel: ChartPanel; first: boolean; lookup: Lookup }) {
  const { t } = useTranslation()
  const u = { h: t('today.unitH'), min: t('today.unitMin') }
  const hrs = (v: number) => formatDuration(v, u)
  const target = first && panel.target?.colour ? panel.target : null
  const goal = targetKey(panel)
  const items: { key: string; glyph: ReactNode; text: string }[] = []
  if (target && goal) {
    if (target.min !== null) {
      items.push({ key: 'ok', glyph: <Swatch state="ok" />, text: t(`${goal}Met`) })
      items.push({ key: 'under', glyph: <Swatch state="under" />, text: t('reportPanels.missed') })
    }
  } else if (target) {
    const { min, max } = target
    if (min === null && max === null) items.push({ key: 'none', glyph: <Swatch state="neutral" />, text: t('reportPanels.noTarget') })
    else {
      const ok = min !== null && max !== null
        ? t('reportPanels.inRange', { range: `${hrs(min)}–${hrs(max)}` })
        : min !== null ? t('reportPanels.orMore', { value: hrs(min) }) : t('reportPanels.upTo', { value: hrs(max!) })
      items.push({ key: 'ok', glyph: <Swatch state="ok" />, text: ok })
      if (min !== null) items.push({ key: 'under', glyph: <Swatch state="under" />, text: t('reportPanels.under', { value: hrs(min) }) })
      if (max !== null) items.push({ key: 'over', glyph: <Swatch state="over" />, text: t('reportPanels.over', { value: hrs(max) }) })
    }
  }
  panel.lines.forEach((l, i) => {
    if (l.pick === null || !l.label) return
    items.push({
      key: `line${i}`, glyph: <LineGlyph dashed={l.dashed} />,
      text: labelText(l.label, t),
    })
  })
  if (panel.bar_layout === 'Overlaid') {
    panel.series.slice(1).forEach((s, i) => items.push({ key: `s${i}`, glyph: <MarkGlyph mark={s.mark} />, text: seriesName(s, lookup, t) }))
  } else if (panel.bar_layout === 'Stacked' && panel.target?.colour) {
    panel.series.slice(1).forEach((s, i) => {
      const state = panel.target && (panel.target.min !== null || panel.target.max !== null) ? 'ok' : 'neutral'
      items.push({
        key: `s${i}`, glyph: <span className="opacity-45"><Swatch state={state} /></span>,
        text: t('reportPanels.stackedOnTop', { label: labelText(s.label, t) }),
      })
    })
  } else if (panel.bar_layout === 'Stacked') {
    panel.series.forEach((s, i) => items.push({
      key: `s${i}`, glyph: <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: seriesColour(s, i, panel.bar_layout) }} />,
      text: seriesName(s, lookup, t),
    }))
  }
  if (goal && panel.target?.lines && panel.target.min !== null) {
    const value = panel.format === 'Count' ? String(panel.target.min) : hrs(panel.target.min)
    items.push({ key: 'goal', glyph: <LineGlyph dashed={false} />, text: t(`${goal}Line`, { value }) })
  }
  if (!items.length) return null
  return (
    <ul aria-label={t('reportPanels.legend')} className="flex flex-wrap gap-x-3.5 gap-y-1.5">
      {items.map((x) => (
        <li key={x.key} className="inline-flex items-center gap-1.5 text-xs leading-[1.3] font-bold text-ui-ink2">
          {x.glyph}<span>{x.text}</span>
        </li>
      ))}
    </ul>
  )
}

const LINE_LABEL = { fontSize: 10, fontFamily: TICK.fontFamily, fill: 'var(--ui-ink)', stroke: 'var(--ui-surface)', strokeWidth: 3, paintOrder: 'stroke' }

export function ChartPanelView({ panel, panels, days, lookup, todayCob, height, first, compact, interactive = true }: ChartPanelProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const stripes = `stripes-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const tickUnits = { h: t('today.unitH'), min: t('insights.tickMin') }
  const tipUnits = { h: t('today.unitH'), min: t('today.unitMin') }
  const rows = chartRows(panel, days, lookup)
  const thin = days.length > THIN_FROM
  const marks = panel.series.map((s) => s.mark)
  const placement = barPlacement(marks.map(asTrace), panel.bar_layout)
  const overlayAxes = placement.flatMap((p) => (p?.xAxisId ? [p.xAxisId] : []))
  const values = rows.flatMap((r: PanelRow) => panel.series.flatMap((_, i) => {
    const v: Resolved = r[`s${i}`]
    return v === null ? [] : Array.isArray(v) ? v : [v]
  }))

  const clock = panel.format === 'NoonClock'
  const [lo, hi] = fitHours(values)
  const hours = (hi - lo) / 60
  // Tall enough for a label an hour, otherwise every other hour still gets its grid line.
  const every = hours > 6 && height < 240 ? 2 : 1
  const hourTicks = Array.from({ length: hours + 1 }, (_, k) => lo + k * 60)
  // A stack reaches its total and a goal line must fit, or the top tick falls short of them.
  const tops = panel.bar_layout === 'Stacked'
    ? rows.map((r) => panel.series.reduce((sum, _, i) => { const v = r[`s${i}`]; return sum + (typeof v === 'number' ? v : 0) }, 0))
    : values
  const reach = panel.target?.lines ? [panel.target.min ?? 0, panel.target.max ?? 0] : []
  const maxHour = Math.ceil(Math.max(0, ...tops, ...reach) / 60)
  const hourStep = Math.ceil(maxHour / 6) || 1
  const durationTicks = Array.from({ length: Math.floor(maxHour / hourStep) + 1 }, (_, k) => k * hourStep * 60)
  const yTick = clock
    ? (v: number) => ((v - lo) / 60 % every === 0 ? clockText(v) : '')
    : panel.format === 'Duration' ? (v: number) => formatDurationTick(v, tickUnits) : (v: number) => String(v)

  const xTicks = rows.length
    ? [...new Set([rows[0], rows[Math.floor((rows.length - 1) / 2)], rows[rows.length - 1]].map((r) => r.cob))]
    : []
  const multiYear = rows.length > 0 && spansYears(rows[0].cob, rows[rows.length - 1].cob)
  const target = panel.target
  const goal = targetKey(panel)
  const limitText = (key: string, value: number) => (goal
    ? t(`${goal}Line`, { value: panel.format === 'Count' ? value : formatDurationTick(value, tickUnits) }).toLocaleLowerCase(locale)
    : `${t(`reportPanels.${key}`)} ${formatDurationTick(value, tickUnits)}`)
  const limits = (target?.lines ? [
    { key: 'min', value: target.min, position: 'insideTopRight' as const },
    { key: 'max', value: target.max, position: 'insideBottomRight' as const },
  ] : []).flatMap((l) => (l.value === null ? [] : [{ ...l, value: l.value }]))
  const lineValue = (i: number) => statResult({
    Average: { of: panel.lines[i].of, pick: panel.lines[i].pick, format: panel.format, scope: { today: true, missing_zero: false } },
  }, days, lookup, todayCob).value

  return (
    <section className={`flex min-w-0 flex-col gap-3 rounded-[20px] border border-ui-hairline bg-ui-surface ${compact ? 'p-4' : 'p-6'}`}>
      {panel.title && <h2 className="text-base leading-[1.3] font-extrabold text-ui-ink">{labelText(panel.title, t)}</h2>}
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={rows} barCategoryGap={thin ? '10%' : BAR_GAP} barGap={1} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <pattern id={stripes} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="4" height="4" fill="var(--ui-state-over)" />
                <rect width="1.7" height="4" fill="var(--ui-state-over-stripe)" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--ui-hairline)" />
            <XAxis dataKey="cob" ticks={xTicks} interval={0} tickFormatter={(c: string) => formatTick(c, locale, multiYear)} {...AXIS} />
            {overlayAxes.map((id) => <XAxis key={id} xAxisId={id} dataKey="cob" hide />)}
            <YAxis reversed={panel.reversed} width={44} domain={clock ? [lo, hi] : [0, 'auto']} tickFormatter={yTick}
              {...(clock ? { ticks: hourTicks, interval: 0 as const } : panel.format === 'Duration' ? { ticks: durationTicks, interval: 0 as const } : {})} {...AXIS} />
            {panel.series.map((s, i) => {
              const colour = seriesColour(s, i, panel.bar_layout)
              if (s.mark === 'Dot') {
                const base = s.only_with
                // Sits above the bar it's beside, so it reads the base's height.
                const at = (r: PanelRow) => (r[`s${i}`] === null ? null : base === null ? r[`s${i}`] : r[`s${base}`])
                return (
                  <Line key={i} dataKey={at} stroke="none" isAnimationActive={false} activeDot={false} legendType="none"
                    dot={(d: { key?: Key | null; cx?: number; cy?: number }) => (d.cx === undefined || d.cy === undefined || d.cy === null
                      ? <g key={d.key} />
                      : <circle key={d.key} data-mark="dot" cx={d.cx} cy={d.cy - 6} r={2.6} fill={colour} />)} />
                )
              }
              if (s.mark === 'Line') {
                return (
                  <Line key={i} dataKey={`s${i}`} stroke={colour} strokeWidth={2} dot={{ r: 2.4, fill: colour, strokeWidth: 0 }}
                    activeDot={false} isAnimationActive={false} />
                )
              }
              const bar = placement[i]
              if (!bar) return null
              const inner = panel.bar_layout === 'Overlaid' && i > 0
              const fade = panel.bar_layout === 'Stacked' && i > 0 ? 0.45 : 1
              return (
                <Bar key={i} dataKey={`s${i}`} xAxisId={bar.xAxisId} stackId={bar.stackId} fill={colour} fillOpacity={inner ? 1 : bar.fillOpacity}
                  radius={thin ? 0 : 2} maxBarSize={14} isAnimationActive={false} {...(inner ? { shape: InnerBar } : {})}>
                  {target?.colour && !inner && rows.map((r) => <Cell key={r.cob} opacity={fade} {...stateCell(r.state ?? 'neutral', thin, stripes)} />)}
                </Bar>
              )
            })}
            {interactive && <Tooltip isAnimationActive={false} cursor={{ fill: 'var(--ui-hairline)', stroke: 'var(--ui-hairline)' }}
              content={({ active, label }) => {
                if (!active || typeof label !== 'string') return null
                const lines = tipLines(panels, label, lookup, t, tipUnits)
                if (!lines.length) return null
                return (
                  <TipShell title={tipDate(label, locale)}>
                    {lines.map((l) => <TipRow key={l.key} color={l.colour ?? SOLID[l.state ?? 'neutral']} name={l.name} value={l.text} />)}
                  </TipShell>
                )
              }} />}
            {limits.map((l) => (
              <ReferenceLine key={l.key} y={l.value} ifOverflow="extendDomain" stroke="var(--ui-ink)" strokeWidth={1.3} strokeDasharray="4 3"
                label={{ ...LINE_LABEL, value: limitText(l.key, l.value), position: l.position }} />
            ))}
            {panel.lines.map((l, i) => {
              const y = lineValue(i)
              if (y === null) return null
              return (
                <ReferenceLine key={`l${i}`} y={y} ifOverflow="extendDomain" stroke="var(--ui-ink)" strokeWidth={1.5} strokeDasharray={l.dashed ? '5 4' : undefined}
                  label={{ ...LINE_LABEL, value: clock ? clockText(y) : String(y), position: l.pick === 'To' ? 'insideTopRight' : 'insideBottomRight' }} />
              )
            })}
          </ComposedChart>
        </ResponsiveContainer>
        {first && values.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center pb-6 text-sm font-extrabold text-ui-ink">{t('insights.noData')}</p>
        )}
      </div>
      <PanelLegend panel={panel} first={first} lookup={lookup} />
    </section>
  )
}
