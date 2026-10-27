import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { MobileShell } from './MobileShell'
import { setViewportWidth } from '../../test/viewport'

const themeColor = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')

describe('MobileShell', () => {
  beforeEach(() => {
    setViewportWidth(390)
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: () => (document.documentElement.getAttribute('data-ui-theme') === 'dark' ? '#15121D' : '#F7F4EE'),
    }) as unknown as CSSStyleDeclaration)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.removeAttribute('data-ui-theme')
  })

  it('re-reads the background when data-ui-theme changes', async () => {
    render(<MemoryRouter><MobileShell><p>content</p></MobileShell></MemoryRouter>)
    expect(themeColor()).toBe('#F7F4EE')
    document.documentElement.setAttribute('data-ui-theme', 'dark')
    await waitFor(() => expect(themeColor()).toBe('#15121D'))
    expect(document.documentElement.style.backgroundColor).toBe('rgb(21, 18, 29)')
  })
})
