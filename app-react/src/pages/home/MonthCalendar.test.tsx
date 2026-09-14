import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MonthCalendar } from './MonthCalendar'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('MonthCalendar', () => {
  it('renders day grid for the selected date month', () => {
    const date = new Date(2026, 6, 24) // July 2026
    render(
      <Wrapper>
        <MonthCalendar selectedDate={date} onSelect={vi.fn()} onClose={vi.fn()} />
      </Wrapper>
    )
    // July has 31 days; check a few are present
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Wrapper>
        <MonthCalendar selectedDate={new Date()} onSelect={vi.fn()} onClose={onClose} />
      </Wrapper>
    )
    // The backdrop is the first fixed inset-0 div
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/30') as HTMLElement
    await userEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onSelect and onClose when a day is clicked', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <Wrapper>
        <MonthCalendar selectedDate={new Date(2026, 6, 1)} onSelect={onSelect} onClose={onClose} />
      </Wrapper>
    )
    await userEvent.click(screen.getAllByText('15')[0])
    expect(onSelect).toHaveBeenCalledWith(new Date(2026, 6, 15))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onSelect(today) when Today is clicked', async () => {
    const onSelect = vi.fn()
    render(
      <Wrapper>
        <MonthCalendar selectedDate={new Date(2026, 6, 1)} onSelect={onSelect} onClose={vi.fn()} />
      </Wrapper>
    )
    await userEvent.click(screen.getByText('Today'))
    expect(onSelect).toHaveBeenCalled()
    const arg: Date = onSelect.mock.calls[0][0]
    const today = new Date()
    expect(arg.getDate()).toBe(today.getDate())
    expect(arg.getMonth()).toBe(today.getMonth())
  })
})
