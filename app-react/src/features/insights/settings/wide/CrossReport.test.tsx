import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { Report } from '../../../../api/charts'
import { setViewportWidth } from '../../../../test/viewport'
import { ChartEditorWide } from './ChartEditorWide'
import { sleepPanels } from '../../panels/templates'

vi.mock('../../../../api/charts', () => ({
  chartsApi: { getReports: vi.fn(), getReportData: vi.fn(), updateReport: vi.fn(), createReport: vi.fn(), deleteReport: vi.fn() },
}))
vi.mock('../../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn(), updateUserPractice: vi.fn(), getGroups: vi.fn() } }))
import { chartsApi } from '../../../../api/charts'
import { practicesApi } from '../../../../api/practices'
const charts = vi.mocked(chartsApi)

const A: Report = { id: 'a', name: 'Report A', definition: { Panels: sleepPanels({ bedtime: 'bedA', wake: 'wakeA', nap: null, min: 360, max: 540 }) } }
const B: Report = { id: 'b', name: 'Report B', definition: { Panels: sleepPanels({ bedtime: 'bedB', wake: 'wakeB', nap: null, min: 420, max: 480 }) } }

describe('leaving a template report inside the debounce, with no blur', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: 'bedA', practice: 'Bed A', data_type: 'Time', is_active: true },
      { id: 'wakeA', practice: 'Wake A', data_type: 'Time', is_active: true },
      { id: 'bedB', practice: 'Bed B', data_type: 'Time', is_active: true },
      { id: 'wakeB', practice: 'Wake B', data_type: 'Time', is_active: true },
    ] as never)
    charts.getReports.mockResolvedValue([A, B])
    charts.getReportData.mockResolvedValue([])
    charts.updateReport.mockResolvedValue()
  })

  it('what is sent when the route changes from A to B', async () => {
    setViewportWidth(1440)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([{ path: '/settings/charts/:id', element: <ChartEditorWide /> }], {
      initialEntries: ['/settings/charts/b', '/settings/charts/a'], initialIndex: 1,
    })
    render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>)
    const min = await screen.findByLabelText('Minimum sleep')
    fireEvent.focus(min)
    fireEvent.change(min, { target: { value: '0500' } })
    await router.navigate(-1) // browser Back: no blur happens first
    await waitFor(() => expect(charts.updateReport).toHaveBeenCalled())
    const [id, name, def] = charts.updateReport.mock.calls[0]
    const s = (def as { Panels: { template: { Sleep: { bedtime: string; min: number } } } }).Panels.template.Sleep
    expect(id).toBe('a')
    expect(name).toBe('Report A')
    expect(s).toMatchObject({ bedtime: 'bedA', min: 300 })
    expect(charts.updateReport.mock.calls.every(([i]) => i === 'a')).toBe(true)
  })
})
