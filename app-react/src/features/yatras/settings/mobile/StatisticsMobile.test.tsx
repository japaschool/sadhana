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
const sentStats = () => api.updateYatra.mock.calls.at(-1)![1].statistics!

async function openStat(label: string) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${label}`) }))
  return screen.getByRole('dialog', { name: 'Edit statistic' })
}

describe('StatisticsMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })

  it("previews the tiles with today's values", async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    expect(await screen.findByText('15.8')).toBeInTheDocument()
    expect(screen.getByText('03:55')).toBeInTheDocument()
    expect(screen.getAllByText('Min (earliest) · Last 7 days').length).toBeGreaterThan(0)
  })

  it('Visible to Admins keeps the statistics', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    fireEvent.click(await screen.findByRole('radio', { name: 'Admins' }))
    await waitFor(() => expect(api.updateYatra).toHaveBeenCalledOnce())
    expect(sentStats().visible_to_all).toBe(false)
    expect(sentStats().statistics).toHaveLength(2)
  })

  it('offers only aggregations that fit the practice', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    const sheet = await openStat('Earliest wake-up')
    const aggs = within(within(sheet).getByRole('radiogroup', { name: 'Aggregation' })).getAllByRole('radio').map((r) => r.textContent)
    expect(aggs).toEqual(['Average', 'Min (earliest)', 'Max (latest)', 'Count'])
    expect(within(sheet).getByText("Sum isn't offered: adding up times of day has no meaning.")).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Count' }))
    await waitFor(() => expect(sentStats().statistics[1].aggregation).toBe('Count'))
  })

  it('chips take arrow keys', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    const sheet = await openStat('Earliest wake-up')
    fireEvent.keyDown(within(sheet).getByRole('radio', { name: 'Min (earliest)' }), { key: 'ArrowRight' })
    await waitFor(() => expect(sentStats().statistics[1].aggregation).toBe('Max'))
    expect(within(sheet).getByRole('radio', { name: 'Max (latest)' })).toHaveFocus()
  })

  it('switches to Count when the new practice cannot take the aggregation', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    const sheet = await openStat('Average japa')
    fireEvent.change(within(sheet).getByLabelText('Practice'), { target: { value: 'p4' } })
    await waitFor(() => expect(sentStats().statistics[0]).toMatchObject({ practice_id: 'p4', aggregation: 'Count' }))
  })

  it('adds a new statistic on its first change, and not before', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    fireEvent.click(await screen.findByRole('button', { name: '+ Add statistic' }))
    const sheet = screen.getByRole('dialog', { name: 'New statistic' })
    expect(api.updateYatra).not.toHaveBeenCalled()
    fireEvent.click(within(sheet).getByRole('radio', { name: 'This week' }))
    await waitFor(() => expect(sentStats().statistics).toHaveLength(3))
    expect(sentStats().statistics[2]).toEqual({ label: 'Japa rounds', practice_id: 'p1', aggregation: 'Avg', time_range: 'ThisWeek' })
  })

  it('Done adds a new statistic as previewed, even untouched', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    fireEvent.click(await screen.findByRole('button', { name: '+ Add statistic' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(sentStats().statistics).toHaveLength(3))
    expect(sentStats().statistics[2]).toEqual({ label: 'Japa rounds', practice_id: 'p1', aggregation: 'Avg', time_range: 'Last30Days' })
  })

  it('closing a new statistic with × adds nothing', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    fireEvent.click(await screen.findByRole('button', { name: '+ Add statistic' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.updateYatra).not.toHaveBeenCalled()
  })

  it("the sheet's tile drops the value once the statistic changes", async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    const sheet = await openStat('Average japa')
    expect(within(sheet).getByText('15.8')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Sum' }))
    expect(within(sheet).queryByText('15.8')).toBeNull()
  })

  it('deletes a statistic after asking', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    const sheet = await openStat('Average japa')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete statistic' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete “Average japa”?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete statistic' }))
    await waitFor(() => expect(sentStats().statistics.map((s) => s.label)).toEqual(['Earliest wake-up']))
  })
})
