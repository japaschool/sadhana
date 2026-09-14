import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { YatraAdminSettingsPage } from './YatraAdminSettingsPage'

vi.mock('../../api/yatras', () => {
  const mockYatra = { id: 'y1', name: 'Morning Circle', show_stability_metrics: false, statistics: null }
  return {
    yatrasApi: {
      getYatra: vi.fn().mockResolvedValue(mockYatra),
      getYatraUsers: vi.fn().mockResolvedValue([]),
      getYatraPractices: vi.fn().mockResolvedValue([]),
      reorderPractices: vi.fn().mockResolvedValue(undefined),
      updateYatra: vi.fn().mockResolvedValue(undefined),
      toggleAdmin: vi.fn().mockResolvedValue(undefined),
      removeMember: vi.fn().mockResolvedValue(undefined),
      deleteYatraPractice: vi.fn().mockResolvedValue(undefined),
      deleteYatra: vi.fn().mockResolvedValue(undefined),
    },
  }
})

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/yatra/y1/admin']}>
        <Routes>
          <Route path="/yatra/:id/admin" element={<YatraAdminSettingsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('YatraAdminSettingsPage — invite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls navigator.share when native share is available', async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: shareFn, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })

    wrap()
    const inviteBtn = await screen.findByText(/share invite link/i)
    fireEvent.click(inviteBtn.closest('button')!)
    await waitFor(() => expect(shareFn).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('/yatra/y1/join') })
    ))
  })

  it('falls back to clipboard copy when native share is unavailable', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    const writeFn = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeFn }, configurable: true })

    wrap()
    const inviteBtn = await screen.findByText(/copy invite link/i)
    fireEvent.click(inviteBtn.closest('button')!)
    await waitFor(() => expect(writeFn).toHaveBeenCalledWith(
      expect.stringContaining('/yatra/y1/join')
    ))
  })
})
