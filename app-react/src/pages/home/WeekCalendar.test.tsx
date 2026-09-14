import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeekCalendar, getWeekDays } from './WeekCalendar'

describe('WeekCalendar — Today button', () => {
  it('shows Today button when selected date is not today', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    render(<WeekCalendar date={yesterday} onDateChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument()
  })

  it('hides Today button when selected date is today', () => {
    render(<WeekCalendar date={new Date()} onDateChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /today/i })).not.toBeInTheDocument()
  })

  it('calls onDateChange with today when Today button clicked', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const onDateChange = vi.fn()
    render(<WeekCalendar date={yesterday} onDateChange={onDateChange} />)
    await userEvent.click(screen.getByRole('button', { name: /today/i }))
    expect(onDateChange).toHaveBeenCalledOnce()
  })
})

describe('getWeekDays', () => {
  it('returns 7 days starting on Monday for a Wednesday input', () => {
    const wednesday = new Date(2026, 6, 29) // July 29 2026
    const week = getWeekDays(wednesday)
    expect(week).toHaveLength(7)
    expect(week[0].getDay()).toBe(1) // Monday
    expect(week[6].getDay()).toBe(0) // Sunday
  })

  it('returns same week for any day within it', () => {
    const monday = new Date(2026, 6, 27)
    const sunday = new Date(2026, 7, 2) // Aug 2
    expect(getWeekDays(monday)[0].toDateString()).toBe(getWeekDays(sunday)[0].toDateString())
  })
})
