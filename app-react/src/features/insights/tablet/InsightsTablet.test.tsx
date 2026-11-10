import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { InsightsTabletScreen } from './InsightsTablet'
import { setViewportWidth } from '../../../test/viewport'

vi.mock('../../../api/charts', () => ({
  chartsApi: { getReports: vi.fn(), getReportData: vi.fn(), deleteReport: vi.fn() },
}))
vi.mock('../../../api/practices', () => ({
  practicesApi: { getGroups: vi.fn().mockResolvedValue([]), getUserPractices: vi.fn(), getIncompleteDays: vi.fn(), getDiaryEntries: vi.fn(), saveDiaryEntry: vi.fn() },
}))
import { chartsApi } from '../../../api/charts'
import { practicesApi } from '../../../api/practices'
const charts = vi.mocked(chartsApi)
const practices = vi.mocked(practicesApi)

function renderScreen(view: 'charts' | 'overview' = 'charts') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/charts']}><InsightsTabletScreen /></MemoryRouter>
    </QueryClientProvider>,
  )

  // The screen opens on Overview; these tests are about the charts.
  if (view === 'charts') fireEvent.click(screen.getByRole('radio', { name: 'Charts' }))
  return result
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
    const line = (practice: string) => ({ label: null, type_: { Line: { style: 'Regular' as const } }, practice, y_axis: null, show_average: false })
    charts.getReports.mockResolvedValue([{ id: 'r1', name: 'Morning', definition: { Graph: { bar_layout: 'Grouped', traces: [line('p1'), line('p2')] } } }])
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
    expect(screen.getByRole('region', { name: 'Averages' })).toHaveTextContent('Japa1hReading—')
    expect(within(screen.getByRole('list', { name: 'Key' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Japa', 'Reading'])
  })

  it('picks the end date from the calendar and opens the more menu', async () => {
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: /Ending today/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wednesday, September 30' }))
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-09-30', 'Month'))
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(within(screen.getByRole('menu', { name: 'More' })).getAllByRole('menuitem').map((i) => i.textContent))
      .toEqual(['New chart', 'Edit “Morning”', 'Sharing', 'Download data (CSV)', 'Delete report', 'Report a problem'])
  })

  it('Sharing opens Settings → Sharing', async () => {
    function Probe() { const l = useLocation(); return <p data-testid="location">{l.pathname}</p> }
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/charts']}>
          <Routes>
            <Route path="/charts" element={<InsightsTabletScreen />} />
            <Route path="/settings/sharing" element={<Probe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'More' }))
    fireEvent.click(within(screen.getByRole('menu', { name: 'More' })).getByRole('menuitem', { name: 'Sharing' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/settings/sharing')
  })

  it('hides report actions on Overview even with a report selected', async () => {
    charts.getReports.mockResolvedValue([{ id: 'g1', name: 'Grid one', definition: { Grid: { practices: ['p1', 'p2'] } } }])
    localStorage.setItem('insights-report', 'g1')
    renderScreen('overview')
    await waitFor(() => expect(charts.getReports).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: 'More' }))
    expect(within(screen.getByRole('menu', { name: 'More' })).getAllByRole('menuitem').map((i) => i.textContent))
      .toEqual(['New chart', 'Sharing', 'Download data (CSV)', 'Report a problem'])
  })

  it('shows a Grid report as a table; a row opens the day as a sheet', async () => {
    charts.getReports.mockResolvedValue([{ id: 'g1', name: 'Grid one', definition: { Grid: { practices: ['p1', 'p2'] } } }])
    localStorage.setItem('insights-report', 'g1')
    practices.getDiaryEntries.mockResolvedValue([{ practice: 'Japa', data_type: 'Duration', value: { Duration: 60 } }])
    renderScreen()
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row').map((r) => r.textContent)).toEqual([
      'Practices', 'DateJapaReading', 'MonOct 51h—', '1 day1h—',
    ])
    expect(screen.queryByRole('region', { name: 'Averages' })).toBeNull()
    fireEvent.click(within(table).getByRole('button', { name: 'Monday, October 5' }))
    await screen.findByRole('button', { name: 'Edit Japa' })
    expect(screen.getByRole('dialog', { name: 'Monday, October 5' })).toBeInTheDocument()
  })
})
