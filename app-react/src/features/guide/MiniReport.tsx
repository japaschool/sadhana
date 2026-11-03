import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Panel, PanelsReport } from '../../api/charts'
import { PanelsReportView } from '../insights/panels/PanelsReportView'
import { current } from '../insights/panels/templates'
import { toDateStr } from '../today/date'
import { exampleDay, exampleReport, exampleSummary } from './examples'
import type { Applied } from './examples'
import type { GuideKind } from './guideLogic'

/**
 * No summary figures (stats, a chart's average headline): the charts alone, so a first look stays light. A card holds one
 * month grid, so it sits beside the others; with the person's own practices each one is shown.
 * Drawn as the template draws it now, then without the template, so the renderer doesn't rebuild the figures back in.
 */
function fit(kind: GuideKind, definition: PanelsReport, compact: boolean, own: boolean): PanelsReport {
  const panels = current(definition).panels.flatMap((p): Panel[] => (p.kind === 'Stats' ? [] : p.kind === 'Chart' ? [{ ...p, headline: false }] : [p]))
  return { ...definition, template: null, panels: compact && kind === 'days' && !own ? panels.slice(0, 1) : panels }
}

/**
 * An example report drawn by the real renderer on bundled data, so it works before anything exists.
 * "Example" is in the frame, not the data, and nothing in it responds to touch.
 */
export function MiniReport({ kind, compact = false, head, footer, on = false, applied }: { kind: GuideKind; compact?: boolean; head?: ReactNode; footer?: ReactNode; on?: boolean; applied?: Applied }) {
  const { t, i18n } = useTranslation()
  const today = exampleDay(kind, toDateStr(new Date()))
  // i18n.language: the example's names and text are rebuilt when the language changes.
  const choices = JSON.stringify(applied)
  const example = useMemo(() => exampleReport(kind, today, t, applied), [kind, today, t, i18n.language, choices]) // eslint-disable-line react-hooks/exhaustive-deps
  const definition = fit(kind, example.definition, compact, !!applied)
  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-[20px] border bg-ui-surface ${on ? 'border-[1.5px] border-ui-accent-pill bg-ui-accent-soft' : 'border-ui-hairline'}`}>
      <div className="flex border-b border-ui-hairline bg-ui-chip px-3 py-[7px]">
        <span className="rounded-md border border-ui-hairline bg-ui-surface px-2 py-[3px] font-ui-mono text-[11px] leading-[1.3] font-semibold tracking-[.08em] text-ui-ink uppercase">
          {t('guide.example.band')}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-3">
        {head}
        <div role="img" aria-label={exampleSummary(kind, today, t)} className="pointer-events-none flex flex-col gap-3">
          <PanelsReportView report={{ id: `example-${kind}`, name: t('guide.example.band'), definition: { Panels: definition } }}
            definition={definition} entries={example.entries} previous={undefined} practices={example.practices} todayCob={today}
            chartHeight={compact ? 110 : 200} formLink={null} cols={compact ? 2 : 4} interactive={false} legendLast monthFigures={false} />
        </div>
      </div>
      {footer}
    </div>
  )
}
