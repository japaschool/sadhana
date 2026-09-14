import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button variant="primary">Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('shows loading spinner and disables when loading', () => {
    render(<Button variant="primary" loading>Save</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
    // DaisyUI loading spinner is a <span>, not an <svg>
    expect(screen.getByRole('button').querySelector('span.loading')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button variant="primary" onClick={onClick}>Click me</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
