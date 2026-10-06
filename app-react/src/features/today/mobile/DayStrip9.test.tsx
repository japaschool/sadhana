import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DayStrip9 } from './DayStrip9'
import { toDateStr } from '../date'

const date = new Date(2026, 9, 6) // Tue

describe('DayStrip9', () => {
  it('renders Sun–Mon around the week with the selected day current', () => {
    render(<DayStrip9 date={date} incomplete={new Set()} onSelect={() => {}} />)
    const days = screen.getAllByRole('button')
    expect(days).toHaveLength(9)
    expect(days[0]).toHaveTextContent('4')
    expect(days[8]).toHaveTextContent('12')
    expect(days[2]).toHaveAttribute('aria-current', 'date')
  })

  it('marks incomplete days with a dot', () => {
    render(<DayStrip9 date={date} incomplete={new Set(['2026-10-04', '2026-10-06'])} onSelect={() => {}} />)
    expect(screen.getAllByTestId('incomplete-dot')).toHaveLength(2)
  })

  it('selects a tapped day', () => {
    const onSelect = vi.fn()
    render(<DayStrip9 date={date} incomplete={new Set()} onSelect={onSelect} />)
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(toDateStr(onSelect.mock.calls[0][0])).toBe('2026-10-05')
  })

  it('swipes a week forward and back, ignoring short or vertical moves', () => {
    const onSelect = vi.fn()
    render(<DayStrip9 date={date} incomplete={new Set()} onSelect={onSelect} />)
    const strip = screen.getByTestId('day-strip')
    const swipe = (dx: number, dy = 0) => {
      fireEvent.touchStart(strip, { touches: [{ clientX: 200, clientY: 100 }] })
      fireEvent.touchEnd(strip, { changedTouches: [{ clientX: 200 + dx, clientY: 100 + dy }] })
    }
    swipe(-100)
    swipe(100)
    swipe(30)
    swipe(-80, 200)
    expect(onSelect.mock.calls.map((c) => toDateStr(c[0]))).toEqual(['2026-10-13', '2026-09-29'])
  })
})
