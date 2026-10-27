import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, renderAdmin, YATRA } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)

describe('GeneralMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })

  it('saves the name after a pause in typing, keeping the other fields', async () => {
    renderAdmin('/yatra/y1/admin/general')
    fireEvent.change(await screen.findByLabelText('Yatra name'), { target: { value: 'Balarama League' } })
    expect(api.updateYatra).not.toHaveBeenCalled()
    await waitFor(() => expect(api.updateYatra).toHaveBeenCalledWith('y1', {
      name: 'Balarama League', show_stability_metrics: true, statistics: YATRA.statistics,
    }))
  })

  it("doesn't save an empty name and says why", async () => {
    renderAdmin('/yatra/y1/admin/general')
    const name = await screen.findByLabelText('Yatra name')
    fireEvent.change(name, { target: { value: '  ' } })
    fireEvent.blur(name)
    expect(screen.getByRole('alert')).toHaveTextContent("Name can't be empty")
    expect(api.updateYatra).not.toHaveBeenCalled()
  })

  it('says what is wrong once typing pauses, not on every keystroke', async () => {
    renderAdmin('/yatra/y1/admin/general')
    const name = await screen.findByLabelText('Yatra name')
    fireEvent.change(name, { target: { value: '' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(await screen.findByRole('alert')).toHaveTextContent("Name can't be empty")
    expect(name).toHaveAccessibleDescription("Name can't be empty")
  })

  it('tidies the spaces around a saved name when you leave the field', async () => {
    renderAdmin('/yatra/y1/admin/general')
    const name = await screen.findByLabelText('Yatra name')
    fireEvent.focus(name)
    fireEvent.change(name, { target: { value: 'New name  ' } })
    fireEvent.blur(name)
    expect(name).toHaveValue('New name')
    await waitFor(() => expect(api.updateYatra).toHaveBeenCalledOnce())
  })

  it('a toggle right after a rename keeps the new name', async () => {
    let release!: () => void
    api.updateYatra.mockImplementationOnce(() => new Promise<void>((r) => { release = r }))
    renderAdmin('/yatra/y1/admin/general')
    const name = await screen.findByLabelText('Yatra name')
    fireEvent.change(name, { target: { value: 'New name' } })
    fireEvent.blur(name)
    fireEvent.click(screen.getByRole('switch', { name: 'Show daily score metrics' }))
    await waitFor(() => expect(api.updateYatra).toHaveBeenCalledOnce())
    release()
    await waitFor(() => expect(api.updateYatra).toHaveBeenCalledTimes(2))
    expect(api.updateYatra.mock.calls[1][1]).toEqual({ name: 'New name', show_stability_metrics: false, statistics: YATRA.statistics })
    expect(await screen.findAllByRole('button', { name: 'Undo' })).not.toHaveLength(0)
  })

  it('lists measurable practices with their thresholds', async () => {
    renderAdmin('/yatra/y1/admin/general')
    expect(await screen.findByText('2 of 3 practices have score thresholds')).toBeInTheDocument()
    expect(screen.getByText('done 16 · bonus 20')).toBeInTheDocument()
    expect(screen.getByText('done 05:00 · bonus 04:30')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reading.*Set threshold/ })).toHaveAttribute('href', '/yatra/y1/practice/p3/edit')
    expect(screen.queryByText('Mangala arati')).toBeNull()
  })
})
