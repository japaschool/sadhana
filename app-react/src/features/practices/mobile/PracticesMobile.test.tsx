import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../test/viewport'
import { useToastStore } from '../../../hooks/useToast'
import type { UserPractice } from '../../../types/api'
import { PracticesMobileScreen } from './PracticesMobile'

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
  { id: 'p3', practice: 'Mood', data_type: 'Text', is_active: true, dropdown_variants: 'Calm, Joyful, Tired, Restless' },
]

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {['/settings/practices', '/settings/practices/new', '/settings/practices/:id'].map((p) => <Route key={p} path={p} element={<PracticesMobileScreen />} />)}
          <Route path="/" element={<p>Today page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PracticesMobile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(390)
    useToastStore.setState({ toasts: [] })
    api.getUserPractices.mockResolvedValue(PRACTICES)
    api.createUserPractice.mockResolvedValue()
    api.updateUserPractice.mockResolvedValue()
    api.deleteUserPractice.mockResolvedValue()
  })

  it('says each row’s state in words, and Show puts a hidden one back on Today', async () => {
    renderAt('/settings/practices')
    expect(await screen.findByText('3 practices · 1 hidden from Today')).toBeInTheDocument()
    expect(screen.getByText('Text · List of 4')).toBeInTheDocument()
    expect(screen.getByText('Hidden from Today')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /^Japa rounds/ })).getByText('Required')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    await waitFor(() => expect(api.updateUserPractice).toHaveBeenCalledWith('p2', expect.objectContaining({ practice: 'Lectures', is_active: true })))
  })

  it('shows the first-time state with no practices', async () => {
    api.getUserPractices.mockResolvedValue([])
    renderAt('/settings/practices')
    expect(await screen.findByText('No practices yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+ Add your first practice' })).toHaveAttribute('href', '/settings/practices/new')
  })

  it('adds a practice with a list of numbers', async () => {
    renderAt('/settings/practices/new')
    const sheet = await screen.findByRole('dialog', { name: 'New practice' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add practice' }))
    expect(within(sheet).getByText('Enter a name')).toBeInTheDocument()
    expect(within(sheet).getByText('Choose a type')).toBeInTheDocument()

    fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Japa in the temple ' } })
    fireEvent.click(within(sheet).getByRole('radio', { name: /Number/ }))
    fireEvent.click(within(sheet).getByRole('switch', { name: 'Pick from a list' }))
    const values = within(sheet).getByLabelText('Add a value')
    fireEvent.change(values, { target: { value: '4' } })
    fireEvent.keyDown(values, { key: 'Enter' })
    fireEvent.change(values, { target: { value: 'eight,8,' } })
    expect(within(sheet).getByText('Comma or Enter adds a value · 4 / 1024')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('switch', { name: 'Required' }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add practice' }))

    await waitFor(() => expect(api.createUserPractice).toHaveBeenCalledWith({
      practice: 'Japa in the temple', data_type: 'Int', is_required: true, dropdown_variants: '4, 8',
    }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('catches a taken name, before and after saving', async () => {
    renderAt('/settings/practices/new')
    await screen.findByText('Text · List of 4')
    const sheet = screen.getByRole('dialog', { name: 'New practice' })
    fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Mood' } })
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Practice “Mood” already exists')

    api.createUserPractice.mockRejectedValue(new AxiosError('x', '422', undefined, undefined,
      { status: 422, data: {}, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }))
    fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Kirtan' } })
    fireEvent.click(within(sheet).getByRole('radio', { name: /Tick/ }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add practice' }))
    expect(await within(sheet).findByText('Practice “Kirtan” already exists')).toBeInTheDocument()
  })

  it('edits: the type is fixed, and turning the list off removes its values on save', async () => {
    renderAt('/settings/practices/p3')
    const sheet = await screen.findByRole('dialog', { name: 'Mood' })
    expect(within(sheet).queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(within(sheet).getByText("Set when the practice was created. It can't be changed.")).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('switch', { name: 'Pick from a list' }))
    expect(within(sheet).getByText('Turning this off removes the 4 values when you save.')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(api.updateUserPractice).toHaveBeenCalledWith('p3', expect.objectContaining({ practice: 'Mood', dropdown_variants: undefined, is_active: true })))
  })

  it('hides from Edit only when saved', async () => {
    renderAt('/settings/practices/p1')
    const sheet = await screen.findByRole('dialog', { name: 'Japa rounds' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Hide' }))
    expect(within(sheet).getByText('Hidden from Today when you save.')).toBeInTheDocument()
    expect(api.updateUserPractice).not.toHaveBeenCalled()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(api.updateUserPractice).toHaveBeenCalledWith('p1', expect.objectContaining({ practice: 'Japa rounds', is_active: false, is_required: true })))
  })

  it('deletes from Edit only after a confirm', async () => {
    renderAt('/settings/practices/p1')
    const sheet = await screen.findByRole('dialog', { name: 'Japa rounds' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete…' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete “Japa rounds”?' })
    expect(api.deleteUserPractice).not.toHaveBeenCalled()
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete practice' }))
    await waitFor(() => expect(api.deleteUserPractice).toHaveBeenCalledWith('p1'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
