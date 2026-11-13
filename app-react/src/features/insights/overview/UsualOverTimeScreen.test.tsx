import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../test/viewport'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { entries, FOUR } from './fixtures'

const today = toDateStr(new Date())
const day = (offset: number) => toDateStr(addDays(fromDateStr(today), offset))
vi.mock('../../../api/markedPeriods', () => ({ useMarkedPeriods: () => ({ periods: [], isLoading: false }) }))
const getReportData = vi.fn()
vi.mock('../../../api/charts', () => ({ chartsApi: { getReports: vi.fn(async () => []), getReportData: (...a: unknown[]) => getReportData(...a) } }))
vi.mock('../../../api/practices', () => ({
  practicesApi: { getUserPractices: vi.fn(async () => FOUR), getIncompleteDays: vi.fn(async () => []), getGroups: vi.fn(async () => []) },
}))
import { UsualOverTime } from './UsualOverTimeScreen'

/** `value(i)` for each day i back from `to` to `from` (inclusive); null skips the day. */
function data(from: number, to = 1, value: (i: number) => Record<string, unknown> = (i) => ({ 'Кругов за день': 16 + (i % 5) })) {
  const days: Record<string, Record<string, unknown>> = {}
  for (let i = from; i >= to; i--) days[day(-i)] = value(i)
  return entries(days)
}
function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter><UsualOverTime /></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390) })
afterEach(() => localStorage.clear())

describe('UsualOverTime', () => {
  it('fetches_all_data_and_draws_a_qualifying_row', async () => {
    getReportData.mockImplementation(async () => data(400))
    show()
    expect(await screen.findByRole('img', { name: /Кругов за день/ })).toBeInTheDocument()
    expect(getReportData).toHaveBeenCalledWith(today, 'AllData')
    expect(screen.getByText(/^Usual now .* · at the start /)).toBeInTheDocument()
  })
  it('short_history_offers_only_all', async () => {
    getReportData.mockImplementation(async () => data(300))
    show()
    await screen.findByRole('img', { name: /Кругов за день/ })
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: '1y' })).not.toBeInTheDocument()
  })
  it('opens_on_2y_and_switches', async () => {
    getReportData.mockImplementation(async () => data(1200))
    show()
    expect(await screen.findByRole('radio', { name: '2y' })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: '3y' }))
    expect(screen.getByRole('radio', { name: '3y' })).toBeChecked()
  })
  it('row_without_history_says_so', async () => {
    getReportData.mockImplementation(async () => data(400, 1, (i) => ({ 'Кругов за день': 16, ...(i <= 60 ? { 'Отбой': { Time: { h: 22, m: 0 } } } : {}) })))
    show()
    await screen.findByRole('img', { name: /Кругов за день/ })
    expect(screen.queryByRole('img', { name: /Отбой/ })).not.toBeInTheDocument()
    expect(screen.getAllByText('Not enough history yet').length).toBeGreaterThan(0)
  })
  it('row_with_no_usual_in_range', async () => {
    getReportData.mockImplementation(async () => data(1100, 800))
    show()
    await screen.findByRole('img', { name: /Кругов за день/ })
    fireEvent.click(screen.getByRole('radio', { name: '1y' }))
    expect(await screen.findByText('No usual in this range')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Кругов за день/ })).not.toBeInTheDocument()
  })
  it('last_usual_when_no_longer_logged', async () => {
    getReportData.mockImplementation(async () => data(1100, 800))
    show()
    expect(await screen.findByText(/^Last usual \d+ · \w+ \d{4}$/)).toBeInTheDocument()
  })
  it('clock_row_shows_times', async () => {
    getReportData.mockImplementation(async () => data(400, 1, () => ({ 'Отбой': { Time: { h: 22, m: 30 } } })))
    show()
    expect(await screen.findByText(/^Usual now 22:30 · at the start 22:30$/)).toBeInTheDocument()
  })
})
