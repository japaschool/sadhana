import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarSheet } from './CalendarSheet'
import { toDateStr } from '../date'

vi.mock('../../../api/practices', () => ({
  practicesApi: { getIncompleteDays: vi.fn() },
}))
import { practicesApi } from '../../../api/practices'

function setup() {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <CalendarSheet date={new Date(2026, 9, 6)} onSelect={onSelect} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onSelect, onClose }
}

describe('CalendarSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 12))
    vi.mocked(practicesApi.getIncompleteDays).mockResolvedValue(['2026-10-02', '2026-10-05'])
  })
  afterEach(() => { vi.useRealTimers() })

  it('shows the month with incomplete dots and disables future days', async () => {
    setup()
    expect(screen.getByRole('button', { name: 'October ▾' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2026 ▾' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByTestId('incomplete-dot')).toHaveLength(2))
    expect(practicesApi.getIncompleteDays).toHaveBeenCalledWith('2026-10-01', '2026-10-31')
    expect(screen.getByRole('button', { name: /October 7/ })).toBeDisabled()
  })

  it('navigates months', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('button', { name: 'September ▾' })).toBeInTheDocument()
    await waitFor(() => expect(practicesApi.getIncompleteDays).toHaveBeenCalledWith('2026-09-01', '2026-09-30'))
  })

  it('selects a day and closes', () => {
    const { onSelect, onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: /October 5/ }))
    expect(toDateStr(onSelect.mock.calls[0][0])).toBe('2026-10-05')
    expect(onClose).toHaveBeenCalled()
  })

  it('Today jumps to today', () => {
    const { onSelect } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(toDateStr(onSelect.mock.calls[0][0])).toBe('2026-10-06')
  })

  it('picks a month from the month picker', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'October ▾' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'March' }))
    expect(screen.getByRole('button', { name: 'March ▾' })).toBeInTheDocument()
  })

  it('Escape in the month picker keeps the sheet open', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'October ▾' }))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
