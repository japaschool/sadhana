import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Report } from '../../../../api/charts'
import { setViewportWidth } from '../../../../test/viewport'
import { ChartEditorMobileScreen } from './ChartEditorMobile'
import { NewChartSheet } from './NewChartSheet'

vi.mock('../../../../api/charts', () => ({
  chartsApi: { getReports: vi.fn(), getReportData: vi.fn(), updateReport: vi.fn(), createReport: vi.fn(), deleteReport: vi.fn() },
}))
vi.mock('../../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn(), updateUserPractice: vi.fn(), getGroups: vi.fn() } }))
import { chartsApi } from '../../../../api/charts'
import { practicesApi } from '../../../../api/practices'
const charts = vi.mocked(chartsApi)

// jsdom has no layout for dnd-kit to measure, so the test calls the drag-end handler itself.
const dnd = vi.hoisted(() => ({ onDragEnd: undefined as undefined | ((e: unknown) => void) }))
vi.mock('@dnd-kit/core', async (orig) => {
  const actual = await orig<typeof import('@dnd-kit/core')>()
  return { ...actual, DndContext: (props: React.ComponentProps<typeof actual.DndContext>) => { dnd.onDragEnd = props.onDragEnd as never; return <actual.DndContext {...props} /> } }
})

vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })

const GRAPH: Report = {
  id: 'r1', name: 'Morning sadhana', definition: { Graph: { bar_layout: 'Grouped', traces: [
    { label: null, type_: 'Bar', practice: 'read', y_axis: null, show_average: true },
    { label: null, type_: { Line: { style: 'Regular' } }, practice: 'wake', y_axis: 'Y2', show_average: true },
  ] } },
}
const TABLE: Report = { id: 't1', name: 'Monthly table', definition: { Grid: { practices: ['wake'] } } }

