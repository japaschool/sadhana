import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../../hooks/useToast'
import { UiToastContainer } from './Toast'

describe('UiToastContainer', () => {
  afterEach(() => { vi.useRealTimers(); useToastStore.setState({ toasts: [] }) })

  it('shows the action, runs it once and dismisses the toast', () => {
    const onClick = vi.fn()
    render(<UiToastContainer />)
    act(() => useToastStore.getState().showToast({ message: 'Linked A → B', variant: 'success', action: { label: 'Undo', onClick } }))
    expect(screen.getByText('Linked A → B')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('keeps an action toast for 5 s, a plain one for 3 s', () => {
    vi.useFakeTimers()
    const { showToast } = useToastStore.getState()
    act(() => { showToast({ message: 'plain', variant: 'success' }); showToast({ message: 'undo', variant: 'success', action: { label: 'Undo', onClick: () => {} } }) })
    act(() => { vi.advanceTimersByTime(3001) })
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['undo'])
    act(() => { vi.advanceTimersByTime(2000) })
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
  it('sits at the top of the screen, newest first, clear of sheets and fields below', () => {
    render(<UiToastContainer />)
    const { showToast } = useToastStore.getState()
    act(() => { showToast({ message: 'first', variant: 'success' }); showToast({ message: 'second', variant: 'success' }) })
    const box = screen.getByText('first').closest('[aria-live]')!
    expect(box.className).toMatch(/\btop-/)
    expect(box.className).not.toMatch(/\bbottom-/)
    expect([...box.querySelectorAll('span')].map((s) => s.textContent)).toEqual(['second', 'first'])
  })
})
