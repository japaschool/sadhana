import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Report } from '../../../../api/charts'
import { setViewportWidth } from '../../../../test/viewport'
import { ChartEditorWide } from './ChartEditorWide'
import { goalsPanels, sleepPanels } from '../../panels/templates'

vi.mock('../../../../api/charts', () => ({
  chartsApi: { getReports: vi.fn(), getReportData: vi.fn(), updateReport: vi.fn(), createReport: vi.fn(), deleteReport: vi.fn() },
}))
vi.mock('../../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn(), updateUserPractice: vi.fn(), getGroups: vi.fn() } }))
vi.mock('../../../../api/markedPeriods', () => ({ useMarkedPeriods: () => ({ periods: [{ id: 'p1' }, { id: 'p2' }], isLoading: false }) }))
import { chartsApi } from '../../../../api/charts'
import { practicesApi } from '../../../../api/practices'
const charts = vi.mocked(chartsApi)

const GRAPH: Report = {
  id: 'r1', name: 'Morning sadhana', definition: { Graph: { bar_layout: 'Grouped', traces: [
    { label: null, type_: 'Bar', practice: 'read', y_axis: null, show_average: true },
    { label: null, type_: { Line: { style: 'Regular' } }, practice: 'wake', y_axis: null, show_average: true },
  ] } },
}
const TABLE: Report = { id: 't1', name: 'Monthly table', definition: { Grid: { practices: ['wake'] } } }

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/settings/charts/:id" element={<ChartEditorWide />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ChartEditorWide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: 'wake', practice: 'Wake-up time', data_type: 'Time', is_active: true },
      { id: 'read', practice: 'Book reading', data_type: 'Duration', is_active: true },
    ])
    vi.mocked(practicesApi.getGroups).mockResolvedValue([{ id: null, name: '', is_default: true }])
    charts.getReports.mockResolvedValue([GRAPH, TABLE])
    charts.getReportData.mockResolvedValue([])
    charts.updateReport.mockResolvedValue()
  })

  it('tablet: lists your charts and edits a series inline, under its row', async () => {
    setViewportWidth(800)
    renderAt('/settings/charts/r1')
    const column = await screen.findByRole('navigation', { name: 'Insights' })
    expect(within(column).getByRole('link', { name: /Morning sadhana/ })).toHaveAttribute('aria-current', 'page')
    expect(within(column).getByRole('link', { name: /Monthly table/ })).toHaveAttribute('href', '/settings/charts/t1')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Wake-up time' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const row = screen.getByRole('listitem', { name: 'Wake-up time' })
    fireEvent.click(within(row).getByRole('radio', { name: /Dots/ }))
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalled())
    expect(charts.updateReport.mock.calls[0][2]).toMatchObject({ Graph: { traces: [{}, { type_: 'Dot' }] } })
    fireEvent.click(within(row).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('listitem', { name: 'Wake-up time' })).not.toBeInTheDocument()
  })

  it('tablet: the rail leads with the Insights settings, so they stay reachable with charts', async () => {
    setViewportWidth(800)
    renderAt('/settings/charts/r1')
    const column = await screen.findByRole('navigation', { name: 'Insights' })
    // The toggles and sleep pair sit behind Overview, opened to the right like a chart.
    expect(within(column).queryByRole('switch')).not.toBeInTheDocument()
    expect(within(column).getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/settings/insights-prefs')
    expect(within(column).getByRole('link', { name: 'Overview rows' })).toHaveAttribute('href', '/settings/overview-rows')
    const periods = within(column).getByRole('link', { name: /Marked periods/ })
    expect(periods).toHaveAttribute('href', '/settings/periods')
    expect(periods).toHaveTextContent('2')
  })

  it('picking another chart after an edit opens that chart', async () => {
    setViewportWidth(1440)
    renderAt('/settings/charts/r1')
    const name = await screen.findByLabelText('Name')
    fireEvent.change(name, { target: { value: 'Evening' } })
    fireEvent.blur(name)
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('link', { name: /Monthly table/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Monthly table' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Monthly table')
  })

  it('desktop: the preview and axes sit in their own panel', async () => {
    setViewportWidth(1440)
    renderAt('/settings/charts/r1')
    const panel = await screen.findByRole('complementary', { name: 'Preview' })
    expect(within(panel).getByRole('heading', { name: 'Axes' })).toBeInTheDocument()
  })

  it('Opens on saves the report’s default range', async () => {
    setViewportWidth(1200)
    renderAt('/settings/charts/t1')
    const opens = await screen.findByRole('radiogroup', { name: 'Opens on' })
    expect(within(opens).getByRole('radio', { name: '30d' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(opens).getByRole('radio', { name: '90d' }))
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalledWith('t1', 'Monthly table', expect.anything(), '90d'))
  })

  it('a table has the Group columns setting too', async () => {
    setViewportWidth(1200)
    renderAt('/settings/charts/t1')
    fireEvent.click(await screen.findByRole('switch', { name: 'Group columns' }))
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalledWith('t1', 'Monthly table', { Grid: { practices: ['wake'], group_columns: false } }, undefined))
  })

  describe('a template report', () => {
    const SLEEP: Report = { id: 's1', name: 'Sleep', definition: { Panels: sleepPanels({ bedtime: 'bed', wake: 'wake', nap: null, min: 360, max: 540 }) } }
    beforeEach(() => {
      vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
        { id: 'bed', practice: 'Bed time', data_type: 'Time', is_active: true },
        { id: 'wake', practice: 'Wake-up time', data_type: 'Time', is_active: true },
      ])
      charts.getReports.mockResolvedValue([SLEEP])
    })

    it('desktop: the form beside a live preview that follows a limit change', async () => {
      setViewportWidth(1440)
      renderAt('/settings/charts/s1')
      const panel = await screen.findByRole('complementary', { name: 'Preview' })
      expect(await within(panel).findByRole('group', { name: 'Sleep' })).toHaveTextContent('Nights in range')
      expect(screen.getByRole('button', { name: 'Bedtime: Bed time' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Clear Minimum sleep' }))
      fireEvent.click(screen.getByRole('button', { name: 'Clear Maximum sleep' }))
      await waitFor(() => expect(within(panel).getByRole('group', { name: 'Sleep' })).toHaveTextContent('Nights logged'))
      expect(screen.queryByRole('button', { name: '+ Add series' })).not.toBeInTheDocument()
    })

    it('tablet: the preview sits above the form', async () => {
      setViewportWidth(800)
      renderAt('/settings/charts/s1')
      const preview = await screen.findByRole('group', { name: 'Sleep' })
      const slot = screen.getByRole('button', { name: 'Bedtime: Bed time' })
      expect(preview.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  it('a Goals report previews the last 12 periods, not 30 days', async () => {
    setViewportWidth(1440)
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([{ id: 'walk', practice: 'Walk', data_type: 'Bool', is_active: true }])
    charts.getReports.mockResolvedValue([{ id: 'g1', name: 'Goals', definition: { Panels: goalsPanels({ goals: [{ practice: 'walk', direction: 'AtLeast', amount: 3, period: 'Week', counts: 'Total' }] }) } }])
    renderAt('/settings/charts/g1')
    const panel = await screen.findByRole('complementary', { name: 'Preview' })
    expect(within(panel).getByText('Last 12 periods')).toBeInTheDocument()
    expect(within(panel).queryByText('Last 30 days')).not.toBeInTheDocument()
  })

  it('on a tablet too', async () => {
    setViewportWidth(800)
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([{ id: 'walk', practice: 'Walk', data_type: 'Bool', is_active: true }])
    charts.getReports.mockResolvedValue([{ id: 'g1', name: 'Goals', definition: { Panels: goalsPanels({ goals: [{ practice: 'walk', direction: 'AtLeast', amount: 3, period: 'Week', counts: 'Total' }] }) } }])
    renderAt('/settings/charts/g1')
    expect(await screen.findByText('Last 12 periods')).toBeInTheDocument()
    expect(screen.queryByText('Last 30 days')).not.toBeInTheDocument()
  })
})
