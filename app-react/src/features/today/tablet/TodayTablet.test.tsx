import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TodayTabletScreen } from './TodayTablet'
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
vi.mock('../../../hooks/useNetworkStatus', () => ({ default: () => ({ online: true, pending: 0 }) }))
import { practicesApi } from '../../../api/practices'
const api = vi.mocked(practicesApi)

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}><TodayTabletScreen /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TodayTablet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(834)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 9))
    api.getUserPractices.mockResolvedValue([
      { id: '1', practice: 'Wake up', data_type: 'Time', is_active: true, is_required: true },
      { id: '2', practice: 'Reading', data_type: 'Bool', is_active: true },
      { id: '3', practice: 'Japa', data_type: 'Int', is_active: true },
    ])
    api.getDiaryEntries.mockResolvedValue([])
    api.getIncompleteDays.mockResolvedValue(['2026-10-05'])
    api.saveDiaryEntry.mockResolvedValue(undefined)
  })
  afterEach(() => { vi.useRealTimers() })

  it('renders the rail, header, 9-day strip and practices split into two columns', async () => {
    renderScreen()
    expect(await screen.findByText('Wake up')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tuesday, October 6')
    expect(screen.queryByRole('link', { name: 'Edit practices' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('menuitem', { name: 'Edit practices' })).toBeInTheDocument()

    const days = within(screen.getByTestId('day-strip')).getAllByRole('button')
    expect(days.map((d) => d.textContent?.replace(/\D/g, ''))).toEqual(['4', '5', '6', '7', '8', '9', '10', '11', '12'])
    await waitFor(() => expect(within(days[1]).getByTestId('incomplete-dot')).toBeInTheDocument())

    const columns = screen.getByRole('region', { name: 'Practices' }).querySelectorAll('.grid > div')
    expect([...columns].map((c) => c.textContent)).toEqual([expect.stringMatching(/Wake up.*Reading/), expect.stringMatching(/Japa/)])
  })

  it('picking a day in the week loads that day', async () => {
    renderScreen()
    await screen.findByText('Wake up')
    fireEvent.click(screen.getByRole('button', { name: 'Thursday, October 8' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Thursday, October 8')
    await waitFor(() => expect(api.getDiaryEntries).toHaveBeenCalledWith('2026-10-08'))
  })
})
