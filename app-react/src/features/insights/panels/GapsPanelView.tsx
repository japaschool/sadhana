import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import { formatDay, formatTick, spansYears } from '../insightsLogic'
import { AXIS, tipDate, TipRow, TipShell } from '../mobile/InsightsChart'
import { FigureGrid, type Figure } from './StatsPanelView'
import { eventOptions, gapEvents, gapFigures, TYPICAL_MIN, type GapEvent } from './gapLogic'
import type { Lookup } from './panelLogic'

interface GapsPanelProps {
  event: string
  days: string[]
  /** The window before `days`: the first event's gap reaches back into it. */
  prevDays: string[]
  lookup: Lookup
  todayCob: string
  height: number
  cols: 2 | 4
  /** Off in examples: no tooltip. */
  interactive?: boolean
}

/** The gap figures, then one bar per event at the height of the days since the one before, coloured by option. */
export function GapsPanelView({ event, days, prevDays, lookup, height, cols, interactive = true }: GapsPanelProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const events = gapEvents(event, days, prevDays, lookup)
  const options = eventOptions(event, events, lookup)
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

  // A non-dropdown practice has one bar, keyed by null.
  const keys: (string | null)[] = options.length ? options : [null]
  const byCob = new Map(events.map((x) => [x.cob, x]))
  const rows = days.map((cob) => {
    const x = byCob.get(cob)
    return { cob, ...Object.fromEntries(keys.map((o, i) => [`o${i}`, x && x.option === o ? x.gap : null])) }
  })
  const xTicks = days.length ? [...new Set([days[0], days[Math.floor((days.length - 1) / 2)], days[days.length - 1]])] : []
  const name = (x: GapEvent) => x.option ?? lookup.name(event) ?? ''
  const colour = (o: string | null) => `var(--ui-chart-${keys.indexOf(o) + 1})`

  return (
    <>
      <FigureGrid items={figures} cols={cols} />
      <section className={`flex min-w-0 flex-col gap-3 rounded-[20px] border border-ui-hairline bg-ui-surface ${cols === 2 ? 'p-4' : 'p-6'}`}>
        <h2 className="text-base leading-[1.3] font-extrabold text-ui-ink">{lookup.name(event)}</h2>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm font-extrabold text-ui-ink">{t('reportPanels.noEvents')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={rows} barCategoryGap="10%" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--ui-hairline)" />
              <XAxis dataKey="cob" ticks={xTicks} interval={0} tickFormatter={(c: string) => formatTick(c, locale, y)} {...AXIS} />
              <YAxis width={44} allowDecimals={false} domain={[0, 'auto']} {...AXIS} />
              {keys.map((o, i) => (
                <Bar key={i} dataKey={`o${i}`} stackId="gaps" fill={colour(o)} radius={2} minPointSize={2} maxBarSize={10} isAnimationActive={false} />
              ))}
              {interactive && <Tooltip isAnimationActive={false} cursor={{ fill: 'var(--ui-hairline)' }}
                content={({ active, label }) => {
                  const x = active && typeof label === 'string' ? byCob.get(label) : undefined
                  if (!x) return null
                  return (
                    <TipShell title={tipDate(x.cob, locale)}>
                      <TipRow color={colour(x.option)} name={name(x)}
                        value={x.gap === null ? '' : t('reportPanels.gapSince', { count: x.gap, date: formatDay(x.prev!, locale, y) })} />
                    </TipShell>
                  )
                }} />}
            </ComposedChart>
          </ResponsiveContainer>
        )}
        {options.length >= 2 && (
          <ul aria-label={t('reportPanels.legend')} className="flex flex-wrap gap-x-3.5 gap-y-1.5">
            {options.map((o) => (
              <li key={o} className="inline-flex items-center gap-1.5 text-xs leading-[1.3] font-bold text-ui-ink2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colour(o) }} />{o}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
