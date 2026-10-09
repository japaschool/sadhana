import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { UserPractice } from '../../../../types/api'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import { SegmentedControl } from '../../../../ui/primitives/SegmentedControl'
import { Toggle } from '../../../../ui/primitives/Toggle'
import { BTN, HINT } from '../../../yatras/settings/mobile/AdminPage'
import { AutosaveText, ChoiceChips, SheetHeader } from '../../../yatras/settings/mobile/fields'
import { TypeIcon, typeLabelKey } from '../../../yatras/settings/mobile/TypeChip'
import { AXES, axisUse, landing, type AxisSeries } from '../../axes'
import type { useChartEditor } from '../useChartEditor'
import { axisName, kindName, newTrace, onAxis, StyleIcon, styleOf, typeOf, type Style } from './parts'

type Editor = ReturnType<typeof useChartEditor>
const LABEL = 'text-[13px] font-bold text-ui-muted'
const RULE = 'border-t border-ui-hairline pt-4'

/** One series in a sheet (mobile). */
export function SeriesSheet({ ed, index, maxHeight, onChoose, onClose }: {
  ed: Editor; index: number; maxHeight?: string; onChoose: () => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const s = ed.series[index]
  if (!s?.practice || !s.axis) return null
  const name = s.trace.label || s.practice.practice
  return (
    <BottomSheet label={name} onClose={onClose} maxHeight={maxHeight}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{t('chartSettings.seriesN', { n: index + 1 })}</span>
          <h2 className="text-xl font-extrabold break-words text-ui-ink">{name}</h2>
        </div>
        <button type="button" aria-label={t('yatraSettings.close')} onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-chip text-lg text-ui-muted">×</button>
      </div>
      <SeriesFields ed={ed} index={index} onChoose={onChoose} onClose={onClose} />
    </BottomSheet>
  )
}

/** One series: practice, style, average, axis and label; Remove takes it out (with Undo). In a sheet or inline. */
export function SeriesFields({ ed, index, onChoose, onClose }: { ed: Editor; index: number; onChoose: () => void; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'en'
  const s = ed.series[index]
  if (!s?.practice || !s.axis) return null
  const { trace, practice } = s
  const axis = s.axis
  const set = (change: Partial<typeof trace>) => ed.setTraces((ts) => ts.map((x, i) => (i === index ? { ...x, ...change } : x)))
  const drawn = ed.series.filter((x) => x.axis)
  const use = axisUse(drawn.map((x): AxisSeries => ({ dataType: x.practice!.data_type, yAxis: x.trace.y_axis })), drawn.indexOf(s))
  const namesOn = (a: string) => drawn.filter((x) => x !== s && x.axis === a).map((x) => x.trace.label || x.practice!.practice).join(', ')
  const manual = trace.y_axis !== null
  const styles: Style[] = ['Bar', 'Line', 'Dot']
  const styleKey = { Bar: 'bar', Line: 'line', Dot: 'dots' } as const

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>{t('chartSettings.practice')}</span>
        <button type="button" onClick={onChoose} aria-label={`${t('chartSettings.practice')}: ${practice.practice}`}
          className="flex min-h-12 items-center gap-2.5 rounded-xl border border-ui-control bg-ui-surface px-3.5 text-left">
          <span className="text-ui-ink2"><TypeIcon type={practice.data_type} /></span>
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-ui-ink">{practice.practice}</span>
          <span className="shrink-0 text-[13px] text-ui-muted">{t(typeLabelKey(practice.data_type))}</span>
          <span aria-hidden className="text-ui-muted">⌄</span>
        </button>
      </div>

      <ChoiceChips label={t('chartSettings.style')} value={styleOf(trace.type_)} onChange={(v) => set({ type_: typeOf(v, trace.type_) })}
        options={styles.map((v) => ({ value: v, label: <span className="flex items-center gap-1.5"><StyleIcon style={v} />{t(`chartSettings.${styleKey[v]}`)}</span> }))} />

      <div className={`${RULE} flex items-start gap-3`}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id="avg-label" className="text-[15px] font-bold text-ui-ink">{t('chartSettings.showAverage')}</span>
          <span id="avg-hint" className={HINT}>{t('chartSettings.showAverageHint')}</span>
        </div>
        <Toggle checked={trace.show_average} onChange={(v) => set({ show_average: v })} label={t('chartSettings.showAverage')} describedBy="avg-hint" />
      </div>

      <div className={`${RULE} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-bold text-ui-ink">{t('chartSettings.axis')}</span>
            <span className={HINT}>{manual ? t('chartSettings.axisPick') : t('chartSettings.axisAuto', { axis: axisName(t, axis), lower: axisName(t, axis).toLocaleLowerCase(lang) })}</span>
          </div>
          {/* Manual starts on the axis it's on now, so nothing moves until another one is picked. */}
          <SegmentedControl label={t('chartSettings.axis')} value={manual ? 'manual' : 'auto'} onChange={(v) => set({ y_axis: v === 'manual' ? axis : null })}
            options={[{ value: 'auto', label: t('chartSettings.automatic') }, { value: 'manual', label: t('chartSettings.manual') }]} />
        </div>
        {manual && (
          <>
            <div role="radiogroup" aria-label={t('chartSettings.axis')} className="grid grid-cols-2 gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{t('chartSettings.leftSide')}</span>
              <span className="text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{t('chartSettings.rightSide')}</span>
              {AXES.map((a) => {
                const held = use.get(a)
                const blocked = !!held && held !== practice.data_type
                const on = a === axis
                const note = on ? t('chartSettings.thisSeries')
                  : blocked ? t('chartSettings.shows', { kind: kindName(t, held).toLocaleLowerCase(lang) })
                  : held ? t('chartSettings.with', { names: namesOn(a) }) : t('chartSettings.free')
                return (
                  <button key={a} type="button" role="radio" aria-checked={on} disabled={blocked} onClick={() => set({ y_axis: a })}
                    className={`flex min-h-14 items-center gap-2.5 rounded-xl border px-3 text-left ${on ? 'border-ui-accent-fill bg-ui-accent-soft' : blocked ? 'border-dashed border-ui-control bg-ui-chip' : 'border-ui-control bg-ui-surface'}`}>
                    <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-ui-accent-fill' : blocked ? 'border-dashed border-ui-faint' : 'border-ui-faint2'}`}>
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-ui-accent-fill" />}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className={`text-[15px] font-bold ${blocked ? 'text-ui-faint2' : 'text-ui-ink'}`}>{axisName(t, a)}</span>
                      <span className={`truncate text-xs ${on ? 'font-semibold text-ui-accent' : 'text-ui-muted'}`}>{note}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className={`${HINT} rounded-xl bg-ui-chip px-3 py-2.5`}>{t('chartSettings.sameTypeNote')}</p>
          </>
        )}
      </div>

      <div className={RULE}>
        <AutosaveText id="series-label" label={t('chartSettings.label')} hint={t('chartSettings.labelHint')} value={trace.label ?? ''}
          placeholder={practice.practice} onCommit={(v) => set({ label: v.trim() || null })} />
      </div>

      <button type="button" onClick={() => { onClose(); ed.removeSeries(index) }}
        className={`${BTN} min-h-10 self-start border border-ui-danger/40 px-4 text-sm text-ui-danger`}>{t('chartSettings.removeSeries')}</button>
    </>
  )
}

