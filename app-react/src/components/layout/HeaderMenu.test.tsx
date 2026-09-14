import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { HeaderMenu } from './HeaderMenu'

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('HeaderMenu', () => {
  it('is closed until the trigger is clicked, then shows a link item', () => {
    wrap(<HeaderMenu label="Practices" items={[{ label: 'Add', to: '/add' }]} />)
    expect(screen.queryByRole('menuitem', { name: 'Add' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Practices/ }))
    expect(screen.getByRole('menuitem', { name: 'Add' })).toHaveAttribute('href', '/add')
  })

  it('renders an onClick item as a button that fires its handler and closes the menu', () => {
    const onClick = vi.fn()
    wrap(<HeaderMenu label="Yatras" items={[{ label: 'Create', onClick }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Yatras/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menuitem', { name: 'Create' })).not.toBeInTheDocument()
  })
})
