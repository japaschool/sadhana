import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, renderAdmin } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)
const sent = () => api.updateYatraPractice.mock.calls.at(-1)![1]

describe('PracticeEditorMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })

  it('shows the bounds, the bar and the score of a Number practice', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    expect(await screen.findByLabelText('Red up to')).toHaveValue('7')
    expect(screen.getByLabelText('Yellow up to')).toHaveValue('15')
    expect(screen.getByText('Above 15: Green')).toBeInTheDocument()
    expect(screen.getByText('✓ 16')).toBeInTheDocument()
    expect(screen.getByText('★ 20')).toBeInTheDocument()
    expect(screen.getByText('Counts as done at ≥ 16 · bonus at ≥ 20')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Japa rounds' })).toBeInTheDocument()
  })

  it('a bound out of order says why and nothing is sent', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    const yellow = await screen.findByLabelText('Yellow up to')
    fireEvent.change(yellow, { target: { value: '6' } })
    fireEvent.blur(yellow)
    expect(screen.getByText('Must be more than 7, the Red bound')).toBeInTheDocument()
    expect(screen.getByText('Not saved yet. The bar keeps the last valid bounds until this is fixed.')).toBeInTheDocument()
    expect(api.updateYatraPractice).not.toHaveBeenCalled()
  })

  it('saves a valid bound and keeps its colours', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    const yellow = await screen.findByLabelText('Yellow up to')
    fireEvent.change(yellow, { target: { value: '14' } })
    fireEvent.blur(yellow)
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(sent().colour_zones!.bounds).toEqual([{ to: { Int: 7 }, colour: 'Red' }, { to: { Int: 14 }, colour: 'Yellow' }])
  })

  it('keeps what is typed in a focused field when its save lands', async () => {
    renderAdmin('/yatra/y1/practice/p3/edit')
    const red = await screen.findByLabelText('Red up to')
    expect(red).toHaveValue('0:30')
    fireEvent.focus(red)
    fireEvent.change(red, { target: { value: '45' } })
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(sent().colour_zones!.bounds[0].to).toEqual({ Duration: 45 })
    expect(red).toHaveValue('45')
  })

  it('2 colours keeps the first bound and offers Undo', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    fireEvent.click(await screen.findByRole('radio', { name: '2 colours' }))
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(sent().colour_zones).toEqual({ better_direction: 'Higher', bounds: [{ to: { Int: 7 }, colour: 'Red' }], no_value_colour: 'Neutral', best_colour: 'Green' })
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('Lower re-colours the zones and the score follows', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    const colourDir = await screen.findByRole('radiogroup', { name: 'Better when the value is' })
    fireEvent.click(within(colourDir).getByRole('radio', { name: 'Lower' }))
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(sent().colour_zones!.bounds.map((b) => b.colour)).toEqual(['Green', 'Yellow'])
    expect(sent().colour_zones!.best_colour).toBe('Red')
    expect(sent().daily_score!.better_direction).toBe('Lower')
  })

  it('clearing both thresholds removes the daily score', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    const done = await screen.findByLabelText('✓ Done at · +1 point')
    const bonus = screen.getByLabelText('★ Bonus at · +1 more')
    fireEvent.change(done, { target: { value: '' } })
    fireEvent.change(bonus, { target: { value: '' } })
    fireEvent.blur(bonus)
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(sent().daily_score).toBeNull()
  })

  it("doesn't save a bonus without a done value", async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    const done = await screen.findByLabelText('✓ Done at · +1 point')
    fireEvent.change(done, { target: { value: '' } })
    fireEvent.blur(done)
    expect(screen.getByText('Set “Done at” first: the bonus only adds to a done day')).toBeInTheDocument()
    expect(api.updateYatraPractice).not.toHaveBeenCalled()
  })

  it('offers to start done where Green starts', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    const done = await screen.findByLabelText('✓ Done at · +1 point')
    expect(screen.queryByRole('button', { name: 'Done starts where Green starts' })).toBeNull()
    fireEvent.change(done, { target: { value: '18' } })
    fireEvent.blur(done)
    fireEvent.click(await screen.findByRole('button', { name: 'Done starts where Green starts' }))
    await waitFor(() => expect(sent().daily_score!.mandatory_threshold).toEqual({ Int: 16 }))
    expect(done).toHaveValue('16')
  })

  it('a Yes / No practice explains why it has no colours or score', async () => {
    renderAdmin('/yatra/y1/practice/p4/edit')
    expect(await screen.findByText(/Yes \/ No practices show ✓ in the table/)).toBeInTheDocument()
    expect(screen.queryByText('Colours in the table')).toBeNull()
  })

  it('deletes the practice and goes back to Practices', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    fireEvent.click(await screen.findByRole('button', { name: 'Delete practice' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete practice' }))
    await waitFor(() => expect(api.deleteYatraPractice).toHaveBeenCalledWith('y1', 'p1'))
    expect(await screen.findByRole('heading', { name: 'Practices' })).toBeInTheDocument()
  })
})
