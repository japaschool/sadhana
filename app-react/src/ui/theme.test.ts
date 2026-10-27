import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { getThemePref, setThemePref, applyThemePref } from './theme'
import { useTheme } from './useTheme'

const attr = () => document.documentElement.getAttribute('data-ui-theme')

describe('theme preference', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    document.documentElement.removeAttribute('data-ui-theme')
  })

  it('defaults to Auto with no attribute', () => {
    expect(getThemePref()).toBe('auto')
    applyThemePref()
    expect(attr()).toBeNull()
  })

  it('Light and Dark set data-ui-theme and persist', () => {
    setThemePref('dark')
    expect(attr()).toBe('dark')
    expect(localStorage.getItem('ui-theme')).toBe('dark')
    setThemePref('light')
    expect(attr()).toBe('light')
    expect(getThemePref()).toBe('light')
  })

  it('Auto removes both', () => {
    setThemePref('dark')
    setThemePref('auto')
    expect(attr()).toBeNull()
    expect(localStorage.getItem('ui-theme')).toBeNull()
  })

  it('applyThemePref applies the stored value', () => {
    localStorage.setItem('ui-theme', 'dark')
    applyThemePref()
    expect(attr()).toBe('dark')
  })

  it('treats a junk stored value as Auto', () => {
    localStorage.setItem('ui-theme', 'purple')
    expect(getThemePref()).toBe('auto')
  })

  it('falls back to Auto when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(getThemePref()).toBe('auto')
  })

  it('setThemePref survives a throwing setItem and still applies for the session', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => setThemePref('dark')).not.toThrow()
    expect(attr()).toBe('dark')
  })

  it('useTheme reads and updates the preference', () => {
    localStorage.setItem('ui-theme', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('light')
    act(() => result.current[1]('dark'))
    expect(result.current[0]).toBe('dark')
    expect(attr()).toBe('dark')
  })
})
