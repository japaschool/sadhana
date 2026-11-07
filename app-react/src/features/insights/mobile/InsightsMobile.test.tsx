import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { InsightsMobileScreen } from './InsightsMobile'
import { setViewportWidth } from '../../../test/viewport'

vi.mock('../../../api/charts', () => ({
  chartsApi: { getReports: vi.fn(), getReportData: vi.fn(), deleteReport: vi.fn() },
}))
vi.mock('../../../api/practices', () => ({
  practicesApi: { getUserPractices: vi.fn(), getIncompleteDays: vi.fn(), getDiaryEntries: vi.fn(), saveDiaryEntry: vi.fn(), getGroups: vi.fn() },
}))
// The screen opens on Overview, which reads marked periods.
vi.mock('../../../api/markedPeriods', () => ({ useMarkedPeriods: () => ({ periods: [], isLoading: false }) }))
import { chartsApi } from '../../../api/charts'
import { practicesApi } from '../../../api/practices'
const charts = vi.mocked(chartsApi)
const practices = vi.mocked(practicesApi)

function LocationProbe() {
  const l = useLocation()
  return <p data-testid="location">{l.pathname + l.search}</p>
}
const LONG = 'Morning sadhana with a very long report name'

const toCharts = () => fireEvent.click(screen.getByRole('radio', { name: 'Charts' }))

function renderScreen(view: 'overview' | 'charts' = 'charts') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const r = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/charts']}><InsightsMobileScreen /></MemoryRouter>
    </QueryClientProvider>,
  )
  if (view === 'charts') toCharts()
  return r
}

// The ▾ is aria-hidden, so the link's accessible name is just the report name.
const reportLink = () => screen.findByRole('button', { name: /^(Grid one|Morning sadhana)/ })

