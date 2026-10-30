import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstallSheet } from './InstallSheet'

const KEY = 'sadhana.installPrompt'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
const WEEK = 7 * 24 * 60 * 60 * 1000

function device(userAgent: string, maxTouchPoints = 0, standalone = false) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true })
}

const shown = () => screen.queryByRole('dialog') !== null

describe('InstallSheet', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('shows on an iPhone in the browser', () => {
    device(IPHONE)
    render(<InstallSheet ready />)
    expect(shown()).toBe(true)
  })

  it('shows on an iPad, which claims to be a Mac', () => {
    device(MAC, 5)
    render(<InstallSheet ready />)
    expect(shown()).toBe(true)
  })

  it('waits until the screen is ready', () => {
    device(IPHONE)
    const { rerender } = render(<InstallSheet ready={false} />)
    expect(shown()).toBe(false)
    rerender(<InstallSheet ready />)
    expect(shown()).toBe(true)
  })

  it('stays hidden from the Home Screen, on a real Mac and on Android', () => {
    for (const [ua, touch, standalone] of [[IPHONE, 5, true], [MAC, 0, false], [ANDROID, 5, false]] as const) {
      device(ua, touch, standalone)
      const { unmount } = render(<InstallSheet ready />)
      expect(shown()).toBe(false)
      unmount()
    }
  })

  it('Not now hides it for 7 days', () => {
    device(IPHONE)
    const now = 1_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const first = render(<InstallSheet ready />)
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(shown()).toBe(false)
    first.unmount()

    vi.spyOn(Date, 'now').mockReturnValue(now + WEEK - 1)
    const second = render(<InstallSheet ready />)
    expect(shown()).toBe(false)
    second.unmount()

    vi.spyOn(Date, 'now').mockReturnValue(now + WEEK)
    render(<InstallSheet ready />)
    expect(shown()).toBe(true)
  })

  it('tapping outside counts as Not now', () => {
    device(IPHONE)
    render(<InstallSheet ready />)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(shown()).toBe(false)
    expect(Number(localStorage.getItem(KEY))).toBeGreaterThan(Date.now())
  })

  it("Don't show again hides it for good", () => {
    device(IPHONE)
    const first = render(<InstallSheet ready />)
    fireEvent.click(screen.getByRole('button', { name: "Don't show again" }))
    expect(shown()).toBe(false)
    first.unmount()

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000)
    render(<InstallSheet ready />)
    expect(shown()).toBe(false)
  })
})
