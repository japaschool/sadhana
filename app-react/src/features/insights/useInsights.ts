import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../api/charts'
import type { GraphReport, Report, ReportDuration } from '../../api/charts'
import { practicesApi } from '../../api/practices'
import { buildChartData, tracesFor } from '../../pages/charts/chartLogic'
import { addDays, fromDateStr, toDateStr } from '../today/date'
import { averageLines, headline } from './insightsLogic'

export const ALL = '__all__'
const KEY = 'insights-report'
const COLORS = Array.from({ length: 8 }, (_, i) => `var(--ui-chart-${i + 1})`)

export type Range = '7d' | '30d' | '90d' | '1y' | 'all'
export const RANGES: Range[] = ['7d', '30d', '90d', '1y', 'all']
const DURATION: Record<Range, ReportDuration> = { '7d': 'Week', '30d': 'Month', '90d': 'Quarter', '1y': 'Year', all: 'AllData' }

type GraphReportRow = Report & { definition: { Graph: GraphReport } }
const isGraph = (r: Report): r is GraphReportRow => 'Graph' in r.definition
export const isTable = (r: Report | null) => !!r && 'Grid' in r.definition

function readStored(): string {
  try { return localStorage.getItem(KEY) ?? ALL } catch { return ALL }
}

function writeStored(id: string) {
  try { localStorage.setItem(KEY, id) } catch { /* blocked storage: the choice lasts for this visit */ }
}

/** `logDate` (desktop) pins the window's end to the log panel's day instead of the screen's own end date.
 *  `withTables` also lists Grid (table) reports; layouts without a table view leave them out. */
export function useInsights(logDate?: Date, withTables = false) {
  const { i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const reportsQ = useQuery({ queryKey: ['reports'], queryFn: chartsApi.getReports })
  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const [stored, setStored] = useState(readStored)
  const [range, setRange] = useState<Range>('30d')
  const [end, setEndState] = useState<Date | null>(null)

  const reports = (reportsQ.data ?? []).filter((r) => withTables || isGraph(r))
  // An unknown or deleted id (or a Grid one, without tables) simply isn't found, so the screen shows All practices.
  const report = reports.find((r) => r.id === stored) ?? null
  const duration = DURATION[range]
  const todayCob = toDateStr(new Date())
  const endCob = toDateStr(logDate ?? end ?? new Date())

  const current = useQuery({
    queryKey: ['report-data', endCob, duration],
    queryFn: () => chartsApi.getReportData(endCob, duration),
  })
  // From the response, so it matches the server's calendar-month/-year arithmetic. All data has no previous window.
  const first = range === 'all' ? undefined : current.data?.[0]?.cob_date
  const prevEnd = first ? toDateStr(addDays(fromDateStr(first), -1)) : null
  const previous = useQuery({
    queryKey: ['report-data', prevEnd, duration],
    queryFn: () => chartsApi.getReportData(prevEnd!, duration),
    enabled: prevEnd !== null,
  })

  const traces = tracesFor(report, practicesQ.data ?? [], COLORS)
  const entries = current.data ?? []
  const names = new Set(traces.map((t) => t.name))
  const barLayout = report && isGraph(report) ? report.definition.Graph.bar_layout : 'Grouped'

  return {
    reports,
    report,
    selectedId: report?.id ?? ALL,
    select: (id: string) => { setStored(id); writeStored(id) },
    range,
    setRange,
    end,
    setEnd: (d: Date | null) => setEndState(d && toDateStr(d) !== todayCob ? d : null),
    todayCob,
    traces,
    entries,
    rows: buildChartData(entries, traces, locale),
    barLayout,
    headline: headline(traces, entries, previous.data, todayCob),
    averages: averageLines(traces, entries, barLayout, todayCob),
    hasData: entries.some((e) => names.has(e.practice) && e.value !== null && e.value !== undefined),
    isLoading: reportsQ.isLoading || practicesQ.isLoading || current.isLoading,
    isError: current.isError,
  }
}
