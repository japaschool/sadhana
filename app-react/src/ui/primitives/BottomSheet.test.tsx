import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'
import { Keypad } from './Keypad'
import { SegmentedControl } from './SegmentedControl'

describe('BottomSheet', () => {
  it('is a focused modal dialog that closes on Escape and backdrop', () => {
    const onClose = vi.fn()
    render(<BottomSheet label="Audiobooks" onClose={onClose}><button>inside</button></BottomSheet>)
    const dialog = screen.getByRole('dialog', { name: 'Audiobooks' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveFocus()
    expect(dialog.closest('.ui-root')).not.toBeNull()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('traps Tab inside the sheet', () => {
    render(<BottomSheet label="S" onClose={() => {}}><button>first</button><button>last</button></BottomSheet>)
    screen.getByText('last').focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(screen.getByText('first')).toHaveFocus()
  })
})

describe('Keypad', () => {
  it('reports keys, with labelled C and ⌫', () => {
    const onKey = vi.fn()
    render(<Keypad onKey={onKey} />)
    fireEvent.click(screen.getByRole('button', { name: '7' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete digit' }))
    expect(onKey.mock.calls.map((c) => c[0])).toEqual(['7', 'C', '⌫'])
  })
})

describe('SegmentedControl', () => {
  it('is a radiogroup', () => {
    const onChange = vi.fn()
    render(<SegmentedControl label="Mode" value="add" onChange={onChange}
      options={[{ value: 'add', label: 'Add' }, { value: 'set', label: 'Set total' }]} />)
    expect(screen.getByRole('radio', { name: 'Add' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'Set total' }))
    expect(onChange).toHaveBeenCalledWith('set')
  })

  it('is one tab stop; arrow keys choose and move focus, wrapping', () => {
    const onChange = vi.fn()
    render(<SegmentedControl label="Mode" value="add" onChange={onChange}
      options={[{ value: 'add', label: 'Add' }, { value: 'set', label: 'Set total' }]} />)
    const add = screen.getByRole('radio', { name: 'Add' })
    expect(add).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Set total' })).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(add, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('set')
    expect(screen.getByRole('radio', { name: 'Set total' })).toHaveFocus()
    fireEvent.keyDown(add, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('set')
  })
})
