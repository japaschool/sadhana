import { useMarkedPeriods } from '../../../api/markedPeriods'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TabletShell } from '../../../layouts/tablet/TabletShell'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { Headline } from '../Headline'
import { formatDelta, formatHeadline, windowLabel } from '../insightsLogic'
import { fromDateStr } from '../../today/date'
import { OverviewWide } from '../overview/OverviewWide'
import { PanelsReportView } from '../panels/PanelsReportView'
import { isTable, RANGES, useInsights } from '../useInsights'
import { DaySheet } from '../mobile/DaySheet'
import { EndDateControl } from '../mobile/EndDateControl'
import { MonthNav } from '../mobile/MonthNav'
import { InsightsChart, TraceAverages } from '../mobile/InsightsChart'
import { InsightsTable } from '../mobile/InsightsTable'
import { useMoreMenu } from '../mobile/MoreMenu'
import { ReportMenu } from '../mobile/ReportMenu'

interface InsightsTabletProps {
  /** Desktop: the log panel's date ends the window, so there's no end date control here. */
  logDate?: Date
  /** Desktop: a table row opens its day in the log panel instead of a sheet. */
  onLogDate?: (d: Date) => void
  chartHeight?: number
  /** A panels report's lead chart, which sits above other cards (15t5, 15d5). */
  panelHeight?: number
}

