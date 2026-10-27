import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DesktopShell } from '../../../../layouts/desktop/DesktopShell'
import { TabletShell } from '../../../../layouts/tablet/TabletShell'
import { useLayout } from '../../../../layouts/useLayout'
import { CARD } from '../../../yatras/settings/mobile/AdminPage'
import { graphOf, useChartEditor } from '../useChartEditor'
import {
  AxesCard, DeleteChartSheet, FailedBanner, Footer, GraphSections, GROUP, NameCard, Preview, SPINNER, subtitle, TableColumns,
} from '../mobile/ChartEditorMobile'
import type { Sheet } from '../mobile/ChartEditorMobile'
import { NewChartSheet } from '../mobile/NewChartSheet'
import { StyleIcon } from '../mobile/parts'
import { PracticePickerSheet } from '../mobile/SeriesSheets'

type Editor = ReturnType<typeof useChartEditor>

const ITEM = 'flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px]'

/** Your charts beside the editor; picking one opens its settings. */
function ChartsColumn({ id, reports }: { id: string; reports: NonNullable<Editor['reports']> }) {
  const { t } = useTranslation()
  const [creating, setCreating] = useState(false)
  const icon = (graph: boolean) => graph
    ? <StyleIcon style="Bar" className="h-3.5 w-3.5" />
    : <span aria-hidden className="w-3.5 text-center text-[13px] leading-none">▦</span>
  return (
    <nav aria-label={t('insights.title')}
      className="sticky top-0 flex h-dvh w-[232px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-ui-control px-3 pt-[calc(32px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-0.5 px-3 pb-4">
        <Link to="/settings" className="flex min-h-8 items-center gap-1 self-start text-[13px] font-bold text-ui-accent">
          <span aria-hidden>‹</span>{t('nav.settings')}
        </Link>
        <p className="text-[22px] leading-tight font-extrabold tracking-[-0.01em] text-ui-ink">{t('insights.title')}</p>
      </div>
      <p className={`${GROUP} px-3 pb-1`}>{t('chartSettings.yourCharts')}</p>
      {reports.map((r) => {
        const active = r.id === id
        const g = graphOf(r)
        const count = g ? g.traces.length : 'Grid' in r.definition ? r.definition.Grid.practices.length : 0
        return (
          <Link key={r.id} to={`/settings/charts/${r.id}`} aria-current={active ? 'page' : undefined}
            className={`${ITEM} ${active ? 'bg-ui-accent-pill font-bold text-ui-ink' : 'font-semibold text-ui-ink2'}`}>
            {icon(!!g)}
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="shrink-0 font-ui-mono text-xs font-semibold text-ui-muted">{count}</span>
          </Link>
        )
      })}
      <button type="button" onClick={() => setCreating(true)} className={`${ITEM} font-bold text-ui-accent`}>
        <span aria-hidden>+</span>{t('chartSettings.newChart')}
      </button>
      {creating && <NewChartSheet onClose={() => setCreating(false)} />}
    </nav>
  )
}

/**
 * A chart's settings on tablet and desktop: your charts in a column, the settings beside them, and series edited
 * inline so the preview stays in view. Tablet keeps the preview on top of the settings; desktop gives it a panel.
 */
export function ChartEditorWide() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const layout = useLayout()
  const desktop = layout === 'desktop'
  const ed = useChartEditor(id)
  // A graph that was just created opens with its practice picker up.
  const [sheet, setSheet] = useState<Sheet>(() => ((location.state as { pick?: boolean } | null)?.pick ? { kind: 'add' } : null))
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])
  // Another chart picked in the column: start it closed.
  const [shownId, setShownId] = useState(id)
  if (shownId !== id) { setShownId(id); setSheet(null) }

  const close = () => setSheet(null)
  const focus = sheet?.kind === 'edit' ? sheet.index : undefined

  let content
  if (ed.isLoading) content = <div className="flex h-40 items-center justify-center"><span role="status" aria-label={t('common.loading')} className={SPINNER} /></div>
  else if (ed.isError) content = <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('common.error')}</p>
  else if (!ed.report) return <Navigate to="/settings/charts" replace />
  else {
    const preview = (header: boolean) => (
      <section className={`${CARD} flex flex-col gap-3 p-4`}>
        <Preview ed={ed} header={header} height={desktop ? 240 : 190} picking={sheet?.kind === 'add'} focus={focus} />
      </section>
    )
    content = (
      <div className="flex min-h-dvh">
        <ChartsColumn id={id} reports={ed.reports} />
        <main className={`flex min-w-0 flex-1 flex-col gap-4 px-8 pt-[calc(32px+env(safe-area-inset-top))] pb-10 ${desktop ? 'max-w-[640px]' : ''}`}>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.02em] break-words text-ui-ink">{ed.report.name}</h1>
            <p className="text-sm text-ui-muted">{subtitle(ed, t)}</p>
          </div>
          <FailedBanner ed={ed} />
          {!desktop && preview(true)}
          <NameCard ed={ed} />
          {ed.graph
            ? <><GraphSections ed={ed} setSheet={setSheet} inline={sheet} />{!desktop && <AxesCard ed={ed} />}</>
            : <TableColumns ed={ed} />}
          <Footer ed={ed} onDelete={() => setSheet({ kind: 'delete' })} />
        </main>
        {desktop && (
          <aside aria-label={t('chartSettings.preview')}
            className="sticky top-0 flex h-dvh min-w-[360px] flex-1 flex-col gap-4 overflow-y-auto border-l border-ui-control bg-ui-sheet px-6 pt-[calc(32px+env(safe-area-inset-top))] pb-10">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-[.1em] text-ui-accent">{t('chartSettings.preview')}</span>
              <h2 className="text-xl font-extrabold break-words text-ui-ink">{ed.report.name}</h2>
              <p className="text-xs text-ui-muted">{t(ed.graph ? 'chartSettings.last30' : 'chartSettings.last30Table')}</p>
            </div>
            {preview(false)}
            {ed.graph && <AxesCard ed={ed} />}
          </aside>
        )}
      </div>
    )
  }

  const page = (
    <>
      {content}
      {sheet?.kind === 'add' && <PracticePickerSheet ed={ed} onClose={close} />}
      {/* Choosing another practice goes back to that series' editor. */}
      {sheet?.kind === 'choose' && <PracticePickerSheet ed={ed} replace={sheet.index} onClose={() => setSheet({ kind: 'edit', index: sheet.index })} />}
      {sheet?.kind === 'delete' && <DeleteChartSheet ed={ed} onClose={close} />}
    </>
  )
  return desktop ? <DesktopShell log={false}>{() => page}</DesktopShell> : <TabletShell>{page}</TabletShell>
}
