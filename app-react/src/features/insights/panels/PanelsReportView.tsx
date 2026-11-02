import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PanelsReport, Report, ReportDataEntry } from '../../../api/charts'
import type { UserPractice } from '../../../types/api'
import { ChartPanelView } from './ChartPanelView'
import { MonthPanelView } from './MonthPanelView'
import { StatsPanelView } from './StatsPanelView'
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
  /** Off in examples: month panels show only their grid. */
  monthFigures?: boolean
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

export function PanelsReportView({ report, definition, entries, previous, practices, todayCob, chartHeight, formLink, cols = 4, month = todayCob.slice(0, 7), interactive = true, legendLast = false, monthFigures = true }: PanelsReportViewProps) {
  const { t } = useTranslation()
  const lookup = makeLookup(entries, previous, practices)
  const days = windowDays(entries)
  const panels = visiblePanels(definition, lookup)
  const missing = missingRequired(definition, lookup)
  const firstChart = panels.findIndex((p) => p.kind === 'Chart')
  const labels = [...new Set(missing.map((r) => labelText(r.label, t)))].join(', ')
  const legend = panels.some((p) => p.kind === 'Month') && <MonthLegend />

  return (
    <div aria-label={report.name} role="group" className="flex flex-col gap-3">
      {missing.length > 0 && <MissingCard labels={labels} formLink={formLink} />}
      {!legendLast && legend}
      {panels.map((p, i) => (p.kind === 'Month' ? (
        <MonthPanelView key={i} practice={p.practice} month={month} end={monthEnd(month, todayCob)} todayCob={todayCob} lookup={lookup} figures={monthFigures} />
      ) : p.kind === 'Stats' ? (
        <StatsPanelView key={i} stats={p.stats} days={days} lookup={lookup} todayCob={todayCob} cols={cols} />
      ) : (
        // The first chart leads; the rest are shorter (15m6, 15m12).
        <ChartPanelView key={i} panel={p} panels={panels} days={days} lookup={lookup} todayCob={todayCob}
          height={i === firstChart ? chartHeight : Math.round(chartHeight * 0.72)} first={i === firstChart} compact={cols === 2} interactive={interactive} />
      )))}
      {legendLast && legend}
    </div>
  )
}
