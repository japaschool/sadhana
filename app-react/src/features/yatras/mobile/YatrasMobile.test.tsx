import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { YatrasMobileScreen } from './YatrasMobile'
import { setViewportWidth } from '../../../test/viewport'
import { useAuthStore } from '../../../store/authStore'

vi.mock('../../../api/yatras', () => ({
  yatrasApi: { getYatras: vi.fn(), getYatraData: vi.fn(), createYatra: vi.fn(), getYatraUserPractices: vi.fn(), getYatraUsers: vi.fn() },
}))
import { yatrasApi } from '../../../api/yatras'
const api = vi.mocked(yatrasApi)

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/yatras']}><YatrasMobileScreen /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('YatrasMobile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(390)
    localStorage.clear()
    useAuthStore.setState({ user: { id: 'u1', email: '', token: 't', name: 'Alex das' }, token: 't' })
    api.getYatraUserPractices.mockResolvedValue([{ yatra_practice: { id: 'p1', practice: 'Rounds', data_type: 'Int' }, user_practice: null }])
    api.getYatraUsers.mockResolvedValue([{ user_id: 'u1', user_name: 'Me', is_admin: true }, { user_id: 'u2', user_name: 'B', is_admin: false }])
    api.getYatras.mockResolvedValue([{ id: 'y1', name: "Lord Balarama's League", show_stability_metrics: true }])
    api.getYatraData.mockResolvedValue({
      practices: [{
        id: 'p1', practice: 'Rounds', data_type: 'Int',
        colour_zones: { better_direction: 'Higher', bounds: [{ to: { Int: 8 }, colour: 'Red' }], no_value_colour: 'Neutral' },
      }],
      data: [{ user_id: 'u1', user_name: 'Alex das', row: [{ Int: 16 }], trend_arrow: 'Up', stability_heatmap: Array(15).fill(100) }],
      statistics: [],
      stability_heatmap_days: Array.from({ length: 15 }, (_, i) => i + 1),
    })
  })

  it('shows the yatra and day pickers, a card per member and the heatmap', async () => {
    api.getYatraUserPractices.mockResolvedValue([{ yatra_practice: { id: 'p1', practice: 'Rounds', data_type: 'Int' }, user_practice: 'Rounds' }])
    renderScreen()
    expect(await screen.findByRole('button', { name: "Lord Balarama's League" })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Today' })).toBeTruthy()
    expect(await screen.findByText('Alex das')).toBeTruthy()
    // 16 is above the 8 bound, so the best colour (Green for "Higher")
    expect(screen.getByText('16').parentElement!.className).toContain('--ui-zone-green')
    expect(screen.getByText('7d ↗')).toBeTruthy()
    expect(screen.getByText('Stability · 14 days').parentElement!.querySelectorAll('[class*="--ui-zone-green"]')).toHaveLength(14)
  })

  it('shows the unlinked banner; Later hides it until the set changes', async () => {
    renderScreen()
    expect(await screen.findByText('1 of your practices isn\'t linked')).toBeInTheDocument()
    expect(screen.getByText("What you log for Rounds won't appear in this table.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Link practices' })).toHaveAttribute('href', '/yatra/y1/settings')
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByText('1 of your practices isn\'t linked')).toBeNull()
    expect(localStorage.getItem('yatra_link_later_y1')).toBe('p1')
  })

  it("marks the user's own unlinked cells", async () => {
    renderScreen()
    expect(await screen.findByText('not linked')).toBeInTheDocument()
  })

  it('has a Settings action to the link page', async () => {
    renderScreen()
    await screen.findByRole('button', { name: "Lord Balarama's League" })
    // The tab bar has a Settings link too (to /settings).
    expect(screen.getAllByRole('link', { name: 'Settings' }).map((l) => l.getAttribute('href'))).toContain('/yatra/y1/settings')
  })

  it('switcher lists yatras with role and members, and creates a new one', async () => {
    api.createYatra.mockResolvedValue({ id: 'y2', name: 'Kartika 2026', show_stability_metrics: false })
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: "Lord Balarama's League" }))
    const sheet = screen.getByRole('dialog', { name: 'Your yatras' })
    expect(await within(sheet).findByText('Admin · 2 members')).toBeInTheDocument()
    fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Kartika 2026' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Create yatra' }))
    await waitFor(() => expect(api.createYatra).toHaveBeenCalled())
    expect(api.createYatra.mock.calls[0][0]).toBe('Kartika 2026')
  })
  it('shows the statistic tiles the server sends, above the members', async () => {
    api.getYatras.mockResolvedValue([{
      id: 'y1', name: "Lord Balarama's League", show_stability_metrics: true,
      statistics: { visible_to_all: true, statistics: [{ label: 'Average rounds', practice_id: 'p1', aggregation: 'Avg', time_range: 'Last30Days' }] },
    }])
    api.getYatraData.mockResolvedValue({ ...(await api.getYatraData('y1', '')), statistics: [{ label: 'Average rounds', value: { Int: 15.83 } }] })
    renderScreen()
    const tile = (await screen.findByText('Average rounds')).parentElement!
    expect(tile).toHaveTextContent('15.8')
    expect(tile).toHaveTextContent('Average · Last 30 days')
    expect(tile.compareDocumentPosition(screen.getByText('Alex das')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('a count tile says "time" for one', async () => {
    api.getYatras.mockResolvedValue([{
      id: 'y1', name: "Lord Balarama's League", show_stability_metrics: true,
      statistics: { visible_to_all: true, statistics: [{ label: 'Arati', practice_id: 'p1', aggregation: 'Count', time_range: 'Last7Days' }] },
    }])
    api.getYatraData.mockResolvedValue({ ...(await api.getYatraData('y1', '')), statistics: [{ label: 'Arati', value: { Int: 1 } }] })
    renderScreen()
    expect((await screen.findByText('Arati')).parentElement).toHaveTextContent(/1time(?!s)/)
  })
})
