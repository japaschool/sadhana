import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TabletShell } from '../../../layouts/tablet/TabletShell'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { formatDelta, formatHeadline, traceAverageLabel, windowLabel } from '../insightsLogic'
import { fromDateStr } from '../../today/date'
import { isTable, RANGES, useInsights } from '../useInsights'
import { DaySheet } from '../mobile/DaySheet'
import { EndDateControl } from '../mobile/EndDateControl'
import { InsightsChart } from '../mobile/InsightsChart'
import { InsightsTable } from '../mobile/InsightsTable'
import { useMoreMenu } from '../mobile/MoreMenu'
import { ReportMenu } from '../mobile/ReportMenu'

interface InsightsTabletProps {
  /** Desktop: the log panel's date ends the window, so there's no end date control here. */
  logDate?: Date
  /** Desktop: a table row opens its day in the log panel instead of a sheet. */
  onLogDate?: (d: Date) => void
  chartHeight?: number
}

export function InsightsTablet({ logDate, onLogDate, chartHeight = 300 }: InsightsTabletProps) {
  const { t, i18n } = useTranslation()
  const ins = useInsights(logDate, true)
  const more = useMoreMenu(ins.report)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const h = ins.headline
  // Pad the legend to whole rows so the hairline grid background doesn't show through empty cells.
  const pad = (4 - (ins.traces.length % 4)) % 4
  // A table shows empty days too, so they can be filled in from it.
  const table = isTable(ins.report) && !ins.isLoading && !ins.isError && ins.entries.length > 0

  return (
    <div className="flex flex-col gap-[22px] px-9 pt-[calc(36px+env(safe-area-inset-top))] pb-9">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-[34px] leading-tight font-extrabold tracking-[-0.02em]">{t('insights.title')}</h1>
          <button type="button" aria-haspopup="menu" onClick={(e) => setMenuAnchor(e.currentTarget)}
            className="flex min-h-9 max-w-full items-center gap-1.5 self-start text-[15px] font-bold text-ui-accent">
            <span className="truncate">{ins.report?.name ?? t('charts.allPractices')}</span>
            <span aria-hidden className="shrink-0">▾</span>
          </button>
        </div>
        <button type="button" aria-label={t('today.more')} aria-haspopup="menu" onClick={(e) => setMoreAnchor(e.currentTarget)}
          className="flex h-11 w-11 shrink-0 items-center justify-center gap-[3px] rounded-full border border-ui-hairline bg-ui-surface">
          {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-ui-ink" />)}
        </button>
      </header>

      <div className="flex items-center justify-between gap-3">
        <div className="font-ui-mono [&_button]:px-3.5 [&_button]:text-[13px]">
          <SegmentedControl label={t('insights.range')} value={ins.range} onChange={ins.setRange}
            options={RANGES.map((r) => ({ value: r, label: t(`insights.range${r}`) }))} />
        </div>
        {!logDate && <EndDateControl end={ins.end} onChange={ins.setEnd} />}
      </div>

      {table ? (
        // The table stops at the screen's 36px bottom padding, so the page itself doesn't scroll.
        <InsightsTable traces={ins.traces} entries={ins.entries} todayCob={ins.todayCob} bottomGap={36}
          onOpenDay={(cob) => (onLogDate ? onLogDate(fromDateStr(cob)) : setOpenDay(cob))} />
      ) : (
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
                <div className="flex items-end justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[13px] font-semibold text-ui-muted">
                      {t(h.kind === 'time' ? 'insights.average' : 'insights.dailyAverage', { range: windowLabel(ins.entries, i18n.language || 'en') })}
                    </p>
                    <p className="font-ui-mono text-[40px] leading-tight tracking-[-0.03em] text-ui-ink">{formatHeadline(h, units)}</p>
                  </div>
                  {h.delta !== null && (
                    <p className={`pb-2 text-[13px] font-bold ${h.delta >= 0 ? 'text-ui-good' : 'text-ui-muted'}`}>
                      {t(`insights.vsPrev${ins.range}`, { delta: formatDelta(h.delta) })}
                    </p>
                  )}
                </div>
              )}
              {/* Remount per report and legend toggle: Recharts hangs updating in place when the series layout changes. */}
              <InsightsChart key={`${ins.selectedId}|${[...ins.hidden]}`} rows={ins.rows} traces={ins.traces} barLayout={ins.barLayout}
                averages={ins.averages} hidden={ins.hidden} height={chartHeight} />
              <ul aria-label={t('insights.legend')}
                className="grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-ui-hairline bg-ui-hairline">
                {ins.traces.map((tr, i) => (
                  <li key={i} className="flex min-w-0 bg-ui-surface">
                    {/* Clicking a cell shows or hides its series on the chart. */}
                    <button type="button" aria-pressed={!ins.hidden.has(i)} onClick={() => ins.toggle(i)}
                      className={`flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3 text-left ${ins.hidden.has(i) ? 'opacity-40' : ''}`}>
                      <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ui-ink2">
                        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: tr.color }} />
                        <span className="truncate">{tr.name}</span>
                      </span>
                      <span className="font-ui-mono text-lg text-ui-ink">{traceAverageLabel(tr, ins.entries, ins.todayCob, units)}</span>
                    </button>
                  </li>
                ))}
                {Array.from({ length: pad }, (_, i) => <li key={`pad${i}`} aria-hidden className="bg-ui-surface" />)}
              </ul>
            </>
          )}
        </section>
      )}

      {menuAnchor && (
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
