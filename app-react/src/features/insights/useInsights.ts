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

export type Range = '7d' | '30d' | '90d' | '1y'
export const RANGES: Range[] = ['7d', '30d', '90d', '1y']
const DURATION: Record<Range, ReportDuration> = { '7d': 'Week', '30d': 'Month', '90d': 'Quarter', '1y': 'Year' }

export type GraphReportRow = Report & { definition: { Graph: GraphReport } }
const isGraph = (r: Report): r is GraphReportRow => 'Graph' in r.definition

function readStored(): string {
  try { return localStorage.getItem(KEY) ?? ALL } catch { return ALL }
}

function writeStored(id: string) {
  try { localStorage.setItem(KEY, id) } catch { /* blocked storage: the choice lasts for this visit */ }
}

export function useInsights() {
  const { i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const reportsQ = useQuery({ queryKey: ['reports'], queryFn: chartsApi.getReports })
  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const [stored, setStored] = useState(readStored)
  const [range, setRange] = useState<Range>('30d')
  const [end, setEndState] = useState<Date | null>(null)

  const reports = (reportsQ.data ?? []).filter(isGraph)
  // An unknown, deleted or Grid id simply isn't found, so the screen shows All practices.
  const report = reports.find((r) => r.id === stored) ?? null
  const duration = DURATION[range]
  const todayCob = toDateStr(new Date())
  const endCob = end ? toDateStr(end) : todayCob

  const current = useQuery({
    queryKey: ['report-data', endCob, duration],
    queryFn: () => chartsApi.getReportData(endCob, duration),
  })
  // From the response, so it matches the server's calendar-month/-year arithmetic.
  const first = current.data?.[0]?.cob_date
  const prevEnd = first ? toDateStr(addDays(fromDateStr(first), -1)) : null
  const previous = useQuery({
    queryKey: ['report-data', prevEnd, duration],
    queryFn: () => chartsApi.getReportData(prevEnd!, duration),
    enabled: prevEnd !== null,
  })

  const traces = tracesFor(report, practicesQ.data ?? [], COLORS)
  const entries = current.data ?? []
  const names = new Set(traces.map((t) => t.name))
  const barLayout = report?.definition.Graph.bar_layout ?? 'Grouped'

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
