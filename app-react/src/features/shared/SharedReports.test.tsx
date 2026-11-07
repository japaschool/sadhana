import { render, screen, waitFor, within } from '@testing-library/react'
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
    api.getSharedUser.mockResolvedValue({ id: 'u1', name: 'Alex das', kind: 'legacy', start_date: null })
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

  it('mobile: the owner, report chips (A–Z, the first selected) and a Sign up strip for visitors', async () => {
    setViewportWidth(390)
    renderAt(<SharedMobile />)
    expect(await screen.findByRole('heading', { name: 'Alex das' })).toBeInTheDocument()
    const chips = screen.getByRole('radiogroup', { name: 'Reports' })
    expect(within(chips).getByRole('radio', { name: 'Full sadhana' })).toHaveAttribute('aria-checked', 'true')
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
    await userEvent.click(screen.getByRole('radio', { name: /Hearing & study/ }))
    expect(await screen.findByRole('heading', { name: 'Table' })).toBeInTheDocument()
  })

  it('desktop grid: a day per cell, with the diary value in its label', async () => {
    setViewportWidth(1440)
    renderAt(<SharedDesktop />)
    await userEvent.click(await screen.findByRole('radio', { name: /Full sadhana/ }))
    expect(await screen.findByRole('button', { name: /Reading: 40m/ })).toBeInTheDocument()
    expect(screen.getByText('2 reports · read-only')).toBeInTheDocument()
  })

  it.each([['mobile', 390, SharedMobile], ['tablet', 834, SharedTablet], ['desktop', 1440, SharedDesktop]] as const)(
    '%s: a month report shows month navigation instead of the range control', async (_n, width, Page) => {
      setViewportWidth(width)
      api.getSharedReports.mockResolvedValue([
        { id: 'm', name: 'Days I did it', definition: { Panels: { version: 1, template: null, required: [], panels: [{ kind: 'Month', practice: 'walk' }] } } },
      ])
      api.getSharedPractices.mockResolvedValue([{ id: 'walk', practice: 'Walk', data_type: 'Bool', is_active: true }])
      api.getSharedReportData.mockResolvedValue([{ cob_date: yesterday, practice: 'Walk', value: { Bool: true } }])
      renderAt(<Page />)
      const now = new Date()
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = toDateStr(new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0))
      const todayCob = toDateStr(now)
      expect(await screen.findByRole('button', { name: 'Previous month' })).toBeInTheDocument()
      expect(screen.queryByRole('radiogroup', { name: 'Range' })).toBeNull()
      await waitFor(() => expect(api.getSharedReportData).toHaveBeenCalledWith('u1', todayCob, 'HalfYear'))
      await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
      await waitFor(() => expect(api.getSharedReportData).toHaveBeenCalledWith('u1', last, 'HalfYear'))
    },
  )

  it.each([['mobile', 390, SharedMobile], ['tablet', 834, SharedTablet], ['desktop', 1440, SharedDesktop]] as const)(
    '%s: a link page has no CSV button', async (_n, width, Page) => {
      setViewportWidth(width)
      api.getSharedUser.mockResolvedValue({ id: 'u1', name: 'Alex das', kind: 'link', start_date: null })
      renderAt(<Page />)
      await userEvent.click(await screen.findByRole('radio', { name: /Hearing & study/ }))
      await screen.findAllByText('Reading')
      expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
    },
  )

  it.each([['mobile', 390, SharedMobile], ['tablet', 834, SharedTablet], ['desktop', 1440, SharedDesktop]] as const)(
    '%s: a legacy page keeps CSV', async (_n, width, Page) => {
      setViewportWidth(width)
      renderAt(<Page />)
      await userEvent.click(await screen.findByRole('radio', { name: /Hearing & study/ }))
      await screen.findAllByText('Reading')
      if (width === 390) {
        await userEvent.click(screen.getByRole('button', { name: 'More' }))
        expect(screen.getByRole('menuitem', { name: 'Download CSV' })).toBeInTheDocument()
      } else expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument()
    },
  )

  it('opens on the link\'s date, and the viewer can still move it', async () => {
    setViewportWidth(834)
    api.getSharedUser.mockResolvedValue({ id: 'u1', name: 'Alex das', kind: 'link', start_date: '2026-10-31' })
    api.getSharedReports.mockResolvedValue([GRAPH])
    renderAt(<SharedTablet />)
    await waitFor(() => expect(api.getSharedReportData).toHaveBeenCalled())
    expect(api.getSharedReportData.mock.calls[0]).toEqual(['u1', '2026-10-31', 'Month'])
    await userEvent.click(await screen.findByRole('button', { name: /Ending/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Friday, October 30' }))
    await waitFor(() => expect(api.getSharedReportData).toHaveBeenCalledWith('u1', '2026-10-30', 'Month'))
    expect(api.getSharedReportData).not.toHaveBeenCalledWith('u1', toDateStr(new Date()), 'Month')
  })

  it('a month report opens on the link\'s month', async () => {
    api.getSharedUser.mockResolvedValue({ id: 'u1', name: 'Alex das', kind: 'link', start_date: '2026-10-31' })
    api.getSharedReports.mockResolvedValue([
      { id: 'm', name: 'Days I did it', definition: { Panels: { version: 1, template: null, required: [], panels: [{ kind: 'Month', practice: 'walk' }] } } },
    ])
    api.getSharedPractices.mockResolvedValue([{ id: 'walk', practice: 'Walk', data_type: 'Bool', is_active: true }])
    renderAt(<SharedMobile />)
    await waitFor(() => expect(api.getSharedReportData).toHaveBeenCalledWith('u1', '2026-10-31', 'HalfYear'))
    expect((await screen.findAllByText('October 2026')).length).toBeGreaterThan(0)
  })

  it('a goals report ignores the link\'s date: it reads to today', async () => {
    api.getSharedUser.mockResolvedValue({ id: 'u1', name: 'Alex das', kind: 'link', start_date: '2026-10-31' })
    api.getSharedReports.mockResolvedValue([
      { id: 'q', name: 'Goals', definition: { Panels: { version: 1, template: null, required: [], panels: [{ kind: 'Goals', goals: [] }] } } },
    ])
    renderAt(<SharedMobile />)
    await waitFor(() => expect(api.getSharedReportData).toHaveBeenCalledWith('u1', toDateStr(new Date()), 'Year'))
    expect(api.getSharedReportData).not.toHaveBeenCalledWith('u1', '2026-10-31', expect.anything())
  })

  it('shows a Gaps report on a shared link, with no marked-period bands', async () => {
    setViewportWidth(1440)
    api.getSharedUser.mockResolvedValue({ id: 'u1', name: 'Alex das', kind: 'link', start_date: null })
    api.getSharedReports.mockResolvedValue([
      { id: 'x', name: 'Fasts', definition: { Panels: { version: 1, template: null, required: [], panels: [{ kind: 'Gaps', event: 'fast' }] } } },
    ])
    api.getSharedPractices.mockResolvedValue([{ id: 'fast', practice: 'Fasting', data_type: 'Bool', is_active: true }])
    api.getSharedReportData.mockResolvedValue([
      { cob_date: toDateStr(new Date(Date.now() - 10 * 86400000)), practice: 'Fasting', value: { Bool: true } },
      { cob_date: yesterday, practice: 'Fasting', value: { Bool: true } },
    ])
    const { container } = renderAt(<SharedDesktop />)
    expect(await screen.findByText('Days since the one before')).toBeInTheDocument()
    expect(api.getSharedReports).toHaveBeenCalledWith('u1')
    expect(container.querySelector('.recharts-reference-area')).toBeNull()
    expect(screen.queryByText('Marked period')).toBeNull()
  })
})
