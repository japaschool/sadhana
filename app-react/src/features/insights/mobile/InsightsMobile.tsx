import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppBar } from '../../../layouts/mobile/AppBar'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { formatDelta, formatHeadline, traceAverageLabel, windowLabel } from '../insightsLogic'
import { RANGES, useInsights } from '../useInsights'
import { EndDateControl } from './EndDateControl'
import { InsightsChart } from './InsightsChart'
import { ReportMenu } from './ReportMenu'

const CARD = 'rounded-[22px] border border-ui-hairline bg-ui-surface'

export function InsightsMobile() {
  const { t, i18n } = useTranslation()
  const ins = useInsights()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const h = ins.headline
  const ready = !ins.isLoading && !ins.isError && ins.hasData

  return (
    <>
      <AppBar title={<h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ui-ink">{t('insights.title')}</h1>} />
      <div className="flex flex-col gap-3 px-4 pb-6">
        <button type="button" aria-haspopup="menu" onClick={(e) => setMenuAnchor(e.currentTarget)}
          className="flex min-h-9 max-w-full items-center gap-1 self-start text-[17px] font-bold text-ui-accent">
          <span className="truncate">{ins.report?.name ?? t('charts.allPractices')}</span>
          <span aria-hidden className="shrink-0">▾</span>
        </button>

        <div className="flex items-center justify-between gap-2">
          <div className="font-ui-mono [&_button]:text-xs">
            <SegmentedControl label={t('insights.range')} value={ins.range} onChange={ins.setRange}
              options={RANGES.map((r) => ({ value: r, label: t(`insights.range${r}`) }))} />
          </div>
          <EndDateControl end={ins.end} onChange={ins.setEnd} />
        </div>

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
              <InsightsChart rows={ins.rows} traces={ins.traces} barLayout={ins.barLayout} averages={ins.averages} />
            </>
          )}
        </section>

        {ready && (
          <ul aria-label={t('insights.legend')} className={`${CARD} px-4 py-1`}>
            {ins.traces.map((tr) => (
              <li key={tr.name} className="flex min-h-11 items-center gap-3 border-b border-ui-hairline last:border-0">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: tr.color }} />
                <span className="min-w-0 flex-1 truncate text-[15px] text-ui-ink2">{tr.name}</span>
                <span className="font-ui-mono text-sm text-ui-ink">{traceAverageLabel(tr, ins.entries, ins.todayCob, units)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {menuAnchor && (
        <ReportMenu anchor={menuAnchor} reports={ins.reports} selectedId={ins.selectedId}
          onSelect={(id) => { ins.select(id); setMenuAnchor(null) }} onClose={() => setMenuAnchor(null)} />
      )}
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
