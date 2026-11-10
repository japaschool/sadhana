import { useMarkedPeriods } from '../../../api/markedPeriods'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppBar } from '../../../layouts/mobile/AppBar'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { Headline } from '../Headline'
import { OverviewMobile } from '../overview/OverviewMobile'
import { deltaKey, formatDelta, formatHeadline, windowLabel } from '../insightsLogic'
import { PanelsReportView } from '../panels/PanelsReportView'
import { isTable, RANGES, useInsights } from '../useInsights'
import { DaySheet } from './DaySheet'
import { EndDateControl } from './EndDateControl'
import { InsightsChart, TraceAverages } from './InsightsChart'
import { InsightsTable } from './InsightsTable'
import { MonthNav } from './MonthNav'
import { useMoreMenu } from './MoreMenu'
import { ReportMenu } from './ReportMenu'

const CARD = 'rounded-[22px] border border-ui-hairline bg-ui-surface'

export function InsightsMobile() {
  const { t, i18n } = useTranslation()
  const { periods } = useMarkedPeriods()
  const ins = useInsights(undefined, true)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  // Always opens on Overview; the choice isn't stored.
  const [view, setView] = useState<'overview' | 'charts'>('overview')
  const more = useMoreMenu(view === 'charts' ? ins.report : null)
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const h = ins.headline
  // A table shows empty days too, so they can be filled in from it.
  const table = view === 'charts' && isTable(ins.report) && !ins.isLoading && !ins.isError && ins.entries.length > 0
  const panels = !ins.isLoading && !ins.isError ? ins.panels : null

  return (
    <>
      <AppBar title={<h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ui-ink">{t('insights.title')}</h1>} actions={more.actions} />
      {/* A table fills the screen down to the tab bar, so it drops the bottom padding that would scroll the page. */}
      <div className={`flex flex-col gap-3 px-4 ${table ? '' : 'pb-6'}`}>
        <div className="[&>div]:w-full [&_button]:max-w-none [&_button]:flex-1 [&_button]:text-sm">
          <SegmentedControl label={t('insights.overview.view')} value={view} onChange={setView}
            options={[{ value: 'overview', label: t('insights.overview.overview') }, { value: 'charts', label: t('insights.overview.charts') }]} />
        </div>
        {view === 'overview' ? <OverviewMobile /> : ins.noReports ? (
          <section className="flex flex-col items-center gap-3 rounded-[22px] border border-ui-hairline bg-ui-surface px-4 py-10">
            <p className="text-sm text-ui-muted">{t('charts.empty')}</p>
            <button type="button" onClick={more.create} className="min-h-12 rounded-[14px] bg-ui-accent-fill px-5 text-[15px] font-extrabold text-ui-ink">{t('insights.newChart')}</button>
          </section>
        ) : (
          <>
            <button type="button" aria-haspopup="menu" onClick={(e) => setMenuAnchor(e.currentTarget)}
              className="flex min-h-9 max-w-full items-center gap-1 self-start text-[17px] font-bold text-ui-accent">
              <span className="truncate">{ins.report?.name}</span>
              <span aria-hidden className="shrink-0">▾</span>
            </button>

            {ins.goals ? null : ins.month ? <MonthNav month={ins.month} todayCob={ins.todayCob} onChange={ins.setMonth} /> : (
              <div className="flex items-center justify-between gap-2">
                <div className="font-ui-mono [&_button]:px-2.5 [&_button]:text-xs">
                  <SegmentedControl label={t('insights.range')} value={ins.range} onChange={ins.setRange}
                    options={RANGES.map((r) => ({ value: r, label: t(`insights.range${r}`) }))} />
                </div>
                <EndDateControl end={ins.end} onChange={ins.setEnd} />
              </div>
            )}

            {table ? (
              <InsightsTable grouped={ins.grouped} traces={ins.traces} entries={ins.entries} todayCob={ins.todayCob} onOpenDay={setOpenDay} />
            ) : panels ? (
              <PanelsReportView key={ins.selectedId} report={ins.report!} definition={panels} entries={ins.entries} previous={ins.previousEntries} compare={ins.compare}
                practices={ins.practices} todayCob={ins.todayCob} chartHeight={230} formLink={`/settings/charts/${ins.selectedId}`} cols={2} month={ins.month ?? undefined} range={ins.range} yearEntries={ins.yearEntries} periods={periods} />
            ) : (
              <>
              {!ins.isLoading && !ins.isError && ins.hasData && <TraceAverages traces={ins.traces} entries={ins.entries} todayCob={ins.todayCob} cols={2} />}
              <section className={`${CARD} p-4`}>
                {ins.isLoading ? (
                  <div className="flex h-[170px] items-center justify-center">
                    <span role="status" aria-label={t('common.loading')}
                      className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
                  </div>
                ) : ins.isError ? (
                  <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('insights.loadFailed')}</p>
                ) : !ins.hasData ? (
                  <p className="py-10 text-center text-sm text-ui-muted">{t('insights.noData')}</p>
                ) : (
                  <>
                    {h && (
                      <Headline wide={false} className="mb-3" value={formatHeadline(h, units)} up={(h.delta ?? 0) >= 0}
                        label={t(h.kind === 'time' ? 'insights.average' : 'insights.dailyAverage', { range: windowLabel(ins.entries, i18n.language || 'en') })}
                        delta={h.delta === null ? null : t(deltaKey(ins.range, ins.compare.year), { delta: formatDelta(h.delta) })} onDelta={ins.compare.toggle} />
                    )}
                    {/* Remount per report and legend toggle: Recharts hangs updating in place when the series layout changes. */}
                    <InsightsChart key={`${ins.selectedId}|${[...ins.hidden]}`} rows={ins.rows} traces={ins.traces} barLayout={ins.barLayout}
                      averages={ins.averages} hidden={ins.hidden} periods={periods} onToggle={ins.toggle} />
                  </>
                )}
              </section>
              </>
            )}

          </>
        )}
      </div>
      {menuAnchor && (
        <ReportMenu anchor={menuAnchor} reports={ins.reports} selectedId={ins.selectedId}
          onSelect={(id) => { ins.select(id); setMenuAnchor(null) }} onClose={() => setMenuAnchor(null)} />
      )}
      {openDay && <DaySheet cob={openDay} names={ins.traces.map((tr) => tr.name)} onClose={() => setOpenDay(null)} />}
      {more.sheet}
    </>
  )
}

export function InsightsMobileScreen() {
  return (
    <MobileShell>
      <InsightsMobile />
    </MobileShell>
  )
}
