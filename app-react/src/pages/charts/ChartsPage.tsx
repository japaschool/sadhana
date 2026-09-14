import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FaPlus, FaChartLine, FaTrash, FaTh } from 'react-icons/fa'
import { LuCopy, LuCheck, LuChevronDown, LuChevronUp, LuX, LuChartLine, LuDownload } from 'react-icons/lu'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { chartsApi } from '../../api/charts'
import type { Report, ReportDefinition, TraceType, PracticeTrace, ReportDuration, GraphReport, BarLayout, ReportDataEntry } from '../../api/charts'
import { practicesApi } from '../../api/practices'
import { Spinner } from '../../components/ui/Spinner'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useAuthStore } from '../../store/authStore'
import type { UserPractice, PracticeDataType } from '../../types/api'
import {
  buildChartData,
  axisKindFor,
  averageForType,
  formatMinutesAsHHMM,
  type ChartDataRow,
} from './chartLogic'
import { ACCENT, ACCENT_GRADIENT, BORDER, SURFACE_PANEL, TEXT, TEXT_MUTED } from '../../theme/tokens'

const glass: React.CSSProperties = {
  background: SURFACE_PANEL,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
}
const TRACE_COLORS = [
  '#5eead4', // teal
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#38bdf8', // sky
  '#f472b6', // pink
  '#34d399', // emerald
  '#fb923c', // orange
  '#c4b5fd', // light violet
]

const DURATIONS: { label: string; value: ReportDuration }[] = [
  { label: '1W', value: 'Week' },
  { label: '1M', value: 'Month' },
  { label: '3M', value: 'Quarter' },
  { label: '6M', value: 'HalfYear' },
  { label: '1Y', value: 'Year' },
  { label: 'All', value: 'AllData' },
]

const ALL_PRACTICES_ID = '__all__'

export function toCSV(entries: ReportDataEntry[], practiceMap: Record<string, string>): string {
  const header = ['date', 'practice', 'value'].join(',')
  const rows = entries.map(e => {
    const name = (practiceMap[e.practice] ?? e.practice).replace(/,/g, ' ')
    const val = csvValueToNumber(e.value)
    return [e.cob_date, name, val === null ? '' : String(val)].join(',')
  })
  return [header, ...rows].join('\n')
}

export function triggerCSVDownload(csv: string) {
  const bom = '﻿'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'data.csv'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function isGrid(def: ReportDefinition): def is { Grid: { practices: string[] } } {
  return 'Grid' in def
}

function traceLabel(type_: TraceType): string {
  if (type_ === 'Bar') return 'Bar'
  if (type_ === 'Dot') return 'Dot'
  if (typeof type_ === 'object' && 'Line' in type_) return 'Line'
  return '?'
}

/** Simple type-agnostic value extractor used only by toCSV (no data_type context). */
function csvValueToNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'boolean') return raw ? 1 : 0
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if ('Int' in obj) return obj.Int as number
    if ('Bool' in obj) return (obj.Bool as boolean) ? 1 : 0
    if ('Duration' in obj) return obj.Duration as number
    if ('Time' in obj) {
      const t = obj.Time as { h: number; m: number }
      return t.h * 60 + t.m
    }
  }
  return null
}

// ─── Main chart panel ───────────────────────────────────────────────────────

interface ChartPanelProps {
  report: Report | null  // null = show all practices
  practices: UserPractice[]
  practiceMap: Record<string, string>
  chartHeight?: number
}

