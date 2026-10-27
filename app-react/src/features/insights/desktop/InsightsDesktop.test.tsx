import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { InsightsDesktopScreen } from './InsightsDesktop'
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
      <MemoryRouter initialEntries={['/charts']}><InsightsDesktopScreen /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('InsightsDesktop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(1440)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 9))
    practices.getUserPractices.mockResolvedValue([
      { id: 'p1', practice: 'Japa', data_type: 'Duration', is_active: true },
    ])
    practices.getIncompleteDays.mockResolvedValue([])
    practices.getDiaryEntries.mockResolvedValue([])
    charts.getReports.mockResolvedValue([])
    charts.getReportData.mockResolvedValue([{ cob_date: '2026-10-05', practice: 'Japa', value: { Duration: 60 } }])
  })
  afterEach(() => { vi.useRealTimers(); localStorage.clear() })

  it('has no Log tab or end date control; the log panel shows the day', async () => {
    renderScreen()
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).queryByRole('link', { name: 'Log' })).toBeNull()
    expect(within(nav).getByRole('link', { name: 'Insights' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: /Ending today/ })).toBeNull()
    const panel = screen.getByRole('complementary', { name: 'Log' })
    expect(await within(panel).findByText('Japa')).toBeInTheDocument()
    expect(within(panel).getAllByRole('button', { name: /^\w+day, \w+ \d+$/ })).toHaveLength(9)
  })

  it('ends the chart on the log date: strip, week step, ⌘↓ and the in-panel month', async () => {
    renderScreen()
    const panel = screen.getByRole('complementary', { name: 'Log' })
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-10-06', 'Month'))

    fireEvent.click(within(panel).getByRole('button', { name: 'Sunday, October 4' }))
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-10-04', 'Month'))

    fireEvent.click(within(panel).getByRole('button', { name: 'Previous week' }))
    await waitFor(() => expect(practices.getDiaryEntries).toHaveBeenCalledWith('2026-09-27'))

    fireEvent.keyDown(window, { key: 'ArrowDown', metaKey: true })
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-09-28', 'Month'))

    fireEvent.click(within(panel).getByRole('button', { name: /^Mon, September 28/ }))
    fireEvent.click(screen.getByTestId('popover-backdrop'))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(within(panel).getByRole('button', { name: /^Mon, September 28/ }))
    const cal = screen.getByRole('dialog', { name: 'Calendar' })
    fireEvent.click(within(cal).getByRole('button', { name: 'Tuesday, September 1' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalledWith('2026-09-01', 'Month'))
  })

  it('opens the add-time pad as a popover over the log panel, not a bottom sheet', async () => {
    practices.getDiaryEntries.mockResolvedValue([{ practice: 'Japa', data_type: 'Duration', value: { Duration: 30 } }])
    renderScreen()
    const panel = screen.getByRole('complementary', { name: 'Log' })
    fireEvent.click(await within(panel).findByRole('button', { name: 'Add time to Japa' }))
    expect(screen.getByRole('dialog', { name: 'Japa' })).toBeInTheDocument()
    expect(screen.queryByTestId('sheet-backdrop')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: 'Add time to Japa' }))
    fireEvent.click(screen.getByTestId('popover-backdrop'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows a Grid report as a table; a row opens its day in the log panel', async () => {
    charts.getReports.mockResolvedValue([{ id: 'g1', name: 'Grid one', definition: { Grid: { practices: ['p1'] } } }])
    localStorage.setItem('insights-report', 'g1')
    renderScreen()
    const table = await screen.findByRole('table')
    fireEvent.click(within(table).getByRole('button', { name: 'Monday, October 5' }))
    await waitFor(() => expect(practices.getDiaryEntries).toHaveBeenCalledWith('2026-10-05'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
