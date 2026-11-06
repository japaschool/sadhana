import { useChartTooltip } from '../../../ui/tooltipTrigger'
import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { fromDateStr, toDateStr } from '../../today/date'
import { periodBands } from '../periodBands'
import { formatDay, formatTick, spansYears } from '../insightsLogic'
import { AXIS, PeriodAreas, PeriodKey, tipDate, TipRow, TipShell } from '../mobile/InsightsChart'
import { FigureGrid, type Figure } from './StatsPanelView'
import { gapEvents, gapFigures, TYPICAL_MIN, type GapEvent } from './gapLogic'
import type { Lookup } from './panelLogic'

interface GapsPanelProps {
  event: string
  /** The event's options, which fix each one's marker; empty for a non-dropdown event. */
  options: string[]
  /** The options shown; empty is all. */
  only: string[]
  days: string[]
  /** The window before `days`: the first event's gap reaches back into it. */
  prevDays: string[]
  lookup: Lookup
  todayCob: string
  height: number
  cols: 2 | 4
  /** Off in examples: no tooltip. */
  interactive?: boolean
  /** Marked periods, drawn as bands; none on shared pages. */
  periods?: MarkedPeriod[]
}

/** Option markers (16m16): amber circle, purple square, then the chart palette. */
const MARK_COLOURS = ['var(--ui-state-ok-solid)', 'var(--ui-state-over-solid)', 'var(--ui-chart-5)', 'var(--ui-chart-7)', 'var(--ui-chart-8)', 'var(--ui-chart-2)']
const markColour = (i: number) => MARK_COLOURS[i % MARK_COLOURS.length]
const square = (i: number) => i % 2 === 1

export function Marker({ i, cx, cy }: { i: number; cx: number; cy: number }) {
  return square(i)
    ? <rect x={cx - 3.5} y={cy - 3.5} width={7} height={7} rx={1.5} fill={markColour(i)} />
    : <circle cx={cx} cy={cy} r={4} fill={markColour(i)} />
}

/** A thin stem from 0 up to the gap, with the option's marker on top. */
function lollipop(i: number) {
  return function Lollipop({ x = 0, y = 0, width = 0, height = 0, payload }: {
    x?: number; y?: number; width?: number; height?: number; payload?: Record<string, number | null>
  }) {
    // The other options' series still pass every row, as an empty slot in the stack: draw nothing there.
    if (payload?.[`o${i}`] == null) return <g />
    const cx = x + width / 2
    return (
      <g data-mark="gap">
        <line x1={cx} x2={cx} y1={y} y2={y + height} stroke="var(--ui-control)" strokeWidth={1} />
        <Marker i={i} cx={cx} cy={y} />
      </g>
    )
  }
}

/**
 * The option chips over a Gaps or Around panel: they key the markers and pick what every panel of the event counts.
 * Empty `only` is All. Static, as a key, without `onChange` or with one option.
 */
export function OptionFilter({ options, only, onChange }: { options: string[]; only: string[]; onChange?: (only: string[]) => void }) {
  const { t } = useTranslation()
  const live = onChange && options.length >= 2
  const chip = 'inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-bold'
  const toggle = (o: string) => {
    const next = only.includes(o) ? only.filter((x) => x !== o) : [...only, o]
    onChange!(next.length === options.length ? [] : next)
  }
  return (
    <div role="group" aria-label={t('reportPanels.option')} className="flex flex-wrap gap-2">
      {live && (
        <button type="button" aria-pressed={!only.length} onClick={() => onChange([])}
          className={`${chip} ${only.length ? 'bg-ui-chip text-ui-ink2' : 'bg-ui-accent-soft text-ui-ink'}`}>{t('reportPanels.allOptions')}</button>
      )}
      {options.map((o, i) => {
        const glyph = <svg aria-hidden width="10" height="10" className="shrink-0"><Marker i={i} cx={5} cy={5} /></svg>
        return live ? (
          <button key={o} type="button" aria-pressed={only.includes(o)} onClick={() => toggle(o)}
            className={`${chip} ${only.includes(o) ? 'bg-ui-accent-soft text-ui-ink' : 'bg-ui-chip text-ui-ink2'}`}>{glyph}{o}</button>
        ) : (
          <span key={o} className="inline-flex items-center gap-1.5 text-xs leading-[1.3] font-bold text-ui-ink2">{glyph}{o}</span>
        )
      })}
    </div>
  )
}

