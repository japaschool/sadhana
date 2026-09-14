import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastContainer } from './Toast'
import { useToastStore } from '../../hooks/useToast'

function renderToastContainer() {
  return render(<ToastContainer />)
}

describe('Toast', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('shows a toast when showToast is called', () => {
    renderToastContainer()
    act(() => {
      useToastStore.getState().showToast({ message: 'Saved!', variant: 'success' })
    })
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('dismisses toast when × button is clicked', async () => {
    renderToastContainer()
    act(() => {
      useToastStore.getState().showToast({ message: 'Error', variant: 'error' })
    })
    expect(screen.getByText('Error')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('Error')).not.toBeInTheDocument()
  })

  it('caps visible toasts at 3', () => {
    renderToastContainer()
    act(() => {
      useToastStore.getState().showToast({ message: 'A', variant: 'success' })
      useToastStore.getState().showToast({ message: 'B', variant: 'success' })
      useToastStore.getState().showToast({ message: 'C', variant: 'success' })
      useToastStore.getState().showToast({ message: 'D', variant: 'success' })
    })
    expect(screen.queryByText('A')).not.toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })
})
