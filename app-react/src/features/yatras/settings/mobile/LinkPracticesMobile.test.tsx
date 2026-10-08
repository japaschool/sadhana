import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useAuthStore } from '../../../../store/authStore'
import { useToastStore } from '../../../../hooks/useToast'
import { LinkPracticesMobileScreen } from './LinkPracticesMobile'

vi.mock('../../../../api/yatras', () => ({
  yatrasApi: { getYatras: vi.fn(), getYatraUserPractices: vi.fn(), updateYatraUserPractices: vi.fn(), getYatraUsers: vi.fn(), leaveYatra: vi.fn() },
}))
vi.mock('../../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
import { yatrasApi } from '../../../../api/yatras'
import { practicesApi } from '../../../../api/practices'
const api = vi.mocked(yatrasApi)

export function renderLinkScreen(url = '/yatra/y1/settings') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/yatra/:id/settings" element={<LinkPracticesMobileScreen />} />
          <Route path="/yatra/:id/admin/settings" element={<p>Admin hub</p>} />
          <Route path="/user/practices" element={<p>My practices</p>} />
          <Route path="/yatras" element={<p>Yatras page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

export function mockLinkApi(isAdmin = false) {
  useAuthStore.setState({ user: { id: 'u1', email: '', token: 't', name: 'Me' }, token: 't' })
  api.getYatras.mockResolvedValue([{ id: 'y1', name: "Balarama's League", show_stability_metrics: false }])
  api.getYatraUserPractices.mockResolvedValue([
    { yatra_practice: { id: 'a', practice: 'Japa rounds', data_type: 'Int' }, user_practice: 'Japa rounds' },
    { yatra_practice: { id: 'b', practice: 'Hearing lectures', data_type: 'Duration' }, user_practice: null },
    { yatra_practice: { id: 'c', practice: "Day's realisation", data_type: 'Text' }, user_practice: null },
  ])
  api.getYatraUsers.mockResolvedValue([
    { user_id: 'u1', user_name: 'Me', is_admin: isAdmin },
    { user_id: 'u2', user_name: 'Other', is_admin: false },
  ])
  api.updateYatraUserPractices.mockResolvedValue()
  vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
    { id: '1', practice: 'Japa rounds', data_type: 'Int', is_active: true },
    { id: '2', practice: 'Lecture listening', data_type: 'Duration', is_active: true },
  ])
}

