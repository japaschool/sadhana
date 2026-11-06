import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../test/viewport'
import { useAuthStore } from '../../store/authStore'
import { practice } from '../insights/overview/fixtures'

vi.mock('../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn(), getGroups: vi.fn() } }))
vi.mock('../../api/insightPrefs', () => ({ insightPrefsApi: { get: vi.fn(), save: vi.fn() }, INSIGHT_PREFS_KEY: ['insight-prefs'] }))
import { practicesApi } from '../../api/practices'
import { insightPrefsApi } from '../../api/insightPrefs'
import { OverviewRows } from './OverviewRows'

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><OverviewRows /></MemoryRouter>
  </QueryClientProvider>,
)

beforeEach(() => {
  vi.clearAllMocks()
  setViewportWidth(390)
  useAuthStore.setState({ user: { id: '1', email: 't@e.st', token: 'tok', name: 'Test User' }, token: 'tok' })
  vi.mocked(practicesApi.getGroups).mockResolvedValue([{ id: null, name: '', is_default: true }, { id: 'm', name: 'Morning', is_default: false }])
  vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
    practice('t1', 'Wake-up', 'Time'),
    practice('d1', 'Reading', 'Duration', { group_id: 'm' }),
    practice('d2', 'Japa', 'Duration', { group_id: 'm' }),
    practice('x', 'Old', 'Int', { is_active: false }),
    practice('b', 'Fasting', 'Bool'),
  ])
  vi.mocked(insightPrefsApi.get).mockResolvedValue(null)
  vi.mocked(insightPrefsApi.save).mockResolvedValue(undefined)
})

const switches = (section: HTMLElement) => within(section).getAllByRole('switch').map((s) => [s.getAttribute('aria-label'), s.getAttribute('aria-checked')])

describe('Overview rows', () => {
  it('lists_groups_with_total_first_and_toggles_reflect_defaults', async () => {
    renderPage()
    const morning = (await screen.findByRole('heading', { name: 'Morning' })).closest('section')!
    expect(switches(morning)).toEqual([['Morning · total', 'true'], ['Reading', 'false'], ['Japa', 'false']])
    const def = screen.getByRole('heading', { name: 'Practices' }).closest('section')!
    expect(switches(def)).toEqual([['Wake-up', 'true']])
    expect(screen.queryByRole('switch', { name: /Sleep/ })).toBeNull()
    expect(screen.getByText(/Choose what the Insights overview shows/)).toBeInTheDocument()
  })

  it('toggling_writes_an_override', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('switch', { name: 'Reading' }))
    await waitFor(() => expect(insightPrefsApi.save).toHaveBeenLastCalledWith(expect.objectContaining({ visibility: { d1: true } })))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Reading' })).toHaveAttribute('aria-checked', 'true'))
  })

  it('back_goes_to_insights_settings', async () => {
    renderPage()
    expect((await screen.findAllByRole('link', { name: /Insights/ }))[0]).toHaveAttribute('href', '/settings/charts')
  })

  it('inactive_practices_are_not_listed', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Morning' })
    expect(screen.queryByText('Old')).toBeNull()
    expect(screen.queryByText('Fasting')).toBeNull()
  })
})
