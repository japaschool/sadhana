import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import type { UserPractice } from '../../../types/api'
import { periodDates, rowName, rowValueText } from './format'
import type { NormalRow, Word } from './usual'

export const OV_CARD = 'flex min-w-0 flex-col gap-2.5 rounded-[20px] border border-ui-hairline bg-ui-surface p-4'
const MONO_SM = 'font-ui-mono text-xs font-medium text-ui-muted'
const ROW_NAME = 'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-[15px] leading-[1.3] font-extrabold text-ui-ink'

/** Teal for above or earlier, orange for below or later, ink for usual. Neither hue means better. */
const dotColour = (w: Word | null) =>
  w === 'above' || w === 'earlier' ? 'var(--ui-chart-5)' : w === 'below' || w === 'later' ? 'var(--ui-chart-6)' : 'var(--ui-ink)'

export function CalculatedTag() {
  const { t } = useTranslation()
  return (
    <span className="rounded-md border border-ui-control px-[5px] py-px font-ui-mono text-[10px] font-semibold tracking-[.04em] whitespace-nowrap text-ui-muted">
      {t('insights.overview.calculated')}
    </span>
  )
}

export function RowLabel({ n, practices }: { n: Pick<NormalRow, 'row'>; practices: UserPractice[] }) {
  const { t } = useTranslation()
  return <span className={ROW_NAME}>{rowName(n.row, practices, t)}{n.row.special !== null && <CalculatedTag />}</span>
}

function WordChip({ word }: { word: Word }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold whitespace-nowrap text-ui-ink2">
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full"
        style={word === 'usual' ? { border: '1.5px solid var(--ui-faint2)' } : { background: dotColour(word) }} />
      {t(`insights.overview.word_${word}`)}
    </span>
  )
}

/** The usual band (P25–P75) with its median, a filled dot for now and a hollow one for the marked period. */
function Strip({ n }: { n: NormalRow }) {
  const u = n.usual!
  const points = [u.p25, u.p75, u.median, ...(n.now !== null ? [n.now] : []), ...(n.hollow ? [n.hollow.value] : [])]
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const pad = Math.max((hi - lo) * 0.2, 1)
  const at = (v: number) => `${((v - lo + pad) / (hi - lo + 2 * pad)) * 100}%`
  const dot = 'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full'
  return (
    <div aria-hidden className="relative h-[22px] w-full">
      <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-ui-control" />
      <span className="absolute top-1 h-3.5 rounded-[7px] bg-[var(--ui-div-0)]" style={{ left: at(u.p25), width: `calc(${at(u.p75)} - ${at(u.p25)})` }} />
      <span className="absolute top-1 h-3.5 w-[1.5px] -translate-x-1/2 bg-ui-faint2" style={{ left: at(u.median) }} />
      {n.hollow && <span data-dot="hollow" className={`${dot} h-2.5 w-2.5 border-[1.8px] border-ui-ink2 bg-ui-surface`} style={{ left: at(n.hollow.value) }} />}
      {n.now !== null && <span data-dot="now" className={`${dot} h-[13px] w-[13px] border-2 border-ui-surface`} style={{ left: at(n.now), background: dotColour(n.word) }} />}
    </div>
  )
}

function useRowText(n: NormalRow) {
  const { t } = useTranslation()
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const fmt = (v: number | null) => rowValueText(n.row.kind, v, units)
  // A week eaten by a left-out period shows the period's own value, with the hollow dot.
  const value = n.now ?? n.hollow?.value ?? null
  const thin = n.usual !== null && value === null
  const note = !n.usual ? t('insights.overview.noRange')
    : thin ? t('insights.overview.notEnough', { n: n.recentDays }) : null
  return { fmt, value, thin, note }
}

