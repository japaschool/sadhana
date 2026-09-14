import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { DeferUntilVisible } from './DeferUntilVisible'

afterEach(() => {
  // @ts-expect-error test cleanup of the global we may have set
  delete globalThis.IntersectionObserver
})

describe('DeferUntilVisible', () => {
  it('renders children immediately when IntersectionObserver is unavailable', () => {
    expect(typeof IntersectionObserver).toBe('undefined') // jsdom default
    render(
      <DeferUntilVisible>
        <div>DEFERRED_CONTENT</div>
      </DeferUntilVisible>,
    )
    expect(screen.getByText('DEFERRED_CONTENT')).toBeInTheDocument()
  })

  it('renders a placeholder first, then children after intersection', () => {
    const observe = vi.fn()
    let cb: (entries: { isIntersecting: boolean }[]) => void = () => {}
    // @ts-expect-error minimal IntersectionObserver mock
    globalThis.IntersectionObserver = class {
      constructor(handler: (entries: { isIntersecting: boolean }[]) => void) { cb = handler }
      observe = observe
      disconnect = vi.fn()
    }
    render(
      <DeferUntilVisible>
        <div>LATER</div>
      </DeferUntilVisible>,
    )
    expect(screen.queryByText('LATER')).not.toBeInTheDocument()
    expect(observe).toHaveBeenCalled()
    act(() => cb([{ isIntersecting: true }]))
    expect(screen.getByText('LATER')).toBeInTheDocument()
  })
})
