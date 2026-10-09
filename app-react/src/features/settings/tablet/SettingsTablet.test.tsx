import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsTabletScreen } from './SettingsTablet'
import { setViewportWidth } from '../../../test/viewport'
import { useAuthStore } from '../../../store/authStore'

vi.mock('../../../api/yatras', () => ({ yatrasApi: { getYatras: vi.fn(), getYatraUsers: vi.fn() } }))
import { yatrasApi } from '../../../api/yatras'
vi.mock('../../../hooks/useServiceWorkerUpdate', () => ({ useServiceWorkerUpdate: () => ({ updateReady: false, applyUpdate: vi.fn() }) }))

describe('SettingsTablet', () => {
  beforeEach(() => {
    setViewportWidth(834)
    useAuthStore.setState({ user: { id: '1', email: 't@e.st', token: 'tok', name: 'Test User' }, token: 'tok' })
    vi.mocked(yatrasApi.getYatras).mockResolvedValue([])
  })

  const renderScreen = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/settings']}><SettingsTabletScreen /></MemoryRouter>
    </QueryClientProvider>,
  )

  it('shows Preferences first and switches the detail pane by section', () => {
    renderScreen()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 2, name: 'Preferences' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Preview channel' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Account & data' }))
    expect(screen.getByRole('button', { name: 'Account & data' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: /Change password/ })).toHaveAttribute('href', '/settings/edit-password')
    expect(screen.queryByRole('switch', { name: 'Preview channel' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(screen.getByRole('dialog', { name: 'Log out?' })).toBeInTheDocument()
  })

  it('has a Yatras section with each yatra and my role, to its settings', async () => {
    vi.mocked(yatrasApi.getYatras).mockResolvedValue([{ id: 'y1', name: 'League', show_stability_metrics: false }])
    vi.mocked(yatrasApi.getYatraUsers).mockResolvedValue([{ user_id: '1', user_name: 'Test User', is_admin: true }])
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Yatras' }))
    const row = await screen.findByRole('link', { name: /League/ })
    expect(row).toHaveAttribute('href', '/yatra/y1/settings')
    expect(await within(row).findByText('Admin')).toBeInTheDocument()
  })

  it('hides the Yatras section without yatras', async () => {
    renderScreen()
    await waitFor(() => expect(yatrasApi.getYatras).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Yatras' })).toBeNull()
  })
})
