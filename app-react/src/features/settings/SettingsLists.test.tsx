import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChartsSettings, YatrasSettings } from './SettingsLists'
import { setViewportWidth } from '../../test/viewport'
import { fireEvent } from '@testing-library/react'
import { useAuthStore } from '../../store/authStore'

vi.mock('../../api/yatras', () => ({ yatrasApi: { getYatras: vi.fn(), getYatraUsers: vi.fn() } }))
import { yatrasApi } from '../../api/yatras'
vi.mock('../../api/charts', () => ({ chartsApi: { getReports: vi.fn() } }))
import { chartsApi } from '../../api/charts'
vi.mock('../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
import { practicesApi } from '../../api/practices'
vi.mock('../../api/insightPrefs', () => ({ insightPrefsApi: { get: vi.fn(), save: vi.fn() }, INSIGHT_PREFS_KEY: ['insight-prefs'] }))
import { insightPrefsApi } from '../../api/insightPrefs'
vi.mock('../../api/markedPeriods', () => ({ useMarkedPeriods: () => ({ periods: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }], isLoading: false }) }))

const renderAt = (path: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings/charts" element={<ChartsSettings />} />
        <Route path="/settings/charts/:id" element={<p>Chart editor</p>} />
        <Route path="/settings/yatras" element={<YatrasSettings />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
)

describe('Settings lists', () => {
  beforeEach(() => {
    setViewportWidth(390)
    useAuthStore.setState({ user: { id: '1', email: 't@e.st', token: 'tok', name: 'Test User' }, token: 'tok' })
    vi.mocked(chartsApi.getReports).mockResolvedValue([{ id: 'r1', name: 'Morning', definition: { Grid: { practices: [] } } }])
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: 'bed', practice: 'Bedtime', data_type: 'Time', is_active: true },
      { id: 'wake', practice: 'Wake-up', data_type: 'Time', is_active: true },
    ])
    vi.mocked(yatrasApi.getYatras).mockResolvedValue([{ id: 'y1', name: 'League', show_stability_metrics: false }])
    vi.mocked(insightPrefsApi.get).mockResolvedValue(null)
    vi.mocked(insightPrefsApi.save).mockResolvedValue(undefined)
    vi.mocked(yatrasApi.getYatraUsers).mockResolvedValue([{ user_id: '1', user_name: 'Test User', is_admin: true }])
  })

  it('mobile: Insights lists the charts, back to Settings', async () => {
    renderAt('/settings/charts')
    expect(await screen.findByRole('link', { name: /Morning/ })).toHaveAttribute('href', '/settings/charts/r1')
    expect(screen.getByRole('heading', { name: 'Insights' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Settings' })[0]).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('button', { name: 'New chart' })).toBeInTheDocument()
  })

  it('mobile: each chart row starts with its type glyph, and keeps the kind text', async () => {
    vi.mocked(chartsApi.getReports).mockResolvedValue([
      { id: 'r1', name: 'Morning', definition: { Grid: { practices: [] } } },
      { id: 'r2', name: 'Sleep', definition: { Panels: { version: 1, template: null, required: [], panels: [] } } },
    ])
    renderAt('/settings/charts')
    const grid = await screen.findByRole('link', { name: /Morning/ })
    expect(grid.firstElementChild).toHaveAttribute('data-glyph', 'table')
    // jsdom has no layout: the class is what keeps the cells from collapsing (inline-flex would beat grid).
    expect(grid.firstElementChild).toHaveClass('inline-grid', 'shrink-0')
    expect(grid.firstElementChild).not.toHaveClass('inline-flex')
    expect(within(grid).getByText('Table')).toBeInTheDocument()
    const tpl = screen.getByRole('link', { name: /Sleep/ })
    expect(tpl.firstElementChild).toHaveAttribute('data-glyph', 'sleep')
    expect(within(tpl).getByText('Template')).toBeInTheDocument()
  })

  it('tablet: Insights opens the first chart, whose column lists them all', async () => {
    setViewportWidth(834)
    renderAt('/settings/charts')
    expect(await screen.findByText('Chart editor')).toBeInTheDocument()
  })

  it('Yatras lists my yatras with my role, each to its settings', async () => {
    renderAt('/settings/yatras')
    const row = await screen.findByRole('link', { name: /League/ })
    expect(row).toHaveAttribute('href', '/yatra/y1/settings')
    expect(await within(row).findByText('Admin')).toBeInTheDocument()
  })

  describe('Insights section', () => {
    afterEach(() => localStorage.clear())

    it('toggles_write_prefs', async () => {
      renderAt('/settings/charts')
      const streaks = await screen.findByRole('switch', { name: 'Show streaks' })
      expect(streaks).not.toBeChecked()
      expect(screen.getByText(/Adds plain run lengths, like “3 days in a row”, to Overview. Off by default./)).toBeInTheDocument()
      fireEvent.click(streaks)
      const suggest = screen.getByRole('switch', { name: 'Suggest periods to mark' })
      expect(suggest).toBeChecked()
      fireEvent.click(suggest)
      await waitFor(() => expect(insightPrefsApi.save).toHaveBeenLastCalledWith(expect.objectContaining({ streaks: true, suggest: false })))
      expect(screen.getByRole('switch', { name: 'Show streaks' })).toBeChecked()
    })

    it('marked_periods_row_counts_and_links', async () => {
      renderAt('/settings/charts')
      const link = await screen.findByRole('link', { name: /Marked periods/ })
      expect(link).toHaveAttribute('href', '/settings/periods')
      expect(link).toHaveTextContent('4')
    })

    it('sleep_row_shows_the_pair_or_off_and_saves_from_the_sheet', async () => {
      renderAt('/settings/charts')
      const row = await screen.findByRole('button', { name: /Bedtime and wake-up/ })
      expect(row).toHaveTextContent('Off')
      fireEvent.click(row)
      fireEvent.change(await screen.findByLabelText('Bedtime'), { target: { value: 'bed' } })
      fireEvent.change(screen.getByLabelText('Wake-up'), { target: { value: 'wake' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findByRole('button', { name: /Bedtime and wake-up/ })).toHaveTextContent('Bedtime · Wake-up')
      expect(insightPrefsApi.save).toHaveBeenLastCalledWith(expect.objectContaining({ sleep: { bedtime: 'bed', wake: 'wake', nap: null } }))
      // Reopening shows the saved pair.
      fireEvent.click(screen.getByRole('button', { name: /Bedtime and wake-up/ }))
      expect(await screen.findByLabelText('Bedtime')).toHaveValue('bed')
      expect(screen.getByLabelText('Wake-up')).toHaveValue('wake')
    })
  })
})
