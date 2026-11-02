import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PanelsReport } from '../../api/charts'
import { PanelsReportView } from '../insights/panels/PanelsReportView'
import { toDateStr } from '../today/date'
import { exampleReport, exampleSummary } from './examples'
import type { GuideKind } from './guideLogic'

/** Sleep's four figures are two in the carousel's narrow frame: average sleep and nights in range. */
const COMPACT_SLEEP_FIGURES = [0, 3]

function fit(kind: GuideKind, definition: PanelsReport, compact: boolean): PanelsReport {
  if (kind !== 'sleep' || !compact) return definition
  return { ...definition, panels: definition.panels.map((p) => (p.kind === 'Stats' ? { ...p, stats: COMPACT_SLEEP_FIGURES.map((i) => p.stats[i]) } : p)) }
}

/**
 * An example report drawn by the real renderer on bundled data, so it works before anything exists.
 * "Example" is in the frame, not the data, and nothing in it responds to touch.
 */
export function MiniReport({ kind, compact = false, head, footer, on = false }: { kind: GuideKind; compact?: boolean; head?: ReactNode; footer?: ReactNode; on?: boolean }) {
  const { t, i18n } = useTranslation()
  const today = toDateStr(new Date())
  // i18n.language: the example's names and text are rebuilt when the language changes.
  const example = useMemo(() => exampleReport(kind, today, t), [kind, today, t, i18n.language]) // eslint-disable-line react-hooks/exhaustive-deps
  const definition = fit(kind, example.definition, compact)
  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-[20px] border bg-ui-surface ${on ? 'border-[1.5px] border-ui-accent-pill bg-ui-accent-soft' : 'border-ui-hairline'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ui-hairline bg-ui-chip px-3 py-[7px]">
        <span className="rounded-md border border-ui-hairline bg-ui-surface px-2 py-[3px] font-ui-mono text-[11px] leading-[1.3] font-semibold tracking-[.08em] text-ui-ink uppercase">
          {t('guide.example.band')}
        </span>
        <span className="rounded-md bg-ui-surface px-[7px] py-[3px] font-ui-mono text-[11px] leading-[1.3] font-medium text-ui-muted">{t('guide.example.after')}</span>
      </div>
      <div className="flex flex-col gap-3 p-3">
        {head}
        <div role="img" aria-label={exampleSummary(kind, today, t)} className="pointer-events-none flex flex-col gap-3">
          <PanelsReportView report={{ id: `example-${kind}`, name: t(`guide.example.after`), definition: { Panels: definition } }}
            definition={definition} entries={example.entries} previous={undefined} practices={example.practices} todayCob={today}
            chartHeight={compact ? 110 : 200} formLink={null} cols={compact ? 2 : 4} interactive={false} />
        </div>
      </div>
      {footer}
    </div>
  )
}
