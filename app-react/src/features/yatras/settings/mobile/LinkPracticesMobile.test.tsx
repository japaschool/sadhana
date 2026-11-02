import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useAuthStore } from '../../../../store/authStore'
import { useToastStore } from '../../../../hooks/useToast'
import { LinkPracticesMobile } from './LinkPracticesMobile'

vi.mock('../../../../api/yatras', () => ({
  yatrasApi: { getYatras: vi.fn(), getYatraUserPractices: vi.fn(), updateYatraUserPractices: vi.fn(), getYatraUsers: vi.fn(), leaveYatra: vi.fn() },
}))
vi.mock('../../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn(), createUserPractice: vi.fn() } }))
import { yatrasApi } from '../../../../api/yatras'
import { practicesApi } from '../../../../api/practices'
const api = vi.mocked(yatrasApi)

const GuideProbe = () => <p>Guide {JSON.stringify(useLocation().state)}</p>

export function renderLinkScreen(url = '/yatra/y1/links') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/yatra/:id/links" element={<LinkPracticesMobile />} />
          <Route path="/yatra/:id/settings" element={<p>Hub</p>} />
          <Route path="/settings/practices" element={<p>My practices</p>} />
          <Route path="/yatras" element={<p>Yatras page</p>} />
          <Route path="/guide" element={<GuideProbe />} />
          <Route path="/" element={<p>Today</p>} />
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
    expect(screen.getByRole('link', { name: 'Add one in My practices ›' })).toHaveAttribute('href', '/settings/practices')
  })

  it('says so when the yatra has no practices yet', async () => {
    api.getYatraUserPractices.mockResolvedValue([])
    renderLinkScreen()
    expect(await screen.findByText('No practices yet')).toBeInTheDocument()
    expect(screen.getByText("Once the yatra has practices, you'll link yours here.")).toBeInTheDocument()
    expect(screen.queryByText(/All 0 linked/)).toBeNull()
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
    renderLinkScreen('/yatra/y1/links?joined=1')
    expect(await screen.findByRole('heading', { name: "You've joined Balarama's League" })).toBeInTheDocument()
  })

  it('goes back to the hub, which has Leave and the admin sections', async () => {
    mockLinkApi(true)
    renderLinkScreen()
    await screen.findByText('1 of 3 linked')
    expect(screen.getByRole('link', { name: "Balarama's League" })).toHaveAttribute('href', '/yatra/y1/settings')
    expect(screen.queryByRole('button', { name: 'Leave yatra' })).toBeNull()
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

describe('Create all and link', () => {
  let mine: { id: string; practice: string; data_type: 'Int' | 'Duration' | 'Text'; is_active: boolean }[]
  const linked = () => api.updateYatraUserPractices.mock.calls.at(-1)![1].map((i) => i.user_practice)

  beforeEach(() => {
    vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockLinkApi()
    api.getYatraUserPractices.mockResolvedValue([
      { yatra_practice: { id: 'a', practice: 'Japa rounds', data_type: 'Int' }, user_practice: null },
      { yatra_practice: { id: 'b', practice: 'Hearing lectures', data_type: 'Duration' }, user_practice: null },
      { yatra_practice: { id: 'c', practice: "Day's realisation", data_type: 'Text' }, user_practice: null },
    ])
    mine = []
    vi.mocked(practicesApi.getUserPractices).mockImplementation(async () => mine.map((p) => ({ ...p })))
    vi.mocked(practicesApi.createUserPractice).mockImplementation(async (d) => { mine.push({ id: String(mine.length + 1), practice: d.practice, data_type: d.data_type as 'Int', is_active: true }) })
  })

  it('offers Create all and link only with no active practices', async () => {
    renderLinkScreen()
    expect(await screen.findByRole('button', { name: 'Create all and link' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Create and link' })).toHaveLength(3)
  })

  it('an existing member with practices sees no change', async () => {
    mine = [{ id: '1', practice: 'Japa rounds', data_type: 'Int', is_active: true }]
    renderLinkScreen()
    await screen.findByText('0 of 3 linked')
    expect(screen.queryByRole('button', { name: 'Create all and link' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Create and link' })).toBeNull()
  })

  it('creates each practice with the yatra name and type, then links them all', async () => {
    renderLinkScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Create all and link' }))
    expect(await screen.findByText('All 3 linked')).toBeInTheDocument()
    expect(vi.mocked(practicesApi.createUserPractice).mock.calls.map(([d]) => [d.practice, d.data_type])).toEqual([
      ['Japa rounds', 'Int'], ['Hearing lectures', 'Duration'], ["Day's realisation", 'Text'],
    ])
    await waitFor(() => expect(linked()).toEqual(['Japa rounds', 'Hearing lectures', "Day's realisation"]))
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('a row creates and links just its own practice', async () => {
    renderLinkScreen()
    const row = (await screen.findByText('Hearing lectures')).closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: 'Create and link' }))
    expect(await screen.findByText('1 of 3 linked')).toBeInTheDocument()
    expect(vi.mocked(practicesApi.createUserPractice)).toHaveBeenCalledOnce()
    await waitFor(() => expect(linked()).toEqual([null, 'Hearing lectures', null]))
    expect(screen.getAllByRole('button', { name: 'Create and link' })).toHaveLength(2)
  })

  it('a hidden practice of the same name stops that row with a message, the rest still link', async () => {
    mine = [{ id: '9', practice: 'Hearing lectures', data_type: 'Duration', is_active: false }]
    renderLinkScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Create all and link' }))
    expect(await screen.findByText('2 of 3 linked')).toBeInTheDocument()
    const row = screen.getByText('Hearing lectures').closest('li')!
    expect(within(row).getByText(/hidden/)).toBeInTheDocument()
    expect(vi.mocked(practicesApi.createUserPractice).mock.calls.map(([d]) => d.practice)).toEqual(['Japa rounds', "Day's realisation"])
    await waitFor(() => expect(linked()).toEqual(['Japa rounds', null, "Day's realisation"]))
  })

  it('a failed create keeps the others and shows the row message', async () => {
    vi.mocked(practicesApi.createUserPractice).mockImplementationOnce(async () => { throw new Error('x') })
    renderLinkScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Create all and link' }))
    expect(await screen.findByText('2 of 3 linked')).toBeInTheDocument()
    const row = screen.getByText('Japa rounds').closest('li')!
    expect(within(row).getByText(/Couldn.t create/)).toBeInTheDocument()
  })

  it('joined=1 shows Start logging once all are linked, going to /', async () => {
    renderLinkScreen('/yatra/y1/links?joined=1')
    expect(screen.queryByRole('link', { name: 'Start logging' })).toBeNull()
    await screen.findByRole('link', { name: /Help me choose/ })
    fireEvent.click(await screen.findByRole('button', { name: 'Create all and link' }))
    const start = await screen.findByRole('link', { name: 'Start logging' })
    expect(start).toHaveAttribute('href', '/')
    expect(screen.getByText('3 practices were created and linked. They are on Today now, under the yatra’s names.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Help me choose/ }))
    expect(await screen.findByText('Guide {"back":"/yatra/y1/links?joined=1"}')).toBeInTheDocument()
  })
})
