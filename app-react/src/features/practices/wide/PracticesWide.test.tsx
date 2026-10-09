import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../test/viewport'
import type { UserPractice } from '../../../types/api'
import { PracticesWide } from './PracticesWide'

vi.mock('../../../api/practices', () => ({
  practicesApi: {
    getUserPractices: vi.fn(), createUserPractice: vi.fn(), updateUserPractice: vi.fn(),
    deleteUserPractice: vi.fn(), reorderUserPractices: vi.fn(),
  },
}))
import { practicesApi } from '../../../api/practices'
const api = vi.mocked(practicesApi)

const PRACTICES: UserPractice[] = [
  { id: 'p1', practice: 'Japa rounds', data_type: 'Int', is_active: true, is_required: true },
  { id: 'p2', practice: 'Lectures', data_type: 'Duration', is_active: false },
]

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {['/settings/practices', '/settings/practices/new', '/settings/practices/:id'].map((p) => <Route key={p} path={p} element={<PracticesWide />} />)}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PracticesWide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(834, 1112)
    api.getUserPractices.mockResolvedValue(PRACTICES)
    api.updateUserPractice.mockResolvedValue()
    api.deleteUserPractice.mockResolvedValue()
  })

  it('opens a tapped row in the editor beside the list, and Cancel goes back to the prompt', async () => {
    renderAt('/settings/practices')
    expect(await screen.findByText('Select a practice to edit it, or add a new one.')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /^Japa rounds/ }))
    const panel = await screen.findByRole('region', { name: 'Japa rounds' })
    expect(screen.getByRole('button', { name: /^Japa rounds/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByText('Select a practice to edit it, or add a new one.')).toBeInTheDocument()
  })

  it('opens Add beside an empty list', async () => {
    api.getUserPractices.mockResolvedValue([])
    renderAt('/settings/practices')
    expect(await screen.findByText('No practices yet')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '+ Add your first practice' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'New practice' })).toBeInTheDocument()
  })

  it('deletes on desktop only after the confirm dialog', async () => {
    setViewportWidth(1440, 900)
    renderAt('/settings/practices/p1')
    const panel = await screen.findByRole('region', { name: 'Japa rounds' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete…' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete “Japa rounds”?' })).getByRole('button', { name: 'Delete practice' }))
    await waitFor(() => expect(api.deleteUserPractice).toHaveBeenCalledWith('p1'))
    expect(await screen.findByText('Select a practice to edit it, or add a new one.')).toBeInTheDocument()
  })
})
