import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  it('is a labelled switch that reports the next state', () => {
    const onChange = vi.fn()
    render(<Toggle label="Japa" checked={false} onChange={onChange} />)
    const sw = screen.getByRole('switch', { name: 'Japa' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
