import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShareLinksData } from '../../api/shareLinks'
import { setViewportWidth } from '../../test/viewport'
import { useAuthStore } from '../../store/authStore'
import { useToastStore } from '../../hooks/useToast'

vi.mock('../../api/shareLinks', async (orig) => {
  const real = await orig<typeof import('../../api/shareLinks')>()
  const { useQuery } = await import('@tanstack/react-query')
  const shareLinksApi = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), setLegacy: vi.fn() }
  // The real hook holds the real api object, so it's rebuilt over the mocked one.
  const useShareLinks = () => {
    const q = useQuery({ queryKey: real.SHARE_LINKS_KEY, queryFn: shareLinksApi.list })
    return { data: q.data, isLoading: q.isLoading }
  }
  return { ...real, shareLinksApi, useShareLinks }
})
import { shareLinksApi } from '../../api/shareLinks'
import { ShareLinkEditor, Sharing } from './Sharing'

const DATA: ShareLinksData = {
  links: [
    { id: 'l1', name: 'Friend', start_date: '2026-10-31', last_opened_at: null, report_ids: ['a', 'b'] },
    { id: 'l2', name: 'Teacher', start_date: null, last_opened_at: '2026-11-05T10:00:00Z', report_ids: ['a', 'b', 'c'] },
  ],
  reports: [
    { id: 'a', name: 'Sleep', kind: 'Graph', practices: ['Wake up', 'Bed time'] },
    { id: 'b', name: 'Japa', kind: 'Grid', practices: ['Rounds'] },
    { id: 'c', name: 'Discipline', kind: 'Panels', practices: ['Rounds', 'Reading', 'Celibacy'] },
  ],
  legacy_enabled: true,
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings/sharing" element={<Sharing />} />
          <Route path="/settings/sharing/new" element={<ShareLinkEditor />} />
          <Route path="/settings/sharing/:id" element={<ShareLinkEditor />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const writeText = vi.fn()
const toasts = () => useToastStore.getState().toasts.map(({ message, variant }) => ({ message, variant }))

beforeEach(() => {
  vi.clearAllMocks()
  setViewportWidth(390)
  useToastStore.setState({ toasts: [] })
  useAuthStore.setState({ user: { id: '1', email: 't@e.st', token: 'tok', name: 'Test User' }, token: 'tok' })
  vi.mocked(shareLinksApi.list).mockResolvedValue(DATA)
  vi.mocked(shareLinksApi.create).mockImplementation(async (form) => {
    vi.mocked(shareLinksApi.list).mockResolvedValue({ ...DATA, links: [{ id: 'l9', ...form, last_opened_at: null }, ...DATA.links] })
    return 'l9'
  })
  vi.mocked(shareLinksApi.update).mockResolvedValue(undefined)
  vi.mocked(shareLinksApi.remove).mockResolvedValue(undefined)
  vi.mocked(shareLinksApi.setLegacy).mockResolvedValue(undefined)
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})
afterEach(() => { localStorage.clear() })

describe('Settings → Sharing', () => {
  it('lists links with summary and copies a link', async () => {
    renderAt('/settings/sharing')
    const list = await screen.findByRole('list', { name: 'Your links' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent(/Friend.*Sleep, Japa · opens on Oct 31/)
    expect(rows[1]).toHaveTextContent(/Teacher.*3 charts · opens today · last opened Nov 5/)
    expect(within(rows[0]).getByRole('link', { name: /Friend/ })).toHaveAttribute('href', '/settings/sharing/l1')
    fireEvent.click(within(rows[0]).getByRole('button', { name: /Copy/ }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/shared/l1`)
    await waitFor(() => expect(toasts()).toContainEqual({ message: 'Link copied', variant: 'success' }))
  })

  it('legacy toggle calls setLegacy(false)', async () => {
    renderAt('/settings/sharing')
    const toggle = await screen.findByRole('switch', { name: 'Old public link' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Shows all your charts and data to anyone with the old link.')).toBeInTheDocument()
    fireEvent.click(toggle)
    await waitFor(() => expect(shareLinksApi.setLegacy).toHaveBeenCalledWith(false))
  })

  it('new link: name, tick two reports, pick a date, save → create', async () => {
    renderAt('/settings/sharing/new')
    fireEvent.change(await screen.findByLabelText('Who is it for?'), { target: { value: ' Mentor ' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Sleep/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Discipline/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Date' }))
    fireEvent.change(screen.getByLabelText('Opening date'), { target: { value: '2026-10-31' } })
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(shareLinksApi.create).toHaveBeenCalledWith({ name: 'Mentor', start_date: '2026-10-31', report_ids: ['a', 'c'] }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/settings/sharing/l9'))
    expect(screen.getByLabelText('Who is it for?')).toHaveValue('Mentor')
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it("editor shows each report's practices", async () => {
    renderAt('/settings/sharing/new')
    const item = (await screen.findByRole('checkbox', { name: /Discipline/ })).closest('label')!
    expect(item).toHaveTextContent('Template')
    expect(item).toHaveTextContent('Rounds, Reading, Celibacy')
    expect(screen.getByRole('checkbox', { name: /Japa/ }).closest('label')).toHaveTextContent('Table')
  })

  it('Today saves start_date null', async () => {
    renderAt('/settings/sharing/l1')
    expect(await screen.findByLabelText('Who is it for?')).toHaveValue('Friend')
    expect(screen.getByRole('checkbox', { name: /Sleep/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Discipline/ })).not.toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: 'Today' }))
    expect(screen.queryByLabelText('Opening date')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(shareLinksApi.update).toHaveBeenCalledWith('l1', { name: 'Friend', start_date: null, report_ids: ['a', 'b'] }))
  })

  it('keeps report ids it cannot show when saving', async () => {
    vi.mocked(shareLinksApi.list).mockResolvedValue({
      ...DATA, links: [{ id: 'l1', name: 'Friend', start_date: null, last_opened_at: null, report_ids: ['a', 'zz'] }],
    })
    renderAt('/settings/sharing/l1')
    fireEvent.click(await screen.findByRole('checkbox', { name: /Japa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(shareLinksApi.update).toHaveBeenCalledWith('l1', { name: 'Friend', start_date: null, report_ids: ['a', 'b', 'zz'] }))
  })

  it('save error keeps the edits and shows a toast', async () => {
    vi.mocked(shareLinksApi.update).mockRejectedValue(new Error('422'))
    renderAt('/settings/sharing/l1')
    fireEvent.change(await screen.findByLabelText('Who is it for?'), { target: { value: 'Old friend' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(toasts()).toContainEqual({ message: 'Something went wrong', variant: 'error' }))
    expect(screen.getByLabelText('Who is it for?')).toHaveValue('Old friend')
  })

  it('withdraw asks first, then remove(l1) and back to the list', async () => {
    renderAt('/settings/sharing/l1')
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw access' }))
    expect(shareLinksApi.remove).not.toHaveBeenCalled()
    const confirm = screen.getByRole('dialog', { name: 'Withdraw access for Friend?' })
    expect(confirm).toHaveTextContent('The link will stop working for good.')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => expect(shareLinksApi.remove).toHaveBeenCalledWith('l1'))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/settings\/sharing$/))
  })

  it('Save disabled for a blank name', async () => {
    renderAt('/settings/sharing/new')
    const save = await screen.findByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Who is it for?'), { target: { value: '   ' } })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Who is it for?'), { target: { value: 'Mentor' } })
    expect(save).toBeEnabled()
  })
})
