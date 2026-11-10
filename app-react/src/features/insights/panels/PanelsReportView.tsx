import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import type { PanelsReport, Report, ReportDataEntry } from '../../../api/charts'
import type { UserPractice } from '../../../types/api'
import { ChartPanelView } from './ChartPanelView'
import { AroundPanelView } from './AroundPanelView'
import { GapsPanelView, OptionFilter } from './GapsPanelView'
import { GoalsPanelView } from './GoalsPanelView'
import { eventOptions, gapEvents } from './gapLogic'
import { MonthPanelView } from './MonthPanelView'
import { StatsPanelView } from './StatsPanelView'
import type { Compare, Range } from '../useInsights'
import { current } from './templates'
import { labelText, makeLookup, missingRequired, monthEnd, visiblePanels, windowDays } from './panelLogic'

interface PanelsReportViewProps {
  report: Report
  definition: PanelsReport
  entries: ReportDataEntry[]
  previous: ReportDataEntry[] | undefined
  practices: UserPractice[]
  todayCob: string
  chartHeight: number
  /** The report's form; null on shared pages, which can't edit. */
  formLink: string | null
  /** Figures per row: 2 on mobile and in previews (15m6), 4 otherwise. */
  cols?: 2 | 4
  /** yyyy-mm shown by month panels; the current month when left out. */
  month?: string
  /** Off in examples: charts show no tooltip. */
  interactive?: boolean
  /** The month legend under the grids, as in examples and form previews (17m3, 17t16); a report has it above them (17m23). */
  legendLast?: boolean
  /** Off in examples: month panels show only their grid, gaps panels only their chart. */
  monthFigures?: boolean
  /** The window's length, which words a headline's change; none in examples. */
  range?: Range
  /** The year to the window's end, read by the days-around table; it falls back to the window without it. */
  yearEntries?: ReportDataEntry[]
  /** What headline changes compare against; the previous window when left out. */
  compare?: Compare
  /** The signed-in user's marked periods, drawn as bands on charts; none on shared pages. */
  periods?: MarkedPeriod[]
}

/** A required practice was deleted or hidden (15m19, 15t10). */
function MissingCard({ labels, formLink }: { labels: string; formLink: string | null }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] border border-ui-hairline bg-ui-surface p-[18px]">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg leading-[1.3] font-extrabold text-ui-ink">{t('reportPanels.missingTitle', { labels })}</h2>
        <p className="text-sm leading-normal text-ui-ink2">{t('reportPanels.missingBody')}</p>
      </div>
      {formLink && (
        <Link to={formLink} className="flex min-h-11 items-center self-start rounded-[14px] bg-ui-primary px-4 text-sm font-bold text-ui-on-primary">
          {t('reportPanels.choosePractice')}
        </Link>
      )}
    </section>
  )
}

function MonthLegend() {
  const { t } = useTranslation()
  const box = 'h-3 w-3 shrink-0 rounded-[3px]'
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <ul aria-label={t('reportPanels.legend')} className="flex flex-wrap gap-x-3.5 gap-y-1.5">
        {([
          [t('reportPanels.done'), 'bg-ui-done'],
          [t('reportPanels.notDone'), 'bg-ui-heat-0'],
          [t('reportPanels.today'), 'outline-2 -outline-offset-1 outline-ui-ink'],
        ] as const).map(([text, cls]) => (
          <li key={text} className="inline-flex items-center gap-1.5 text-xs leading-[1.3] font-bold text-ui-ink2">
            <span aria-hidden className={`${box} ${cls}`} />{text}
          </li>
        ))}
      </ul>
      <p className="text-xs leading-[1.45] text-ui-muted">{t('reportPanels.monthNote')}</p>
    </div>
  )
}

