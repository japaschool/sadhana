import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../../api/charts'
import type { Report } from '../../../api/charts'
import { practicesApi } from '../../../api/practices'
import { useToast } from '../../../hooks/useToast'
import { DesktopShell } from '../../../layouts/desktop/DesktopShell'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { TabletShell } from '../../../layouts/tablet/TabletShell'
import { useLayout } from '../../../layouts/useLayout'
import { toDateStr } from '../../today/date'
import { BTN, CARD, FIELD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { SPINNER } from '../settings/mobile/ChartEditorMobile'
import { ChartsColumn } from '../settings/wide/ChartEditorWide'
import { KindGlyph } from '../ReportGlyph'
import { writeStored } from '../useInsights'
import { nameTaken, REPORTS_KEY, useReports } from '../useReports'
import { PanelsReportView } from './PanelsReportView'
import { draftProblem, draftToDefinition, NEW_DRAFTS, TemplateForm } from './TemplateForm'

const SMALL_BTN = 'flex min-h-11 items-center rounded-[14px] px-4 text-sm font-bold'

function Busy() {
  const { t } = useTranslation()
  return <div className="flex h-40 items-center justify-center"><span role="status" aria-label={t('common.loading')} className={SPINNER} /></div>
}

type Slug = keyof typeof NEW_DRAFTS

/** /settings/charts/new/:template */
export function NewTemplateScreen() {
  const { template } = useParams()
  return template && template in NEW_DRAFTS
    ? <NewReport key={template} slug={template as Slug} />
    : <Navigate to="/settings/charts" replace />
}

/** A new report: nothing is saved until Create, so half-filled reports never reach Insights. */
function NewReport({ slug }: { slug: Slug }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const layout = useLayout()
  const wide = layout !== 'mobile'
  const desktop = layout === 'desktop'
  const reportsQ = useReports()
  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const todayCob = toDateStr(new Date())
  // The same query as Insights and the chart editor's preview: 30 days, or half a year for month grids (Last 90 days needs it).
  // A year for gaps: the days-around table needs 10 events. A year for goals too: 12 months, as Insights reads them.
  const duration = slug === 'days' ? 'HalfYear' : slug === 'gaps' || slug === 'goals' ? 'Year' : 'Month'
  // Only Goals has a preview on mobile, below the form.
  const mobilePreview = slug === 'goals'
  const dataQ = useQuery({ queryKey: ['report-data', todayCob, duration], queryFn: () => chartsApi.getReportData(todayCob, duration), enabled: wide || mobilePreview })

  const defaultName = t(`templateForm.${slug}Name`)
  const [name, setName] = useState(defaultName)
  const [draft, setDraft] = useState(NEW_DRAFTS[slug])
  const definition = draftToDefinition(draft)
  const taken = nameTaken(reportsQ.data ?? [], name)
  const ready = !!name.trim() && !!definition && !taken
  const create = useMutation({
    mutationFn: async () => {
      const id = await chartsApi.createReport(name.trim(), definition!)
      return { id, name: name.trim(), definition: definition! } satisfies Report
    },
    onSuccess: (r) => {
      qc.setQueryData<Report[]>([...REPORTS_KEY], (list) => [...(list ?? []), r])
      // Back on Insights, the new report is the one shown.
      writeStored(r.id)
      navigate('/charts')
    },
    onError: () => showToast({ message: t('common.error'), variant: 'error' }),
  })

  const practices = practicesQ.data
  const nameCard = (
    <section className={`${CARD} flex flex-col gap-1.5 p-4`}>
      <label htmlFor="report-name" className="text-[13px] font-bold text-ui-muted">{t('chartSettings.name')}</label>
      <input id="report-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-invalid={taken} className={FIELD} />
      {taken && <p role="alert" className="text-[13px] text-ui-danger">{t('chartSettings.nameTaken')}</p>}
    </section>
  )
  const form = practicesQ.isError ? <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('common.error')}</p>
    : !practices ? <Busy />
    : <TemplateForm value={draft} onChange={setDraft} practices={practices} name={nameCard} />
  const createLabel = t('templateForm.create')
  const heading = (size: string) => (
    <div className="flex min-w-0 flex-col gap-1">
      <h1 className={`${size} leading-[1.15] font-extrabold tracking-[-0.02em] text-ui-ink`}>{t(`templateForm.new${draft.kind}`)}</h1>
      <p className="flex items-center gap-2 text-sm text-ui-muted"><KindGlyph kind={slug} className="text-ui-muted" />{t(`templateForm.ready${draft.kind}`)}</p>
    </div>
  )

  const preview: ReactNode = !definition
    ? <p className={`${HINT} rounded-xl border border-dashed border-ui-control px-4 py-10 text-center`}>{t('templateForm.previewEmpty')}</p>
    : dataQ.isLoading || !practices ? <Busy />
    : (
      // ponytail: the preview has no previous window, so its first night has no bar; pass it through if that reads as wrong.
      <PanelsReportView report={{ id: 'new', name: name.trim() || defaultName, definition }} definition={definition.Panels}
        entries={dataQ.data ?? []} previous={undefined} practices={practices} todayCob={todayCob} chartHeight={desktop ? 220 : 180} formLink={null} cols={2} legendLast />
    )
  const previewSub = t(mobilePreview ? 'templateForm.previewSubGoals' : 'templateForm.previewSub')
  const previewCard = (
    <section className={`${CARD} flex flex-col gap-3 bg-ui-bg p-4`}>
      <div className="flex flex-col gap-px">
        <h2 className="text-[15px] font-extrabold text-ui-ink">{t('chartSettings.preview')}</h2>
        <p className="text-xs text-ui-muted">{previewSub}</p>
      </div>
      {preview}
    </section>
  )

  if (!wide) return (
    <MobileShell tabBar={false}>
      <header className="flex min-h-11 items-center px-2.5 pt-[calc(6px+env(safe-area-inset-top))]">
        <Link to="/settings/charts" className="flex min-h-11 items-center px-2.5 text-[15px] font-bold text-ui-accent">{t('common.cancel')}</Link>
      </header>
      <div className="px-[22px] pt-0.5 pb-4">{heading('text-[28px]')}</div>
      <div className="flex flex-col gap-4 px-4 pb-[180px]">{form}{mobilePreview && practices && previewCard}</div>
      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2 border-t border-ui-control bg-ui-tabbar px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
        {draftProblem(draft) === 'required' && <p className="text-center text-xs leading-snug text-ui-muted">{t(`templateForm.needs${draft.kind}`)}</p>}
        <button type="button" disabled={!ready || create.isPending} onClick={() => create.mutate()}
          className={`${BTN} bg-ui-accent-fill text-ui-ink disabled:opacity-50`}>{createLabel}</button>
      </div>
    </MobileShell>
  )

  const buttons = (
    <div className="flex items-center justify-end gap-2">
      <Link to="/settings/charts" className={`${SMALL_BTN} border border-ui-control bg-ui-surface text-ui-ink`}>{t('common.cancel')}</Link>
      <button type="button" disabled={!ready || create.isPending} onClick={() => create.mutate()}
        className={`${SMALL_BTN} bg-ui-accent-fill text-ui-ink disabled:opacity-50`}>{createLabel}</button>
    </div>
  )
  const page = (
    <div className="flex min-h-dvh">
      <ChartsColumn id="" reports={reportsQ.data ?? []} newOn />
      <main className={`flex min-w-0 flex-col gap-4 px-8 pt-[calc(36px+env(safe-area-inset-top))] pb-10 ${desktop ? 'w-[440px] shrink-0 px-8' : 'flex-1'}`}>
        {heading('text-[28px]')}
        {!desktop && previewCard}
        {form}
        {buttons}
      </main>
      {desktop && (
        <aside aria-label={t('chartSettings.preview')}
          className="sticky top-0 flex h-dvh min-w-[360px] flex-1 flex-col gap-4 overflow-y-auto border-l border-ui-control bg-ui-sheet px-6 pt-[calc(32px+env(safe-area-inset-top))] pb-10">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-[.1em] text-ui-accent">{t('chartSettings.preview')}</span>
            <h2 className="text-xl font-extrabold break-words text-ui-ink">{name.trim() || defaultName}</h2>
            <p className="text-xs text-ui-muted">{previewSub}</p>
          </div>
          {preview}
        </aside>
      )}
    </div>
  )
  return desktop ? <DesktopShell log={false}>{() => page}</DesktopShell> : <TabletShell>{page}</TabletShell>
}
