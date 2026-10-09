import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import i18n from 'i18next'
import { SettingsMobileScreen } from './SettingsMobile'
import { setViewportWidth } from '../../../test/viewport'
import { useAuthStore } from '../../../store/authStore'
import { useServiceWorkerUpdate } from '../../../hooks/useServiceWorkerUpdate'

vi.mock('../../../hooks/useServiceWorkerUpdate', () => ({ useServiceWorkerUpdate: vi.fn() }))
vi.mock('../../../api/yatras', () => ({ yatrasApi: { getYatras: vi.fn(), getYatraUsers: vi.fn() } }))
import { yatrasApi } from '../../../api/yatras'
vi.mock('../../../api/charts', () => ({ chartsApi: { getReports: vi.fn() } }))
import { chartsApi } from '../../../api/charts'
vi.mock('../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
import { practicesApi } from '../../../api/practices'
const swUpdate = vi.mocked(useServiceWorkerUpdate)

const realLocation = window.location

function renderScreen(name = 'Test User') {
  useAuthStore.setState({ user: { id: '1', email: 't@e.st', token: 'tok', name }, token: 'tok' })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsMobileScreen />} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SettingsMobile', () => {
  beforeEach(() => {
    setViewportWidth(390)
    swUpdate.mockReturnValue({ updateReady: false, applyUpdate: vi.fn() })
    vi.mocked(yatrasApi.getYatras).mockResolvedValue([])
    vi.mocked(chartsApi.getReports).mockResolvedValue([])
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([])
  })
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    document.documentElement.removeAttribute('data-ui-theme')
    Reflect.deleteProperty(document, 'cookie')
    Object.defineProperty(window, 'location', { value: realLocation, configurable: true })
  })

  it('shows the title and a profile card linking to user details', () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    const card = screen.getByRole('link', { name: /Test User/ })
    expect(card).toHaveAttribute('href', '/settings/edit-user')
    expect(within(card).getByText('TU')).toBeInTheDocument()
    expect(within(card).getByText('User details')).toBeInTheDocument()
  })

  it.each([
    ['', '?'],
    ['   ', '?'],
    ['ada', 'A'],
    ['  ada   lovelace  byron ', 'AL'],
    ['анна мария', 'АМ'],
  ])('initials for %j are %s', (name, expected) => {
    renderScreen(name)
    expect(screen.getByTestId('avatar')).toHaveTextContent(expected)
  })

  it('links rows to their pages; About opens the site in a new tab', () => {
    renderScreen()
    expect(screen.getByRole('link', { name: 'Change password' })).toHaveAttribute('href', '/settings/edit-password')
    expect(screen.getByRole('link', { name: 'Import CSV' })).toHaveAttribute('href', '/settings/import')
    expect(screen.getByRole('link', { name: 'Help and support' })).toHaveAttribute('href', '/help')
    const about = screen.getByRole('link', { name: 'About' })
    expect(about).toHaveAttribute('href', 'https://sadhana.pro')
    expect(about).toHaveAttribute('target', '_blank')
    expect(about).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('picks a language from the menu', () => {
    const change = vi.spyOn(i18n, 'changeLanguage').mockResolvedValue(undefined as never)
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /Language.*English/ }))
    const items = screen.getAllByRole('menuitemradio')
    expect(items.map((i) => i.textContent?.replace('✓', ''))).toEqual(['English', 'Русский', 'Українська'])
    expect(screen.getByRole('menuitemradio', { name: /English/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Русский/ }))
    expect(change).toHaveBeenCalledWith('ru')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('switches theme with the segmented control', () => {
    renderScreen()
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement).toHaveAttribute('data-ui-theme', 'dark')
    fireEvent.click(screen.getByRole('radio', { name: 'Auto' }))
    expect(document.documentElement).not.toHaveAttribute('data-ui-theme')
  })

  it('preview toggle writes the cookie and reloads', () => {
    const writes: string[] = []
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: (v: string) => { writes.push(v) } })
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, configurable: true })
    renderScreen()
    const sw = screen.getByRole('switch', { name: 'Preview channel' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(writes).toEqual(['sadhana_release_channel=preview; Path=/; Secure; SameSite=Lax; Max-Age=2592000'])
    expect(reload).toHaveBeenCalledOnce()
  })

  it('shows the update row only when an update is ready', () => {
    const { unmount } = renderScreen()
    expect(screen.queryByRole('button', { name: /Update available/ })).toBeNull()
    unmount()
    const applyUpdate = vi.fn()
    swUpdate.mockReturnValue({ updateReady: true, applyUpdate })
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /Update available/ }))
    expect(applyUpdate).toHaveBeenCalledOnce()
  })

  it('Logout asks first; Confirm logs out and goes to /login', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    const sheet = screen.getByRole('dialog', { name: 'Log out?' })
    expect(within(sheet).getByText('Are you sure you want to log out?')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Log out' }))
    expect(useAuthStore.getState().token).toBeNull()
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('Cancel closes the sheet without logging out', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useAuthStore.getState().token).toBe('tok')
  })

  it('Escape closes the sheet without logging out', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useAuthStore.getState().token).toBe('tok')
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
