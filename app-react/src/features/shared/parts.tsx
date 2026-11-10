import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../api/charts'
import type { Report } from '../../api/charts'
import { useAuth } from '../../hooks/useAuth'
import { useToastStore } from '../../hooks/useToast'
import { ReportGlyph } from '../insights/ReportGlyph'
import { toCSV, triggerCSVDownload } from '../insights/csv'
import type { Trace } from '../insights/chartLogic'
import { valueToNumber } from '../insights/chartLogic'
import { fromDateStr, toDateStr } from '../today/date'
import { formatDuration } from '../today/values'
import { cellText, deltaKey, formatDay, formatDelta, formatHeadline, windowLabel } from '../insights/insightsLogic'
import { isTable, useInsights } from '../insights/useInsights'
import { Delta } from '../insights/Headline'
import { doneAverage } from './sharedLogic'

export const SHARED_RANGES = ['7d', '30d', '90d', '1y'] as const
export const CARD = 'rounded-[20px] border border-ui-hairline bg-ui-surface'

/** Everything a shared reports screen needs: the owner, their reports and the selected one's data. */
export function useShared(userId: string) {
  const user = useQuery({ queryKey: ['shared', userId, 'user'], queryFn: () => chartsApi.getSharedUser(userId), retry: false })
  // The page opens once on the link's date (a month report on its month; goals still read to today), then the viewer moves freely.
  // Data waits for it, so the first read is already the right window.
  const [opened, setOpened] = useState(false)
  const ins = useInsights(undefined, true, userId, !opened && !user.isError)
  const start = user.data?.start_date
  // Set during render, not in an effect, so the first fetch already uses the link's date instead of fetching today's window first.
  // setMonth is harmless for a report that isn't a month one: select() resets it.
  if (!opened && user.data) {
    setOpened(true)
    if (start && start !== ins.todayCob) {
      ins.setEnd(fromDateStr(start))
      ins.setMonth(start.slice(0, 7))
    }
  }
  const { isAuthenticated } = useAuth()
  return {
    ...ins,
    name: user.data?.name ?? '',
    /** Until the user loads it reads as a link, so a link page never flashes its legacy-only CSV button. */
    kind: user.data?.kind ?? 'link',
    grid: isTable(ins.report),
    /** A table report with days to show: drawn as the owner's Insights table, read-only. */
    table: isTable(ins.report) && !ins.isLoading && !ins.isError && ins.entries.length > 0,
    /** A panels report with its data: it draws its own cards. */
    panelsReady: !!ins.panels && !ins.isLoading && !ins.isError,
    // An unknown user and a report that's no longer shared look the same, so the page doesn't reveal which.
    notFound: user.isError || ins.reportsError,
    loadingPage: user.isLoading || (ins.isLoading && !ins.reports.length),
    visitor: !isAuthenticated,
  }
}
export type Shared = ReturnType<typeof useShared>

export function useKind() {
  const { t } = useTranslation()
  return (r: Report) => 'Grid' in r.definition
    ? t('shared.grid', { count: r.definition.Grid.practices.length })
    : 'Graph' in r.definition
      ? t('shared.graph', { count: r.definition.Graph.traces.length })
      : t('shared.template')
}

/** CSV of the report's practices, every day ever logged. */
export function useCsv(userId: string, s: Shared) {
  const showToast = useToastStore((st) => st.showToast)
  const { t } = useTranslation()
  return () => {
    const names = new Set(s.traces.map((tr) => tr.name))
    chartsApi.getSharedReportData(userId, toDateStr(new Date()), 'AllData')
      .then((rows) => triggerCSVDownload(toCSV(rows.filter((r) => names.has(r.practice)))))
      .catch(() => showToast({ message: t('common.error'), variant: 'error' }))
  }
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-bold tracking-[.1em] text-ui-muted uppercase">{children}</span>
}

/** The nav panel's logo; mobile shows none. */
export function Mark() {
  return <span role="img" aria-label="Sadhana Pro" className="h-10 w-10 shrink-0 bg-ui-accent [mask:url(/logo.png)_center/contain_no-repeat] xl:h-12 xl:w-12" />
}

export function Medallion({ danger }: { danger?: boolean }) {
  return (
    <span aria-hidden className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-ui-danger-soft' : 'bg-ui-accent-pill'}`}>
      <span className={`h-[22px] w-[22px] rounded-full ${danger ? 'bg-ui-danger' : 'bg-ui-accent-fill'}`} />
    </span>
  )
}

/** 13d / 13e: no reports, or nothing to show at this link. */
export function EmptyState({ s }: { s: Shared }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-5">
      <Medallion danger={s.notFound} />
      <div className="flex flex-col gap-2">
        <h2 className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em]">{t(s.notFound ? 'shared.notFound' : 'shared.none')}</h2>
        <p className="text-[15px] leading-normal text-pretty text-ui-ink2">
          {s.notFound ? t('shared.notFoundHint') : t('shared.noneHint', { name: s.name })}
        </p>
      </div>
      {s.notFound && <Link to="/" className="mt-2 flex min-h-[52px] items-center justify-center rounded-2xl bg-ui-selected px-4 text-base font-bold text-ui-on-selected">{t('notFound.goHome')}</Link>}
    </div>
  )
}

