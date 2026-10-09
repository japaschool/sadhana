import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Mocked } from 'vitest'
import type { yatrasApi } from '../../../../api/yatras'
import { useAuthStore } from '../../../../store/authStore'
import type { Yatra, YatraPractice, YatraUser } from '../../../../types/api'
import { AdminSectionMobile } from './AdminSectionMobile'
import { PracticeEditorMobile } from './PracticeEditorMobile'

export const PRACTICES: YatraPractice[] = [
  {
    id: 'p1', practice: 'Japa rounds', data_type: 'Int',
    colour_zones: { better_direction: 'Higher', bounds: [{ to: { Int: 7 }, colour: 'Red' }, { to: { Int: 15 }, colour: 'Yellow' }], no_value_colour: 'Neutral', best_colour: 'Green' },
    daily_score: { better_direction: 'Higher', mandatory_threshold: { Int: 16 }, bonus_rules: [{ threshold: { Int: 20 }, points: 1 }] },
  },
  {
    id: 'p2', practice: 'Wake up', data_type: 'Time', colour_zones: null,
    daily_score: { better_direction: 'Lower', mandatory_threshold: { Time: { h: 5, m: 0 } }, bonus_rules: [{ threshold: { Time: { h: 4, m: 30 } }, points: 1 }] },
  },
  {
    id: 'p3', practice: 'Reading', data_type: 'Duration', daily_score: null,
    colour_zones: { better_direction: 'Higher', bounds: [{ to: { Duration: 30 }, colour: 'Red' }], no_value_colour: 'Neutral', best_colour: 'Green' },
  },
  { id: 'p4', practice: 'Mangala arati', data_type: 'Bool' },
  { id: 'p5', practice: "Day's realisation", data_type: 'Text' },
]

export const YATRA: Yatra = {
  id: 'y1', name: "Balarama's League", show_stability_metrics: true,
  statistics: {
    visible_to_all: true,
    statistics: [
      { label: 'Average japa', practice_id: 'p1', aggregation: 'Avg', time_range: 'Last30Days' },
      { label: 'Earliest wake-up', practice_id: 'p2', aggregation: 'Min', time_range: 'Last7Days' },
    ],
  },
}

export const USERS: YatraUser[] = [
  { user_id: 'u1', user_name: 'Alex das', is_admin: true },
  { user_id: 'u2', user_name: 'Gaura Priya devi dasi', is_admin: true },
  { user_id: 'u3', user_name: 'Madhava das', is_admin: false },
]

/** Every call the admin screens make. The current user is u1 (admin) or u3 (member). */
export function mockAdmin(api: Mocked<typeof yatrasApi>, { admin = true, users = USERS }: { admin?: boolean; users?: YatraUser[] } = {}) {
  useAuthStore.setState({ user: { id: admin ? 'u1' : 'u3', email: '', token: 't', name: 'Me' }, token: 't' })
  api.getYatra.mockResolvedValue(structuredClone(YATRA))
  api.getYatras.mockResolvedValue([structuredClone(YATRA)])
  api.getYatraUserPractices.mockResolvedValue([])
  api.getYatraPractices.mockResolvedValue(structuredClone(PRACTICES))
  api.getYatraUsers.mockResolvedValue(structuredClone(users))
  api.getYatraData.mockResolvedValue({
    practices: [], data: [], stability_heatmap_days: [],
    statistics: [{ label: 'Average japa', value: { Int: 15.8 } }, { label: 'Earliest wake-up', value: { Time: { h: 3, m: 55 } } }],
  })
  for (const fn of ['updateYatra', 'updateYatraPractice', 'reorderPractices', 'createYatraPractice', 'deleteYatraPractice', 'toggleAdmin', 'removeMember', 'deleteYatra'] as const) {
    api[fn].mockResolvedValue()
  }
}

export function renderAdmin(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/yatra/:id/admin/:section" element={<AdminSectionMobile />} />
          <Route path="/yatra/:id/practice/:practice_id/edit" element={<PracticeEditorMobile />} />
          <Route path="/yatra/:id/settings" element={<p>Link page</p>} />
          <Route path="/yatras" element={<p>Yatras page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return qc
}
