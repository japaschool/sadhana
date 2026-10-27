import { describe, it, expect } from 'vitest'
import { findZone, heatmapWindow, heatmapZone } from './yatrasLogic'
import type { ColourZonesConfig } from '../../types/api'

describe('findZone', () => {
  const lower: ColourZonesConfig = {
    better_direction: 'Lower',
    bounds: [{ to: { Time: { h: 5, m: 0 } }, colour: 'Green' }, { to: null, colour: 'Yellow' }],
    no_value_colour: 'MutedRed',
  }
  it('matches the first bound at or above the value', () => {
    expect(findZone({ Time: { h: 4, m: 30 } }, lower)).toBe('Green')
    expect(findZone({ Time: { h: 5, m: 0 } }, lower)).toBe('Green')
  })
  it('skips open bounds and falls back by direction', () => {
    expect(findZone({ Time: { h: 6, m: 0 } }, lower)).toBe('Red')
  })
  it('uses the no-value colour for nothing logged, but a false Bool is a value', () => {
    expect(findZone(null, lower)).toBe('MutedRed')
    const bool: ColourZonesConfig = { better_direction: 'Higher', bounds: [{ to: { Bool: false }, colour: 'Red' }], no_value_colour: 'Neutral' }
    expect(findZone({ Bool: false }, bool)).toBe('Red')
    expect(findZone({ Bool: true }, bool)).toBe('Green')
  })
})

describe('heatmap', () => {
  it('colours scores like the Rust UI', () => {
    expect([0, 50, 51, 70, 95, 105, 106].map(heatmapZone)).toEqual(['Neutral', 'MutedRed', 'Red', 'Red', 'Yellow', 'Green', 'DarkGreen'])
  })
  it('keeps 14 of 15 days', () => {
    const days = Array.from({ length: 15 }, (_, i) => i)
    expect(heatmapWindow(days, true)).toEqual(days.slice(0, 14))
    expect(heatmapWindow(days, false)).toEqual(days.slice(1))
  })
})