export function Spinner() {
  const { t } = useTranslation()
  return <span role="status" aria-label={t('common.loading')} className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
}

/** Tablet and desktop: the reports as a list (desktop puts it in the sidebar). */
export function ReportList({ s }: { s: Shared }) {
  const { t } = useTranslation()
  const kind = useKind()
  return (
    <div role="radiogroup" aria-label={t('shared.reports')} className="flex flex-col gap-1">
      {s.reports.map((r) => {
        const on = r.id === s.report?.id
        return (
          <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => s.select(r.id)}
            className={`flex flex-col gap-[3px] rounded-[14px] px-3.5 py-3 text-left ${on ? 'bg-ui-accent-pill' : 'hover:bg-ui-chip'}`}>
            <span className="flex min-w-0 items-center gap-2 text-sm leading-snug font-bold text-ui-ink"><ReportGlyph report={r} /><span className="truncate">{r.name}</span></span>
            <span className={`font-ui-mono text-[11px] font-medium tracking-[.04em] uppercase ${on ? 'text-ui-accent' : 'text-ui-faint2'}`}>{kind(r)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** The chart card's label and big number: a graph's daily average, or a grid's practices done per day. */
export function Headline({ s, size, delta = true }: { s: Shared; size: 30 | 34 | 40; delta?: boolean }) {
  const { t, i18n } = useTranslation()
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const range = windowLabel(s.entries, i18n.language || 'en')
  const big = { 30: 'text-[30px]', 34: 'text-[34px]', 40: 'text-[40px]' }[size]
  let label: string
  let value: string | null
  if (s.grid) {
    const avg = doneAverage(s.traces, s.entries, s.todayCob)
    label = t('shared.donePerDay', { range })
    value = avg === null ? null : t('shared.doneOf', { done: avg.toLocaleString(i18n.language), total: s.traces.length })
  } else {
    const h = s.headline
    label = t(h?.kind === 'time' ? 'insights.average' : 'insights.dailyAverage', { range })
    value = h ? formatHeadline(h, units) : null
  }
  if (value === null) return null
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[13px] font-semibold text-ui-muted">{label}</span>
      <span className={`font-ui-mono ${big} leading-tight font-semibold tracking-[-0.03em] text-ui-ink`}>{value}</span>
      {delta && !s.grid && s.headline?.delta != null && <DeltaText s={s} />}
    </div>
  )
}

export function DeltaText({ s, className = '' }: { s: Shared; className?: string }) {
  const { t } = useTranslation()
  const d = s.headline?.delta
  if (s.grid || d == null) return null
  return <Delta text={t(deltaKey(s.range, s.compare.year), { delta: formatDelta(d) })} onClick={s.compare.toggle} className={`text-[13px] font-bold ${d >= 0 ? 'text-ui-good' : 'text-ui-muted'} ${className}`} />
}

/** Tablet and desktop graph reports: the days as rows, newest first, with a total when every practice is a duration. */
export function DayTable({ s }: { s: Shared }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const values = new Map(s.entries.map((e) => [`${e.cob_date}|${e.practice}`, e.value]))
  const rows = [...new Set(s.entries.map((e) => e.cob_date))].sort().reverse()
  const total = s.traces.length > 1 && s.traces.every((tr) => tr.dataType === 'Duration')
  const cols = `64px repeat(${s.traces.length + (total ? 1 : 0)}, minmax(0, 1fr))`
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="grid gap-2 pb-2 text-[11px] leading-tight font-bold text-ui-muted" style={{ gridTemplateColumns: cols }}>
          <th className="text-left font-bold">{t('shared.date')}</th>
          {s.traces.map((tr, i) => <th key={i} className="truncate text-right font-bold">{tr.name}</th>)}
          {total && <th className="text-right font-bold">{t('shared.total')}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((cob) => {
          const sum = s.traces.reduce((acc, tr: Trace) => acc + (valueToNumber(values.get(`${cob}|${tr.name}`), tr.dataType) ?? 0), 0)
          return (
            <tr key={cob} className="grid gap-2 border-t border-ui-hairline py-2.5 font-ui-mono text-[13px] font-medium" style={{ gridTemplateColumns: cols }}>
              <th scope="row" className="text-left font-ui font-bold">{formatDay(cob, locale)}</th>
              {s.traces.map((tr, i) => <td key={i} className="truncate text-right">{cellText(values.get(`${cob}|${tr.name}`), tr.dataType, units)}</td>)}
              {total && <td className="text-right font-semibold">{sum ? formatDuration(sum, units) : ''}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function SignUpLink({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return <Link to="/register" className={`flex min-h-11 items-center text-sm font-extrabold whitespace-nowrap text-ui-accent ${className}`}>{t('shared.signUp')}</Link>
}
