import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../api/charts'
import type { Report, ReportDataEntry } from '../../api/charts'
import { useAuth } from '../../hooks/useAuth'
import { useToastStore } from '../../hooks/useToast'
import { toCSV, triggerCSVDownload } from '../insights/csv'
import type { Trace } from '../insights/chartLogic'
import { valueToNumber } from '../insights/chartLogic'
import { fromDateStr, toDateStr } from '../today/date'
import { formatDuration } from '../today/values'
import { cellText, formatDay, formatDelta, formatHeadline, traceAverageLabel, windowLabel } from '../insights/insightsLogic'
import { isTable, useInsights } from '../insights/useInsights'
import { dayLevels, doneAverage, practiceCells, type Level } from './sharedLogic'

export const SHARED_RANGES = ['7d', '30d', '90d', '1y'] as const
export const HEAT: Record<Level, string> = { 0: 'bg-ui-heat-0', 1: 'bg-ui-heat-1', 2: 'bg-ui-heat-2', 3: 'bg-ui-heat-3' }
export const CARD = 'rounded-[20px] border border-ui-hairline bg-ui-surface'

/** Everything a shared reports screen needs: the owner, their reports and the selected one's data. */
export function useShared(userId: string) {
  const ins = useInsights(undefined, true, userId)
  const user = useQuery({ queryKey: ['shared', userId, 'user'], queryFn: () => chartsApi.getSharedUser(userId), retry: false })
  const { isAuthenticated } = useAuth()
  return {
    ...ins,
    name: user.data?.name ?? '',
    grid: isTable(ins.report),
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
    : t('shared.graph', { count: r.definition.Graph.traces.length })
}

/** CSV of the report's practices, every day ever logged. */
export function useCsv(userId: string, s: Shared) {
  const showToast = useToastStore((st) => st.showToast)
  const { t } = useTranslation()
  return () => {
    const names = new Set(s.traces.map((tr) => tr.name))
    chartsApi.getSharedReportData(userId, toDateStr(new Date()), 'AllData')
      .then((rows) => triggerCSVDownload(toCSV(rows.filter((r) => names.has(r.practice)), {})))
      .catch(() => showToast({ message: t('common.error'), variant: 'error' }))
  }
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-bold tracking-[.1em] text-ui-muted uppercase">{children}</span>
}

export function Mark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className={`shrink-0 rounded-full bg-ui-accent-fill ${size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'}`} />
      <span className={`font-extrabold tracking-[-0.01em] whitespace-nowrap ${size === 'sm' ? 'text-[15px]' : 'text-lg'}`}>Sadhana Pro</span>
    </span>
  )
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
            <span className="text-sm leading-snug font-bold text-ui-ink">{r.name}</span>
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
  return <span className={`text-[13px] font-bold ${d >= 0 ? 'text-ui-good' : 'text-ui-muted'} ${className}`}>{t(`insights.vsPrev${s.range}`, { delta: formatDelta(d) })}</span>
}

export function Legend({ s, cols }: { s: Shared; cols: 2 | 4 }) {
  const { t } = useTranslation()
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const pad = (cols - (s.traces.length % cols)) % cols
  return (
    <ul aria-label={t('insights.legend')}
      className={`grid ${cols === 2 ? 'grid-cols-2' : 'grid-cols-4'} gap-px overflow-hidden rounded-2xl border border-ui-hairline bg-ui-hairline`}>
      {s.traces.map((tr, i) => (
        <li key={i} className="flex min-w-0 flex-col gap-[3px] bg-ui-surface px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ui-ink2">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: tr.color }} />
            <span className="truncate">{tr.name}</span>
          </span>
          <span className="font-ui-mono text-base font-medium">{traceAverageLabel(tr, s.entries, s.todayCob, units)}</span>
        </li>
      ))}
      {Array.from({ length: pad }, (_, i) => <li key={`pad${i}`} aria-hidden className="bg-ui-surface" />)}
    </ul>
  )
}

export function HeatKey() {
  const { t } = useTranslation()
  return (
    <span className="flex items-center gap-1.5 text-xs text-ui-muted">
      {t('shared.less')}
      {([0, 1, 2, 3] as Level[]).map((l) => <span key={l} aria-hidden className={`h-3 w-3 rounded-[3px] ${HEAT[l]}`} />)}
      {t('shared.more')}
    </span>
  )
}

