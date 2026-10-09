import { useEffect, useRef, useState } from 'react'
import type { ReactNode, TouchEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useShellBackground } from '../../layouts/useShellBackground'
import { AnchoredMenu, MenuItem } from '../../ui/primitives/AnchoredMenu'
import { SegmentedControl } from '../../ui/primitives/SegmentedControl'
import { UiToastContainer } from '../../ui/primitives/Toast'
import { EndDateControl } from '../insights/mobile/EndDateControl'
import { InsightsChart } from '../insights/mobile/InsightsChart'
import type { Range } from '../insights/useInsights'
import {
  CARD, DayCalendar, DayTable, DeltaText, EmptyState, Eyebrow, HeatKey, Headline, Legend, Mark, PracticeHeatmap, ReportList,
  SHARED_RANGES, SignUpLink, Spinner, useCsv, useKind, useShared, type Shared,
} from './parts'

/** /shared/:userId — Insights, read-only (Turn 13). The only action is Download CSV. */

function Root({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useShellBackground(ref)
  return (
    <div ref={ref} className={`ui-root min-h-dvh bg-ui-bg text-ui-ink ${className}`}>
      {children}
      <UiToastContainer />
    </div>
  )
}

function RangeControl({ s, size }: { s: Shared; size: 'sm' | 'md' | 'lg' }) {
  const { t } = useTranslation()
  const pad = { sm: '[&_button]:px-2.5 [&_button]:text-xs', md: '[&_button]:px-[11px] [&_button]:text-[13px]', lg: '[&_button]:px-3.5 [&_button]:text-[13px]' }[size]
  return (
    <div className={`font-ui-mono ${pad}`}>
      <SegmentedControl<Range> label={t('insights.range')} value={s.range} onChange={s.setRange}
        options={SHARED_RANGES.map((r) => ({ value: r, label: t(`insights.range${r}`) }))} />
    </div>
  )
}

function CsvButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-10 shrink-0 items-center rounded-xl border border-ui-control bg-ui-surface px-3.5 text-[13px] font-bold whitespace-nowrap text-ui-ink">
      {t('shared.downloadCsv')}
    </button>
  )
}

/** The chart, or why there isn't one. */
function ChartBody({ s, height, children }: { s: Shared; height: number; children: ReactNode }) {
  const { t } = useTranslation()
  if (s.isLoading) return <div className="flex items-center justify-center" style={{ height }}><Spinner /></div>
  if (s.isError) return <p role="alert" className="py-10 text-center text-sm text-ui-danger-text">{t('insights.loadFailed')}</p>
  if (s.grid ? !s.entries.length : !s.hasData) return <p className="py-10 text-center text-sm text-ui-muted">{t('insights.noData')}</p>
  return <>{children}</>
}

function Name({ s, size }: { s: Shared; size: 28 | 34 }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-0.5">
      <Eyebrow>{t('shared.eyebrow')}</Eyebrow>
      <h1 className={`${size === 28 ? 'text-[28px]' : 'text-[34px]'} leading-tight font-extrabold tracking-[-0.02em] break-words`}>{s.name}</h1>
    </div>
  )
}

function Skeleton() {
  const bar = 'block rounded-lg bg-ui-hairline'
  return (
    <div aria-hidden className="flex animate-pulse flex-col gap-4 px-4 pt-[18px]">
      <div className="flex flex-col gap-2 px-1.5"><span className={`${bar} h-2.5 w-[110px]`} /><span className={`${bar} h-[26px] w-[170px]`} /></div>
      <div className="flex gap-2">{[130, 110, 100].map((w) => <span key={w} className={`${bar} h-11 rounded-full`} style={{ width: w }} />)}</div>
      <span className={`${bar} h-10 w-[210px] rounded-xl`} />
      <div className={`${CARD} flex flex-col gap-3.5 p-4`}>
        <span className={`${bar} h-2.5 w-40`} /><span className={`${bar} h-[26px] w-[110px]`} />
        <span className={`${bar} h-[170px] w-full`} />
      </div>
    </div>
  )
}

