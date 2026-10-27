import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppBar } from '../../../layouts/mobile/AppBar'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { formatDelta, formatHeadline, traceAverageLabel, windowLabel } from '../insightsLogic'
import { isTable, RANGES, useInsights } from '../useInsights'
import { DaySheet } from './DaySheet'
import { EndDateControl } from './EndDateControl'
import { InsightsChart } from './InsightsChart'
import { InsightsTable } from './InsightsTable'
import { useMoreMenu } from './MoreMenu'
import { ReportMenu } from './ReportMenu'

const CARD = 'rounded-[22px] border border-ui-hairline bg-ui-surface'

export function InsightsMobile() {
  const { t, i18n } = useTranslation()
  const ins = useInsights(undefined, true)
  const more = useMoreMenu(ins.report)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const h = ins.headline
  const ready = !ins.isLoading && !ins.isError && ins.hasData
  // A table shows empty days too, so they can be filled in from it.
  const table = isTable(ins.report) && !ins.isLoading && !ins.isError && ins.entries.length > 0

  return (
    <>
      <AppBar title={<h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ui-ink">{t('insights.title')}</h1>} actions={more.actions} />
      {/* A table fills the screen down to the tab bar, so it drops the bottom padding that would scroll the page. */}
      <div className={`flex flex-col gap-3 px-4 ${table ? '' : 'pb-6'}`}>
        <button type="button" aria-haspopup="menu" onClick={(e) => setMenuAnchor(e.currentTarget)}
          className="flex min-h-9 max-w-full items-center gap-1 self-start text-[17px] font-bold text-ui-accent">
          <span className="truncate">{ins.report?.name ?? t('charts.allPractices')}</span>
          <span aria-hidden className="shrink-0">▾</span>
        </button>

        <div className="flex items-center justify-between gap-2">
          <div className="font-ui-mono [&_button]:px-2.5 [&_button]:text-xs">
            <SegmentedControl label={t('insights.range')} value={ins.range} onChange={ins.setRange}
              options={RANGES.map((r) => ({ value: r, label: t(`insights.range${r}`) }))} />
          </div>
          <EndDateControl end={ins.end} onChange={ins.setEnd} />
        </div>

        {table ? (
          <InsightsTable traces={ins.traces} entries={ins.entries} todayCob={ins.todayCob} onOpenDay={setOpenDay} />
        ) : (
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
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-ui-muted">
                      {t(h.kind === 'time' ? 'insights.average' : 'insights.dailyAverage', { range: windowLabel(ins.entries, i18n.language || 'en') })}
                    </p>
                    <p className="font-ui-mono text-[30px] leading-tight text-ui-ink">{formatHeadline(h, units)}</p>
                    {h.delta !== null && (
                      <p className={`text-xs font-semibold ${h.delta >= 0 ? 'text-ui-good' : 'text-ui-muted'}`}>
                        {t(`insights.vsPrev${ins.range}`, { delta: formatDelta(h.delta) })}
                      </p>
                    )}
                  </div>
                )}
                {/* Remount per report and legend toggle: Recharts hangs updating in place when the series layout changes. */}
                <InsightsChart key={`${ins.selectedId}|${[...ins.hidden]}`} rows={ins.rows} traces={ins.traces} barLayout={ins.barLayout}
                  averages={ins.averages} hidden={ins.hidden} />
              </>
            )}
          </section>
        )}

        {ready && !table && (
          <ul aria-label={t('insights.legend')} className={`${CARD} px-4 py-1`}>
            {ins.traces.map((tr, i) => (
              <li key={i} className="border-b border-ui-hairline last:border-0">
                {/* Tapping a row shows or hides its series on the chart. */}
                <button type="button" aria-pressed={!ins.hidden.has(i)} onClick={() => ins.toggle(i)}
                  className={`flex min-h-11 w-full items-center gap-3 text-left ${ins.hidden.has(i) ? 'opacity-40' : ''}`}>
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: tr.color }} />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-ui-ink2">{tr.name}</span>
                  <span className="font-ui-mono text-sm text-ui-ink">{traceAverageLabel(tr, ins.entries, ins.todayCob, units)}</span>
                </button>
              </li>
            ))}
          </ul>
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