/** Mobile grid report (13b): a calendar of the window, each day shaded by how many practices were done. */
export function DayCalendar({ s }: { s: Shared }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const levels = dayLevels(s.traces, s.entries)
  if (!levels.length) return null
  const lead = (fromDateStr(levels[0].cob).getDay() + 6) % 7
  // A Monday-first week: 2026-10-05 was a Monday.
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 5 + i).toLocaleDateString(locale, { weekday: 'narrow' }))
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {weekdays.map((w, i) => <span key={i} aria-hidden className="text-center text-[11px] font-semibold text-ui-faint2">{w}</span>)}
      {Array.from({ length: lead }, (_, i) => <span key={`lead${i}`} />)}
      {levels.map((d) => {
        const day = fromDateStr(d.cob)
        return (
          <span key={d.cob} role="img"
            aria-label={`${formatDay(d.cob, locale)}: ${t('shared.doneOf', { done: d.count, total: s.traces.length })}`}
            className={`flex h-[38px] items-center justify-center rounded-[10px] font-ui-mono text-[13px] font-medium ${HEAT[d.level]} ${d.level === 3 ? 'text-ui-on-heat-3' : 'text-ui-ink'}`}>
            {day.getDate()}
          </span>
        )
      })}
    </div>
  )
}

/** Tablet and desktop grid report (13h): a row of days per practice; hover (or tap) a day for its diary value. */
export function PracticeHeatmap({ s }: { s: Shared }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const [hover, setHover] = useState<string | null>(null)
  const dayCount = new Set(s.entries.map((e) => e.cob_date)).size
  // ponytail: a year is 365 thin cells with no gap; weeks/months per cell if anyone wants 1y readable.
  const gap = dayCount > 90 ? 'gap-0' : dayCount > 31 ? 'gap-px' : 'gap-1'
  const ticks = tickDays(s.entries)
  return (
    <div className="flex flex-col gap-2.5 pt-11">
      {s.traces.map((tr) => {
        const cells = practiceCells(tr, s.entries)
        const past = cells.filter((c) => c.cob !== s.todayCob)
        return (
          <div key={tr.name} className="flex items-center gap-4">
            <span className="w-[190px] shrink-0 truncate text-sm font-semibold text-ui-ink2 max-lg:w-[130px]">{tr.name}</span>
            <div className={`grid min-w-0 flex-1 ${gap}`} style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
              {cells.map((c) => {
                const key = `${tr.name}|${c.cob}`
                const label = `${fromDateStr(c.cob).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })} · ${tr.name}`
                const value = cellText(c.raw, tr.dataType, units) || '—'
                return (
                  <button key={c.cob} type="button" aria-label={`${label}: ${value}`}
                    onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover((h) => (h === key ? null : h))}
                    onFocus={() => setHover(key)} onBlur={() => setHover(null)} onClick={() => setHover((h) => (h === key ? null : key))}
                    className={`relative h-7 ${dayCount > 31 ? 'rounded-sm' : 'rounded-md'} ${HEAT[c.level]} ${hover === key ? 'z-10 shadow-[0_0_0_2px_var(--ui-ink)]' : ''}`}>
                    {hover === key && (
                      <span className="pointer-events-none absolute bottom-[38px] left-1/2 z-20 flex -translate-x-1/2 flex-col gap-0.5 rounded-[10px] bg-ui-ink px-3 py-2 text-left text-xs font-semibold whitespace-nowrap text-ui-bg">
                        <span>{label}</span>
                        <span className="font-ui-mono font-medium">{value}</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <span className="w-14 shrink-0 text-right font-ui-mono text-[13px] font-medium text-ui-ink2">
              {past.filter((c) => c.level > 0).length}/{past.length}
            </span>
          </div>
        )
      })}
      <div className="flex gap-4">
        <span className="w-[190px] shrink-0 max-lg:w-[130px]" />
        <div className="flex flex-1 justify-between font-ui-mono text-xs font-medium text-ui-faint2">
          {ticks.map((c) => <span key={c}>{formatDay(c, locale)}</span>)}
        </div>
        <span className="w-14 shrink-0" />
      </div>
    </div>
  )
}

/** Five evenly spaced dates across the window, for the x axis under the heatmap. */
function tickDays(entries: ReportDataEntry[]) {
  const all = [...new Set(entries.map((e) => e.cob_date))].sort()
  if (all.length < 2) return all
  return [...new Set([0, 1, 2, 3, 4].map((i) => all[Math.round((i * (all.length - 1)) / 4)]))]
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
