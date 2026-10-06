import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AddTimeSheet } from './AddTimeSheet'

function setup(initialMode: 'add' | 'set' = 'add', current = 30) {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<AddTimeSheet practice="Audiobooks" current={current} initialMode={initialMode} onSave={onSave} onClose={onClose} />)
  const key = (k: string) => fireEvent.click(screen.getByRole('button', { name: k }))
  return { onSave, onClose, key }
}

describe('AddTimeSheet', () => {
  it('stacks chips and previews the new total', () => {
    const { onSave, onClose, key } = setup()
    key('+30'); key('+15')
    expect(screen.getByTestId('amount')).toHaveTextContent('+45')
    expect(screen.getByTestId('new-total')).toHaveTextContent('1 h 15 min')
    key('Add 45 min')
    expect(onSave).toHaveBeenCalledWith({ Duration: 75 })
    expect(onClose).toHaveBeenCalled()
  })

  it('typing replaces the chip amount; backspace and reset work', () => {
    const { key } = setup()
    key('+30'); key('4'); key('5')
    expect(screen.getByTestId('amount')).toHaveTextContent('+45')
    key('Delete digit')
    expect(screen.getByTestId('amount')).toHaveTextContent('+4')
    key('Reset')
    expect(screen.getByTestId('amount')).toHaveTextContent('+0')
    expect(screen.getByRole('button', { name: 'Add 0 min' })).toBeDisabled()
  })

  it('Set total starts at the current value and replaces it', () => {
    const { onSave, key } = setup('set', 30)
    expect(screen.getByRole('radio', { name: 'Set total' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('amount')).toHaveTextContent('30')
    key('9'); key('0')
    key('Set 1 h 30 min')
    expect(onSave).toHaveBeenCalledWith({ Duration: 90 })
  })

  it('setting the total to 0 clears the value', () => {
    const { onSave, key } = setup('set', 30)
    key('Reset')
    key('Clear')
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('switching mode resets the amount', () => {
    const { key } = setup('add', 30)
    key('+10')
    fireEvent.click(screen.getByRole('radio', { name: 'Set total' }))
    expect(screen.getByTestId('amount')).toHaveTextContent('30')
  })
})
