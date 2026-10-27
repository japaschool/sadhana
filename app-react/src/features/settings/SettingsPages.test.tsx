import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { setViewportWidth } from '../../test/viewport'
import { useAuthStore } from '../../store/authStore'
import { UserDetails } from './UserDetails'
import { ChangePassword } from './ChangePassword'
import { SendMessage } from './SendMessage'
import { ImportCsv } from './ImportCsv'

vi.mock('../../api/auth', () => ({ authApi: { updateUser: vi.fn(), updatePassword: vi.fn() } }))
import { authApi } from '../../api/auth'
vi.mock('../../api/support', () => ({ supportApi: { sendMessage: vi.fn() } }))
import { supportApi } from '../../api/support'
vi.mock('../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn(), saveDiaryDay: vi.fn(), createUserPractice: vi.fn() } }))
import { practicesApi } from '../../api/practices'
vi.mock('../../api/yatras', () => ({ yatrasApi: { getYatras: vi.fn().mockResolvedValue([]) } }))
vi.mock('../../api/charts', () => ({ chartsApi: { getReports: vi.fn().mockResolvedValue([]) } }))

function renderAt(path: string, element: ReactElement) {
  useAuthStore.setState({ user: { id: '1', email: 'alex@example.org', token: 'tok', name: 'Alex das' }, token: 'tok' })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="/settings" element={<p>Settings page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const http = (status: number) => new AxiosError('x', String(status), undefined, undefined,
  { status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() }, data: null })

beforeEach(() => setViewportWidth(390))
afterEach(() => vi.clearAllMocks())

describe('UserDetails', () => {
  it('saves only a real change of at least 3 characters, and shows the new name', async () => {
    vi.mocked(authApi.updateUser).mockResolvedValue()
    renderAt('/settings/edit-user', <UserDetails />)
    const save = screen.getByRole('button', { name: 'Save' })
    const name = screen.getByLabelText('Name')
    expect(save).toBeDisabled()
    fireEvent.change(name, { target: { value: 'Al' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Name must be at least 3 characters')
    expect(save).toBeDisabled()
    fireEvent.change(name, { target: { value: ' Alex Dasanudas ' } })
    fireEvent.click(save)
    await waitFor(() => expect(useAuthStore.getState().user?.name).toBe('Alex Dasanudas'))
    expect(authApi.updateUser).toHaveBeenCalledWith('Alex Dasanudas')
  })

  it('keeps the edit and says so when saving fails', async () => {
    vi.mocked(authApi.updateUser).mockRejectedValue(http(500))
    renderAt('/settings/edit-user', <UserDetails />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex D' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText("Couldn't save your name")).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Alex D')
  })
})

describe('ChangePassword', () => {
  const fill = (current: string, next: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: current } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: next } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } })
  }

  it('blocks the button on a mismatch, checked on the device', () => {
    renderAt('/settings/edit-password', <ChangePassword />)
    fill('oldpass', 'gauranga108', 'gauranga109')
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Show password' })).toHaveLength(3)
  })

  it('shows a wrong current password under that field', async () => {
    vi.mocked(authApi.updatePassword).mockRejectedValue(http(401))
    renderAt('/settings/edit-password', <ChangePassword />)
    fill('oldpass', 'gauranga108', 'gauranga108')
    expect(screen.getByText('Passwords match')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
    expect(authApi.updatePassword).toHaveBeenCalledWith('oldpass', 'gauranga108')
  })

  it('goes back to Settings when changed (mobile)', async () => {
    vi.mocked(authApi.updatePassword).mockResolvedValue()
    renderAt('/settings/edit-password', <ChangePassword />)
    fill('oldpass', 'gauranga108', 'gauranga108')
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Settings page')).toBeInTheDocument()
  })
})

describe('SendMessage', () => {
  it('sends subject and message; a failure keeps the text and offers Try again', async () => {
    vi.mocked(supportApi.sendMessage).mockRejectedValueOnce(http(500)).mockResolvedValueOnce()
    renderAt('/help/support-form', <SendMessage />)
    expect(screen.getByText("We'll reply to alex@example.org.")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Average looks wrong' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'It shows 4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Message sent')).toBeInTheDocument()
    expect(supportApi.sendMessage).toHaveBeenLastCalledWith({ subject: 'Average looks wrong', message: 'It shows 4' })
  })
})

describe('ImportCsv', () => {
  beforeEach(() => {
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: 'p1', practice: 'Japa rounds', data_type: 'Int', is_active: true },
      { id: 'p2', practice: 'Mangala arati', data_type: 'Bool', is_active: true },
    ])
    vi.mocked(practicesApi.saveDiaryDay).mockResolvedValue()
  })

  async function pick(csv: string) {
    renderAt('/settings/import', <ImportCsv />)
    await waitFor(() => expect(practicesApi.getUserPractices).toHaveBeenCalled())
    const file = new File([csv], 'sadhana.csv', { type: 'text/csv' })
    fireEvent.change(document.getElementById('import-file')!, { target: { files: [file] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Review columns' }, {}))
  }

  it('lists matched and unmatched columns, then saves every day', async () => {
    await pick('date,Japa rounds,Kirtan,Mangala arati\n2024-10-01,16,30,true\n2024-10-02,12,,')
    expect(await screen.findByText('Matched columns')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 rows' }))
    expect(await screen.findByText('Imported 2 rows')).toBeInTheDocument()
    expect(practicesApi.saveDiaryDay).toHaveBeenCalledWith('2024-10-02', [
      { practice: 'Japa rounds', value: { Int: 12 } }, { practice: 'Mangala arati', value: null },
    ])
  })

  it('adds an unmatched column as a practice without losing the file', async () => {
    await pick('date,Japa rounds,Kirtan\n2024-10-01,16,30')
    vi.mocked(practicesApi.createUserPractice).mockImplementation(async () => {
      vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
        { id: 'p1', practice: 'Japa rounds', data_type: 'Int', is_active: true },
        { id: 'p3', practice: 'Kirtan', data_type: 'Duration', is_active: true },
      ])
      return { id: 'p3' } as never
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Add Kirtan as a practice' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Kirtan')
    fireEvent.click(screen.getByRole('radio', { name: /Duration/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add practice' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add Kirtan as a practice' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 row' }))
    expect(await screen.findByText('Imported 1 row')).toBeInTheDocument()
    expect(practicesApi.saveDiaryDay).toHaveBeenCalledWith('2024-10-01', [
      { practice: 'Japa rounds', value: { Int: 16 } }, { practice: 'Kirtan', value: { Duration: 30 } },
    ])
  })

  it('saves nothing when any row fails, and lists why by line', async () => {
    await pick('date,Japa rounds\n2024-10-01,16\n2024-10-02,16 rounds')
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }))
    expect(await screen.findByText('Nothing was imported')).toBeInTheDocument()
    expect(screen.getByText('Line 3')).toBeInTheDocument()
    expect(screen.getByText("Failed to parse number from '16 rounds' in 'Japa rounds'")).toBeInTheDocument()
    expect(practicesApi.saveDiaryDay).not.toHaveBeenCalled()
  })

  it('offers nothing to import when no column matches', async () => {
    await pick('date,Rounds\n2024-10-01,16')
    expect(await screen.findByText('No columns match your practices')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })
})
