import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useInsights } from './useInsights'

vi.mock('../../api/charts', () => ({ chartsApi: { getReports: vi.fn(), getSharedReports: vi.fn(), getSharedPractices: vi.fn(), getSharedReportData: vi.fn(), getReportData: vi.fn() } }))
vi.mock('../../api/practices', () => ({ practicesApi: { getGroups: vi.fn().mockResolvedValue([]), getUserPractices: vi.fn() } }))
import { chartsApi } from '../../api/charts'
import { practicesApi } from '../../api/practices'
const charts = vi.mocked(chartsApi)
const practices = vi.mocked(practicesApi)

const GRAPH = { id: 'r1', name: 'Japa', definition: { Graph: { bar_layout: 'Grouped' as const, traces: [
  { label: null, type_: 'Bar' as const, practice: 'p1', y_axis: null, show_average: true },
] } } }
const GRID = { id: 'g1', name: 'Grid', definition: { Grid: { practices: ['p1'] } } }

const PANELS = { id: 'a1', name: 'Sleep', definition: { Panels: { version: 1, template: null, required: [], panels: [] } } }

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return renderHook(() => useInsights(), { wrapper })
}

describe('useInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 9))
    charts.getReports.mockResolvedValue([GRAPH, GRID])
    practices.getUserPractices.mockResolvedValue([{ id: 'p1', practice: 'Japa', data_type: 'Duration', is_active: true }])
    charts.getReportData.mockImplementation(async (cob) =>
      cob === '2026-10-06' ? [{ cob_date: '2026-09-07', practice: 'Japa', value: { Duration: 30 } }] : [])
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear() })

  it('lists Graph reports only and defaults to the first', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.reports.map((r) => r.id)).toEqual(['r1'])
    expect(result.current.selectedId).toBe('r1')
    expect(result.current.traces.map((t) => t.name)).toEqual(['Japa'])
    expect(result.current.noReports).toBe(false)
  })

  it('says when there are no reports', async () => {
    charts.getReports.mockResolvedValue([GRID])
    const { result } = setup()
    await waitFor(() => expect(result.current.noReports).toBe(true))
    expect(result.current.report).toBeNull()
    expect(result.current.traces).toEqual([])
  })

  it.each([true, false])('lists and selects a panels report (withTables %s)', async (withTables) => {
    charts.getReports.mockResolvedValue([GRAPH, GRID, PANELS])
    localStorage.setItem('insights-report', 'a1')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useInsights(undefined, withTables), { wrapper })
    await waitFor(() => expect(result.current.report?.id).toBe('a1'))
    expect(result.current.reports.map((r) => r.id)).toEqual(withTables ? ['g1', 'r1', 'a1'] : ['r1', 'a1'])
    expect(result.current.panels).toEqual(PANELS.definition.Panels)
    expect(result.current.traces).toEqual([])
  })

  it('a shared user defaults to the alphabetically first report', async () => {
    charts.getSharedReports.mockResolvedValue([PANELS, GRAPH])
    charts.getSharedPractices.mockResolvedValue([])
    charts.getSharedReportData.mockResolvedValue([])
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useInsights(undefined, true, 'u1'), { wrapper })
    await waitFor(() => expect(result.current.report?.id).toBe('r1'))
    expect(result.current.reports.map((r) => r.id)).toEqual(['r1', 'a1'])
  })

  it('exposes the previous window’s entries', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await waitFor(() => expect(result.current.previousEntries).toBeDefined())
    expect(result.current.panels).toBeNull()
  })

  it('restores a stored id', async () => {
    localStorage.setItem('insights-report', 'r1')
    const { result } = setup()
    await waitFor(() => expect(result.current.report?.id).toBe('r1'))
    expect(result.current.traces[0].showAverage).toBe(true)
  })

  it.each(['zzz', 'g1', '__all__'])('unknown or Grid id %s falls back to the first report', async (id) => {
    localStorage.setItem('insights-report', id)
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.selectedId).toBe('r1')
  })

  it('writes a selection change to storage', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.select('r1'))
    expect(localStorage.getItem('insights-report')).toBe('r1')
    expect(result.current.selectedId).toBe('r1')
  })

  it('falls back when storage throws, and select still works', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.selectedId).toBe('r1')
    act(() => result.current.select('r1'))
    expect(result.current.selectedId).toBe('r1')
  })

  it('fetches the 30d window ending today, then the previous window ending the day before its first row', async () => {
    setup()
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-09-06', 'Month'))
    expect(charts.getReportData).toHaveBeenCalledWith('2026-10-06', 'Month')
  })

  it('maps the range to the server duration and the end date to a local yyyy-mm-dd', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.setRange('1y'); result.current.setEnd(new Date(2026, 8, 30)) })
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-09-30', 'Year'))
  })

  it('All fetches every day up to the end and skips the previous window', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    vi.clearAllMocks()
    act(() => result.current.setRange('all'))
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-10-06', 'AllData'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(charts.getReportData).toHaveBeenCalledTimes(1)
  })

  it('choosing today clears the end date', async () => {
    const { result } = setup()
    act(() => result.current.setEnd(new Date(2026, 9, 6, 18)))
    expect(result.current.end).toBeNull()
  })

  describe('month panel', () => {
    const MONTH = { id: 'm1', name: 'Days', definition: { Panels: { version: 1, template: null, required: [], panels: [{ kind: 'Month' as const, practice: 'p1' }] } } }
    const setupMonth = async () => {
      charts.getReports.mockResolvedValue([MONTH, PANELS])
      localStorage.setItem('insights-report', 'm1')
      const r = setup()
      await waitFor(() => expect(r.result.current.report?.id).toBe('m1'))
      return r
    }

    it('is null without a month panel', async () => {
      const { result } = setup()
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.month).toBeNull()
    })
    it('asks for half a year ending today in the current month, with no previous window', async () => {
      const { result } = await setupMonth()
      expect(result.current.month).toBe('2026-10')
      await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-10-06', 'HalfYear'))
      // Only the one half-year window: no previous-window fetch.
      await new Promise((r) => setTimeout(r, 20))
      expect(charts.getReportData.mock.calls.filter(([, d]) => d === 'HalfYear')).toHaveLength(1)
      expect(charts.getReportData.mock.calls.every(([cob]) => cob === '2026-10-06')).toBe(true)
    })
    it('a past month ends on its last day', async () => {
      const { result } = await setupMonth()
      act(() => result.current.setMonth('2026-02'))
      expect(result.current.month).toBe('2026-02')
      await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-02-28', 'HalfYear'))
    })
    it('ignores the log date, and select returns to the current month', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      charts.getReports.mockResolvedValue([MONTH, PANELS])
      localStorage.setItem('insights-report', 'm1')
      const { result } = renderHook(() => useInsights(new Date(2026, 8, 3)), { wrapper })
      await waitFor(() => expect(result.current.month).toBe('2026-10'))
      await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-10-06', 'HalfYear'))
      act(() => result.current.setMonth('2026-08'))
      act(() => result.current.select('m1'))
      expect(result.current.month).toBe('2026-10')
    })
  })
})
