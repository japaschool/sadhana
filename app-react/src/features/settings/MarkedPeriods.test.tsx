import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarkedPeriod } from '../../api/markedPeriods'
import { setViewportWidth } from '../../test/viewport'
import { useAuthStore } from '../../store/authStore'
import { DEFAULT_PREFS } from '../insights/overview/prefs'

vi.mock('../../api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
import { apiClient } from '../../api/client'
vi.mock('../insights/overview/useOverview', () => ({ useOverview: vi.fn() }))
import { useOverview } from '../insights/overview/useOverview'
import { MarkedPeriods } from './MarkedPeriods'

const TODAY = '2026-11-05'
const night: MarkedPeriod = { id: 'p1', name: 'Night shifts', start_date: '2026-10-02', end_date: null, exclude_from_usual: true }
const summer: MarkedPeriod = { id: 'p2', name: 'Summer schedule', start_date: '2026-06-01', end_date: '2026-08-31', exclude_from_usual: false }
const retreat: MarkedPeriod = { id: 'p3', name: 'Retreat', start_date: '2026-10-09', end_date: '2026-10-18', exclude_from_usual: true }

function overview(openPeriod: MarkedPeriod | null = null) {
  vi.mocked(useOverview).mockReturnValue({
    todayCob: TODAY, openPeriod, rows: [], practices: [], prefs: DEFAULT_PREFS, setPrefs: vi.fn(),
  } as unknown as ReturnType<typeof useOverview>)
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><MarkedPeriods /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  setViewportWidth(390)
  useAuthStore.setState({ user: { id: '1', email: 't@e.st', token: 'tok', name: 'Test User' }, token: 'tok' })
  vi.mocked(apiClient.get).mockResolvedValue({ data: { periods: [night, retreat, summer] } })
  overview()
})
afterEach(() => localStorage.clear())

describe('Marked periods', () => {
  it('periods_list_shows_status_and_usual_flag', async () => {
    renderPage()
    const list = await screen.findByRole('list', { name: 'Your periods' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Night shifts')
    expect(rows[0]).toHaveTextContent('In progress')
    expect(rows[0]).toHaveTextContent('Oct 2 – ongoing')
    expect(rows[0]).toHaveTextContent('Left out of usual range')
    expect(rows[1]).toHaveTextContent('Oct 9, 2026 – Oct 18, 2026')
    expect(rows[2]).toHaveTextContent('Counted in usual range')
    expect(within(rows[2]).queryByText('In progress')).toBeNull()
    expect(screen.getByText(/Leaving a period out keeps an unusual stretch/)).toBeInTheDocument()
  })

  it('new_period_posts_and_refreshes', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 'p4' } })
    renderPage()
    await screen.findByRole('list', { name: 'Your periods' })
    fireEvent.click(screen.getByRole('button', { name: /New period/ }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Flu' } })
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-02-03' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save period' }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/marked-periods',
      { name: 'Flu', start_date: '2026-02-03', end_date: null, exclude_from_usual: true }))
    await waitFor(() => expect(vi.mocked(apiClient.get).mock.calls.length).toBeGreaterThan(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('edit_opens_the_period_and_delete_asks_first', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Retreat/ }))
    expect(screen.getByLabelText('Name')).toHaveValue('Retreat')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(apiClient.delete).not.toHaveBeenCalled()
    const confirm = screen.getByRole('dialog', { name: 'Delete “Retreat”?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/marked-period/p3'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('delete_period_cancel_keeps_it', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Retreat/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete “Retreat”?' })).getByRole('button', { name: 'Cancel' }))
    expect(apiClient.delete).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Name')).toHaveValue('Retreat')
  })

  it('save_error_keeps_sheet_open', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('422'))
    renderPage()
    await screen.findByRole('list', { name: 'Your periods' })
    fireEvent.click(screen.getByRole('button', { name: /New period/ }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Flu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save period' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Flu')
  })

  it('shows_the_open_period_prompt', async () => {
    overview(night)
    renderPage()
    expect(await screen.findByText('Is Night shifts still going?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'It ended on…' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Night shifts')
  })
})