export function PanelsReportView({ report, definition, entries, previous, practices, todayCob, chartHeight, formLink, cols = 4, month = todayCob.slice(0, 7), interactive = true, legendLast = false, monthFigures = true, range, yearEntries, periods, compare = { year: false } }: PanelsReportViewProps) {
  const { t } = useTranslation()
  const cmp = compare.year ? compare.entries ?? [] : previous ?? []
  // Last year's days sit apart from the window and the one before it, so one lookup holds them all.
  const lookup = makeLookup(entries, compare.year ? [...(previous ?? []), ...cmp] : previous, practices)
  const days = windowDays(entries)
  const prevDays = windowDays(previous ?? [])
  const cmpDays = windowDays(cmp)
  const def = current(definition)
  const panels = visiblePanels(def, lookup)
  const missing = missingRequired(def, lookup)
  const firstChart = panels.findIndex((p) => p.kind === 'Chart')
  const labels = [...new Set(missing.map((r) => labelText(r.label, t)))].join(', ')
  const year = yearEntries ? { lookup: makeLookup(yearEntries, undefined, practices), days: windowDays(yearEntries) } : { lookup, days }
  const legend = panels.some((p) => p.kind === 'Month') && <MonthLegend />
  // One option filter per event, shared by its Gaps and Around panels: picked options, empty for All.
  const [only, setOnly] = useState<Record<string, string[]>>({})
  const optionsOf = (event: string) => eventOptions(event,
    [...gapEvents(event, days, prevDays, lookup), ...gapEvents(event, year.days, [], year.lookup)], lookup)

  return (
    <div aria-label={report.name} role="group" className="flex flex-col gap-3">
      {missing.length > 0 && <MissingCard labels={labels} formLink={formLink} />}
      {!legendLast && legend}
      {panels.map((p, i) => {
        const event = p.kind === 'Gaps' || p.kind === 'Around' ? p.event : null
        const options = event ? optionsOf(event) : []
        const picked = event ? (only[event] ?? []).filter((o) => options.includes(o)) : []
        // The chips go over the first of the event's panels.
        const filter = event !== null && options.length > 0
          && panels.findIndex((q) => (q.kind === 'Gaps' || q.kind === 'Around') && q.event === event) === i
          && <OptionFilter options={options} only={picked} onChange={interactive ? (o) => setOnly({ ...only, [event]: o }) : undefined} />
        return (
          <Fragment key={i}>
            {filter}
            {p.kind === 'Gaps' ? (
              <GapsPanelView event={p.event} options={options} only={picked} days={days} prevDays={prevDays} cmpDays={cmpDays} compare={compare} range={range} lookup={lookup} todayCob={todayCob}
                height={chartHeight} cols={cols} interactive={interactive} periods={periods} figures={monthFigures} />
            ) : p.kind === 'Around' ? (
              <AroundPanelView event={p.event} only={picked} rows={p.rows} days={year.days} prevDays={[]} lookup={year.lookup} todayCob={todayCob} />
            ) : p.kind === 'Month' ? (
              <MonthPanelView practice={p.practice} month={month} end={monthEnd(month, todayCob)} todayCob={todayCob} lookup={lookup} figures={monthFigures} />
            ) : p.kind === 'Goals' ? (
              // The last 12 periods reach past the window: read the year when there is one, values and logged days alike.
              <GoalsPanelView goals={p.goals} entries={yearEntries ?? entries} lookup={yearEntries ? year.lookup : makeLookup(entries, undefined, practices)}
                todayCob={todayCob} formLink={formLink} cols={cols} interactive={interactive} />
            ) : p.kind === 'Stats' ? (
              <StatsPanelView stats={p.stats} days={days} lookup={lookup} todayCob={todayCob} cols={cols} />
            ) : (
              // The first chart leads; the rest are shorter (15m6, 15m12).
              <ChartPanelView panel={p} panels={panels} days={days} prevDays={cmpDays} compare={compare} range={range} lookup={lookup} todayCob={todayCob}
                height={i === firstChart ? chartHeight : Math.round(chartHeight * 0.72)} first={i === firstChart} compact={cols === 2} interactive={interactive} periods={periods} />
            )}
          </Fragment>
        )
      })}
      {legendLast && legend}
    </div>
  )
}
