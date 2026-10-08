import { lazy } from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ByLayout } from './ByLayout'
import { setViewportWidth } from '../test/viewport'

const ui = <ByLayout mobile={<p>mobile</p>} desktop={<p>desktop</p>} legacy={<p>legacy</p>} />

describe('ByLayout', () => {
  beforeEach(() => setViewportWidth(390))

  it('renders the mobile element below 640px', () => {
    render(ui)
    expect(screen.getByText('mobile')).toBeInTheDocument()
  })

  it('falls back to legacy for a layout without an element (tablet)', () => {
    render(ui)
    act(() => setViewportWidth(800))
    expect(screen.getByText('legacy')).toBeInTheDocument()
  })

  it('keeps a landscape phone on the mobile element', () => {
    render(ui)
    act(() => setViewportWidth(844, 390))
    expect(screen.getByText('mobile')).toBeInTheDocument()
  })

  it('renders the desktop element at 1024px and above', () => {
    setViewportWidth(1280)
    render(ui)
    expect(screen.getByText('desktop')).toBeInTheDocument()
  })
  it('shows a loader in the new design while a new screen loads, not the old dark one', () => {
    const Never = lazy(() => new Promise<{ default: () => null }>(() => {}))
    render(<ByLayout mobile={<Never />} legacy={<p>legacy</p>} />)
    expect(screen.getByRole('status').closest('.ui-root')).not.toBeNull()
  })
})
