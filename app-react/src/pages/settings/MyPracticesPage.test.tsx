import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { MyPracticesPage } from './MyPracticesPage'

vi.mock('../../api/practices', () => ({
  practicesApi: {
    getUserPractices: vi.fn().mockResolvedValue([
      { id: '1', practice: 'Meditation', data_type: 'Bool', is_active: true, is_required: false },
      { id: '2', practice: 'Reading', data_type: 'Int', is_active: false, is_required: false },
    ]),
    updateUserPractice: vi.fn().mockResolvedValue(undefined),
    deleteUserPractice: vi.fn().mockResolvedValue(undefined),
    reorderUserPractices: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('MyPracticesPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders inactive practice with strikethrough', async () => {
    wrap(<MyPracticesPage />)
    const name = await screen.findByText('Reading')
    expect(name).toHaveStyle({ textDecoration: 'line-through' })
  })

  it('calls updateUserPractice with is_active:false when hiding an active practice', async () => {
    const { practicesApi } = await import('../../api/practices')
    wrap(<MyPracticesPage />)
    const hideBtn = await screen.findByLabelText('Hide practice')
    fireEvent.click(hideBtn)
    await waitFor(() => {
      expect(vi.mocked(practicesApi.updateUserPractice)).toHaveBeenCalledWith('1', { is_active: false })
    })
  })
})