export function SharedMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const s = useShared(id)
  const csv = useCsv(id, s)
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const chips = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const index = s.reports.findIndex((r) => r.id === s.report?.id)

  // Chips scroll with the swipe, so the selected one stays in view.
  useEffect(() => {
    chips.current?.querySelector('[aria-checked="true"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [s.report?.id])

  const onTouchStart = (e: TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e: TouchEvent) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return
    const next = s.reports[index + (dx < 0 ? 1 : -1)]
    if (next) s.select(next.id)
  }

  const content = s.loadingPage ? <Skeleton /> : s.notFound || !s.reports.length ? (
    <>
      {!s.notFound && <div className="px-[22px] pt-3.5"><Name s={s} size={28} /></div>}
      <div className="flex flex-1 flex-col justify-center px-7 pb-[120px]"><EmptyState s={s} /></div>
    </>
  ) : (
    <>
      <div className="px-[22px] pt-3.5"><Name s={s} size={28} /></div>
      <div ref={chips} role="radiogroup" aria-label={t('shared.reports')}
        className="flex shrink-0 gap-2 overflow-x-auto px-4 pt-3.5 [scrollbar-width:none]">
        {s.reports.map((r) => {
          const on = r.id === s.report?.id
          return (
            <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => s.select(r.id)}
              className={`flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold whitespace-nowrap ${on ? 'bg-ui-selected text-ui-on-selected' : 'border border-ui-control text-ui-ink2'}`}>
              {r.name}
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <RangeControl s={s} size="sm" />
        <EndDateControl end={s.end} onChange={s.setEnd} />
      </div>
      <div className="px-4 pt-2.5" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <section className={`${CARD} flex flex-col gap-3.5 p-4`}>
          <div className="flex items-start justify-between gap-3">
            {!s.isLoading && !s.isError ? <Headline s={s} size={30} /> : <span />}
            <button type="button" aria-label={t('today.more')} aria-haspopup="menu" onClick={(e) => setMenu(e.currentTarget)}
              className="-mt-2.5 -mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center gap-[3px]">
              {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-ui-ink" />)}
            </button>
          </div>
          <ChartBody s={s} height={170}>
            {s.grid ? (
              <><DayCalendar s={s} /><HeatKey /></>
            ) : (
              <>
                <InsightsChart key={s.selectedId} rows={s.rows} traces={s.traces} barLayout={s.barLayout} averages={s.averages} />
                <Legend s={s} cols={2} />
              </>
            )}
          </ChartBody>
        </section>
      </div>
      {s.reports.length > 1 && (
        <div aria-hidden className="flex justify-center gap-1.5 pt-3.5">
          {s.reports.map((r, i) => <span key={r.id} className={`h-1.5 rounded-[3px] ${i === index ? 'w-[18px] bg-ui-ink' : 'w-1.5 bg-ui-control'}`} />)}
        </div>
      )}
    </>
  )

  return (
    <Root className={`flex flex-col pt-[env(safe-area-inset-top)] ${s.visitor ? 'pb-[calc(96px+env(safe-area-inset-bottom))]' : 'pb-8'}`}>
      <header className="flex min-h-11 shrink-0 items-center justify-between pt-3 pr-4 pl-[22px]">
        <Mark size="sm" />
        {!s.loadingPage && (
          <span className="rounded-full border border-ui-hairline px-[9px] py-[5px] font-ui-mono text-[11px] font-semibold tracking-[.06em] text-ui-muted uppercase">
            {t('shared.readOnly')}
          </span>
        )}
      </header>
      {content}
      {s.visitor && !s.loadingPage && (
        <aside className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-ui-control bg-ui-tabbar px-[22px] pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
          <span className="text-sm font-semibold text-ui-ink2">{t('shared.trackOwn')}</span>
          <SignUpLink />
        </aside>
      )}
      {menu && (
        <AnchoredMenu anchor={menu} label={t('today.more')} onClose={() => setMenu(null)}>
          <MenuItem onSelect={() => { setMenu(null); csv() }}>{t('shared.downloadCsv')}</MenuItem>
        </AnchoredMenu>
      )}
    </Root>
  )
}

export function SharedTablet() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const s = useShared(id)
  const csv = useCsv(id, s)

  return (
    <Root className="flex flex-col px-9 pt-[calc(28px+env(safe-area-inset-top))] pb-9">
      <header className="flex items-center justify-between gap-4">
        <Mark />
        {s.visitor && (
          <div className="flex items-center gap-3.5">
            <span className="text-sm font-semibold text-ui-muted">{t('shared.trackOwn')}</span>
            <Link to="/register" className="flex min-h-11 items-center rounded-[14px] border border-ui-control bg-ui-surface px-4 text-sm font-bold">
              {t('auth.signUp')}
            </Link>
          </div>
        )}
      </header>
      {s.loadingPage ? (
        <div className="flex flex-1 items-center justify-center"><Spinner /></div>
      ) : s.notFound || !s.reports.length ? (
        <div className="flex flex-1 flex-col justify-center"><div className="max-w-[480px]"><EmptyState s={s} /></div></div>
      ) : (
        <>
          <div className="pt-7"><Name s={s} size={34} /></div>
          <div className="flex min-h-0 flex-1 gap-6 pt-6">
            <aside className="w-[220px] shrink-0"><ReportList s={s} /></aside>
            <main className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <RangeControl s={s} size="md" />
                <EndDateControl end={s.end} onChange={s.setEnd} />
                <span className="flex-1" />
                <CsvButton onClick={csv} />
              </div>
              <section className={`${CARD} flex flex-col gap-3.5 p-5`}>
                <div className="flex items-start justify-between gap-3">
                  {!s.isLoading && !s.isError && <Headline s={s} size={34} delta={false} />}
                  {s.grid ? <HeatKey /> : <DeltaText s={s} className="pt-0.5 text-right" />}
                </div>
                <ChartBody s={s} height={220}>
                  {s.grid ? <PracticeHeatmap s={s} /> : (
                    <>
                      <InsightsChart key={s.selectedId} rows={s.rows} traces={s.traces} barLayout={s.barLayout} averages={s.averages} height={220} />
                      <Legend s={s} cols={4} />
                    </>
                  )}
                </ChartBody>
              </section>
              {!s.grid && s.hasData && !s.isLoading && (
                <section className={`${CARD} flex flex-col gap-3.5 px-5 py-[18px]`}>
                  <h2 className="text-[15px] font-extrabold">{t('shared.table')}</h2>
                  <DayTable s={s} />
                </section>
              )}
              {s.grid && <p className="text-[13px] text-ui-muted">{t('shared.hoverHint')}</p>}
            </main>
          </div>
        </>
      )}
    </Root>
  )
}

export function SharedDesktop() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const s = useShared(id)
  const csv = useCsv(id, s)
  const kind = useKind()
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const empty = s.notFound || !s.reports.length

  return (
    <Root className="flex">
      <aside className="sticky top-0 flex h-dvh w-[300px] shrink-0 flex-col gap-[30px] overflow-y-auto border-r border-ui-control px-5 py-7">
        <div className="px-2.5"><Mark /></div>
        {!s.loadingPage && !s.notFound && (
          <div className="flex flex-col gap-0.5 px-2.5">
            <Name s={s} size={28} />
            {s.reports.length > 0 && <span className="text-[13px] text-ui-muted">{t('shared.summary', { count: s.reports.length })}</span>}
          </div>
        )}
        {!s.loadingPage && <ReportList s={s} />}
        <span className="flex-1" />
        {s.visitor && (
          <div className={`${CARD} flex flex-col gap-2 rounded-[18px] p-4`}>
            <span className="text-[15px] leading-snug font-extrabold">{t('shared.trackOwn')}</span>
            <span className="text-[13px] leading-[1.45] text-ui-muted">{t('shared.trackHint')}</span>
            <SignUpLink className="min-h-9" />
          </div>
        )}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-[22px] px-10 py-9">
        {s.loadingPage ? (
          <div className="flex flex-1 items-center justify-center"><Spinner /></div>
        ) : empty ? (
          <div className="flex flex-1 flex-col justify-center"><div className="max-w-[480px]"><EmptyState s={s} /></div></div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                {s.report && <span className="font-ui-mono text-xs font-medium tracking-[.06em] text-ui-faint2 uppercase">{kind(s.report)}</span>}
                <h2 className="text-[34px] leading-tight font-extrabold tracking-[-0.02em] break-words">{s.report?.name}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <RangeControl s={s} size="lg" />
                <EndDateControl end={s.end} onChange={s.setEnd} />
                <CsvButton onClick={csv} />
              </div>
            </div>
            <section className={`${CARD} flex flex-col gap-[18px] rounded-[24px] p-6`}>
              <div className="flex items-start justify-between gap-3">
                {!s.isLoading && !s.isError && <Headline s={s} size={40} delta={false} />}
                {s.grid ? <HeatKey /> : (
                  <div className="flex items-center gap-4">
                    <DeltaText s={s} />
                    <SegmentedControl label={t('shared.table')} value={view} onChange={setView}
                      options={[{ value: 'chart', label: t('shared.chart') }, { value: 'table', label: t('shared.table') }]} />
                  </div>
                )}
              </div>
              <ChartBody s={s} height={400}>
                {s.grid ? <PracticeHeatmap s={s} /> : view === 'table' ? <DayTable s={s} /> : (
                  <>
                    <InsightsChart key={s.selectedId} rows={s.rows} traces={s.traces} barLayout={s.barLayout} averages={s.averages} height={400} />
                    <Legend s={s} cols={4} />
                  </>
                )}
              </ChartBody>
            </section>
            {s.grid && <p className="text-[13px] text-ui-muted">{t('shared.hoverHint')}</p>}
          </>
        )}
      </main>
    </Root>
  )
}
