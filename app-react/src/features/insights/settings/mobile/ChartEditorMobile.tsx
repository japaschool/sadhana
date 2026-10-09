import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BarLayout } from '../../../../api/charts'
import { MobileShell } from '../../../../layouts/mobile/MobileShell'
import { UiPortal } from '../../../../ui/primitives/UiPortal'
import { BTN, CARD, HINT, LIST, SECTION_TITLE } from '../../../yatras/settings/mobile/AdminPage'
import { AutosaveText, ChoiceChips, ConfirmSheet } from '../../../yatras/settings/mobile/fields'
import { TypeChip, TypeIcon } from '../../../yatras/settings/mobile/TypeChip'
import { AXES } from '../../axes'
import { cellText, formatDay } from '../../insightsLogic'
import { InsightsChart } from '../../mobile/InsightsChart'
import { useChartEditor, type Series } from '../useChartEditor'
import { axisName, kindName, LegendMark, onAxis, SaveDot, SeriesTile, StyleIcon, styleOf } from './parts'
import { PracticePickerSheet, SeriesFields, SeriesSheet } from './SeriesSheets'

type Editor = ReturnType<typeof useChartEditor>
export type Sheet = { kind: 'add' } | { kind: 'edit' | 'choose'; index: number } | { kind: 'delete' } | null

export const GROUP = 'text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted'
export const SPINNER = 'h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent'

export function ChartEditorMobileScreen() {
  return (
    <MobileShell>
      <ChartEditorMobile />
    </MobileShell>
  )
}

