import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { InsightsTabletScreen } from './InsightsTablet'
import { setViewportWidth } from '../../../test/viewport'

vi.mock('../../../api/charts', () => ({
  chartsApi: { getReports: vi.fn(), getReportData: vi.fn(), deleteReport: vi.fn() },
}))
vi.mock('../../../api/practices', () => ({
  practicesApi: { getUserPractices: vi.fn(), getIncompleteDays: vi.fn(), getDiaryEntries: vi.fn(), saveDiaryEntry: vi.fn() },
}))
import { chartsApi } from '../../../api/charts'
import { practicesApi } from '../../../api/practices'
const charts = vi.mocked(chartsApi)
const practices = vi.mocked(practicesApi)

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/charts']}><InsightsTabletScreen /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('InsightsTablet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(834)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 9))
    practices.getUserPractices.mockResolvedValue([
      { id: 'p1', practice: 'Japa', data_type: 'Duration', is_active: true },
      { id: 'p2', practice: 'Reading', data_type: 'Duration', is_active: true },
    ])
    practices.getIncompleteDays.mockResolvedValue([])
    charts.getReports.mockResolvedValue([])
    charts.getReportData.mockImplementation(async (cob) =>
      cob === '2026-10-04'
        ? [{ cob_date: '2026-10-04', practice: 'Japa', value: { Duration: 40 } }]
        : [{ cob_date: '2026-10-05', practice: 'Japa', value: { Duration: 60 } }])
  })
  afterEach(() => { vi.useRealTimers(); localStorage.clear() })

  it('renders the rail, headline, delta and the legend strip', async () => {
    renderScreen()
    expect(await screen.findByText('+50% vs previous 30 days')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Insights')
    expect(screen.getByRole('link', { name: 'Insights' })).toHaveAttribute('aria-current', 'page')
    const items = within(screen.getByRole('list', { name: 'Averages' })).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['Japa1 h', 'Reading—'])
  })

  it('picks the end date from the calendar and opens the more menu', async () => {
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: /Ending today/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wednesday, September 30' }))
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-09-30', 'Month'))
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(within(screen.getByRole('menu', { name: 'More' })).getAllByRole('menuitem').map((i) => i.textContent))
      .toEqual(['New chart', 'Share reports link', 'Download data (CSV)'])
  })

  it('shows a Grid report as a table; a row opens the day as a sheet', async () => {
    charts.getReports.mockResolvedValue([{ id: 'g1', name: 'Grid one', definition: { Grid: { practices: ['p1', 'p2'] } } }])
    localStorage.setItem('insights-report', 'g1')
    practices.getDiaryEntries.mockResolvedValue([{ practice: 'Japa', data_type: 'Duration', value: { Duration: 60 } }])
    renderScreen()
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row').map((r) => r.textContent)).toEqual([
      'Practices', 'DateJapaReading', 'MonOct 51 h—', '1 day1 h—',
    ])
    expect(screen.queryByRole('list', { name: 'Averages' })).toBeNull()
    fireEvent.click(within(table).getByRole('button', { name: 'Monday, October 5' }))
    await screen.findByRole('button', { name: 'Edit Japa' })
    expect(screen.getByRole('dialog', { name: 'Monday, October 5' })).toBeInTheDocument()
  })
})
