import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PanelsReport, Report, ReportDataEntry } from '../../../api/charts'
import type { UserPractice } from '../../../types/api'
import { ChartPanelView } from './ChartPanelView'
import { StatsPanelView } from './StatsPanelView'
import { labelText, makeLookup, missingRequired, visiblePanels, windowDays } from './panelLogic'

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

export function PanelsReportView({ report, definition, entries, previous, practices, todayCob, chartHeight, formLink, cols = 4 }: PanelsReportViewProps) {
  const { t } = useTranslation()
  const lookup = makeLookup(entries, previous, practices)
  const days = windowDays(entries)
  const panels = visiblePanels(definition, lookup)
  const missing = missingRequired(definition, lookup)
  const firstChart = panels.findIndex((p) => p.kind === 'Chart')
  const labels = [...new Set(missing.map((r) => labelText(r.label, t)))].join(', ')

  return (
    <div aria-label={report.name} role="group" className="flex flex-col gap-3">
      {missing.length > 0 && <MissingCard labels={labels} formLink={formLink} />}
      {panels.map((p, i) => (p.kind === 'Stats' ? (
        <StatsPanelView key={i} stats={p.stats} days={days} lookup={lookup} todayCob={todayCob} cols={cols} />
      ) : (
        // The first chart leads; the rest are shorter (15m6, 15m12).
        <ChartPanelView key={i} panel={p} panels={panels} days={days} lookup={lookup} todayCob={todayCob}
          height={i === firstChart ? chartHeight : Math.round(chartHeight * 0.72)} first={i === firstChart} compact={cols === 2} />
      )))}
    </div>
  )
}
