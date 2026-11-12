import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { RangePicker } from './RangePicker'
import type { Range } from '../useInsights'

function Harness() {
  const [r, setR] = useState<Range>('30d')
  return <><RangePicker value={r} onChange={setR} /><output>{r}</output></>
}

describe('RangePicker', () => {
  it('picks short ranges directly and long ones from the last segment, which then shows the pick', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('radio', { name: '1y' }))
    expect(screen.getByRole('status')).toHaveTextContent('1y')
    fireEvent.click(screen.getByRole('radio', { name: '…' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '3 years' }))
    expect(screen.getByRole('status')).toHaveTextContent('3y')
    const last = screen.getByRole('radio', { name: '3y ▾' })
    expect(last).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(last)
    expect(screen.getByRole('menuitemradio', { name: '3 years' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'All time' }))
    expect(screen.getByRole('status')).toHaveTextContent('all')
  })
})
