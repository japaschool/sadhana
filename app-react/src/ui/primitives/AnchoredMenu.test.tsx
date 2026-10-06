import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { AnchoredMenu, MenuItem, MenuDivider } from './AnchoredMenu'

function Harness({ onPick = vi.fn() }: { onPick?: (v: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <button onClick={(e) => setAnchor(e.currentTarget)}>open</button>
      {anchor && (
        <AnchoredMenu anchor={anchor} label="Quality" onClose={() => setAnchor(null)}>
          <MenuItem selected={false} onSelect={() => { onPick('Great'); setAnchor(null) }}>Great</MenuItem>
          <MenuItem selected onSelect={() => { onPick('Good'); setAnchor(null) }}>Good</MenuItem>
          <MenuDivider />
          <MenuItem muted onSelect={() => { onPick('clear'); setAnchor(null) }}>Clear</MenuItem>
        </AnchoredMenu>
      )}
    </>
  )
}

describe('AnchoredMenu', () => {
  it('focuses the selected item and picks on click', () => {
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByRole('menuitemradio', { name: /Good/ })).toHaveFocus()
    expect(screen.getByRole('menuitemradio', { name: /Good/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Great' }))
    expect(onPick).toHaveBeenCalledWith('Great')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('moves focus with arrow keys and closes on Escape, returning focus', () => {
    render(<Harness />)
    const opener = screen.getByText('open')
    fireEvent.click(opener)
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: 'Clear' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('closes on backdrop click', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByTestId('menu-backdrop'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders inside a .ui-root portal', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByRole('menu').closest('.ui-root')).not.toBeNull()
  })
})
