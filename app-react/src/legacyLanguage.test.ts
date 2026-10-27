import { beforeEach, describe, expect, it } from 'vitest'
import { migrateLegacyLanguage } from './legacyLanguage'

describe('migrateLegacyLanguage', () => {
  beforeEach(() => localStorage.clear())

  it('carries the Rust UI choice over', () => {
    localStorage.setItem('user_language', '"uk"')
    migrateLegacyLanguage()
    expect(localStorage.getItem('i18nextLng')).toBe('uk')
  })

  it('leaves "sys" to browser detection', () => {
    localStorage.setItem('user_language', '"sys"')
    migrateLegacyLanguage()
    expect(localStorage.getItem('i18nextLng')).toBeNull()
  })

  it('never overrides a React choice', () => {
    localStorage.setItem('user_language', '"ru"')
    localStorage.setItem('i18nextLng', 'en')
    migrateLegacyLanguage()
    expect(localStorage.getItem('i18nextLng')).toBe('en')
  })
})
