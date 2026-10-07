import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { YatrasMobileScreen } from './YatrasMobile'
import { setViewportWidth } from '../../../test/viewport'

vi.mock('../../../api/yatras', () => ({
  yatrasApi: { getYatras: vi.fn(), getYatraData: vi.fn(), createYatra: vi.fn() },
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
    renderScreen()
    expect(await screen.findByRole('button', { name: "Lord Balarama's League" })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Today' })).toBeTruthy()
    expect(await screen.findByText('Alex das')).toBeTruthy()
    // 16 is above the 8 bound, so the best colour (Green for "Higher")
    expect(screen.getByText('16').parentElement!.className).toContain('--ui-zone-green')
    expect(screen.getByText('7d ↗')).toBeTruthy()
    expect(screen.getByText('Stability · 14 days').parentElement!.querySelectorAll('[class*="--ui-zone-green"]')).toHaveLength(14)
  })
})
