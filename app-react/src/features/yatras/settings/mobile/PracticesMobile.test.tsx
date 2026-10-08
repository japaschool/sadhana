import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, PRACTICES, renderAdmin } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)

async function openMenu(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
}

describe('PracticesMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })

  it('summarises each practice and links it to the editor', async () => {
    renderAdmin('/yatra/y1/admin/practices')
    expect(await screen.findByText('3 colours · done 16 · bonus 20')).toBeInTheDocument()
    expect(screen.getByText('No colours · done 05:00 · bonus 04:30')).toBeInTheDocument()
    expect(screen.getByText('2 colours · not in score')).toBeInTheDocument()
    expect(screen.getByText('Shown as ✓')).toBeInTheDocument()
    expect(screen.getByText('Shown as written')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Japa rounds/ })).toHaveAttribute('href', '/yatra/y1/practice/p1/edit')
  })

  it('rows block text selection and the iOS long-press callout, so dragging is clean', async () => {
    renderAdmin('/yatra/y1/admin/practices')
    const row = (await screen.findByRole('link', { name: /Japa rounds/ })).closest('li')!
    expect(row.className).toContain('select-none')
    expect(row.className).toContain('[-webkit-touch-callout:none]')
  })

  it('removes the statistics that use a practice, then deletes it', async () => {
    renderAdmin('/yatra/y1/admin/practices')
    await openMenu('Japa rounds')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    const sheet = screen.getByRole('dialog', { name: 'Delete “Japa rounds”?' })
    expect(within(sheet).getByText(/the 1 statistic that uses it/)).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete practice' }))
    await waitFor(() => expect(api.deleteYatraPractice).toHaveBeenCalledWith('y1', 'p1'))
    expect(api.updateYatra.mock.calls[0][1].statistics!.statistics.map((s) => s.label)).toEqual(['Earliest wake-up'])
    expect(api.updateYatra.mock.invocationCallOrder[0]).toBeLessThan(api.deleteYatraPractice.mock.invocationCallOrder[0])
  })

  it('keeps the practice when removing its statistics fails', async () => {
    api.updateYatra.mockRejectedValue(new Error('x'))
    renderAdmin('/yatra/y1/admin/practices')
    await openMenu('Japa rounds')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete practice' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(api.deleteYatraPractice).not.toHaveBeenCalled()
  })

  it('deletes a practice no statistic uses without touching the yatra', async () => {
    renderAdmin('/yatra/y1/admin/practices')
    await openMenu('Reading')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByText('Its column and colours are removed for everyone. Members keep their own entries.')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete practice' }))
    await waitFor(() => expect(api.deleteYatraPractice).toHaveBeenCalledWith('y1', 'p3'))
    expect(api.updateYatra).not.toHaveBeenCalled()
  })

  it("won't add or rename to a name the yatra already has", async () => {
    renderAdmin('/yatra/y1/admin/practices')
    fireEvent.click(await screen.findByRole('button', { name: '+ Add practice' }))
    const add = screen.getByRole('dialog', { name: 'New practice' })
    fireEvent.change(within(add).getByLabelText('Name'), { target: { value: ' japa ROUNDS ' } })
    expect(within(add).getByRole('alert')).toHaveTextContent('This yatra already has a practice with this name')
    expect(within(add).getByRole('button', { name: 'Add practice' })).toBeDisabled()
    fireEvent.click(within(add).getByRole('button', { name: 'Close' }))
    await openMenu('Japa rounds')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const rename = screen.getByRole('dialog', { name: 'Rename practice' })
    const name = within(rename).getByLabelText('Name')
    fireEvent.change(name, { target: { value: 'Reading' } })
    fireEvent.blur(name)
    expect(within(rename).getByRole('alert')).toHaveTextContent('This yatra already has a practice with this name')
    expect(api.updateYatraPractice).not.toHaveBeenCalled()
    expect(within(rename).getByRole('button', { name: 'Done' })).toBeDisabled()
    fireEvent.change(name, { target: { value: 'Study' } })
    expect(within(rename).getByRole('button', { name: 'Done' })).toBeEnabled()
  })

  it('renames from the row menu', async () => {
    renderAdmin('/yatra/y1/admin/practices')
    await openMenu('Japa rounds')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const sheet = screen.getByRole('dialog', { name: 'Rename practice' })
    fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Japa' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledWith('y1', { ...PRACTICES[0], practice: 'Japa' }))
  })

  it('adds a practice of the chosen type and opens its editor', async () => {
    api.getYatraPractices
      .mockResolvedValueOnce(structuredClone(PRACTICES))
      .mockResolvedValueOnce([...structuredClone(PRACTICES), { id: 'p6', practice: 'Seva', data_type: 'Bool' }])
    renderAdmin('/yatra/y1/admin/practices')
    fireEvent.click(await screen.findByRole('button', { name: '+ Add practice' }))
    const sheet = screen.getByRole('dialog', { name: 'New practice' })
    const add = within(sheet).getByRole('button', { name: 'Add practice' })
    expect(add).toBeDisabled()
    fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Seva' } })
    fireEvent.click(within(sheet).getByRole('radio', { name: /Yes \/ No/ }))
    fireEvent.click(add)
    expect(await screen.findByRole('heading', { name: 'Seva' })).toBeInTheDocument()
    expect(api.createYatraPractice).toHaveBeenCalledWith('y1', { practice: 'Seva', data_type: 'Bool' })
  })
})
