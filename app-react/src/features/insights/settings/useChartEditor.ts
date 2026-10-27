import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../../api/charts'
import type { GraphReport, PracticeTrace, Report } from '../../../api/charts'
import { practicesApi } from '../../../api/practices'
import { useToast } from '../../../hooks/useToast'
import { buildChartData, tracesFor, type Trace } from '../chartLogic'
import type { UserPractice } from '../../../types/api'
import { toDateStr } from '../../today/date'
import { assignAxes, type Axis } from '../axes'
import { averageLines } from '../insightsLogic'
import { COLORS } from '../useInsights'

/** A graph series with the practice it plots; archived and deleted practices are kept but not drawn. */
export interface Series {
  trace: PracticeTrace
  index: number
  practice?: UserPractice
  state: 'ok' | 'archived' | 'deleted'
  color: string
  /** Its axis, for drawn series. */
  axis?: Axis
}

export const graphOf = (r: Report): GraphReport | null => ('Graph' in r.definition ? r.definition.Graph : null)

/**
 * One chart being edited. Every change shows at once and saves the whole report; saves go one at a time and the
 * latest wins. A failed save keeps the edits here (not in the cache) and tries again when back online or on retry().
 */
export function useChartEditor(id: string) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const reportsQ = useQuery({ queryKey: ['reports'], queryFn: chartsApi.getReports })
  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const todayCob = toDateStr(new Date())
  // The same query as Insights' default 30 days, so the preview is usually cached already.
  const dataQ = useQuery({ queryKey: ['report-data', todayCob, 'Month'], queryFn: () => chartsApi.getReportData(todayCob, 'Month') })

  // ponytail: edits not yet saved live in memory only; they're lost if the app is closed while offline.
  const [draft, setDraft] = useState<Report | null>(null)
  // Tablet and desktop keep the editor mounted while another chart is picked; a draft is only for its own chart.
  const report = (draft?.id === id ? draft : null) ?? reportsQ.data?.find((r) => r.id === id) ?? null
  const latest = useRef(report)
  latest.current = report
  const [failed, setFailed] = useState(false)
  const pending = useRef<Report | null>(null)
  /** What the next send confirms: its toast, and the chart before the changes it carries (for Undo). */
  const batch = useRef<{ prev: Report; message: string; undoable: boolean } | null>(null)
  const sending = useRef(false)

  async function pump() {
    if (sending.current) return
    sending.current = true
    while (pending.current) {
      const r = pending.current
      const b = batch.current!
      pending.current = null
      batch.current = null
      try {
        await chartsApi.updateReport(r.id, r.name, r.definition)
        qc.setQueryData<Report[]>(['reports'], (list) => list?.map((x) => (x.id === r.id ? r : x)))
      } catch {
        pending.current ??= r
        // Changes made meanwhile join this batch, so Undo still goes back to before all of them.
        batch.current = { ...(batch.current ?? b), prev: b.prev }
        sending.current = false
        setFailed(true)
        return
      }
      // As in yatra settings: a toast once saved, with Undo.
      // ponytail: Undo restores the chart as it was before this save, dropping edits made since; it's the newest toast, so rarely any.
      showToast({
        message: b.message, variant: 'success',
        action: b.undoable ? { label: t('common.undo'), onClick: () => update(() => b.prev, t('yatraSettings.undone'), false) } : undefined,
      })
    }
    sending.current = false
    setFailed(false)
  }

  function update(change: (r: Report) => Report, message = t('common.saved'), undoable = true) {
    if (!latest.current) return
    const prev = latest.current
    const next = change(prev)
    batch.current = { prev: batch.current?.prev ?? prev, message, undoable }
    latest.current = next
    setDraft(next)
    pending.current = next
    setFailed(false)
    void pump()
  }

  const retry = () => {
    if (!pending.current) return
    setFailed(false)
    void pump()
  }
  const retryRef = useRef(retry)
  retryRef.current = retry
  useEffect(() => {
    const online = () => retryRef.current()
    window.addEventListener('online', online)
    return () => window.removeEventListener('online', online)
  }, [])

  const setTraces = (change: (traces: PracticeTrace[]) => PracticeTrace[], message?: string) =>
    update((r) => ('Graph' in r.definition ? { ...r, definition: { Graph: { ...r.definition.Graph, traces: change(r.definition.Graph.traces) } } } : r), message)

  const removeSeries = (index: number) => setTraces((ts) => ts.filter((_, i) => i !== index), t('chartSettings.seriesRemoved'))

  const remove = useMutation({
    mutationFn: () => chartsApi.deleteReport(id),
    onSuccess: () => qc.setQueryData<Report[]>(['reports'], (list) => list?.filter((r) => r.id !== id)),
    onError: () => showToast({ message: t('common.error'), variant: 'error' }),
  })

  const turnBackOn = useMutation({
    mutationFn: (p: UserPractice) => practicesApi.updateUserPractice(p.id, {
      practice: p.practice, data_type: p.data_type, is_active: true,
      is_required: p.is_required || undefined, dropdown_variants: p.dropdown_variants || undefined,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practices'] }),
    onError: () => showToast({ message: t('common.error'), variant: 'error' }),
  })

  const practices = practicesQ.data ?? []
  const byId = new Map(practices.map((p) => [p.id, p]))
  const graph = report && graphOf(report)
  const all = report ? tracesFor(report, practices, COLORS) : []
  const series: Series[] = (graph?.traces ?? []).map((trace, index) => {
    const practice = byId.get(trace.practice)
    return { trace, index, practice, state: !practice ? 'deleted' : practice.is_active ? 'ok' : 'archived', color: all[index].color }
  })
  const drawn = series.filter((s) => s.state === 'ok')
  // A table draws its active columns.
  const traces: Trace[] = graph
    ? drawn.map((s) => all[s.index])
    : all.filter((tr) => practices.some((p) => p.practice === tr.name && p.is_active))
  if (graph) assignAxes(traces).forEach((a, i) => { drawn[i].axis = a })
  const entries = dataQ.data ?? []

  return {
    report, reports: reportsQ.data ?? [], graph, practices, series, traces, failed, retry, update, setTraces, removeSeries, remove, turnBackOn, todayCob,
    entries,
    rows: buildChartData(entries, traces, i18n.language || 'en'),
    averages: graph ? averageLines(traces, entries, graph.bar_layout, todayCob) : [],
    dataLoading: dataQ.isLoading,
    isLoading: reportsQ.isLoading || practicesQ.isLoading,
    isError: reportsQ.isError || practicesQ.isError,
  }
}
