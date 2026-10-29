import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../test/viewport'
import { useToastStore } from '../../../hooks/useToast'
import type { PracticeGroup, UserPractice } from '../../../types/api'
import { PracticesMobileScreen } from './PracticesMobile'

vi.mock('../../../api/practices', () => ({
  practicesApi: {
    getUserPractices: vi.fn(), createUserPractice: vi.fn(), updateUserPractice: vi.fn(),
    deleteUserPractice: vi.fn(),
    getGroups: vi.fn(), createGroup: vi.fn(), renameGroup: vi.fn(), deleteGroup: vi.fn(), saveLayout: vi.fn(),
  },
}))
import { practicesApi } from '../../../api/practices'
const api = vi.mocked(practicesApi)

const PRACTICES: UserPractice[] = [
  { id: 'p1', practice: 'Japa rounds', data_type: 'Int', is_active: true, is_required: true },
  { id: 'p2', practice: 'Lectures', data_type: 'Duration', is_active: false },
  { id: 'p3', practice: 'Mood', data_type: 'Text', is_active: true, dropdown_variants: 'Calm, Joyful, Tired, Restless' },
]

const GROUPS: PracticeGroup[] = [
  { id: 'g1', name: 'Morning', is_default: false },
  { id: null, name: '', is_default: true },
  { id: 'g2', name: 'Evening', is_default: false },
]
const GROUPED: UserPractice[] = [
  { ...PRACTICES[0], group_id: 'g1' },
  { ...PRACTICES[1], group_id: null },
  { ...PRACTICES[2], group_id: 'g1' },
]
const unprocessable = () => new AxiosError('x', '422', undefined, undefined,
  { status: 422, data: {}, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } })

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {['/settings/practices', '/settings/practices/new', '/settings/practices/:id', '/settings/practices/groups/new', '/settings/practices/groups/:groupId'].map((p) => <Route key={p} path={p} element={<PracticesMobileScreen />} />)}
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
    api.getGroups.mockResolvedValue([])
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

  describe('groups', () => {
    beforeEach(() => {
      api.getUserPractices.mockResolvedValue(GROUPED)
      api.getGroups.mockResolvedValue(GROUPS)
      api.createGroup.mockResolvedValue('g3')
      api.renameGroup.mockResolvedValue()
      api.deleteGroup.mockResolvedValue()
    })

    it('shows group headers with counts, a Default chip on the default group and no menu on it', async () => {
      renderAt('/settings/practices')
      expect(await screen.findByText('3 practices in 3 groups · 1 hidden from Today')).toBeInTheDocument()
      const morning = screen.getByRole('button', { name: 'Morning, 2' })
      expect(morning).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drag Morning' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drag Practices' })).toBeInTheDocument()
      expect(screen.getByText('Default')).toBeInTheDocument()
      // The default group's header isn't a button: it can't be renamed or deleted.
      expect(screen.queryByRole('button', { name: /^Practices, / })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Evening, 0' })).toBeInTheDocument()
    })

    it('+ Group opens a name sheet; creating calls createGroup("Kirtan")', async () => {
      renderAt('/settings/practices')
      fireEvent.click(await screen.findByRole('link', { name: 'Group' }))
      const sheet = await screen.findByRole('dialog', { name: 'New group' })
      expect(within(sheet).getByText("It's added at the end, empty. Empty groups don't show on Today.")).toBeInTheDocument()
      fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: ' Kirtan ' } })
      fireEvent.click(within(sheet).getByRole('button', { name: 'Create group' }))
      await waitFor(() => expect(api.createGroup).toHaveBeenCalledWith('Kirtan'))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('tapping a header opens the group sheet; Save renames', async () => {
      renderAt('/settings/practices')
      fireEvent.click(await screen.findByRole('button', { name: 'Morning, 2' }))
      const sheet = await screen.findByRole('dialog', { name: 'Morning' })
      fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Early morning' } })
      fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))
      await waitFor(() => expect(api.renameGroup).toHaveBeenCalledWith('g1', 'Early morning'))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('Delete group confirms with the count and destination, then calls deleteGroup', async () => {
      renderAt('/settings/practices/groups/g1')
      const sheet = await screen.findByRole('dialog', { name: 'Morning' })
      expect(within(sheet).getByText('Its 2 practices move to “Practices”.')).toBeInTheDocument()
      fireEvent.click(within(sheet).getByRole('button', { name: 'Delete…' }))
      const confirm = screen.getByRole('dialog', { name: 'Delete “Morning”?' })
      expect(within(confirm).getByText('Its 2 practices move to the end of “Practices”. Their logged data isn\'t touched.')).toBeInTheDocument()
      expect(api.deleteGroup).not.toHaveBeenCalled()
      fireEvent.click(within(confirm).getByRole('button', { name: 'Delete group' }))
      await waitFor(() => expect(api.deleteGroup).toHaveBeenCalledWith('g1'))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('an empty group shows the drop-zone text', async () => {
      renderAt('/settings/practices')
      expect(await screen.findByText('No practices yet. Drag one here, or pick this group in a practice. Not shown on Today while empty.')).toBeInTheDocument()
    })

    it('with only the default group, the count line has no group count and shows the add-group hint', async () => {
      api.getUserPractices.mockResolvedValue(PRACTICES)
      api.getGroups.mockResolvedValue([])
      renderAt('/settings/practices')
      expect(await screen.findByText('3 practices · 1 hidden from Today')).toBeInTheDocument()
      expect(screen.getByText('Add a group to split Today into sections.')).toBeInTheDocument()
      expect(screen.getByText('Default')).toBeInTheDocument()
    })

    it('a duplicate group name shows the name-taken error', async () => {
      api.createGroup.mockRejectedValue(unprocessable())
      renderAt('/settings/practices/groups/new')
      const sheet = await screen.findByRole('dialog', { name: 'New group' })
      fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Kirtan' } })
      fireEvent.click(within(sheet).getByRole('button', { name: 'Create group' }))
      expect(await within(sheet).findByText('Group “Kirtan” already exists')).toBeInTheDocument()
      // Names already loaded are caught before saving.
      fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Evening' } })
      expect(within(sheet).getByRole('alert')).toHaveTextContent('Group “Evening” already exists')
    })

    it('a failed create or rename shows the error toast and keeps the sheet open', async () => {
      api.createGroup.mockRejectedValue(new Error('Network Error'))
      renderAt('/settings/practices/groups/new')
      const sheet = await screen.findByRole('dialog', { name: 'New group' })
      fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Kirtan' } })
      fireEvent.click(within(sheet).getByRole('button', { name: 'Create group' }))
      await waitFor(() => expect(useToastStore.getState().toasts.map((x) => x.message)).toEqual(['Something went wrong']))
      expect(screen.getByRole('dialog', { name: 'New group' })).toBeInTheDocument()
      expect(within(sheet).queryByRole('alert')).not.toBeInTheDocument()
    })

    describe('the editor Group field', () => {
      const open = async (name = 'Group') => {
        const field = await screen.findByRole('button', { name: /^Group/ })
        fireEvent.click(field)
        return screen.findByRole('menu', { name })
      }

      it('shows the practice\'s group and lists groups in order with + New group', async () => {
        renderAt('/settings/practices/p1')
        const sheet = await screen.findByRole('dialog', { name: 'Japa rounds' })
        expect(within(sheet).getByRole('button', { name: /^Group/ })).toHaveTextContent('Morning')
        const menu = await open()
        const items = [...menu.querySelectorAll('[role^="menuitem"]')].map((e) => e.textContent)
        expect(items).toEqual(['Morning✓', 'Practices', 'Evening', '+ New group'])
      })

      it('saving with a new group calls update then saveLayout with the practice last in that group', async () => {
        api.saveLayout.mockResolvedValue()
        renderAt('/settings/practices/p1')
        await screen.findByRole('dialog', { name: 'Japa rounds' })
        fireEvent.click(within(await open()).getByRole('menuitemradio', { name: 'Evening' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
        await waitFor(() => expect(api.saveLayout).toHaveBeenCalledWith({
          groups: ['g1', null, 'g2'],
          practices: [{ id: 'p3', group_id: 'g1' }, { id: 'p2', group_id: null }, { id: 'p1', group_id: 'g2' }],
        }))
        expect(api.updateUserPractice).toHaveBeenCalledWith('p1', expect.objectContaining({ practice: 'Japa rounds' }))
        expect(api.updateUserPractice.mock.invocationCallOrder[0]).toBeLessThan(api.saveLayout.mock.invocationCallOrder[0])
      })

      it('a new practice defaults to Practices; picking Morning creates it with group_id g1', async () => {
        renderAt('/settings/practices/new')
        const sheet = await screen.findByRole('dialog', { name: 'New practice' })
        expect(within(sheet).getByRole('button', { name: /^Group/ })).toHaveTextContent('Practices')
        fireEvent.click(within(await open()).getByRole('menuitemradio', { name: 'Morning' }))
        fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Kirtan' } })
        fireEvent.click(within(sheet).getByRole('radio', { name: /Tick/ }))
        fireEvent.click(within(sheet).getByRole('button', { name: 'Add practice' }))
        await waitFor(() => expect(api.createUserPractice).toHaveBeenCalledWith(expect.objectContaining({ practice: 'Kirtan', group_id: 'g1' })))
      })

      it('saving without changing the group makes no layout call', async () => {
        renderAt('/settings/practices/p1')
        await screen.findByRole('dialog', { name: 'Japa rounds' })
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
        await waitFor(() => expect(api.updateUserPractice).toHaveBeenCalled())
        expect(api.saveLayout).not.toHaveBeenCalled()
      })

      it('+ New group names a group and selects it', async () => {
        renderAt('/settings/practices/p1')
        await screen.findByRole('dialog', { name: 'Japa rounds' })
        fireEvent.click(within(await open()).getByRole('menuitem', { name: '+ New group' }))
        const sheet = await screen.findByRole('dialog', { name: 'New group' })
        fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Kirtan' } })
        api.getGroups.mockResolvedValue([...GROUPS, { id: 'g3', name: 'Kirtan', is_default: false }])
        fireEvent.click(within(sheet).getByRole('button', { name: 'Create group' }))
        await waitFor(() => expect(api.createGroup).toHaveBeenCalledWith('Kirtan'))
        await waitFor(() => expect(screen.getByRole('button', { name: /^Group/ })).toHaveTextContent('Kirtan'))
      })

      it('+ New group then Save moves the practice there, even before the groups list has it', async () => {
        api.saveLayout.mockResolvedValue()
        renderAt('/settings/practices/p1')
        await screen.findByRole('dialog', { name: 'Japa rounds' })
        fireEvent.click(within(await open()).getByRole('menuitem', { name: '+ New group' }))
        const sheet = await screen.findByRole('dialog', { name: 'New group' })
        fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Kirtan' } })
        // The refetch after creating doesn't include it yet, so the move builds a section for it.
        fireEvent.click(within(sheet).getByRole('button', { name: 'Create group' }))
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New group' })).not.toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
        await waitFor(() => expect(api.saveLayout).toHaveBeenCalledWith({
          groups: ['g1', null, 'g2', 'g3'],
          practices: [{ id: 'p3', group_id: 'g1' }, { id: 'p2', group_id: null }, { id: 'p1', group_id: 'g3' }],
        }))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(await screen.findByRole('button', { name: /^Japa rounds/ })).toBeInTheDocument()
      })
    })
  })
})
