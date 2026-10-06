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

  it('renders the desktop element at 1024px and above', () => {
    setViewportWidth(1280)
    render(ui)
    expect(screen.getByText('desktop')).toBeInTheDocument()
  })
})