/** The gap figures, then a lollipop per event (16m16): a stem to the days since the one before, the option's marker on top, over calendar time. */
export function GapsPanelView({ event, options, only, days, prevDays, lookup, height, cols, interactive = true, periods = [] }: GapsPanelProps) {
  const { t, i18n } = useTranslation()
  const tip = useChartTooltip()
  const locale = i18n.language || 'en'
  const events = gapEvents(event, days, prevDays, lookup, only)
  const { typical, longest, latest } = gapFigures(events)
  const y = days.length > 0 && spansYears(days[0], days[days.length - 1])
  const span = (x: GapEvent) => `${formatDay(x.prev!, locale, y)} – ${formatDay(x.cob, locale, y)}`
  const gapFigure = (label: string, x: GapEvent | null): Figure => (x
    ? { label, text: t('reportPanels.gapDays', { count: x.gap! }), note: span(x) }
    : { label, text: '—' })
  const figures: Figure[] = [
    typical === null
      ? { label: t('reportPanels.typicalGap'), text: '—', note: events.length < TYPICAL_MIN ? t('reportPanels.needsEvents', { count: TYPICAL_MIN }) : undefined }
      : { label: t('reportPanels.typicalGap'), text: t('reportPanels.gapDays', { count: typical }) },
    gapFigure(t('reportPanels.longestGap'), longest),
    gapFigure(t('reportPanels.latestGap'), latest),
  ]

  // A non-dropdown practice has one mark, keyed by null.
  const keys: (string | null)[] = options.length ? options : [null]
  const byCob = new Map(events.map((x) => [x.cob, x]))
  // Calendar time, so the space between marks reads as the time between events.
  const at = (cob: string) => fromDateStr(cob).getTime()
  const rows = events.filter((x) => x.gap !== null)
    .map((x) => ({ t: at(x.cob), ...Object.fromEntries(keys.map((o, i) => [`o${i}`, x.option === o ? x.gap : null])) }))
  const xTicks = days.length ? [...new Set([days[0], days[Math.floor((days.length - 1) / 2)], days[days.length - 1]])].map(at) : []
  const bands = periodBands(periods, days)
  const name = (x: GapEvent) => x.option ?? lookup.name(event) ?? ''

  return (
    <>
      <FigureGrid items={figures} cols={cols} />
      <section className={`flex min-w-0 flex-col gap-3 rounded-[20px] border border-ui-hairline bg-ui-surface ${cols === 2 ? 'p-4' : 'p-6'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base leading-[1.3] font-extrabold text-ui-ink">{t('reportPanels.daysSince')}</h2>
          <span className="font-ui-mono text-xs text-ui-muted">{t('reportPanels.eventCount', { count: events.length })}</span>
        </div>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm font-extrabold text-ui-ink">{t('reportPanels.noEvents')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart {...tip.chart} data={rows} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--ui-hairline)" />
              <XAxis dataKey="t" type="number" scale="time" domain={[xTicks[0], xTicks[xTicks.length - 1]]} ticks={xTicks} interval={0}
                tickFormatter={(v: number) => formatTick(toDateStr(new Date(v)), locale, y)} padding={{ left: 6, right: 6 }} {...AXIS} />
              <YAxis width={32} allowDecimals={false} tickCount={3} domain={[0, 'auto']} {...AXIS} />
              <PeriodAreas bands={bands} at={at} />
              {/* One stack: an event has one option, so its marks never sit side by side. */}
              {keys.map((_, i) => (
                <Bar key={i} dataKey={`o${i}`} stackId="gaps" barSize={8} shape={lollipop(i)} isAnimationActive={false} />
              ))}
              {interactive && <Tooltip {...tip.tooltip} isAnimationActive={false} cursor={{ stroke: 'var(--ui-hairline)' }}
                content={({ active, label }) => {
                  const x = active && typeof label === 'number' ? byCob.get(toDateStr(new Date(label))) : undefined
                  if (!x) return null
                  return (
                    <TipShell title={tipDate(x.cob, locale)}>
                      <TipRow color={markColour(keys.indexOf(x.option))} name={name(x)}
                        value={x.gap === null ? '' : t('reportPanels.gapSince', { count: x.gap, date: formatDay(x.prev!, locale, y) })} />
                    </TipShell>
                  )
                }} />}
            </ComposedChart>
          </ResponsiveContainer>
        )}
        {/* The options' key is the chips above the report. */}
        {bands.length > 0 && (
          <ul aria-label={t('reportPanels.legend')} className="flex flex-wrap gap-x-3.5 gap-y-1.5"><li><PeriodKey /></li></ul>
        )}
      </section>
    </>
  )
}