/** A chart's settings, saved as you edit, with a preview that stays in view while you scroll or edit a series. */
export function ChartEditorMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const ed = useChartEditor(id)
  // A graph that was just created opens with its practice picker up.
  const [sheet, setSheet] = useState<Sheet>(() => ((location.state as { pick?: boolean } | null)?.pick ? { kind: 'add' } : null))
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  const preview = useRef<HTMLElement>(null)
  const [scrolledPast, setScrolledPast] = useState(false)
  const ready = !ed.isLoading && !!ed.report
  useEffect(() => {
    const el = preview.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setScrolledPast(!e.isIntersecting && e.boundingClientRect.top < 100), { rootMargin: '-44px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [ready])

  const graph = ed.graph
  const overSheet = !!sheet && sheet.kind !== 'delete' && ed.traces.length > 0
  const pinned = !!graph && ed.traces.length > 0 && (scrolledPast || overSheet)
  const pin = useRef<HTMLDivElement>(null)
  const [pinBottom, setPinBottom] = useState(0)
  useLayoutEffect(() => setPinBottom(pin.current?.getBoundingClientRect().bottom ?? 0), [pinned, sheet, ed.series.length])
  // On mobile the series sheets stop under the pinned preview, so each change shows as it lands.
  const sheetMax = overSheet && pinBottom ? `calc(100dvh - ${Math.round(pinBottom) + 8}px)` : undefined

  const header = (
    <header className="sticky top-0 z-30 bg-ui-bg pt-[env(safe-area-inset-top)]">
      <div className="grid min-h-11 grid-cols-[1fr_auto_1fr] items-center px-2">
        <Link to="/charts" className="flex min-h-11 items-center gap-1 justify-self-start px-2 text-[17px] font-semibold text-ui-accent">
          <span aria-hidden>‹</span>{t('insights.title')}
        </Link>
        <span className="max-w-[44vw] truncate text-[15px] font-extrabold text-ui-ink">{pinned ? ed.report?.name : ''}</span>
        <span />
      </div>
    </header>
  )

  if (ed.isLoading) return <>{header}<div className="flex h-40 items-center justify-center"><span role="status" aria-label={t('common.loading')} className={SPINNER} /></div></>
  if (ed.isError) return <>{header}<p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('common.error')}</p></>
  if (!ed.report) return <Navigate to="/charts" replace />
  const close = () => setSheet(null)

  return (
    <>
      {header}
      <div className="flex flex-col gap-0.5 px-5 pb-4">
        <h1 className="text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] break-words text-ui-ink">{ed.report.name}</h1>
        <p className="text-sm text-ui-muted">{subtitle(ed, t)}</p>
      </div>
      <div className="flex flex-col gap-4 px-4 pb-8">
        <FailedBanner ed={ed} />

        <section ref={preview} className={`${CARD} flex flex-col gap-3 p-4`}>
          <Preview ed={ed} picking={sheet?.kind === 'add'} />
        </section>

        <NameCard ed={ed} />

        {graph ? <><GraphSections ed={ed} setSheet={setSheet} /><AxesCard ed={ed} /></> : <TableColumns ed={ed} />}

        <Footer ed={ed} onDelete={() => setSheet({ kind: 'delete' })} />
      </div>

      {pinned && (
        <UiPortal>
          <div className={`fixed inset-x-0 top-[calc(44px+env(safe-area-inset-top))] px-4 pt-1 ${overSheet ? 'z-[51]' : 'z-[29] bg-ui-bg pb-2'}`}>
            <div ref={pin} className={`${CARD} p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,.25)]`}>
              <Preview ed={ed} header={false} height={100} focus={sheet?.kind === 'edit' ? sheet.index : undefined} />
            </div>
          </div>
        </UiPortal>
      )}
      {sheet?.kind === 'add' && <PracticePickerSheet ed={ed} maxHeight={sheetMax} onClose={close} />}
      {sheet?.kind === 'choose' && <PracticePickerSheet ed={ed} replace={sheet.index} maxHeight={sheetMax} onClose={close} />}
      {sheet?.kind === 'edit' && (
        <SeriesSheet key={sheet.index} ed={ed} index={sheet.index} maxHeight={sheetMax} onClose={close}
          onChoose={() => setSheet({ kind: 'choose', index: sheet.index })} />
      )}
      {sheet?.kind === 'delete' && <DeleteChartSheet ed={ed} onClose={close} />}
    </>
  )
}

export function FailedBanner({ ed }: { ed: Editor }) {
  const { t } = useTranslation()
  return ed.failed && (
    <section role="alert" className="flex flex-col gap-2 rounded-[18px] border border-ui-danger/30 bg-ui-danger/10 p-4">
      <p className="flex items-center gap-2 text-[15px] font-extrabold text-ui-ink">
        <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full bg-ui-danger" />{t('chartSettings.saveFailedTitle')}
      </p>
      <p className="text-sm leading-normal text-ui-ink2">{t(navigator.onLine ? 'chartSettings.saveFailedText' : 'chartSettings.saveFailedOffline')}</p>
      <button type="button" onClick={ed.retry} className="min-h-10 self-start rounded-xl border border-ui-control bg-ui-surface px-4 text-sm font-bold text-ui-ink">
        {t('chartSettings.retryNow')}
      </button>
    </section>
  )
}

export function NameCard({ ed }: { ed: Editor }) {
  const { t } = useTranslation()
  const report = ed.report!
  return (
    <section className={`${CARD} flex flex-col gap-3 p-4`}>
      <AutosaveText id="chart-name" label={t('chartSettings.name')} value={report.name}
        validate={(v) => (v.trim() ? null : t('chartSettings.nameRequired'))}
        onCommit={(v) => ed.update((r) => ({ ...r, name: v.trim() }))} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold text-ui-muted">{t('chartSettings.type')}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ui-chip py-1 pr-2.5 pl-2 text-xs font-bold text-ui-ink2">
          {ed.graph ? <StyleIcon style="Bar" className="h-3.5 w-3.5" /> : <span aria-hidden className="text-[13px] leading-none">▦</span>}
          {t(ed.graph ? 'chartSettings.graph' : 'chartSettings.table')}
        </span>
        <span className={HINT}>{t('chartSettings.typeSet')}</span>
      </div>
    </section>
  )
}

export function Footer({ ed, onDelete }: { ed: Editor; onDelete: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-3 pl-1.5">
      <SaveDot failed={ed.failed} t={t} text={t('chartSettings.savedAsYouEdit')} />
      <button type="button" onClick={onDelete}
        className="min-h-10 rounded-xl border border-ui-danger/40 bg-ui-surface px-4 text-sm font-bold text-ui-danger">{t('chartSettings.deleteChart')}</button>
    </div>
  )
}

export function DeleteChartSheet({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const report = ed.report!
  return (
    <ConfirmSheet title={t('chartSettings.deleteTitle', { name: report.name })} confirm={t('chartSettings.deleteChart')}
      text={ed.graph ? t('chartSettings.deleteGraph', { count: ed.graph.traces.length }) : t('chartSettings.deleteTable')}
      busy={ed.remove.isPending} onClose={onClose}
      onConfirm={() => ed.remove.mutate(undefined, { onSuccess: () => navigate('/charts', { replace: true }) })} />
  )
}

export const subtitle = (ed: Editor, t: TFunction) => ed.graph
  ? ed.graph.traces.length ? t('chartSettings.graphSeries', { count: ed.graph.traces.length }) : t('chartSettings.graphEmpty')
  : t('chartSettings.tableColumns', { count: ed.traces.length })

function Placeholder({ text, sub, busy }: { text: string; sub?: string; busy?: boolean }) {
  return (
    <div role={busy ? 'status' : undefined} className="flex h-[150px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ui-control px-4 text-center">
      <p className={`text-[15px] font-bold ${busy ? 'text-ui-muted' : 'text-ui-ink'}`}>{text}</p>
      {sub && <p className={HINT}>{sub}</p>}
    </div>
  )
}

/** The chart (or table) as it is now. `focus` brings one series forward in the legend. */
export function Preview({ ed, header = true, height = 170, picking, focus }: { ed: Editor; header?: boolean; height?: number; picking?: boolean; focus?: number }) {
  const { t } = useTranslation()
  const graph = ed.graph
  const hidden = ed.series.filter((s) => s.state !== 'ok').length
  return (
    <>
      {header && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[17px] font-extrabold text-ui-ink">{t('chartSettings.preview')}</h2>
            <p className="text-xs text-ui-muted">{t(graph ? 'chartSettings.last30' : 'chartSettings.last30Table')}</p>
          </div>
          {hidden > 0 && <span className="text-xs font-bold text-ui-danger">{t('chartSettings.hidden', { count: hidden })}</span>}
        </div>
      )}
      {!graph ? <TablePreview ed={ed} />
        : ed.dataLoading ? <Placeholder busy text={t('chartSettings.loadingEntries')} />
        : !ed.traces.length ? <Placeholder text={t('chartSettings.nothingToPlot')} sub={picking ? undefined : t('chartSettings.addToSee')} />
        : !ed.rows.length ? <Placeholder text={t('chartSettings.noEntries')} />
        : (
          // Remount per change: Recharts hangs updating in place when the series layout changes.
          <InsightsChart key={JSON.stringify(graph)} rows={ed.rows} traces={ed.traces} barLayout={graph.bar_layout} averages={ed.averages}
            height={height} />
        )}
      {graph && ed.series.length > 0 && (
        <ul aria-label={t('insights.legend')} className="flex flex-wrap gap-x-4 gap-y-1.5">
          {ed.series.map((s) => (
            <li key={s.index} className={`flex items-center gap-1.5 text-[13px] font-semibold ${s.state !== 'ok' ? 'text-ui-faint2 line-through' : 'text-ui-ink2'} ${focus !== undefined && focus !== s.index ? 'opacity-40' : ''}`}>
              <LegendMark style={styleOf(s.trace.type_)} color={s.state === 'ok' ? s.color : 'var(--ui-faint)'} />
              {seriesName(s, t)}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

const seriesName = (s: Series, t: (k: string) => string) => s.trace.label || s.practice?.practice || t('chartSettings.deletedPractice')

/** The latest five days, newest first. */
function TablePreview({ ed }: { ed: Editor }) {
  const { t, i18n } = useTranslation()
  if (ed.dataLoading) return <Placeholder busy text={t('chartSettings.loadingEntries')} />
  if (!ed.traces.length) return <Placeholder text={t('chartSettings.nothingToPlot')} sub={t('chartSettings.tickToSee')} />
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const values = new Map(ed.entries.map((e) => [`${e.cob_date}|${e.practice}`, e.value]))
  const days = [...new Set(ed.entries.map((e) => e.cob_date))].sort().reverse().slice(0, 5)
  if (!days.length) return <Placeholder text={t('chartSettings.noEntries')} />
  return (
    <div className="overflow-x-auto rounded-xl border border-ui-hairline">
      <table className="min-w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="border-b border-ui-hairline px-2.5 py-2 text-left align-bottom font-ui-mono text-[10px] font-semibold tracking-[.08em] text-ui-faint uppercase">{t('insights.date')}</th>
            {ed.traces.map((tr, i) => (
              <th key={i} className="max-w-[72px] min-w-[52px] border-b border-l border-ui-hairline px-1.5 py-2 text-left align-bottom text-[11px] leading-tight font-semibold break-words text-ui-ink2">{tr.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d}>
              <td className="border-b border-ui-hairline px-2.5 py-2 font-bold whitespace-nowrap text-ui-ink">{formatDay(d, i18n.language || 'en')}</td>
              {ed.traces.map((tr, i) => (
                <td key={i} className="max-w-[72px] truncate border-b border-l border-ui-hairline px-1.5 py-2 text-center font-ui-mono text-ui-ink">
                  {cellText(values.get(`${d}|${tr.name}`), tr.dataType, units)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The series list, Add series and bar layout. With `inline` (tablet, desktop) an edited series opens under its row, not in a sheet. */
export function GraphSections({ ed, setSheet, inline }: { ed: Editor; setSheet: (s: Sheet) => void; inline?: Sheet }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'en'
  const graph = ed.graph!
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    ed.setTraces((ts) => arrayMove(ts, Number(active.id), Number(over.id)))
  }
  const drawn = ed.series.filter((s) => s.axis)
  const bars = drawn.filter((s) => styleOf(s.trace.type_) === 'Bar').length
  const noBarLayout = ed.series.length > 0 && bars < 2
  const layouts: BarLayout[] = ['Grouped', 'Stacked', 'Overlaid']

  return (
    <>
      <section aria-label={t('chartSettings.series')} className="flex flex-col gap-2">
        <h2 className={`${GROUP} px-1.5`}>{ed.series.length ? t('chartSettings.seriesCount', { count: ed.series.length }) : t('chartSettings.series')}</h2>
        {ed.series.length ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ed.series.map((s) => String(s.index))} strategy={verticalListSortingStrategy}>
              <ul className={LIST}>
                {ed.series.map((s) => (
                  <SeriesRow key={s.index} s={s} lang={lang} onOpen={() => setSheet({ kind: 'edit', index: s.index })}
                    editor={inline?.kind === 'edit' && inline.index === s.index
                      ? { onDone: () => setSheet(null), fields: <SeriesFields ed={ed} index={s.index} onChoose={() => setSheet({ kind: 'choose', index: s.index })} onClose={() => setSheet(null)} /> }
                      : undefined}
                    onChoose={() => setSheet({ kind: 'choose', index: s.index })}
                    onTurnOn={() => s.practice && ed.turnBackOn.mutate(s.practice)}
                    onRemove={() => ed.removeSeries(s.index)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <div className={`${CARD} flex flex-col gap-1 p-4`}>
            <p className="text-[15px] font-bold text-ui-ink">{t('chartSettings.noSeries')}</p>
            <p className={HINT}>{t('chartSettings.noSeriesHint')}</p>
          </div>
        )}
        <button type="button" onClick={() => setSheet({ kind: 'add' })} className={`${BTN} border border-ui-control bg-ui-surface text-ui-ink`}>
          {t('chartSettings.addSeries')}
        </button>
        {ed.series.length > 1 && <p className={`${HINT} px-1.5`}>{t('chartSettings.dragHint')}</p>}
      </section>

      <section className={`${CARD} flex flex-col gap-3 p-4`}>
        <div className="flex flex-col gap-0.5">
          <h2 className={SECTION_TITLE}>{t('chartSettings.barLayout')}</h2>
          <p className={HINT}>{noBarLayout ? t('chartSettings.barLayoutNeeds', { count: bars }) : t('chartSettings.barLayoutHint')}</p>
        </div>
        <fieldset disabled={noBarLayout} className="disabled:opacity-50">
          <ChoiceChips label={t('chartSettings.barLayout')} hideLabel value={graph.bar_layout}
            onChange={(v) => ed.update((r) => ({ ...r, definition: { Graph: { ...graph, bar_layout: v } } }))}
            options={layouts.map((v) => ({ value: v, label: t(`chartSettings.${v.toLowerCase()}`) }))} />
        </fieldset>
      </section>
    </>
  )
}

/** What is on which axis. */
export function AxesCard({ ed }: { ed: Editor }) {
  const { t } = useTranslation()
  const drawn = ed.series.filter((s) => s.axis)
  const used = AXES.filter((a) => drawn.some((s) => s.axis === a))
  return used.length > 0 && (
    <section className={`${CARD} flex flex-col gap-3 p-4`}>
      <div className="flex flex-col gap-0.5">
        <h2 className={SECTION_TITLE}>{t('chartSettings.axes')}</h2>
        <p className={HINT}>{t('chartSettings.axesHint')}</p>
      </div>
      {used.map((a) => {
        const on = drawn.filter((s) => s.axis === a)
        const dt = on[0].practice!.data_type
        return (
          <div key={a} className="flex items-center gap-3 rounded-xl border border-ui-hairline bg-ui-field px-3.5 py-3">
            <span className="w-16 shrink-0 text-[15px] font-bold text-ui-ink">{axisName(t, a)}</span>
            <span className="text-ui-ink2"><TypeIcon type={dt} /></span>
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-ui-ink2">
              {kindName(t, dt)} · {on.map((s) => seriesName(s, t)).join(', ')}
            </span>
            <span className="flex shrink-0 items-center gap-1">{on.map((s) => <LegendMark key={s.index} style={styleOf(s.trace.type_)} color={s.color} />)}</span>
          </div>
        )
      })}
    </section>
  )
}

function SeriesRow({ s, lang, editor, onOpen, onChoose, onTurnOn, onRemove }: {
  s: Series; lang: string; editor?: { onDone: () => void; fields: ReactNode }
  onOpen: () => void; onChoose: () => void; onTurnOn: () => void; onRemove: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(s.index) })
  const name = seriesName(s, t)
  const style = styleOf(s.trace.type_)
  const SMALL = 'flex min-h-10 items-center rounded-xl border px-3.5 text-sm font-bold'
  const summary = s.practice && s.axis && (
    <>
      <SeriesTile style={style} color={s.color} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-bold text-ui-ink">{name}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TypeChip type={s.practice.data_type} />
          <span className="font-ui-mono text-xs text-ui-muted">
            {onAxis(t, s.axis, lang)}{s.trace.show_average && ` · ${t('chartSettings.avg')}`}
          </span>
        </span>
      </span>
    </>
  )
  const handle = (
    <button type="button" {...attributes} {...listeners} aria-label={t('chartSettings.dragHandle', { name })}
      className="flex h-[68px] w-9 shrink-0 cursor-grab touch-none items-center justify-center text-ui-faint2">
      <span aria-hidden className="text-lg leading-none">⋮⋮</span>
    </button>
  )
  if (editor) return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} aria-label={name}
      className={`flex flex-col bg-ui-surface ${isDragging ? 'relative z-10 shadow-lg' : ''}`}>
      <div className="flex items-center gap-1 bg-ui-accent-soft pr-3">
        {handle}
        <span className="flex min-h-[68px] min-w-0 flex-1 items-center gap-3 py-2.5">{summary}</span>
        <button type="button" onClick={editor.onDone} className="min-h-9 shrink-0 rounded-full bg-ui-selected px-4 text-sm font-bold text-ui-on-selected">
          {t('yatraSettings.done')}
        </button>
      </div>
      <div className="flex flex-col gap-[18px] p-4">{editor.fields}</div>
    </li>
  )
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-1 bg-ui-surface pr-1 select-none [-webkit-touch-callout:none] ${isDragging ? 'relative z-10 shadow-lg' : ''}`}>
      {handle}
      {summary ? (
        <button type="button" onClick={onOpen} aria-label={t('chartSettings.editSeries', { name })} className="flex min-h-[68px] min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
          {summary}
          <span aria-hidden className="px-2 text-lg text-ui-faint2">›</span>
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 py-3 pr-3">
          <div className="flex items-center gap-3">
            <SeriesTile style={style} color={s.color} gone />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] font-semibold text-ui-ink2">{name}</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ui-danger">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ui-danger" />{t(s.state === 'archived' ? 'chartSettings.archived' : 'chartSettings.deleted')}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-12">
            <button type="button" onClick={onChoose} className={`${SMALL} border-ui-control text-ui-ink`}>{t('chartSettings.choose')}</button>
            {s.state === 'archived' && <button type="button" onClick={onTurnOn} className="min-h-10 px-2 text-sm font-bold text-ui-accent">{t('chartSettings.turnBackOn')}</button>}
            <button type="button" onClick={onRemove} className={`${SMALL} border-ui-danger/40 text-ui-danger`}>{t('chartSettings.remove')}</button>
          </div>
        </div>
      )}
    </li>
  )
}

/** A table's columns: your active practices, ticked or not. They keep My practices' order. */
export function TableColumns({ ed }: { ed: Editor }) {
  const { t } = useTranslation()
  const report = ed.report!
  const checked = new Set('Grid' in report.definition ? report.definition.Grid.practices : [])
  const active = ed.practices.filter((p) => p.is_active)
  const save = (ids: Set<string>) => ed.update((r) => ({ ...r, definition: { Grid: { practices: ed.practices.filter((p) => ids.has(p.id)).map((p) => p.id) } } }))
  const toggle = (id: string) => {
    const next = new Set(checked)
    if (!next.delete(id)) next.add(id)
    save(next)
  }
  const TEXT_BTN = 'min-h-9 px-1.5 text-[13px] font-bold text-ui-accent'
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-3 px-1.5">
        <h2 className={`${GROUP} flex-1`}>{t('chartSettings.columns', { n: active.filter((p) => checked.has(p.id)).length, total: active.length })}</h2>
        <button type="button" className={TEXT_BTN} onClick={() => save(new Set([...checked, ...active.map((p) => p.id)]))}>{t('chartSettings.selectAll')}</button>
        <button type="button" className={TEXT_BTN} onClick={() => save(new Set([...checked].filter((id) => !active.some((p) => p.id === id))))}>{t('chartSettings.none')}</button>
      </div>
      <ul className={LIST}>
        {active.map((p) => (
          <li key={p.id}>
            <label className="flex min-h-[60px] items-center gap-3 bg-ui-surface px-4">
              <input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} className="h-5 w-5 shrink-0 accent-[var(--ui-accent-fill)]" />
              <span className="text-ui-ink2"><TypeIcon type={p.data_type} /></span>
              <span className={`min-w-0 flex-1 truncate text-[15px] font-bold ${checked.has(p.id) ? 'text-ui-ink' : 'text-ui-muted'}`}>{p.practice}</span>
              <TypeChip type={p.data_type} />
            </label>
          </li>
        ))}
      </ul>
      <p className={`${HINT} px-1.5`}>{t('chartSettings.columnsHint')}</p>
    </section>
  )
}
