import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsTabletScreen } from './SettingsTablet'
import { setViewportWidth } from '../../../test/viewport'
import { useAuthStore } from '../../../store/authStore'

vi.mock('../../../api/yatras', () => ({ yatrasApi: { getYatras: vi.fn(), getYatraUsers: vi.fn() } }))
import { yatrasApi } from '../../../api/yatras'
vi.mock('../../../api/charts', () => ({ chartsApi: { getReports: vi.fn() } }))
import { chartsApi } from '../../../api/charts'
vi.mock('../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
import { practicesApi } from '../../../api/practices'
vi.mock('../../../hooks/useServiceWorkerUpdate', () => ({ useServiceWorkerUpdate: () => ({ updateReady: false, applyUpdate: vi.fn() }) }))

describe('SettingsTablet', () => {
  beforeEach(() => {
    setViewportWidth(834)
    useAuthStore.setState({ user: { id: '1', email: 't@e.st', token: 'tok', name: 'Test User' }, token: 'tok' })
    vi.mocked(yatrasApi.getYatras).mockResolvedValue([])
    vi.mocked(chartsApi.getReports).mockResolvedValue([])
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([])
  })

  const renderScreen = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/settings']}><SettingsTabletScreen /></MemoryRouter>
    </QueryClientProvider>,
  )

  it('stacks every section in one list, no section picker', () => {
    renderScreen()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('switch', { name: 'Preview channel' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Change password/ })).toHaveAttribute('href', '/settings/edit-password')
    expect(screen.queryByRole('button', { name: 'Account & data' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(screen.getByRole('dialog', { name: 'Log out?' })).toBeInTheDocument()
  })

  it('has one Your sadhana group: Insights, Yatras and Practices, each to its list with a count', async () => {
    vi.mocked(chartsApi.getReports).mockResolvedValue([{ id: 'r1', name: 'Morning', definition: { Grid: { practices: [] } } }])
    vi.mocked(yatrasApi.getYatras).mockResolvedValue([])
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: 'p1', practice: 'Japa', data_type: 'Int', is_active: true },
      { id: 'p2', practice: 'Reading', data_type: 'Duration', is_active: true },
    ])
    renderScreen()
    const group = screen.getByRole('region', { name: 'Your sadhana' })
    expect(await within(group).findByRole('link', { name: /Insights\s*1/ })).toHaveAttribute('href', '/settings/charts')
    expect(within(group).getByRole('link', { name: 'Yatras' })).toHaveAttribute('href', '/settings/yatras')
    expect(await within(group).findByRole('link', { name: /Practices\s*2/ })).toHaveAttribute('href', '/settings/practices')
  })
})
