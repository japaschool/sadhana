import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Report } from '../../api/charts'
import { useAuthStore } from '../../store/authStore'
import { setViewportWidth } from '../../test/viewport'
import { toDateStr } from '../today/date'
import { SharedDesktop, SharedMobile, SharedTablet } from './SharedReports'

vi.mock('../../api/charts', () => ({
  chartsApi: { getSharedUser: vi.fn(), getSharedReports: vi.fn(), getSharedPractices: vi.fn(), getSharedReportData: vi.fn() },
}))
import { chartsApi } from '../../api/charts'
const api = vi.mocked(chartsApi)

const GRAPH: Report = { id: 'g', name: 'Hearing & study', definition: { Graph: { bar_layout: 'Stacked', traces: [
  { label: null, type_: 'Bar', practice: 'read', y_axis: null, show_average: false },
] } } }
const GRID: Report = { id: 'd', name: 'Full sadhana', definition: { Grid: { practices: ['read', 'wake'] } } }
const yesterday = toDateStr(new Date(Date.now() - 86400000))

function renderAt(el: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/shared/u1']}>
        <Routes><Route path="/shared/:id" element={el} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('shared reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, token: null, isLoading: false })
    api.getSharedUser.mockResolvedValue({ id: 'u1', name: 'Alex das' })
    api.getSharedReports.mockResolvedValue([GRAPH, GRID])
    api.getSharedPractices.mockResolvedValue([
      { id: 'read', practice: 'Reading', data_type: 'Duration', is_active: true },
      { id: 'wake', practice: 'Wake up', data_type: 'Bool', is_active: true },
    ])
    api.getSharedReportData.mockResolvedValue([
      { cob_date: yesterday, practice: 'Reading', value: { Duration: 40 } },
      { cob_date: yesterday, practice: 'Wake up', value: { Bool: true } },
    ])
  })

  it('mobile: the owner, report chips and a Sign up strip for visitors', async () => {
    setViewportWidth(390)
    renderAt(<SharedMobile />)
    expect(await screen.findByRole('heading', { name: 'Alex das' })).toBeInTheDocument()
    const chips = screen.getByRole('radiogroup', { name: 'Reports' })
    expect(within(chips).getByRole('radio', { name: 'Hearing & study' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/register')
    expect(api.getSharedReportData).toHaveBeenCalledWith('u1', expect.any(String), 'Month')
  })

  it('mobile grid: a calendar of days shaded by practices done', async () => {
    setViewportWidth(390)
    renderAt(<SharedMobile />)
    await userEvent.click(await screen.findByRole('radio', { name: 'Full sadhana' }))
    expect(await screen.findByRole('img', { name: /2 of 2/ })).toBeInTheDocument()
  })

  it('signed in: no Sign up', async () => {
    useAuthStore.setState({ token: 't' })
    renderAt(<SharedMobile />)
    await screen.findByRole('heading', { name: 'Alex das' })
    expect(screen.queryByRole('link', { name: /sign up/i })).toBeNull()
  })

  it('an unknown user reads as Report not found', async () => {
    api.getSharedUser.mockRejectedValue(new Error('404'))
    api.getSharedReports.mockRejectedValue(new Error('404'))
    renderAt(<SharedMobile />)
    expect(await screen.findByText('Report not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  })

  it('no reports shared yet', async () => {
    api.getSharedReports.mockResolvedValue([])
    renderAt(<SharedMobile />)
    expect(await screen.findByText('No reports shared yet')).toBeInTheDocument()
  })

  it('tablet: a report list beside the chart, a table under it, and Download CSV', async () => {
    setViewportWidth(834)
    renderAt(<SharedTablet />)
    expect(await screen.findByRole('radio', { name: /Full sadhana.*Grid · 2 practices/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Table' })).toBeInTheDocument()
  })

  it('desktop grid: a day per cell, with the diary value in its label', async () => {
    setViewportWidth(1440)
    renderAt(<SharedDesktop />)
    await userEvent.click(await screen.findByRole('radio', { name: /Full sadhana/ }))
    expect(await screen.findByRole('button', { name: /Reading: 40 ?min/ })).toBeInTheDocument()
    expect(screen.getByText('2 reports · read-only')).toBeInTheDocument()
  })
})