function renderAt(path: string) {
  // As in the app: a just-created chart isn't refetched away before the server lists it.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/charts" element={<NewChartSheet onClose={() => {}} />} />
          <Route path="/settings/charts/:id" element={<ChartEditorMobileScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ChartEditorMobile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(390)
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: 'japa', practice: 'Japa rounds', data_type: 'Int', is_active: true },
      { id: 'wake', practice: 'Wake-up time', data_type: 'Time', is_active: true },
      { id: 'read', practice: 'Book reading', data_type: 'Duration', is_active: true },
    ])
    vi.mocked(practicesApi.getGroups).mockResolvedValue([{ id: null, name: '', is_default: true }])
    charts.getReports.mockResolvedValue([GRAPH, TABLE])
    charts.getReportData.mockResolvedValue([])
    charts.updateReport.mockResolvedValue()
  })

  it('lists series on their axes and adds one where the picker says it lands', async () => {
    renderAt('/settings/charts/r1')
    expect(await screen.findByRole('button', { name: 'Edit Book reading' })).toHaveTextContent('Left axis · avg')
    expect(screen.getByRole('button', { name: 'Edit Wake-up time' })).toHaveTextContent('Right axis · avg')
    fireEvent.click(screen.getByRole('button', { name: '+ Add series' }))
    const sheet = screen.getByRole('dialog', { name: 'Add a series' })
    expect(within(sheet).getByText(/Number · New axis · Left 2/)).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add Japa rounds' }))
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalled())
    const [, , def] = charts.updateReport.mock.calls[0]
    expect('Graph' in def && def.Graph.traces[2]).toMatchObject({ practice: 'japa', type_: 'Bar', y_axis: 'Y3' })
    expect(await screen.findByRole('button', { name: 'Edit Japa rounds' })).toHaveTextContent('Left 2 axis')
    // Confirmed like yatra settings: a toast, whose Undo takes the series back out.
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Edit Japa rounds' })).not.toBeInTheDocument())
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalledTimes(2))
  })

  it('keeps an edit that failed to save and sends it again on Retry', async () => {
    charts.updateReport.mockRejectedValueOnce(new Error('offline'))
    renderAt('/settings/charts/r1')
    fireEvent.click(await screen.findByRole('radio', { name: 'Stacked' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save your last change')
    expect(screen.getByRole('radio', { name: 'Stacked' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Retry now' }))
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalledTimes(2))
    expect(charts.updateReport.mock.calls[1][2]).toMatchObject({ Graph: { bar_layout: 'Stacked' } })
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('ticking a column appends it and saves group_columns', async () => {
    renderAt('/settings/charts/t1')
    fireEvent.click(await screen.findByRole('checkbox', { name: /Japa rounds/ }))
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalledWith('t1', 'Monthly table', { Grid: { practices: ['wake', 'japa'], group_columns: true } }))
  })

  it('the Group columns toggle saves group_columns:false and keeps the practices order', async () => {
    charts.getReports.mockResolvedValue([{ ...TABLE, definition: { Grid: { practices: ['wake', 'japa'] } } }])
    renderAt('/settings/charts/t1')
    const toggle = await screen.findByRole('switch', { name: 'Group columns' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalledWith('t1', 'Monthly table', { Grid: { practices: ['wake', 'japa'], group_columns: false } }))
  })

  const MORNING = { id: 'm', name: 'Morning', is_default: false }
  const withGroups = () => {
    vi.mocked(practicesApi.getGroups).mockResolvedValue([MORNING, { id: null, name: '', is_default: true }])
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: 'japa', practice: 'Japa rounds', data_type: 'Int', is_active: true, group_id: null },
      { id: 'wake', practice: 'Wake-up time', data_type: 'Time', is_active: true, group_id: 'm' },
      { id: 'read', practice: 'Book reading', data_type: 'Duration', is_active: true, group_id: null },
    ] as never)
  }
  const names = () => screen.getAllByRole('checkbox').map((c) => c.closest('label')!.textContent)

  it('with grouping on, a column only drags within its group', async () => {
    withGroups()
    charts.getReports.mockResolvedValue([{ ...TABLE, definition: { Grid: { practices: ['wake', 'japa', 'read'], group_columns: true } } }])
    renderAt('/settings/charts/t1')
    await screen.findByRole('heading', { name: 'Morning' })
    act(() => dnd.onDragEnd!({ active: { id: 'wake' }, over: { id: 'japa' } }))
    expect(charts.updateReport).not.toHaveBeenCalled()
    act(() => dnd.onDragEnd!({ active: { id: 'read' }, over: { id: 'japa' } }))
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalledWith('t1', 'Monthly table', { Grid: { practices: ['wake', 'read', 'japa'], group_columns: true } }))
  })

  it('with grouping on, the column list is split by group', async () => {
    withGroups()
    renderAt('/settings/charts/t1')
    expect(await screen.findByRole('heading', { name: 'Morning' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Practices' })).toBeInTheDocument()
    // Morning first; inside Practices the order is Japa, Book (neither ticked).
    expect(names()[0]).toMatch(/Wake-up time/)
    expect(names()[1]).toMatch(/Japa rounds/)
  })

  it('with grouping off, the list is flat: ticked columns in report order, then unticked', async () => {
    withGroups()
    charts.getReports.mockResolvedValue([{ ...TABLE, definition: { Grid: { practices: ['read', 'wake'], group_columns: false } } }])
    renderAt('/settings/charts/t1')
    await screen.findByRole('checkbox', { name: /Japa rounds/ })
    expect(screen.queryByRole('heading', { name: 'Morning' })).not.toBeInTheDocument()
    expect(names()).toHaveLength(3)
    expect(names()[0]).toMatch(/Book reading/)
    expect(names()[1]).toMatch(/Wake-up time/)
    expect(names()[2]).toMatch(/Japa rounds/)
  })

  it('dragging a ticked column saves the new practices order', async () => {
    charts.getReports.mockResolvedValue([{ ...TABLE, definition: { Grid: { practices: ['wake', 'read'], group_columns: false } } }])
    renderAt('/settings/charts/t1')
    await screen.findByRole('button', { name: 'Move Wake-up time' })
    act(() => dnd.onDragEnd!({ active: { id: 'wake' }, over: { id: 'read' } }))
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalledWith('t1', 'Monthly table', { Grid: { practices: ['read', 'wake'], group_columns: false } }))
  })

  it('creating a graph opens its settings with the practice picker up', async () => {
    charts.createReport.mockResolvedValue('r9')
    renderAt('/charts')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Evening ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create graph' }))
    expect(await screen.findByRole('dialog', { name: 'Add the first series' })).toBeInTheDocument()
    expect(charts.createReport).toHaveBeenCalledWith('Evening', { Graph: { bar_layout: 'Grouped', traces: [] } })
  })
})
