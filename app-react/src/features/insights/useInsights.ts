import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { failedWithoutData } from '../../api/queryState'
import { chartsApi } from '../../api/charts'
import type { GraphReport, Report, ReportDuration } from '../../api/charts'
import { practicesApi } from '../../api/practices'
import { buildChartData, tracesFor } from './chartLogic'
import { hasPanel, isPanels, REPORTS_KEY, useReportSort } from './useReports'
import { addDays, fromDateStr, toDateStr } from '../today/date'
import { averageLines, headline } from './insightsLogic'
import { monthEnd } from './panels/panelLogic'

const KEY = 'insights-report'
export const COLORS = Array.from({ length: 8 }, (_, i) => `var(--ui-chart-${i + 1})`)

export type Range = '7d' | '30d' | '90d' | '1y' | 'all'
export const RANGES: Range[] = ['7d', '30d', '90d', '1y', 'all']
const DURATION: Record<Range, ReportDuration> = { '7d': 'Week', '30d': 'Month', '90d': 'Quarter', '1y': 'Year', all: 'AllData' }

type GraphReportRow = Report & { definition: { Graph: GraphReport } }
const isGraph = (r: Report): r is GraphReportRow => 'Graph' in r.definition
export const isTable = (r: Report | null) => !!r && 'Grid' in r.definition

function readStored(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}

export function writeStored(id: string) {
  try { localStorage.setItem(KEY, id) } catch { /* blocked storage: the choice lasts for this visit */ }
}

/** `logDate` (desktop) pins the window's end to the log panel's day instead of the screen's own end date.
 *  `withTables` also lists Grid (table) reports; layouts without a table view leave them out.
 *  `sharedUser` reads that user's shared reports (/shared/:userId) instead.
 *  `paused` holds back the report data (a shared page waits to learn the date its link opens on). */
export function useInsights(logDate?: Date, withTables = false, sharedUser?: string, paused = false) {
  const { i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const sortReports = useReportSort()
  const src = sharedUser
    ? {
      key: ['shared', sharedUser],
      reports: () => chartsApi.getSharedReports(sharedUser),
      practices: () => chartsApi.getSharedPractices(sharedUser),
      data: (cob: string, d: ReportDuration) => chartsApi.getSharedReportData(sharedUser, cob, d),
    }
    : { key: [], reports: chartsApi.getReports, practices: practicesApi.getUserPractices, data: chartsApi.getReportData }
  const reportsQ = useQuery({ queryKey: sharedUser ? [...src.key, 'reports', 'panels'] : [...REPORTS_KEY], queryFn: src.reports, select: sortReports, retry: !sharedUser })
  const practicesQ = useQuery({ queryKey: [...src.key, 'practices'], queryFn: src.practices })
  const [stored, setStored] = useState(sharedUser ? '' : readStored)
  const [range, setRange] = useState<Range>('30d')
  const [end, setEndState] = useState<Date | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  // Legend toggles, per report: switching reports starts with every series shown.
  const [hiddenFor, setHiddenFor] = useState<{ id: string; set: Set<number> }>({ id: '', set: new Set() })

  const reports = (reportsQ.data ?? []).filter((r) => withTables || !('Grid' in r.definition))
  // An unknown or deleted id (or a Grid one, without tables) simply isn't found, so the screen shows the first report.
  const report = reports.find((r) => r.id === stored) ?? reports[0] ?? null
  const todayCob = toDateStr(new Date())
  // A month report has no range or end date: it reads half a year to the shown month's end, which covers that month, the one before and any 90 days.
  // A goals report has no range or end date either: it reads the last year to today, whatever the range or log date.
  const goals = hasPanel(report, 'Goals')
  const hasMonth = !goals && !!report && isPanels(report) && report.definition.Panels.panels.some((p) => p.kind === 'Month')
  const month = hasMonth ? picked ?? todayCob.slice(0, 7) : null
  const duration = goals ? 'Year' : hasMonth ? 'HalfYear' : DURATION[range]
  const endCob = goals ? todayCob : month ? monthEnd(month, todayCob) : toDateStr(logDate ?? end ?? new Date())

  const current = useQuery({
    queryKey: [...src.key, 'report-data', endCob, duration],
    queryFn: () => src.data(endCob, duration),
    enabled: !paused,
  })
  // From the response, so it matches the server's calendar-month/-year arithmetic. All data has no previous window.
  const first = range === 'all' || hasMonth || goals ? undefined : current.data?.[0]?.cob_date
  const prevEnd = first ? toDateStr(addDays(fromDateStr(first), -1)) : null
  const previous = useQuery({
    queryKey: [...src.key, 'report-data', prevEnd, duration],
    queryFn: () => src.data(prevEnd!, duration),
    enabled: prevEnd !== null && !paused,
  })
  // The days-around table needs 10 events of one option, more than a week or a month holds: it reads the year to the window's end.
  const hasAround = !!report && isPanels(report) && report.definition.Panels.panels.some((p) => p.kind === 'Around')
  const year = useQuery({
    queryKey: [...src.key, 'report-data', endCob, 'Year'],
    queryFn: () => src.data(endCob, 'Year'),
    enabled: hasAround && duration !== 'Year' && !paused,
  })

  const traces = tracesFor(report, practicesQ.data ?? [], COLORS)
  const entries = current.data ?? []
  const names = new Set(traces.map((t) => t.name))
  const barLayout = report && isGraph(report) ? report.definition.Graph.bar_layout : 'Grouped'
  const selectedId = report?.id ?? ''
  const hidden = hiddenFor.id === selectedId ? hiddenFor.set : new Set<number>()

  return {
    reports,
    report,
    selectedId,
    select: (id: string) => { setStored(id); setPicked(null); if (!sharedUser) writeStored(id) },
    range,
    setRange,
    end,
    setEnd: (d: Date | null) => setEndState(d && toDateStr(d) !== todayCob ? d : null),
    todayCob,
    /** The report has a Goals panel: no range or end date. */
    goals,
    /** yyyy-mm shown by a month report; null for any other. */
    month,
    setMonth: setPicked,
    traces,
    entries,
    rows: buildChartData(entries, traces, locale),
    barLayout,
    previousEntries: previous.data,
    /** The year to the window's end, for the days-around table; undefined while it loads or without one. */
    yearEntries: duration === 'Year' ? current.data : year.data,
    panels: report && isPanels(report) ? report.definition.Panels : null,
    practices: practicesQ.data ?? [],
    /** A table's Group columns setting (on unless the report says otherwise). */
    grouped: !(report && 'Grid' in report.definition && report.definition.Grid.group_columns === false),
    headline: headline(traces, barLayout, entries, previous.data, todayCob),
    averages: averageLines(traces, entries, barLayout, todayCob, hidden),
    hidden,
    toggle: (i: number) => {
      const set = new Set(hidden)
      if (!set.delete(i)) set.add(i)
      setHiddenFor({ id: selectedId, set })
    },
    hasData: entries.some((e) => names.has(e.practice) && e.value !== null && e.value !== undefined),
    isLoading: reportsQ.isLoading || practicesQ.isLoading || current.isLoading,
    isError: failedWithoutData(current),
    reportsError: failedWithoutData(reportsQ),
    /** Loaded, and there are no reports to show. */
    noReports: reportsQ.isSuccess && reports.length === 0,
  }
}
