import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { setViewportWidth } from '../../../test/viewport'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { entries, FOUR } from './fixtures'
import { mondayOf } from './yearMap'

const today = toDateStr(new Date())
const day = (offset: number) => toDateStr(addDays(fromDateStr(today), offset))
const periods: MarkedPeriod[] = [{ id: 'p1', name: 'Retreat', start_date: day(-40), end_date: day(-20), exclude_from_usual: true }]
vi.mock('../../../api/markedPeriods', () => ({ useMarkedPeriods: () => ({ periods, isLoading: false }) }))
const getReportData = vi.fn()
const getUserPractices = vi.fn()
vi.mock('../../../api/charts', () => ({ chartsApi: { getReports: vi.fn(async () => []), getReportData: (...a: unknown[]) => getReportData(...a) } }))
vi.mock('../../../api/practices', () => ({
  practicesApi: { getUserPractices: (...a: unknown[]) => getUserPractices(...a), getIncompleteDays: vi.fn(async () => []), getGroups: vi.fn(async () => []) },
}))
import { YearMap } from './YearMapScreen'
import { Rhythm } from './Rhythm'

function data(daysBack: number) {
  const days: Record<string, Record<string, unknown>> = {}
  for (let i = daysBack; i >= 1; i--) days[day(-i)] = { 'Кругов за день': i >= 20 && i <= 40 ? 40 : 16 + (i % 5) }
  return entries(days)
}
function show(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>)
}

beforeEach(() => { vi.clearAllMocks(); getUserPractices.mockImplementation(async () => FOUR); getReportData.mockImplementation(async () => data(200)) })
afterEach(() => localStorage.clear())

describe('YearMap', () => {
  it('mobile_has_26_columns_and_tablet_52', async () => {
    setViewportWidth(390)
    const m = show(<YearMap />)
    const first = await screen.findAllByRole('button', { name: /Кругов за день/ })
    expect(first).toHaveLength(26)
    expect(screen.getByText('Turn the phone or open on a larger screen for 52 weeks.')).toBeInTheDocument()
    expect(getReportData).toHaveBeenCalledWith(today, 'Year')
    m.unmount()
    setViewportWidth(900)
    show(<YearMap />)
    expect(await screen.findAllByRole('button', { name: /Кругов за день/ })).toHaveLength(52)
    expect(screen.queryByText(/Turn the phone/)).not.toBeInTheDocument()
  })

  it('a_cell_popover_shows_its_numbers', async () => {
    setViewportWidth(390)
    show(<YearMap />)
    const cells = await screen.findAllByRole('button', { name: /Кругов за день/ })
    const week = mondayOf(day(-30))
    fireEvent.click(cells.find((c) => c.getAttribute('data-week') === week)!)
    expect(screen.getByText(/of 7 days/)).toBeInTheDocument()
    expect(screen.getByText(/avg 40 · usual 1\d/)).toBeInTheDocument()
    expect(screen.getByText(/Above usual · 3 of 3 steps/)).toBeInTheDocument()
    expect(screen.getByText('In Retreat')).toBeInTheDocument()
  })
})

describe('Rhythm', () => {
  it('shows_the_not_yet_message_for_a_3_week_history', async () => {
    setViewportWidth(390)
    getReportData.mockImplementation(async () => data(21))
    show(<Rhythm />)
    expect(await screen.findByText('Your rhythm shows up after 8 weeks of entries.')).toBeInTheDocument()
  })

  it('without_number_or_duration_practices_it_explains_instead_of_waiting', async () => {
    setViewportWidth(390)
    getUserPractices.mockImplementation(async () => FOUR.slice(0, 2))
    show(<Rhythm />)
    expect(await screen.findByText('Rows come from your number and duration practices.')).toBeInTheDocument()
    expect(screen.queryByText(/shows up after 8 weeks/)).toBeNull()
  })

  it('shows_typical_and_seven_averages_per_row', async () => {
    setViewportWidth(390)
    show(<Rhythm />)
    expect((await screen.findAllByText(/^typical \d/))[0]).toBeInTheDocument()
    expect(screen.getAllByRole('listitem', { name: /Кругов за день, / })).toHaveLength(7)
    expect(screen.getByText('Rows come from your number and duration practices.')).toBeInTheDocument()
  })
})
