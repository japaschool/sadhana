import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { setViewportWidth } from '../../../test/viewport'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { entries, FOUR } from './fixtures'

const today = toDateStr(new Date())
const day = (offset: number) => toDateStr(addDays(fromDateStr(today), offset))
const T = (h: number, m: number) => ({ Time: { h, m } })
const period = (start: number, end: number): MarkedPeriod => ({ id: 'p1', name: 'Retreat', start_date: day(-start), end_date: day(-end), exclude_from_usual: true })

let current: MarkedPeriod = period(15, 6)
vi.mock('../../../api/markedPeriods', () => ({
  useMarkedPeriods: () => ({ periods: [current], isLoading: false }),
}))
const getReportData = vi.fn()
vi.mock('../../../api/charts', () => ({ chartsApi: { getReports: vi.fn(async () => []), getReportData: (...a: unknown[]) => getReportData(...a) } }))
vi.mock('../../../api/practices', () => ({
  practicesApi: { getUserPractices: vi.fn(async () => FOUR), getIncompleteDays: vi.fn(async () => []), getGroups: vi.fn(async () => []) },
}))
import { PeriodDetail } from './PeriodDetail'

function data() {
  const days: Record<string, Record<string, unknown>> = {}
  for (let i = 90; i >= 1; i--) days[day(-i)] = { 'Подъём': T(4, 20), 'Кругов за день': i <= 15 && i > 5 ? 24 : 16 }
  return entries(days)
}
function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/insights/period/p1']}>
        <Routes><Route path="/insights/period/:id" element={<PeriodDetail />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>)
}

beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); getReportData.mockImplementation(async () => data()); current = period(15, 6) })
afterEach(() => localStorage.clear())

describe('PeriodDetail', () => {
  it('picker_defaults_to_the_most_changed_row', async () => {
    show()
    expect(await screen.findByRole('heading', { name: 'Retreat' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Кругов за день' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Подъём' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Each row')).toBeInTheDocument()
    expect(getReportData).toHaveBeenCalledWith(today, 'Year')
    expect(getReportData).not.toHaveBeenCalledWith(today, 'AllData')
  })

  it('an_old_period_loads_all_data', async () => {
    current = period(300, 290)
    show()
    await waitFor(() => expect(getReportData).toHaveBeenCalledWith(today, 'AllData'))
  })
})
