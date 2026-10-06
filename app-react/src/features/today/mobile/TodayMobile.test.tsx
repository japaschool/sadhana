import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TodayMobileScreen } from './TodayMobile'
import { setViewportWidth } from '../../../test/viewport'

vi.mock('../../../api/practices', () => ({
  practicesApi: {
    getUserPractices: vi.fn(),
    getDiaryEntries: vi.fn(),
    getIncompleteDays: vi.fn(),
    saveDiaryEntry: vi.fn(),
    createUserPractice: vi.fn(),
  },
}))
vi.mock('../../../hooks/useNetworkStatus', () => ({ default: () => true }))
import { practicesApi } from '../../../api/practices'
const api = vi.mocked(practicesApi)

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}><TodayMobileScreen /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TodayMobile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(390)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 9))
    api.getUserPractices.mockResolvedValue([
      { id: '1', practice: 'Wake up', data_type: 'Time', is_active: true, is_required: true },
      { id: '2', practice: 'Reading', data_type: 'Bool', is_active: true },
    ])
    api.getDiaryEntries.mockResolvedValue([{ practice: 'Reading', data_type: 'Bool', value: { Bool: false } }])
    api.getIncompleteDays.mockResolvedValue([])
    api.saveDiaryEntry.mockResolvedValue(undefined)
  })
  afterEach(() => { vi.useRealTimers() })

  it('renders the date header, summary, group and tabs', async () => {
    renderScreen()
    expect(await screen.findByText('Wake up')).toBeInTheDocument()
    expect(screen.getByText('Tue, October 6')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 · 1 required left')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Practices' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Log' }).querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Log' })).toHaveTextContent(/^$/)
  })

  it('saves a toggle for the selected day', async () => {
    renderScreen()
    fireEvent.click(await screen.findByRole('switch', { name: 'Reading' }))
    await waitFor(() => expect(api.saveDiaryEntry).toHaveBeenCalledWith('2026-10-06', 'Reading', { Bool: true }))
  })

  it('opens the calendar from the date header', async () => {
    renderScreen()
    fireEvent.click(await screen.findByText('Tue, October 6'))
    expect(screen.getByRole('dialog', { name: 'Calendar' })).toBeInTheDocument()
  })

  it('shows screen actions in the ⋯ menu', async () => {
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'More' }))
    expect(screen.getByRole('menuitem', { name: 'Add new practice' })).toBeInTheDocument()
  })

  it('shows the empty state with starters', async () => {
    api.getUserPractices.mockResolvedValue([])
    renderScreen()
    expect(await screen.findByRole('button', { name: 'Add starter practices' })).toBeInTheDocument()
  })
})