export function InsightsTablet({ logDate, onLogDate, chartHeight = 300, panelHeight = 300 }: InsightsTabletProps) {
  const { t, i18n } = useTranslation()
  const { periods } = useMarkedPeriods()
  const ins = useInsights(logDate, true)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  // Always opens on Overview; the choice isn't stored.
  const [view, setView] = useState<'overview' | 'charts'>('overview')
  const more = useMoreMenu(view === 'charts' ? ins.report : null)
  const charts = view === 'charts'
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const h = ins.headline
  // A table shows empty days too, so they can be filled in from it.
  const table = charts && isTable(ins.report) && !ins.isLoading && !ins.isError && ins.entries.length > 0
  const panels = !ins.isLoading && !ins.isError ? ins.panels : null

  return (
    <div className="flex flex-col gap-[22px] px-9 pt-[calc(36px+env(safe-area-inset-top))] pb-9">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-[34px] leading-tight font-extrabold tracking-[-0.02em]">{t('insights.title')}</h1>
          <div className="mt-1 self-start">
            <SegmentedControl label={t('insights.overview.view')} value={view} onChange={setView}
              options={[{ value: 'overview', label: t('insights.overview.overview') }, { value: 'charts', label: t('insights.overview.charts') }]} />
          </div>
        </div>
        <button type="button" aria-label={t('today.more')} aria-haspopup="menu" onClick={(e) => setMoreAnchor(e.currentTarget)}
          className="flex h-11 w-11 shrink-0 items-center justify-center gap-[3px] rounded-full border border-ui-hairline bg-ui-surface">
          {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-ui-ink" />)}
        </button>
      </header>

      {!charts ? <OverviewWide /> : ins.noReports ? (
        <section className="flex flex-col items-center gap-3 rounded-[22px] border border-ui-hairline bg-ui-surface px-6 py-16">
            <p className="text-sm text-ui-muted">{t('charts.empty')}</p>
            <button type="button" onClick={more.create} className="min-h-12 rounded-[14px] bg-ui-accent-fill px-5 text-[15px] font-extrabold text-ui-ink">{t('insights.newChart')}</button>
          </section>
        ) : (
        <>
          <button type="button" aria-haspopup="menu" onClick={(e) => setMenuAnchor(e.currentTarget)}
            className="flex min-h-9 max-w-full items-center gap-1.5 self-start text-[15px] font-bold text-ui-accent">
            <span className="truncate">{ins.report?.name}</span>
            <span aria-hidden className="shrink-0">▾</span>
          </button>

          {ins.goals ? null : ins.month ? <MonthNav month={ins.month} todayCob={ins.todayCob} onChange={ins.setMonth} /> : (
            <div className="flex items-center justify-between gap-3">
              <div className="font-ui-mono [&_button]:px-3.5 [&_button]:text-[13px]">
                <SegmentedControl label={t('insights.range')} value={ins.range} onChange={ins.setRange}
                  options={RANGES.map((r) => ({ value: r, label: t(`insights.range${r}`) }))} />
              </div>
              {!logDate && <EndDateControl end={ins.end} onChange={ins.setEnd} />}
            </div>
          )}

          {table ? (
            // The table stops at the screen's 36px bottom padding, so the page itself doesn't scroll.
            <InsightsTable grouped={ins.grouped} traces={ins.traces} entries={ins.entries} todayCob={ins.todayCob} bottomGap={36}
              onOpenDay={(cob) => (onLogDate ? onLogDate(fromDateStr(cob)) : setOpenDay(cob))} />
          ) : panels ? (
            <PanelsReportView key={ins.selectedId} report={ins.report!} definition={panels} entries={ins.entries} previous={ins.previousEntries}
              practices={ins.practices} todayCob={ins.todayCob} chartHeight={panelHeight} formLink={`/settings/charts/${ins.selectedId}`} month={ins.month ?? undefined} range={ins.range} yearEntries={ins.yearEntries} periods={periods} />
          ) : (
            // The averages sit over the chart as a report's figures do over its chart.
            <div className="flex flex-col gap-3">
            {!ins.isLoading && !ins.isError && ins.hasData && <TraceAverages traces={ins.traces} entries={ins.entries} todayCob={ins.todayCob} cols={4} />}
            <section className="flex flex-col gap-[18px] rounded-[24px] border border-ui-hairline bg-ui-surface p-6">
              {ins.isLoading ? (
                <div className="flex h-[300px] items-center justify-center">
                  <span role="status" aria-label={t('common.loading')}
                    className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
                </div>
              ) : ins.isError ? (
                <p role="alert" className="py-16 text-center text-sm text-ui-danger">{t('insights.loadFailed')}</p>
              ) : !ins.hasData ? (
                <p className="py-16 text-center text-sm text-ui-muted">{t('insights.noData')}</p>
              ) : (
                <>
                  {h && (
                    <Headline wide value={formatHeadline(h, units)} up={(h.delta ?? 0) >= 0}
                      label={t(h.kind === 'time' ? 'insights.average' : 'insights.dailyAverage', { range: windowLabel(ins.entries, i18n.language || 'en') })}
                      delta={h.delta === null ? null : t(`insights.vsPrev${ins.range}`, { delta: formatDelta(h.delta) })} />
                  )}
                  {/* Remount per report and legend toggle: Recharts hangs updating in place when the series layout changes. */}
                  <InsightsChart key={`${ins.selectedId}|${[...ins.hidden]}`} rows={ins.rows} traces={ins.traces} barLayout={ins.barLayout}
                    averages={ins.averages} hidden={ins.hidden} periods={periods} height={chartHeight} onToggle={ins.toggle} />
                </>
              )}
            </section>
            </div>
          )}
        </>
      )}

      {charts && menuAnchor && (
        <ReportMenu anchor={menuAnchor} reports={ins.reports} selectedId={ins.selectedId}
          onSelect={(id) => { ins.select(id); setMenuAnchor(null) }} onClose={() => setMenuAnchor(null)} />
      )}
      {moreAnchor && (
        <AnchoredMenu anchor={moreAnchor} label={t('today.more')} onClose={() => setMoreAnchor(null)}>
          {more.actions.map((a) => (
            <MenuItem key={a.label} onSelect={() => { setMoreAnchor(null); a.onSelect() }}>{a.label}</MenuItem>
          ))}
        </AnchoredMenu>
      )}
      {openDay && <DaySheet cob={openDay} names={ins.traces.map((tr) => tr.name)} onClose={() => setOpenDay(null)} />}
      {more.sheet}
    </div>
  )
}

export function InsightsTabletScreen() {
  return (
    <TabletShell>
      <InsightsTablet />
    </TabletShell>
  )
}