describe('InsightsMobile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(390)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 9))
    practices.getUserPractices.mockResolvedValue([
      { id: 'p1', practice: 'Japa', data_type: 'Duration', is_active: true },
      { id: 'p2', practice: 'Reading', data_type: 'Duration', is_active: true, is_required: true },
    ])
    practices.getGroups.mockResolvedValue([{ id: null, name: '', is_default: true }])
    practices.getIncompleteDays.mockResolvedValue([])
    charts.getReports.mockResolvedValue([
      { id: 'r1', name: LONG, definition: { Graph: { bar_layout: 'Stacked', traces: [
        { label: null, type_: 'Bar', practice: 'p1', y_axis: null, show_average: true },
      ] } } },
      { id: 'g1', name: 'Grid one', definition: { Grid: { practices: ['p1', 'p2'] } } },
    ])
    charts.getReportData.mockImplementation(async (cob) =>
      cob === '2026-10-04'
        ? [{ cob_date: '2026-10-04', practice: 'Japa', value: { Duration: 40 } }]
        : [
            { cob_date: '2026-10-05', practice: 'Japa', value: { Duration: 60 } },
            { cob_date: '2026-10-06', practice: 'Japa', value: { Duration: 30 } },
          ])
    localStorage.setItem('insights-report', 'r1')
  })
  afterEach(() => { vi.useRealTimers(); localStorage.clear() })

  it('shows the headline, delta, window and legend for a graph report', async () => {
    renderScreen()
    // Today (Oct 6) is excluded: the headline is Oct 5's 60m; the previous window (Oct 4) had 40 → +50%.
    expect(await screen.findByText('+50% vs previous 30 days')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Insights' })).toBeInTheDocument()
    expect(screen.getByText('Daily average · Oct 5 – Oct 6')).toBeInTheDocument()
    expect(screen.getAllByText('1h')).toHaveLength(2) // headline + Japa legend row
    const legend = screen.getByRole('list', { name: 'Averages' })
    expect(within(legend).getByText('Japa').parentElement).toHaveTextContent('1h')
  })

  it('a legend row toggles its series', async () => {
    renderScreen()
    const japa = await screen.findByRole('button', { name: /Japa/ })
    expect(japa).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(japa)
    expect(japa).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(japa)
    expect(japa).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches reports through the menu; Grid reports are listed too', async () => {
    renderScreen()
    fireEvent.click(await reportLink())
    const menu = screen.getByRole('menu', { name: 'Reports' })
    expect(within(menu).getByRole('menuitemradio', { name: LONG })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Grid one' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(await reportLink()).toHaveTextContent('Grid one')
    expect(localStorage.getItem('insights-report')).toBe('g1')
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

  const openMore = async () => fireEvent.click(await screen.findByRole('button', { name: 'More' }))

  it('without reports shows an empty state whose button creates a chart', async () => {
    charts.getReports.mockResolvedValue([])
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'New chart' }))
    expect(screen.getByText('No reports yet')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('hides Edit and Delete without a report', async () => {
    charts.getReports.mockResolvedValue([])
    renderScreen()
    await screen.findByText('No reports yet')
    await openMore()
    const menu = screen.getByRole('menu', { name: 'More' })
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'New chart', 'Share reports link', 'Download data (CSV)', 'Report a problem',
    ])
  })

  it('hides report actions on Overview even with a report selected', async () => {
    localStorage.setItem('insights-report', 'r1')
    renderScreen('overview')
    await waitFor(() => expect(charts.getReports).toHaveBeenCalled())
    await openMore()
    const menu = screen.getByRole('menu', { name: 'More' })
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'New chart', 'Share reports link', 'Download data (CSV)', 'Report a problem',
    ])
  })

  it('offers Edit and Delete for a report; Edit opens its chart settings', async () => {
    localStorage.setItem('insights-report', 'r1')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/charts']}>
          <Routes>
            <Route path="/charts" element={<InsightsMobileScreen />} />
            <Route path="/settings/charts/:id" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    toCharts()
    await screen.findByRole('button', { name: LONG })
    await openMore()
    expect(screen.getByRole('menuitem', { name: 'Delete report' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: `Edit “${LONG}”` }))
    expect(screen.getByTestId('location')).toHaveTextContent('/settings/charts/r1')
  })

  it('deletes the last report after confirming and shows the empty state', async () => {
    localStorage.setItem('insights-report', 'r1')
    charts.deleteReport.mockImplementation(async () => {
      charts.getReports.mockResolvedValue([])
    })
    renderScreen()
    await screen.findByRole('button', { name: LONG })
    await openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete report' }))
    const sheet = screen.getByRole('dialog', { name: 'Delete report' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(charts.deleteReport).toHaveBeenCalledWith('r1'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByText('No reports yet')).toBeInTheDocument()
  })

  it('keeps the sheet open and shows an error when delete fails', async () => {
    localStorage.setItem('insights-report', 'r1')
    charts.deleteReport.mockRejectedValue(new Error('boom'))
    renderScreen()
    await screen.findByRole('button', { name: LONG })
    await openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete report' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete report' })).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Delete report' })).toBeInTheDocument()
  })

  it('shows a Grid report as a table with averages; a row opens the day, editable', async () => {
    localStorage.setItem('insights-report', 'g1')
    practices.getDiaryEntries.mockResolvedValue([{ practice: 'Japa', data_type: 'Duration', value: { Duration: 60 } }])
    practices.saveDiaryEntry.mockResolvedValue(undefined)
    renderScreen()
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    // Group band, header, Oct 6, Oct 5 (newest first), footer.
    expect(rows.map((r) => r.textContent)).toEqual([
      'Practices', 'DateJapaReading', 'TueOct 630m—', 'MonOct 51h—', '2 days1h—',
    ])
    expect(within(table).getAllByTestId('required-missing')).toHaveLength(2)
    expect(screen.queryByRole('list', { name: 'Averages' })).toBeNull()

    fireEvent.click(within(table).getByRole('button', { name: 'Monday, October 5' }))
    const editJapa = await screen.findByRole('button', { name: 'Edit Japa' })
    const sheet = screen.getByRole('dialog', { name: 'Monday, October 5' })
    expect(within(sheet).getByText('1 required left')).toBeInTheDocument() // Reading
    fireEvent.click(editJapa)
    const input = within(sheet).getByRole('textbox', { name: 'Japa' })
    fireEvent.change(input, { target: { value: '90' } })
    fireEvent.blur(input)
    await waitFor(() => expect(practices.saveDiaryEntry).toHaveBeenCalledWith('2026-10-05', 'Japa', { Duration: 90 }))
  })

  it('a grouped table has one header cell per group spanning its columns', async () => {
    localStorage.setItem('insights-report', 'g1')
    charts.getReports.mockResolvedValue([{ id: 'g1', name: 'Grid one', definition: { Grid: { practices: ['p1', 'p2', 'p3'] } } }])
    practices.getUserPractices.mockResolvedValue([
      { id: 'p1', practice: 'Japa', data_type: 'Duration', is_active: true, group_id: null },
      { id: 'p2', practice: 'Reading', data_type: 'Duration', is_active: true, group_id: 'm' },
      { id: 'p3', practice: 'Mantra', data_type: 'Duration', is_active: true, group_id: 'm' },
    ] as never)
    practices.getGroups.mockResolvedValue([{ id: 'm', name: 'Morning', is_default: false }, { id: null, name: '', is_default: true }])
    renderScreen()
    const table = await screen.findByRole('table')
    const head = within(table).getAllByRole('row')[0]
    const cells = within(head).getAllByRole('columnheader').filter((c) => c.textContent)
    expect(cells.map((c) => c.textContent)).toEqual(['Morning', 'Practices'])
    expect(cells.map((c) => c.getAttribute('colspan'))).toEqual(['2', '1'])
    // Morning's columns, in report order, come before Japa.
    expect(within(table).getAllByRole('row')[1].textContent).toBe('DateReadingMantraJapa')
  })

  it('Group columns off: no group header row, report order', async () => {
    localStorage.setItem('insights-report', 'g1')
    charts.getReports.mockResolvedValue([{ id: 'g1', name: 'Grid one', definition: { Grid: { practices: ['p2', 'p1'], group_columns: false } } }])
    practices.getUserPractices.mockResolvedValue([
      { id: 'p1', practice: 'Japa', data_type: 'Duration', is_active: true, group_id: null },
      { id: 'p2', practice: 'Reading', data_type: 'Duration', is_active: true, group_id: 'm' },
    ] as never)
    practices.getGroups.mockResolvedValue([{ id: 'm', name: 'Morning', is_default: false }, { id: null, name: '', is_default: true }])
    renderScreen()
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows[0].textContent).toBe('DateReadingJapa')
    expect(within(table).queryByText('Morning')).toBeNull()
  })

  it('a goals report has no range or end date control; a graph report has', async () => {
    charts.getReports.mockResolvedValue([
      { id: 'go1', name: 'Goals', definition: { Panels: { version: 1, template: null, required: [], panels: [{ kind: 'Goals', goals: [] }] } } },
    ])
    localStorage.setItem('insights-report', 'go1')
    const { unmount } = renderScreen()
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-10-06', 'Year'))
    await waitFor(() => expect(screen.queryByRole('radiogroup', { name: 'Range' })).toBeNull())
    expect(screen.queryByText('Ending today')).toBeNull()
    unmount()
    localStorage.clear()
    charts.getReports.mockResolvedValue([{ id: 'g2', name: 'Sleep', definition: { Graph: { bar_layout: 'Grouped', traces: [] } } }])
    renderScreen()
    expect(await screen.findByRole('radiogroup', { name: 'Range' })).toBeInTheDocument()
  })

  it('a month report swaps the range control for month navigation', async () => {
    charts.getReports.mockResolvedValue([
      { id: 'm1', name: 'Days I did it', definition: { Panels: { version: 1, template: null, required: [], panels: [{ kind: 'Month', practice: 'p3' }] } } },
    ])
    practices.getUserPractices.mockResolvedValue([{ id: 'p3', practice: 'Walk', data_type: 'Bool', is_active: true }])
    localStorage.setItem('insights-report', 'm1')
    renderScreen()
    expect(await screen.findByText('October 2026')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Range' })).toBeNull()
    expect(screen.queryByText('Ending today')).toBeNull()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-10-06', 'HalfYear'))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(await screen.findByText('September 2026')).toBeInTheDocument()
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-09-30', 'HalfYear'))
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled()
  })
})
