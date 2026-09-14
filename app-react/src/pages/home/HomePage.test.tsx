import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HomePage, SectionLabel, DateContextLabel } from './HomePage'

vi.mock('../../api/practices', () => ({
  practicesApi: {
    getUserPractices: vi.fn().mockResolvedValue([
      { id: '1', practice: 'Meditation', data_type: 'Bool', is_active: true, is_required: true },
      { id: '2', practice: 'Reading',    data_type: 'Bool', is_active: true, is_required: false },
    ]),
    getDiaryEntries: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../../hooks/useNetworkStatus', () => ({ default: () => true }))

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not show Optional divider when all practices are required', async () => {
    const { practicesApi } = await import('../../api/practices')
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: '1', practice: 'Meditation', data_type: 'Bool', is_active: true, is_required: true },
    ])
    wrap(<HomePage />)
    await screen.findByText('Meditation')
    expect(screen.queryByText('Optional')).not.toBeInTheDocument()
  })

  it('fetches diary entries for all 7 days of the visible week on mount', async () => {
    const { practicesApi } = await import('../../api/practices')
    wrap(<HomePage />)
    await screen.findByText('Meditation')

    // The week is subscribed via useQueries — expect one diary fetch per unique day.
    await waitFor(() => {
      const diaryDates = new Set(
        vi.mocked(practicesApi.getDiaryEntries).mock.calls.map((c) => c[0]),
      )
      expect(diaryDates.size).toBe(7)
    })
  })

  it('does not show nothing-logged banner on today even with no diary entries', async () => {
    const { practicesApi } = await import('../../api/practices')
    vi.mocked(practicesApi.getDiaryEntries).mockResolvedValue([])

    wrap(<HomePage />)
    await screen.findByText('Meditation')
    expect(screen.queryByText('Nothing was logged on this day')).not.toBeInTheDocument()
  })

  it('renders the yatras section below the dashboard on the same page', async () => {
    const { container } = wrap(<HomePage />)
    await screen.findByText('Meditation')
    expect(container.querySelector('#home-yatras')).not.toBeNull()
  })
})

describe('SectionLabel', () => {
  it('renders label text and a decorative horizontal rule', () => {
    const { container } = render(<SectionLabel label="Required" />)
    expect(screen.getByText('Required')).toBeInTheDocument()
    // outer element must have exactly 2 children: the <p> and the rule <div>
    expect(container.firstChild?.childNodes).toHaveLength(2)
  })
})

describe('DateContextLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // Fix "today" to 2026-07-30
    vi.setSystemTime(new Date('2026-07-30T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders "Today" for today\'s date', () => {
    render(<DateContextLabel dateStr="2026-07-30" />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('renders "Yesterday" for the previous day', () => {
    render(<DateContextLabel dateStr="2026-07-29" />)
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
  })

  it('renders "Tomorrow" for the next day', () => {
    render(<DateContextLabel dateStr="2026-07-31" />)
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
  })

  it('renders a formatted date for other past dates', () => {
    const { container } = render(<DateContextLabel dateStr="2026-07-15" />)
    // Should not render "Today", "Yesterday", or "Tomorrow"
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
    expect(screen.queryByText('Yesterday')).not.toBeInTheDocument()
    // Should render some non-empty text (locale-formatted date)
    expect(container.querySelector('p')?.textContent?.length).toBeGreaterThan(0)
  })
})
