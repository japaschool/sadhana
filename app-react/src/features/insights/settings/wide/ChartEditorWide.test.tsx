import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Report } from '../../../../api/charts'
import { setViewportWidth } from '../../../../test/viewport'
import { ChartEditorWide } from './ChartEditorWide'

vi.mock('../../../../api/charts', () => ({
  chartsApi: { getReports: vi.fn(), getReportData: vi.fn(), updateReport: vi.fn(), createReport: vi.fn(), deleteReport: vi.fn() },
}))
vi.mock('../../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn(), updateUserPractice: vi.fn() } }))
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
        <Routes><Route path="/charts/:id/edit" element={<ChartEditorWide />} /></Routes>
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
    charts.getReports.mockResolvedValue([GRAPH, TABLE])
    charts.getReportData.mockResolvedValue([])
    charts.updateReport.mockResolvedValue()
  })

  it('tablet: lists your charts and edits a series inline, under its row', async () => {
    setViewportWidth(800)
    renderAt('/charts/r1/edit')
    const column = await screen.findByRole('navigation', { name: 'Charts' })
    expect(within(column).getByRole('link', { name: /Morning sadhana/ })).toHaveAttribute('aria-current', 'page')
    expect(within(column).getByRole('link', { name: /Monthly table/ })).toHaveAttribute('href', '/charts/t1/edit')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Wake-up time' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const row = screen.getByRole('listitem', { name: 'Wake-up time' })
    fireEvent.click(within(row).getByRole('radio', { name: /Dots/ }))
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalled())
    expect(charts.updateReport.mock.calls[0][2]).toMatchObject({ Graph: { traces: [{}, { type_: 'Dot' }] } })
    fireEvent.click(within(row).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('listitem', { name: 'Wake-up time' })).not.toBeInTheDocument()
  })

  it('desktop: the preview and axes sit in their own panel', async () => {
    setViewportWidth(1440)
    renderAt('/charts/r1/edit')
    const panel = await screen.findByRole('complementary', { name: 'Preview' })
    expect(within(panel).getByRole('heading', { name: 'Axes' })).toBeInTheDocument()
  })
})
