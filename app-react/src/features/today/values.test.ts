import { describe, it, expect } from 'vitest'
import { parseOptions, formatDuration, formatTime, sameValue, capitalize } from './values'

const units = { h: 'h', min: 'min' }

describe('parseOptions', () => {
  it('splits on commas and newlines, trims, drops empties', () => {
    expect(parseOptions('1, 2,3')).toEqual(['1', '2', '3'])
    expect(parseOptions('Low\nCalm\n\nJoyful ')).toEqual(['Low', 'Calm', 'Joyful'])
    expect(parseOptions('a,\nb')).toEqual(['a', 'b'])
    expect(parseOptions(undefined)).toEqual([])
    expect(parseOptions(' , ')).toEqual([])
  })
})

describe('formatDuration', () => {
  it('formats minutes, hours, and both', () => {
    expect(formatDuration(0, units)).toBe('0 min')
    expect(formatDuration(30, units)).toBe('30 min')
    expect(formatDuration(60, units)).toBe('1 h')
    expect(formatDuration(75, units)).toBe('1 h 15 min')
  })
})

describe('formatTime', () => {
  it('zero-pads', () => { expect(formatTime({ h: 4, m: 5 })).toBe('04:05') })
})

describe('sameValue', () => {
  it('treats undefined and null as the same empty value', () => {
    expect(sameValue(undefined, null)).toBe(true)
    expect(sameValue({ Int: 1 }, { Int: 1 })).toBe(true)
    expect(sameValue({ Int: 1 }, { Int: 2 })).toBe(false)
    expect(sameValue({ Text: 'x' }, null)).toBe(false)
  })
})

describe('capitalize', () => {
  it('uppercases the first letter in the given locale', () => {
    expect(capitalize('вт, 6 октября', 'ru')).toBe('Вт, 6 октября')
    expect(capitalize('', 'en')).toBe('')
  })
})
