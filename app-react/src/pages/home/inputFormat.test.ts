// app-react/src/pages/home/inputFormat.test.ts
import { describe, it, expect } from 'vitest'
import { formatTimeInput, parseTime } from './inputFormat'

describe('formatTimeInput', () => {
  it('inserts the colon after two hour digits', () => {
    expect(formatTimeInput('0630')).toBe('06:30')
    expect(formatTimeInput('12')).toBe('12:')
  })
  it('auto-prefixes a leading zero when the first digit is > 2', () => {
    expect(formatTimeInput('9')).toBe('09:')
    expect(formatTimeInput('2')).toBe('2')
  })
  it('clamps hours to 23 and minutes to 59', () => {
    expect(formatTimeInput('2530')).toBe('23:30')
    expect(formatTimeInput('1275')).toBe('12:59')
  })
  it('pads a minutes tens digit > 5', () => {
    expect(formatTimeInput('127')).toBe('12:07')
  })
  it('strips non-digits and empties on no digits', () => {
    expect(formatTimeInput('ab')).toBe('')
    expect(formatTimeInput('')).toBe('')
  })
})

describe('parseTime', () => {
  it('parses full and partial HH:MM', () => {
    expect(parseTime('06:30')).toEqual({ h: 6, m: 30 })
    expect(parseTime('06:')).toEqual({ h: 6, m: 0 })
  })
  it('returns null for empty', () => {
    expect(parseTime('')).toBeNull()
    expect(parseTime(':')).toBeNull()
  })
  it('clamps out-of-range', () => {
    expect(parseTime('30:90')).toEqual({ h: 23, m: 59 })
  })
})