function StackedRow({ n, practices }: { n: NormalRow; practices: UserPractice[] }) {
  const { t } = useTranslation()
  const { fmt, value, thin, note } = useRowText(n)
  return (
    <div role="group" aria-label={rowName(n.row, practices, t)} className="flex flex-col gap-1.5 border-t border-ui-chip py-3 first:border-0">
      <div className="flex items-baseline justify-between gap-2.5">
        <RowLabel n={n} practices={practices} />
        <span className={`font-ui-mono text-[17px] font-semibold whitespace-nowrap ${value === null ? 'text-ui-faint2' : 'text-ui-ink'}`}>{fmt(value)}</span>
      </div>
      {n.usual && <Strip n={n} />}
      <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1">
        {note ? <span className="text-[13px] leading-[1.4] font-semibold text-ui-muted">{note}</span>
          : <span className={MONO_SM}>{t('insights.overview.usualLine', { median: fmt(n.usual!.median), p25: fmt(n.usual!.p25), p75: fmt(n.usual!.p75) })}</span>}
        {!thin && n.word && <WordChip word={n.word} />}
      </div>
    </div>
  )
}

const COLS = 'grid grid-cols-[minmax(0,1fr)_64px_104px_minmax(120px,178px)_116px] items-center gap-3'

function ColumnsRow({ n, practices }: { n: NormalRow; practices: UserPractice[] }) {
  const { t } = useTranslation()
  const { fmt, value, note } = useRowText(n)
  return (
    <div role="group" aria-label={rowName(n.row, practices, t)} className={`${COLS} border-t border-ui-chip py-3 first:border-0`}>
      <RowLabel n={n} practices={practices} />
      <span className={`text-right font-ui-mono text-base font-semibold whitespace-nowrap ${value === null ? 'text-ui-faint2' : 'text-ui-ink'}`}>{fmt(value)}</span>
      {n.usual ? (
        <span className="flex flex-col gap-px font-ui-mono">
          <span className="text-[13px] font-medium text-ui-ink2">{fmt(n.usual.median)}</span>
          <span className="text-[11px] text-ui-faint2">{fmt(n.usual.p25)}–{fmt(n.usual.p75)}</span>
        </span>
      ) : <span />}
      {note ? <span className={"col-span-2 text-[13px] leading-[1.4] font-semibold text-ui-muted"}>{note}</span> : (
        <>
          <Strip n={n} />
          {n.word ? <WordChip word={n.word} /> : <span />}
        </>
      )}
    </div>
  )
}

/** The columns need about 680px of card (a name, then ~510px of fixed columns); a small tablet gets the phone's stacked rows. */
function useNarrow(ref: RefObject<HTMLElement | null>) {
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 680))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return narrow
}

/** Each row's last 7 days against its usual range (16m1, 16m3; tablet and desktop: 16t1). */
export function MeVsNormal({ normal, practices, variant }: { normal: NormalRow[]; practices: UserPractice[]; variant: 'stacked' | 'columns' }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const periods = [...new Map(normal.flatMap((n) => (n.hollow ? [[n.hollow.period.id, n.hollow.period] as const] : []))).values()]
  const ref = useRef<HTMLElement>(null)
  const narrow = useNarrow(ref)
  const cols = variant === 'columns' && !narrow
  const Row = cols ? ColumnsRow : StackedRow
  return (
    <section ref={ref} aria-labelledby="me-vs-normal" className={OV_CARD}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="me-vs-normal" className="text-lg font-extrabold tracking-[-0.01em] text-ui-ink">{t('insights.overview.meVsNormal')}</h2>
          <span className={MONO_SM}>{t('insights.overview.last7')}</span>
        </div>
        <p className="text-[13px] leading-[1.45] text-ui-muted">{t('insights.overview.usualExplain')}</p>
      </div>
      <div className="flex flex-col">
        {cols && (
          <div aria-hidden className={`${COLS} pt-1 text-[11px] font-bold tracking-[.08em] text-ui-faint2 uppercase`}>
            <span /><span className="text-right">{t('insights.overview.now')}</span><span>{t('insights.overview.usual')}</span>
          </div>
        )}
        {normal.map((n) => <Row key={n.row.key} n={n} practices={practices} />)}
      </div>
      <Legend periods={periods} locale={locale} />
    </section>
  )
}

function Legend({ periods, locale }: { periods: MarkedPeriod[]; locale: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-ui-chip pt-3 text-xs font-semibold text-ui-muted">
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-[18px] rounded-[5px] bg-[var(--ui-div-0)]" />{t('insights.overview.usualRange')}</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-ui-ink2" />{t('insights.overview.last7')}</span>
      {periods.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border-[1.8px] border-ui-ink2" />{`${p.name}, ${periodDates(p, locale, t)}`}
        </span>
      ))}
    </div>
  )
}
