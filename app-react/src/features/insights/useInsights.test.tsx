import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useInsights, ALL } from './useInsights'

vi.mock('../../api/charts', () => ({ chartsApi: { getReports: vi.fn(), getReportData: vi.fn() } }))
vi.mock('../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
import { chartsApi } from '../../api/charts'
import { practicesApi } from '../../api/practices'
const charts = vi.mocked(chartsApi)
const practices = vi.mocked(practicesApi)

const GRAPH = { id: 'r1', name: 'Japa', definition: { Graph: { bar_layout: 'Grouped' as const, traces: [
  { label: null, type_: 'Bar' as const, practice: 'p1', y_axis: null, show_average: true },
] } } }
const GRID = { id: 'g1', name: 'Grid', definition: { Grid: { practices: ['p1'] } } }

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

  it('lists Graph reports only and defaults to All practices', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.reports.map((r) => r.id)).toEqual(['r1'])
    expect(result.current.selectedId).toBe(ALL)
    expect(result.current.traces.map((t) => t.name)).toEqual(['Japa'])
  })

  it('restores a stored id', async () => {
    localStorage.setItem('insights-report', 'r1')
    const { result } = setup()
    await waitFor(() => expect(result.current.report?.id).toBe('r1'))
    expect(result.current.traces[0].showAverage).toBe(true)
  })

  it.each(['zzz', 'g1'])('unknown or Grid id %s falls back to All practices', async (id) => {
    localStorage.setItem('insights-report', id)
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.selectedId).toBe(ALL)
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
    expect(result.current.selectedId).toBe(ALL)
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
})