/** Picks a practice to add as a series, or (`replace`) for a series to plot instead. Says where each would land. */
export function PracticePickerSheet({ ed, replace, maxHeight, onClose }: {
  ed: Editor; replace?: number; maxHeight?: string; onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const lang = i18n.language || 'en'
  const active = ed.practices.filter((p) => p.is_active)
  const base = ed.series.filter((s) => s.axis && s.index !== replace)
  const baseAxes = base.map((s): AxisSeries => ({ dataType: s.practice!.data_type, yAxis: s.trace.y_axis }))
  const inChart = new Set(ed.series.filter((s) => s.state === 'ok').map((s) => s.trace.practice))
  const first = !base.length && replace === undefined
  const title = replace !== undefined ? t('chartSettings.choose') : first ? t('chartSettings.addFirst') : t('chartSettings.addOne')
  const subtitle = replace !== undefined ? t('chartSettings.seriesN', { n: replace + 1 })
    : first ? `${ed.report?.name} · ${t('chartSettings.graph')}` : t('chartSettings.addOneHint')

  function pick(p: UserPractice) {
    if (replace === undefined) ed.setTraces((ts) => [...ts, newTrace(p)])
    else ed.setTraces((ts) => ts.map((x, i) => (i !== replace ? x : {
      ...x, practice: p.id,
      // A manual axis may now hold another type; let it find one again.
      y_axis: ed.series[replace].practice?.data_type === p.data_type ? x.y_axis : null,
    })))
    onClose()
  }

  const rows = active.map((p) => {
    const l = landing(baseAxes, p.data_type)
    const names = base.filter((s) => s.axis === l.axis).map((s) => s.trace.label || s.practice!.practice).join(', ')
    const where = l.shared || first ? onAxis(t, l.axis, lang) : t('chartSettings.newAxis', { axis: axisName(t, l.axis) })
    const unit = p.data_type === 'Bool' || p.data_type === 'Text'
    const detail = [t(typeLabelKey(p.data_type)), where, l.shared && t('chartSettings.withNames', { names }), unit && t('chartSettings.plottedAsOne')].filter(Boolean).join(' · ')
    return { p, shared: l.shared, detail }
  })
  const list = (items: typeof rows) => (
    <ul className="flex flex-col">
      {items.map(({ p, detail }) => (
        <li key={p.id} className="flex min-h-16 items-center gap-3 py-2">
          <span className="w-5 text-ui-ink2"><TypeIcon type={p.data_type} /></span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-bold text-ui-ink">{p.practice}</span>
            <span className="text-xs leading-snug text-ui-muted">{detail}</span>
          </span>
          {inChart.has(p.id)
            ? <span className="shrink-0 text-xs font-semibold text-ui-muted">{t('chartSettings.inChart')}</span>
            : (
              <button type="button" aria-label={t('chartSettings.add', { name: p.practice })} onClick={() => pick(p)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ui-accent-soft text-lg font-bold text-ui-accent">+</button>
            )}
        </li>
      ))}
    </ul>
  )
  const GROUP = 'text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted'

  return (
    <BottomSheet label={title} onClose={onClose} maxHeight={maxHeight}>
      <SheetHeader title={title} onClose={onClose} />
      <p className="-mt-4 text-[13px] text-ui-muted">{subtitle}</p>
      {!active.length ? (
        <div className="flex flex-col gap-3 text-center">
          <h3 className="pt-2 text-lg font-extrabold text-ui-ink">{t('chartSettings.noPracticesTitle')}</h3>
          <p className="text-sm leading-normal text-ui-ink2">{t('chartSettings.noPracticesText')}</p>
          <button type="button" onClick={() => navigate('/user/practices')} className={`${BTN} bg-ui-accent-fill text-ui-ink`}>{t('chartSettings.addPractice')}</button>
          <button type="button" onClick={onClose} className={`${BTN} border border-ui-control bg-ui-surface text-ui-ink`}>{t('chartSettings.notNow')}</button>
          <p className={`${HINT} rounded-xl bg-ui-chip px-3 py-2.5 text-left`}>{t('chartSettings.archivedCantPlot')}</p>
        </div>
      ) : first ? (
        <section className="flex flex-col gap-1">
          <h3 className={GROUP}>{t('chartSettings.yourPractices', { count: active.length })}</h3>
          {list(rows)}
        </section>
      ) : (
        <>
          {[true, false].map((shared) => {
            const items = rows.filter((r) => r.shared === shared)
            return items.length > 0 && (
              <section key={String(shared)} className="flex flex-col gap-1">
                <h3 className={GROUP}>{t(shared ? 'chartSettings.sharesAxis' : 'chartSettings.ownAxis')}</h3>
                {list(items)}
              </section>
            )
          })}
        </>
      )}
      {active.length > 0 && <p className={HINT}>{t('chartSettings.archivedNotListed')}</p>}
    </BottomSheet>
  )
}
