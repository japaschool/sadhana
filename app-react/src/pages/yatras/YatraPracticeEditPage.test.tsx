import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { YatraPracticeEditPage } from './YatraPracticeEditPage'

vi.mock('../../api/yatras', () => ({ yatrasApi: { getYatraPractice: vi.fn(), updateYatraPractice: vi.fn() } }))
import { yatrasApi } from '../../api/yatras'
const api = vi.mocked(yatrasApi)

describe('YatraPracticeEditPage', () => {
  it('loads and saves the daily score under the server field name', async () => {
    api.getYatraPractice.mockResolvedValue({
      id: 'p1', practice: 'Japa rounds', data_type: 'Int', colour_zones: null,
      daily_score: { better_direction: 'Higher', mandatory_threshold: { Int: 16 }, bonus_rules: [] },
    })
    api.updateYatraPractice.mockResolvedValue()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/yatra/y1/practice/p1/edit']}>
          <Routes>
            <Route path="/yatra/:id/practice/:practice_id/edit" element={<YatraPracticeEditPage />} />
            <Route path="/yatra/:id/admin/settings" element={<p>Admin</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(screen.getByLabelText(/mandatory/i)).toHaveValue(16))
    fireEvent.submit(screen.getByLabelText(/mandatory/i).closest('form')!)
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(api.updateYatraPractice.mock.calls[0][1]).toMatchObject({ daily_score: { mandatory_threshold: { Int: 16 } } })
    expect(api.updateYatraPractice.mock.calls[0][1]).not.toHaveProperty('daily_score_config')
  })
})
