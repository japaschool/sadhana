import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../test/viewport'
import { useToastStore } from '../../../hooks/useToast'
import { YatraSettingsHome } from './SettingsFrame'
import { LinkPracticesMobile } from './mobile/LinkPracticesMobile'
import { AdminSectionMobile } from './mobile/AdminSectionMobile'
import { PracticeEditorMobile } from './mobile/PracticeEditorMobile'
import { mockAdmin, USERS } from './mobile/adminTestUtils'

vi.mock('../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
vi.mock('../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
import { yatrasApi } from '../../../api/yatras'
import { practicesApi } from '../../../api/practices'
const api = vi.mocked(yatrasApi)

function renderAt(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/yatra/:id/settings" element={<YatraSettingsHome />} />
          <Route path="/yatra/:id/links" element={<LinkPracticesMobile />} />
          <Route path="/yatra/:id/admin/:section" element={<AdminSectionMobile />} />
          <Route path="/yatra/:id/practice/:practice_id/edit" element={<PracticeEditorMobile />} />
          <Route path="/yatras" element={<p>Yatras page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] })
  vi.mocked(practicesApi.getUserPractices).mockResolvedValue([])
  api.getYatraUserPractices.mockResolvedValue([
    { yatra_practice: { id: 'p1', practice: 'Japa rounds', data_type: 'Int' }, user_practice: 'Japa rounds' },
    { yatra_practice: { id: 'p4', practice: 'Mangala arati', data_type: 'Bool' }, user_practice: null },
  ])
})

describe('Yatra settings hub (mobile)', () => {
  it('lists Your links with its count, the admin sections and Leave; back goes to Settings', async () => {
    mockAdmin(api)
    api.getYatraUserPractices.mockResolvedValue([
      { yatra_practice: { id: 'p1', practice: 'Japa rounds', data_type: 'Int' }, user_practice: 'Japa rounds' },
      { yatra_practice: { id: 'p4', practice: 'Mangala arati', data_type: 'Bool' }, user_practice: null },
    ])
    renderAt('/yatra/y1/settings')
    expect(await screen.findByRole('link', { name: /Your links\s*1 \/ 2/ })).toHaveAttribute('href', '/yatra/y1/links')
    expect(screen.getByRole('heading', { name: 'Yatra settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Practices\s*5/ })).toHaveAttribute('href', '/yatra/y1/admin/practices')
    expect(screen.getByRole('link', { name: /Danger zone/ })).toHaveAttribute('href', '/yatra/y1/admin/danger')
    // The back link, then the tab bar's, which is the selected tab.
    const settings = screen.getAllByRole('link', { name: 'Settings' })
    expect(settings.map((l) => l.getAttribute('href'))).toEqual(['/settings', '/settings'])
    expect(settings[1].querySelector('.text-ui-accent')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Leave yatra' })).toBeInTheDocument()
  })

  it('members see Your links and Leave, no admin sections', async () => {
    mockAdmin(api, { admin: false })
    renderAt('/yatra/y1/settings')
    expect(await screen.findByRole('link', { name: /Your links/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /General/ })).toBeNull()
  })

  it('a member opening an admin URL lands on the hub', async () => {
    mockAdmin(api, { admin: false })
    renderAt('/yatra/y1/admin/members')
    expect(await screen.findByRole('heading', { name: 'Yatra settings' })).toBeInTheDocument()
  })
})

describe('Leave yatra', () => {
  it('asks first, then leaves and goes to the Yatras screen', async () => {
    mockAdmin(api, { admin: false })
    api.leaveYatra.mockResolvedValue()
    renderAt('/yatra/y1/settings')
    fireEvent.click(await screen.findByRole('button', { name: 'Leave yatra' }))
    const sheet = screen.getByRole('dialog', { name: "Leave Balarama's League?" })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Leave yatra' }))
    expect(await screen.findByText('Yatras page')).toBeInTheDocument()
    expect(api.leaveYatra).toHaveBeenCalledWith('y1')
  })

  it('the last admin gets the explanation and nothing is sent', async () => {
    mockAdmin(api, { users: [USERS[0], USERS[2]] }) // u1 is the only admin
    renderAt('/yatra/y1/settings')
    fireEvent.click(await screen.findByRole('button', { name: 'Leave yatra' }))
    const sheet = screen.getByRole('dialog', { name: "You're the last admin" })
    expect(within(sheet).getByRole('link', { name: 'Choose another admin' })).toHaveAttribute('href', '/yatra/y1/admin/members')
    expect(within(sheet).getByRole('link', { name: 'Delete yatra…' })).toHaveAttribute('href', '/yatra/y1/admin/danger')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.leaveYatra).not.toHaveBeenCalled()
  })
})

describe('Tablet and desktop', () => {
  it('tablet: /settings opens Your links beside the section column, keeping ?joined', async () => {
    setViewportWidth(834)
    mockAdmin(api)
    renderAt('/yatra/y1/settings?joined=1')
    const nav = await screen.findByRole('navigation', { name: 'Yatra settings' })
    expect(await within(nav).findByRole('link', { name: /Your links/ })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: /Members\s*3/ })).toHaveAttribute('href', '/yatra/y1/admin/members')
    expect(await screen.findByRole('heading', { name: "You've joined Balarama's League" })).toBeInTheDocument()
  })

  it('desktop: a practice opens in a panel beside the list', async () => {
    setViewportWidth(1440)
    mockAdmin(api)
    renderAt('/yatra/y1/practice/p1/edit')
    const panel = await screen.findByRole('region', { name: 'Japa rounds' })
    expect(within(panel).getByLabelText('Name')).toHaveValue('Japa rounds')
    expect(screen.getByRole('link', { name: /Japa rounds/, current: true })).toBeInTheDocument()
  })

  it('desktop: members have their own Admin toggle and Remove, which asks first', async () => {
    setViewportWidth(1440)
    mockAdmin(api)
    renderAt('/yatra/y1/admin/members')
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Madhava das?' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove Madhava das?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith('y1', 'u3'))
    fireEvent.click(screen.getByRole('switch', { name: 'Admin: Gaura Priya devi dasi' }))
    await waitFor(() => expect(api.toggleAdmin).toHaveBeenCalledWith('y1', 'u2'))
  })
})
