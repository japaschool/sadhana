import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { InsightsMobileScreen } from './InsightsMobile'
import { setViewportWidth } from '../../../test/viewport'

vi.mock('../../../api/charts', () => ({
  chartsApi: { getReports: vi.fn(), getReportData: vi.fn(), deleteReport: vi.fn() },
}))
vi.mock('../../../api/practices', () => ({
  practicesApi: { getUserPractices: vi.fn(), getIncompleteDays: vi.fn() },
}))
import { chartsApi } from '../../../api/charts'
import { practicesApi } from '../../../api/practices'
const charts = vi.mocked(chartsApi)
const practices = vi.mocked(practicesApi)

const LONG = 'Morning sadhana with a very long report name'

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/charts']}><InsightsMobileScreen /></MemoryRouter>
    </QueryClientProvider>,
  )
}

// The ▾ is aria-hidden, so the link's accessible name is just the report name.
const reportLink = () => screen.findByRole('button', { name: /^(All practices|Morning sadhana)/ })

describe('InsightsMobile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(390)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 9))
    practices.getUserPractices.mockResolvedValue([
      { id: 'p1', practice: 'Japa', data_type: 'Duration', is_active: true },
      { id: 'p2', practice: 'Reading', data_type: 'Duration', is_active: true },
    ])
    practices.getIncompleteDays.mockResolvedValue([])
    charts.getReports.mockResolvedValue([
      { id: 'r1', name: LONG, definition: { Graph: { bar_layout: 'Stacked', traces: [
        { label: null, type_: 'Bar', practice: 'p1', y_axis: null, show_average: true },
      ] } } },
      { id: 'g1', name: 'Grid one', definition: { Grid: { practices: ['p1'] } } },
    ])
    charts.getReportData.mockImplementation(async (cob) =>
      cob === '2026-10-04'
        ? [{ cob_date: '2026-10-04', practice: 'Japa', value: { Duration: 40 } }]
        : [
            { cob_date: '2026-10-05', practice: 'Japa', value: { Duration: 60 } },
            { cob_date: '2026-10-06', practice: 'Japa', value: { Duration: 30 } },
          ])
  })
  afterEach(() => { vi.useRealTimers(); localStorage.clear() })

  it('shows the headline, delta, window and legend for All practices', async () => {
    renderScreen()
    // Today (Oct 6) is excluded: the headline is Oct 5's 60 min; the previous window (Oct 4) had 40 → +50%.
    expect(await screen.findByText('+50% vs previous 30 days')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Insights' })).toBeInTheDocument()
    expect(screen.getByText('Daily average · Oct 5 – Oct 6')).toBeInTheDocument()
    expect(screen.getAllByText('1 h')).toHaveLength(2) // headline + Japa legend row
    const legend = screen.getByRole('list', { name: 'Averages' })
    expect(within(legend).getByText('Japa').parentElement).toHaveTextContent('1 h')
    expect(within(legend).getByText('Reading').parentElement).toHaveTextContent('—')
  })

  it('switches reports through the menu; Grid reports are not listed', async () => {
    renderScreen()
    fireEvent.click(await reportLink())
    const menu = screen.getByRole('menu', { name: 'Reports' })
    expect(within(menu).getByRole('menuitemradio', { name: 'All practices' })).toHaveAttribute('aria-checked', 'true')
    expect(within(menu).queryByText('Grid one')).toBeNull()
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: LONG }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(await reportLink()).toHaveTextContent(LONG)
    expect(localStorage.getItem('insights-report')).toBe('r1')
  })

  it('switches the range', async () => {
    renderScreen()
    await screen.findByText('+50% vs previous 30 days')
    fireEvent.click(screen.getByRole('radio', { name: '7d' }))
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-10-06', 'Week'))
  })

  it('a past end date shows the amber pill, and × resets it to today', async () => {
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: /Ending today/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wednesday, September 30' }))
    expect(await screen.findByRole('button', { name: 'Ending Sep 30' })).toBeInTheDocument()
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-09-30', 'Month'))
    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(screen.getByRole('button', { name: /Ending today/ })).toBeInTheDocument()
  })

  it('shows "No data in this range" when nothing was logged', async () => {
    charts.getReportData.mockResolvedValue([{ cob_date: '2026-10-05', practice: 'Japa', value: null }])
    renderScreen()
    expect(await screen.findByText('No data in this range')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Averages' })).toBeNull()
  })

  it('shows an inline error when the data request fails', async () => {
    charts.getReportData.mockRejectedValue(new Error('boom'))
    renderScreen()
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load data")
  })
})
