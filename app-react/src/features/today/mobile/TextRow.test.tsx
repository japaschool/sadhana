import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TextRow } from './TextRow'

function hideApp() {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
}

describe('TextRow', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  const setup = (value = '', required = false) => {
    const onSave = vi.fn()
    const utils = render(<TextRow label="Gratitude" value={value} required={required} failed={false} onSave={onSave} />)
    return { onSave, ...utils }
  }

  it('shows + Add when empty and opens a focused editor on tap', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Gratitude' }))
    expect(screen.getByRole('textbox', { name: 'Gratitude' })).toHaveFocus()
    expect(screen.getByText('Saved as you type')).toBeInTheDocument()
  })

  it('tapping the label opens the editor; tapping it while editing only closes it', () => {
    setup('Thankful')
    fireEvent.click(screen.getByText('Gratitude'))
    const area = screen.getByRole('textbox', { name: 'Gratitude' })
    fireEvent.pointerDown(screen.getByText('Gratitude'))
    fireEvent.blur(area)
    fireEvent.click(screen.getByText('Gratitude'))
    expect(screen.queryByRole('textbox', { name: 'Gratitude' })).not.toBeInTheDocument()
  })

  it('shows Required instead of Edit when required and empty', () => {
    setup('', true)
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('saves 600ms after typing stops', () => {
    const { onSave } = setup('Old')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New text' } })
    act(() => { vi.advanceTimersByTime(599) })
    expect(onSave).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onSave).toHaveBeenCalledWith({ Text: 'New text' })
  })

  it('Done saves immediately and returns to the preview', () => {
    const { onSave } = setup('Old')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Kirtan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onSave).toHaveBeenCalledWith({ Text: 'Kirtan' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('whitespace-only saves null', () => {
    const { onSave } = setup('Old')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    fireEvent.blur(screen.getByRole('textbox'))
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('flushes a pending edit when the app is hidden', () => {
    const { onSave } = setup('Old')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Typed' } })
    act(() => hideApp())
    expect(onSave).toHaveBeenCalledWith({ Text: 'Typed' })
  })

  it('flushes a pending edit on unmount', () => {
    const { onSave, unmount } = setup('Old')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Typed' } })
    unmount()
    expect(onSave).toHaveBeenCalledWith({ Text: 'Typed' })
  })
})