describe('LinkPracticesMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockLinkApi() })

  it('shows the count, the unlinked summary and one row per yatra practice', async () => {
    renderLinkScreen()
    expect(await screen.findByText('1 of 3 linked')).toBeInTheDocument()
    expect(screen.getByText("Your entries for Hearing lectures and Day's realisation won't appear in the table.")).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Link your practices' })).toBeInTheDocument()
    expect(screen.getByText('You have no Text practice')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add one in My practices ›' })).toHaveAttribute('href', '/user/practices')
  })

  it('links a suggestion from its row and offers Undo', async () => {
    renderLinkScreen()
    const row = (await screen.findByText('Hearing lectures')).closest('li')!
    expect(within(row).getByText('Lecture listening')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: 'Link' }))
    expect(await screen.findByText('2 of 3 linked')).toBeInTheDocument()
    await waitFor(() => expect(api.updateYatraUserPractices).toHaveBeenCalledOnce())
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('"Link N suggested matches" links them all in one request', async () => {
    renderLinkScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Link 1 suggested match' }))
    await waitFor(() => expect(api.updateYatraUserPractices).toHaveBeenCalledOnce())
    expect(api.updateYatraUserPractices.mock.calls[0][1].map((i) => i.user_practice)).toEqual(['Japa rounds', 'Lecture listening', null])
  })

  it('shows the joined header after joining', async () => {
    renderLinkScreen('/yatra/y1/settings?joined=1')
    expect(await screen.findByRole('heading', { name: "You've joined Balarama's League" })).toBeInTheDocument()
  })

  it('shows Manage yatra only to admins', async () => {
    renderLinkScreen()
    await screen.findByText('1 of 3 linked')
    expect(screen.queryByRole('link', { name: /Manage yatra/ })).toBeNull()
  })

  it('admins get Manage yatra to the admin hub', async () => {
    mockLinkApi(true)
    renderLinkScreen()
    expect(await screen.findByRole('link', { name: /Manage yatra/ })).toHaveAttribute('href', '/yatra/y1/admin/settings')
  })
})
describe('LinkPickerSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockLinkApi()
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: '1', practice: 'Japa rounds', data_type: 'Int', is_active: true },
      { id: '2', practice: 'Lecture listening', data_type: 'Duration', is_active: true },
      { id: '3', practice: 'Book reading', data_type: 'Duration', is_active: true },
      { id: '4', practice: 'Wake-up time', data_type: 'Time', is_active: true },
      { id: '5', practice: 'Exercise', data_type: 'Duration', is_active: false },
    ])
    api.getYatraUserPractices.mockResolvedValue([
      { yatra_practice: { id: 'a', practice: 'Reading', data_type: 'Duration' }, user_practice: 'Book reading' },
      { yatra_practice: { id: 'b', practice: 'Hearing lectures', data_type: 'Duration' }, user_practice: null },
    ])
  })

  async function openPicker() {
    renderLinkScreen()
    const row = (await screen.findByText('Hearing lectures')).closest('li')!
    fireEvent.click(within(row).getByText('Lecture listening'))
    return screen.getByRole('dialog', { name: 'Link to “Hearing lectures”' })
  }

  it('lists every practice in its group, with reasons', async () => {
    const sheet = await openPicker()
    expect(within(sheet).getByText('Only Duration practices can fill it')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /Lecture listening/ })).toBeInTheDocument()
    expect(within(sheet).getByText('Linked to Reading · moving unlinks it there')).toBeInTheDocument()
    expect(within(sheet).getByText('Time of day · this needs a Duration')).toBeInTheDocument()
    expect(within(sheet).getByText('Number · this needs a Duration')).toBeInTheDocument()
    expect(within(sheet).getByText('Inactive · turn it on in My practices')).toBeInTheDocument()
    expect(within(sheet).getByText('Time of day or Duration?')).toBeInTheDocument()
  })

  it('Move here sends one request with the link moved', async () => {
    const sheet = await openPicker()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Move here' }))
    await waitFor(() => expect(api.updateYatraUserPractices).toHaveBeenCalledOnce())
    expect(api.updateYatraUserPractices.mock.calls[0][1].map((i) => i.user_practice)).toEqual([null, 'Book reading'])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("Don't link unlinks a linked row", async () => {
    renderLinkScreen()
    const row = (await screen.findByText('Reading')).closest('li')!
    fireEvent.click(within(row).getByText('Book reading'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Don't link/ }))
    await waitFor(() => expect(api.updateYatraUserPractices.mock.calls[0][1].map((i) => i.user_practice)).toEqual([null, null]))
  })
})
describe('Leave yatra', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }) })

  it('asks first, then leaves and goes to the Yatras screen', async () => {
    mockLinkApi(false)
    api.leaveYatra.mockResolvedValue()
    renderLinkScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Leave yatra' }))
    const sheet = screen.getByRole('dialog', { name: "Leave Balarama's League?" })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Leave yatra' }))
    expect(await screen.findByText('Yatras page')).toBeInTheDocument()
    expect(api.leaveYatra).toHaveBeenCalledWith('y1')
  })

  it('the last admin gets the explanation and nothing is sent', async () => {
    mockLinkApi(true) // u1 is the only admin
    renderLinkScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Leave yatra' }))
    const sheet = screen.getByRole('dialog', { name: "You're the last admin" })
    expect(within(sheet).getByRole('link', { name: 'Choose another admin' })).toHaveAttribute('href', '/yatra/y1/admin/members')
    expect(within(sheet).getByRole('link', { name: 'Delete yatra…' })).toHaveAttribute('href', '/yatra/y1/admin/danger')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.leaveYatra).not.toHaveBeenCalled()
  })
})