function ChartPanel({ report, practices, practiceMap, chartHeight = 290 }: ChartPanelProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const [duration, setDuration] = useState<ReportDuration>('Month')
  const [selectedPractice, setSelectedPractice] = useState<string | null>(null)
  const todayCob = new Date().toISOString().slice(0, 10)

  const { data: rawValues = [], isLoading, isFetching } = useQuery({
    queryKey: ['report-data', todayCob, duration],
    queryFn: () => chartsApi.getReportData(todayCob, duration),
  })

  // Reset filter when switching reports
  useEffect(() => { setSelectedPractice(null) }, [report])

  // Build traces for "all practices" (every active practice as a Line)
  const activePractices = practices.filter(p => p.is_active)

  const byId = new Map(practices.map((p) => [p.id, p]))

  const traces: { name: string; type_: TraceType; color: string; dataType: PracticeDataType; showAverage: boolean; yAxis: string | null }[] =
    report === null
      ? activePractices.map((p, i) => ({
          name: p.practice,
          type_: { Line: { style: 'Regular' as const } },
          color: TRACE_COLORS[i % TRACE_COLORS.length],
          dataType: p.data_type,
          showAverage: false,
          yAxis: null,
        }))
      : isGrid(report.definition)
        ? report.definition.Grid.practices.map((pid, i) => ({
            name: practiceMap[pid] ?? pid,
            type_: { Line: { style: 'Regular' as const } } as TraceType,
            color: TRACE_COLORS[i % TRACE_COLORS.length],
            dataType: byId.get(pid)?.data_type ?? 'Int',
            showAverage: false,
            yAxis: null,
          }))
        : report.definition.Graph.traces.map((t, i) => ({
            name: practiceMap[t.practice] ?? t.practice,
            type_: t.type_,
            color: TRACE_COLORS[i % TRACE_COLORS.length],
            dataType: byId.get(t.practice)?.data_type ?? 'Int',
            showAverage: t.show_average,
            yAxis: t.y_axis,
          }))

  const visibleTraces = selectedPractice
    ? traces.filter(t => t.name === selectedPractice)
    : traces

  const practiceNames = visibleTraces.map(t => t.name)
  const chartData = buildChartData(
    rawValues as { cob_date: string; practice: string; value: unknown }[],
    visibleTraces.map((t) => ({ name: t.name, dataType: t.dataType })),
    locale,
  )
  const isGridReport = report !== null && isGrid(report.definition)

  function resolveAxisId(yAxis: string | null, dataType: PracticeDataType): string {
    if (yAxis === 'Y2' && axisKindFor(dataType) === 'num') return 'num-right'
    return axisKindFor(dataType)
  }

  const usedAxes = new Set(visibleTraces.map((t) => resolveAxisId(t.yAxis, t.dataType)))
  const numAxisAllDuration =
    visibleTraces.filter((t) => ['num', 'num-right'].includes(resolveAxisId(t.yAxis, t.dataType)))
      .every((t) => t.dataType === 'Duration') &&
    visibleTraces.some((t) => ['num', 'num-right'].includes(resolveAxisId(t.yAxis, t.dataType)))

  const averages = visibleTraces
    .filter((t) => t.showAverage)
    .map((t) => {
      const entries = rawValues.filter((e: { practice: string }) => e.practice === t.name)
      const avg = averageForType(entries as { cob_date: string; value: unknown }[], t.dataType, todayCob)
      return avg === null ? null : { axis: resolveAxisId(t.yAxis, t.dataType), value: avg, color: t.color }
    })
    .filter((a): a is { axis: string; value: number; color: string } => a !== null)

  async function handleDownload() {
    const entries = await chartsApi.getReportData(todayCob, duration)
    triggerCSVDownload(toCSV(entries, practiceMap))
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={glass}>
      {/* Duration strip */}
      <div className="px-4 pt-3 pb-2 flex gap-1.5 flex-wrap items-center" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <span className="text-xs font-semibold text-base-content/70 mr-1">{t('charts.duration')}</span>
        {DURATIONS.map(d => (
          <button
            key={d.value}
            onClick={() => setDuration(d.value)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: duration === d.value ? ACCENT : 'rgba(255,255,255,0.06)',
              color: duration === d.value ? 'white' : 'rgba(242,244,246,0.65)',
              border: duration === d.value ? 'none' : `1px solid ${BORDER}`,
            }}
          >
            {d.label}
          </button>
        ))}
        {report !== null && (
          <button
            onClick={handleDownload}
            title={t('charts.download')}
            className="ml-auto h-7 px-2.5 flex items-center gap-1 rounded-lg text-xs font-semibold flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(242,244,246,0.65)', border: 'none' }}
          >
            <LuDownload className="w-3.5 h-3.5" />
            {t('charts.download')}
          </button>
        )}
      </div>

      {/* Chart body */}
      <div className="px-2 py-4 relative">
        {isFetching && !isLoading && (
          <div
            className="absolute inset-0 rounded-2xl flex items-center justify-center z-10"
            style={{ background: 'rgba(39,54,86,0.65)', backdropFilter: 'blur(4px)' }}
          >
            <span className="loading loading-spinner loading-md" style={{ color: ACCENT }} />
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : chartData.length === 0 || practiceNames.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2">
            <p className="text-sm text-base-content/70">{t('charts.noData')}</p>
          </div>
        ) : isGridReport ? (
          <GridTable chartData={chartData} practiceNames={practiceNames} />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.15)"
                tick={{ fontSize: 10, fill: 'rgba(238,243,248,0.55)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              {usedAxes.has('num') && (
                <YAxis
                  yAxisId="num"
                  orientation="left"
                  domain={[0, 'auto']}
                  stroke="rgba(255,255,255,0.15)"
                  tick={{ fontSize: 10, fill: 'rgba(238,243,248,0.55)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (numAxisAllDuration ? `${v} min` : String(v))}
                />
              )}
              {usedAxes.has('num-right') && (
                <YAxis
                  yAxisId="num-right"
                  orientation="right"
                  domain={[0, 'auto']}
                  stroke="rgba(255,255,255,0.15)"
                  tick={{ fontSize: 10, fill: 'rgba(238,243,248,0.55)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (numAxisAllDuration ? `${v} min` : String(v))}
                />
              )}
              {usedAxes.has('time') && (
                <YAxis
                  yAxisId="time"
                  orientation="right"
                  stroke="rgba(255,255,255,0.15)"
                  tick={{ fontSize: 10, fill: 'rgba(238,243,248,0.55)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatMinutesAsHHMM}
                />
              )}
              {usedAxes.has('unit') && (
                <YAxis yAxisId="unit" hide domain={[0, 1.1]} />
              )}
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 10, background: '#151d27', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', color: '#eef3f8' }}
                labelStyle={{ color: '#eef3f8' }}
                itemStyle={{ color: '#eef3f8' }}
              />
              <Legend
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: 11, paddingTop: 8, cursor: traces.length > 1 ? 'pointer' : 'default', color: '#eef3f8' }}
                onClick={(data) => {
                  if (traces.length <= 1) return
                  const name = data.value as string
                  setSelectedPractice(prev => prev === name ? null : name)
                }}
                formatter={(value) => (
                  <span style={{ color: selectedPractice && selectedPractice !== value ? 'rgba(238,243,248,0.35)' : '#eef3f8' }}>
                    {value}
                  </span>
                )}
              />
              {visibleTraces.map(({ name, type_, color, dataType, yAxis }) => {
                const yAxisId = resolveAxisId(yAxis, dataType)
                const label = traceLabel(type_)
                if (label === 'Bar') {
                  return <Bar key={name} yAxisId={yAxisId} dataKey={name} fill={color} fillOpacity={0.35} radius={[2, 2, 0, 0]} maxBarSize={20} />
                }
                if (label === 'Dot') {
                  return (
                    <Line key={name} yAxisId={yAxisId} type="monotone" dataKey={name} stroke="none" strokeWidth={0}
                      dot={{ r: 4, fill: color, strokeWidth: 0, fillOpacity: 0.8 }} activeDot={{ r: 5, fill: color }} name={name} />
                  )
                }
                const isSquare = typeof type_ === 'object' && 'Line' in type_ && type_.Line.style === 'Square'
                return (
                  <Line key={name} yAxisId={yAxisId} type={isSquare ? 'stepAfter' : 'natural'} dataKey={name}
                    stroke={color} strokeOpacity={0.85} strokeWidth={2}
                    dot={{ r: 2.5, fill: color, strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls name={name} />
                )
              })}
              {averages.map((a, i) => (
                <ReferenceLine
                  key={`avg-${i}`}
                  yAxisId={a.axis}
                  y={a.value}
                  stroke={a.color}
                  strokeDasharray="6 4"
                  strokeOpacity={0.8}
                  ifOverflow="extendDomain"
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function GridTable({ chartData, practiceNames }: { chartData: ChartDataRow[]; practiceNames: string[] }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const fmt = (cob: string) =>
    new Date(cob + 'T00:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th className="text-left px-2 py-1.5 font-semibold" style={{ color: 'rgba(242,244,246,0.7)', borderBottom: `1px solid ${BORDER}` }}>{t('charts.date')}</th>
            {practiceNames.map((name) => (
              <th key={name} className="text-right px-2 py-1.5 font-semibold" style={{ color: 'rgba(242,244,246,0.7)', borderBottom: `1px solid ${BORDER}` }}>
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chartData.map((row, i) => (
            <tr key={row.cob} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
              <td className="px-2 py-1.5 text-base-content/60 whitespace-nowrap">{fmt(row.cob)}</td>
              {practiceNames.map((name) => (
                <td key={name} className="px-2 py-1.5 text-right text-base-content/80">
                  {row[name] == null ? '—' : String(row[name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Report picker dropdown ──────────────────────────────────────────────────

function ReportPicker({
  reports,
  selectedId,
  onSelect,
}: {
  reports: Report[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [])

  const selectedLabel = selectedId === ALL_PRACTICES_ID
    ? t('charts.allPractices')
    : reports.find(r => r.id === selectedId)?.name ?? t('charts.allPractices')

  const options = [
    { id: ALL_PRACTICES_ID, label: t('charts.allPractices'), icon: <FaChartLine className="w-3.5 h-3.5" /> },
    ...reports.map(r => ({
      id: r.id,
      label: r.name,
      icon: isGrid(r.definition)
        ? <FaTh className="w-3.5 h-3.5" />
        : <FaChartLine className="w-3.5 h-3.5" />,
    })),
  ]

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: 200 }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="h-9 px-3 flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-all"
        style={{
          background: 'rgba(255,255,255,0.05)',
          color: TEXT,
          border: 'none',
          maxWidth: 150,
        }}
      >
        <LuChartLine className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} />
        <span className="truncate">{selectedLabel}</span>
        {open ? <LuChevronUp className="w-3 h-3 flex-shrink-0 ml-0.5" /> : <LuChevronDown className="w-3 h-3 flex-shrink-0 ml-0.5" />}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-2xl overflow-hidden min-w-44"
          style={{ ...glass, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', zIndex: 9999 }}
        >
          {options.map((opt, i) => (
            <button
              key={opt.id}
              onClick={() => { onSelect(opt.id); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm transition-colors"
              style={{
                background: selectedId === opt.id ? 'rgba(245,158,11,0.06)' : 'transparent',
                color: selectedId === opt.id ? ACCENT : TEXT,
                border: 'none',
                borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`,
                fontWeight: selectedId === opt.id ? 600 : 400,
              }}
            >
              <span style={{ color: selectedId === opt.id ? ACCENT : 'rgba(242,244,246,0.7)' }}>{opt.icon}</span>
              <span className="truncate">{opt.label}</span>
              {selectedId === opt.id && <LuCheck className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Manage report card ──────────────────────────────────────────────────────

function ReportCard({
  report,
  practiceMap,
  practices,
}: {
  report: Report
  practiceMap: Record<string, string>
  practices: UserPractice[]
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [addPracticeId, setAddPracticeId] = useState('')
  const [addTraceType, setAddTraceType] = useState<'Line' | 'Bar' | 'Dot'>('Line')
  const isGridType = isGrid(report.definition)

  const [localName, setLocalName] = useState(report.name)
  useEffect(() => { setLocalName(report.name) }, [report.name])

  const renameMutation = useMutation({
    mutationFn: (name: string) => chartsApi.updateReport(report.id, name, report.definition),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  function changeTrace(practice: string, patch: Partial<PracticeTrace>) {
    if (isGrid(report.definition)) return
    const traces = report.definition.Graph.traces.map(t =>
      t.practice === practice ? { ...t, ...patch } : t
    )
    updateMutation.mutate({ Graph: { ...report.definition.Graph, traces } })
  }

  function changeBarLayout(bar_layout: BarLayout) {
    if (isGrid(report.definition)) return
    updateMutation.mutate({ Graph: { ...report.definition.Graph, bar_layout } })
  }

  function traceTypeValue(type_: TraceType): 'Line' | 'Bar' | 'Dot' {
    if (type_ === 'Bar') return 'Bar'
    if (type_ === 'Dot') return 'Dot'
    return 'Line'
  }

  function typeFromSelect(v: string): TraceType {
    if (v === 'Bar') return 'Bar'
    if (v === 'Dot') return 'Dot'
    return { Line: { style: 'Regular' } }
  }

  const updateMutation = useMutation({
    mutationFn: (def: ReportDefinition) => chartsApi.updateReport(report.id, report.name, def),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  function removeItem(itemId: string) {
    let newDef: ReportDefinition
    if (isGrid(report.definition)) {
      newDef = { Grid: { practices: report.definition.Grid.practices.filter(p => p !== itemId) } }
    } else {
      newDef = { Graph: { ...report.definition.Graph, traces: report.definition.Graph.traces.filter(t => t.practice !== itemId) } }
    }
    updateMutation.mutate(newDef)
  }

  function addItem() {
    if (!addPracticeId) return
    let newDef: ReportDefinition
    if (isGrid(report.definition)) {
      if (report.definition.Grid.practices.includes(addPracticeId)) return
      newDef = { Grid: { practices: [...report.definition.Grid.practices, addPracticeId] } }
    } else {
      if (report.definition.Graph.traces.some(t => t.practice === addPracticeId)) return
      const type_: TraceType = addTraceType === 'Line'
        ? { Line: { style: 'Regular' } }
        : addTraceType === 'Bar' ? 'Bar' : 'Dot'
      const newTrace: PracticeTrace = { label: null, type_, practice: addPracticeId, y_axis: null, show_average: true }
      newDef = { Graph: { ...report.definition.Graph, traces: [...report.definition.Graph.traces, newTrace] } }
    }
    updateMutation.mutate(newDef)
    setAddPracticeId('')
  }

  const currentIds = isGrid(report.definition)
    ? report.definition.Grid.practices
    : report.definition.Graph.traces.map(t => t.practice)
  const currentTraces = isGrid(report.definition) ? [] : report.definition.Graph.traces

  return (
    <div className="rounded-2xl overflow-hidden" style={glass}>
      <div className="px-4 py-3 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: isGridType ? 'rgba(99,102,241,0.10)' : 'rgba(245,158,11,0.10)' }}
        >
          {isGridType
            ? <FaTh className="w-3.5 h-3.5" style={{ color: '#6366f1' }} />
            : <FaChartLine className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-base-content truncate">{report.name}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(242,244,246,0.7)' }}>
            {t(isGridType ? 'charts.kindGrid' : 'charts.kindGraph')} · {t('charts.practiceCount', { count: currentIds.length })}
          </p>
        </div>
        <button
          onClick={() => (document.getElementById(`del-report-${report.id}`) as HTMLDialogElement)?.showModal()}
          className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(225,29,72,0.07)', color: 'rgba(225,29,72,0.55)', border: 'none' }}
        >
          <FaTrash className="w-3 h-3" />
        </button>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.05)', color: 'rgba(242,244,246,0.65)', border: 'none' }}
        >
          {open ? <LuChevronUp className="w-4 h-4" /> : <LuChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${BORDER}` }}>

          {/* Report name input */}
          <div className="px-4 pt-3 pb-1">
            <label className="text-xs text-base-content/70 block mb-1">{t('charts.reportName')}</label>
            <input
              type="text"
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              onBlur={() => { if (localName.trim() && localName !== report.name) renameMutation.mutate(localName.trim()) }}
              className="w-full text-sm font-semibold text-base-content rounded-xl px-3 h-9 outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}` }}
            />
          </div>

          {/* Bar layout (Graph only) */}
          {!isGridType && (
            <div className="px-4 pb-2">
              <label className="text-xs text-base-content/70 block mb-1">{t('charts.barLayout')}</label>
              <select
                value={(report.definition as { Graph: GraphReport }).Graph.bar_layout}
                onChange={e => changeBarLayout(e.target.value as BarLayout)}
                className="w-full text-sm text-base-content rounded-xl px-3 h-9 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}` }}
              >
                <option value="Grouped">{t('charts.barLayoutGrouped')}</option>
                <option value="Stacked">{t('charts.barLayoutStacked')}</option>
                <option value="Overlaid">{t('charts.barLayoutOverlaid')}</option>
              </select>
            </div>
          )}

          {/* Trace / practice list */}
          {currentIds.length > 0 ? (
            <div className="px-4 py-2 flex flex-col gap-2" style={{ borderTop: `1px solid ${BORDER}` }}>
              {isGrid(report.definition)
                ? report.definition.Grid.practices.map(pid => (
                    <div key={pid} className="flex items-center gap-2 py-0.5">
                      <span className="flex-1 text-xs text-base-content/80">{practiceMap[pid] ?? pid}</span>
                      <button onClick={() => removeItem(pid)} className="w-5 h-5 flex items-center justify-center rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(242,244,246,0.7)', border: 'none' }}>
                        <LuX className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                : currentTraces.map(trace => (
                    <div key={trace.practice} className="flex flex-col gap-1 py-1" style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <div className="flex items-center gap-2">
                        {/* Type select */}
                        <select
                          value={traceTypeValue(trace.type_)}
                          onChange={e => changeTrace(trace.practice, { type_: typeFromSelect(e.target.value) })}
                          className="text-xs rounded-lg px-2 h-6 outline-none flex-shrink-0"
                          style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: TEXT }}
                        >
                          <option value="Line">{t('charts.traceLine')}</option>
                          <option value="Bar">{t('charts.traceBar')}</option>
                          <option value="Dot">{t('charts.traceDot')}</option>
                        </select>
                        <span className="flex-1 text-xs font-semibold text-base-content">{practiceMap[trace.practice] ?? trace.practice}</span>
                        <button onClick={() => removeItem(trace.practice)} className="w-5 h-5 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(242,244,246,0.7)', border: 'none' }}>
                          <LuX className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 pl-1">
                        {/* Custom label */}
                        <input
                          key={trace.practice + '-label'}
                          type="text"
                          defaultValue={trace.label ?? ''}
                          onBlur={e => changeTrace(trace.practice, { label: e.target.value.trim() || null })}
                          placeholder={t('charts.traceCustomLabel')}
                          className="flex-1 text-xs rounded-lg px-2 h-6 outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: TEXT }}
                        />
                        {/* Show average */}
                        <label className="flex items-center gap-1 text-xs text-base-content/60 flex-shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={trace.show_average}
                            onChange={e => changeTrace(trace.practice, { show_average: e.target.checked })}
                            className="w-3 h-3 rounded"
                            style={{ accentColor: ACCENT }}
                          />
                          {t('charts.showAverage')}
                        </label>
                        {/* Y-axis override */}
                        <select
                          value={trace.y_axis ?? ''}
                          onChange={e => changeTrace(trace.practice, { y_axis: e.target.value === '' ? null : e.target.value })}
                          className="text-xs rounded-lg px-2 h-6 outline-none flex-shrink-0"
                          style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: TEXT }}
                          aria-label={t('charts.yAxis')}
                          title={t('charts.yAxis')}
                        >
                          <option value="">{t('charts.yAxisAuto')}</option>
                          <option value="Y2">{t('charts.yAxisRight')}</option>
                        </select>
                      </div>
                    </div>
                  ))
              }
            </div>
          ) : (
            <p className="px-4 py-2 text-xs text-base-content/70">{t('charts.noPracticesAdded')}</p>
          )}

          {/* Add practice row — unchanged */}
          <div className="px-4 pb-3 flex items-center gap-2" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '0.625rem' }}>
            <select
              value={addPracticeId}
              onChange={e => setAddPracticeId(e.target.value)}
              className="flex-1 text-sm rounded-xl px-3 h-9 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: addPracticeId ? TEXT : TEXT_MUTED }}
            >
              <option value="">{t('charts.addPractice')}</option>
              {practices.filter(p => p.is_active && !currentIds.includes(p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.practice}</option>
              ))}
            </select>
            {!isGridType && (
              <select
                value={addTraceType}
                onChange={e => setAddTraceType(e.target.value as 'Line' | 'Bar' | 'Dot')}
                className="text-sm rounded-xl px-2 h-9 focus:outline-none flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: TEXT }}
              >
                <option value="Line">{t('charts.traceLine')}</option>
                <option value="Bar">{t('charts.traceBar')}</option>
                <option value="Dot">{t('charts.traceDot')}</option>
              </select>
            )}
            <button
              onClick={addItem}
              disabled={!addPracticeId || updateMutation.isPending}
              className="h-9 px-4 rounded-xl text-sm font-semibold flex-shrink-0"
              style={{ background: ACCENT_GRADIENT, color: 'white', border: 'none', opacity: addPracticeId ? 1 : 0.4 }}
            >
              {t('charts.add')}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        id={`del-report-${report.id}`}
        title={t('charts.deleteTitle')}
        message={t('charts.deleteMsg', { name: report.name })}
        confirmLabel={t('common.delete')}
        onConfirm={() => chartsApi.deleteReport(report.id).then(() => qc.invalidateQueries({ queryKey: ['reports'] }))}
      />
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function ChartsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const { data: reports = [], isLoading: reportsLoading } = useQuery({ queryKey: ['reports'], queryFn: chartsApi.getReports })
  const { data: practices = [] } = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const [selectedId, setSelectedId] = useState(ALL_PRACTICES_ID)
  const [shareCopied, setShareCopied] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const practiceMap = Object.fromEntries(practices.map(p => [p.id, p.practice]))
  const selectedReport = selectedId === ALL_PRACTICES_ID ? null : (reports.find(r => r.id === selectedId) ?? null)

  function copyShareLink() {
    if (!user) return
    navigator.clipboard.writeText(`${window.location.origin}/shared/${user.id}`)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 3000)
  }

  if (reportsLoading) return <Spinner />

  return (
    <>
      <div className={embedded ? 'flex flex-col gap-3' : 'px-4 py-6 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-3 pb-24 sm:pb-8'}>
        {/* Header — z-index needed so ReportPicker dropdown appears above the chart panel */}
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3" style={{ ...glass, position: 'relative', zIndex: 100 }}>
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: ACCENT_GRADIENT, boxShadow: '0 4px 16px rgba(245,158,11,0.30)' }}
          >
            <FaChartLine className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block min-w-0 flex-1">
            <h1 className="text-base font-bold font-serif text-base-content leading-tight">{t('charts.title')}</h1>
          </div>
          {/* Report picker */}
          <ReportPicker reports={reports} selectedId={selectedId} onSelect={setSelectedId} />
          {/* Share */}
          <button
            onClick={copyShareLink}
            className="h-9 px-3 flex items-center gap-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
            style={{ background: shareCopied ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.06)', color: shareCopied ? ACCENT : 'rgba(242,244,246,0.65)', border: 'none' }}
          >
            {shareCopied ? <LuCheck className="w-3.5 h-3.5" /> : <LuCopy className="w-3.5 h-3.5" />}
            {shareCopied ? t('charts.copied') : t('charts.share')}
          </button>
        </div>

        {/* Chart panel */}
        <ChartPanel
          report={selectedReport}
          practices={practices}
          practiceMap={practiceMap}
          chartHeight={embedded ? 520 : 290}
        />

        {/* Manage reports section */}
        {reports.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={glass}>
            <button
              onClick={() => setManageOpen(o => !o)}
              className="w-full px-4 py-3 flex items-center gap-2 text-left"
              style={{ background: 'transparent', border: 'none' }}
            >
              <span className="text-xs font-semibold text-base-content/70 flex-1">{t('charts.manage')} ({reports.length})</span>
              {manageOpen ? <LuChevronUp className="w-4 h-4 text-base-content/70" /> : <LuChevronDown className="w-4 h-4 text-base-content/70" />}
            </button>
            <AnimatePresence>
              {manageOpen && (
                <motion.div
                  key="manage-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    {reports.map(r => (
                      <ReportCard key={r.id} report={r} practiceMap={practiceMap} practices={practices} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {reports.length === 0 && (
          <div
            className="rounded-2xl px-5 py-12 flex flex-col items-center gap-5"
            style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${BORDER}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.08)' }}
            >
              <LuChartLine className="w-6 h-6" style={{ color: ACCENT }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-base-content">{t('charts.emptyTitle')}</p>
              <p className="text-xs text-base-content/60 mt-1">{t('charts.emptySubtitle')}</p>
            </div>
            <Link
              to="/charts/new"
              className="px-6 h-11 rounded-full text-sm font-semibold flex items-center gap-2"
              style={{
                background: ACCENT_GRADIENT,
                color: 'white',
                textDecoration: 'none',
                boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
              }}
            >
              {t('charts.create')}
            </Link>
          </div>
        )}
      </div>

      {!embedded && (
        <Link
          to="/charts/new"
          aria-label="New report"
          className="fixed sm:bottom-6 right-4 z-30 w-14 h-14 rounded-full hidden sm:flex items-center justify-center"
          style={{ background: ACCENT_GRADIENT, boxShadow: '0 4px 24px rgba(245,158,11,0.45)' }}
        >
          <FaPlus className="w-5 h-5 text-white" />
        </Link>
      )}
    </>
  )
}
