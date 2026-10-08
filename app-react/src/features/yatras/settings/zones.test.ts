import { describe, expect, it } from 'vitest'
import type { ColourZonesConfig } from '../../../types/api'
import {
  barGeometry, checkBounds, checkScore, formatValue, greenStart, paletteZones, parseValue, scoreConfig, zoneCount, zoneSamples,
} from './zones'

const japa: ColourZonesConfig = {
  better_direction: 'Higher',
  bounds: [{ to: { Int: 7 }, colour: 'Red' }, { to: { Int: 15 }, colour: 'Yellow' }],
  no_value_colour: 'Neutral', best_colour: 'Green',
}
const score = scoreConfig('Higher', { Int: 16 }, { Int: 20 })

describe('values', () => {
  it('formats each type the way the fields show it', () => {
    expect(formatValue({ Int: 16 }, 'Int')).toBe('16')
    expect(formatValue({ Duration: 90 }, 'Duration')).toBe('1:30')
    expect(formatValue({ Time: { h: 5, m: 0 } }, 'Time')).toBe('05:00')
    expect(formatValue(null, 'Int')).toBe('')
  })

  it('parses, treats empty as null and rejects the rest', () => {
    expect(parseValue(' 16 ', 'Int')).toEqual({ Int: 16 })
    expect(parseValue('', 'Int')).toBeNull()
    expect(parseValue('1.5', 'Int')).toBe('invalid')
    expect(parseValue('1:30', 'Duration')).toEqual({ Duration: 90 })
    expect(parseValue('45', 'Duration')).toEqual({ Duration: 45 })
    expect(parseValue('1:75', 'Duration')).toBe('invalid')
    expect(parseValue('5:30', 'Time')).toEqual({ Time: { h: 5, m: 30 } })
    expect(parseValue('24:00', 'Time')).toBe('invalid')
  })
})

describe('palettes', () => {
  it('maps count and direction to the standard colours, keeping values and the empty colour', () => {
    expect(zoneCount(null)).toBe(0)
    expect(zoneCount(japa)).toBe(3)
    const two = paletteZones(2, 'Higher', { ...japa, no_value_colour: 'Red' })
    expect(two).toEqual({ better_direction: 'Higher', bounds: [{ to: { Int: 7 }, colour: 'Red' }], no_value_colour: 'Red', best_colour: 'Green' })
    const lower = paletteZones(3, 'Lower', japa)
    expect(lower.bounds.map((b) => b.colour)).toEqual(['Green', 'Yellow'])
    expect(lower.best_colour).toBe('Red')
    expect(lower.bounds.map((b) => b.to)).toEqual([{ Int: 7 }, { Int: 15 }])
    expect(paletteZones(3, 'Higher', null).bounds).toEqual([{ to: null, colour: 'Red' }, { to: null, colour: 'Yellow' }])
  })

  it('green starts one above the last bound (Higher) or at the first bound (Lower)', () => {
    expect(greenStart(japa, 'Int')).toEqual({ Int: 16 })
    expect(greenStart(paletteZones(3, 'Lower', japa), 'Int')).toEqual({ Int: 7 })
    expect(greenStart(paletteZones(3, 'Higher', null), 'Int')).toBeNull()
  })
})

describe('validation', () => {
  it('names the bound a value must exceed', () => {
    const r = checkBounds(['7', '6'], ['Red', 'Yellow'], 'Int')
    expect(r.ok).toBe(false)
    expect(r.errors).toEqual([null, { kind: 'order', than: { Int: 7 }, colour: 'Red' }])
  })

  it('allows an empty bound and compares with the last filled one', () => {
    expect(checkBounds(['', '6'], ['Red', 'Yellow'], 'Int')).toEqual({ values: [null, { Int: 6 }], errors: [null, null], ok: true })
    expect(checkBounds(['x', '6'], ['Red', 'Yellow'], 'Int').errors[0]).toEqual({ kind: 'format' })
  })

  it('bonus must be at least done for Higher and at most done for Lower', () => {
    expect(checkScore('16', '20', 'Higher', 'Int').ok).toBe(true)
    expect(checkScore('16', '12', 'Higher', 'Int').errors[1]).toEqual({ kind: 'bonus', done: { Int: 16 }, dir: 'Higher' })
    expect(checkScore('05:00', '04:30', 'Lower', 'Time').ok).toBe(true)
    expect(checkScore('05:00', '05:30', 'Lower', 'Time').ok).toBe(false)
  })

  it('both thresholds empty means no daily score', () => {
    expect(scoreConfig('Higher', null, null)).toBeNull()
    expect(scoreConfig('Lower', null, { Int: 3 })).toEqual({ better_direction: 'Lower', mandatory_threshold: null, bonus_rules: [{ threshold: { Int: 3 }, points: 1 }] })
  })
})

describe('range bar', () => {
  it('matches the 12m14 mockup: 0–24, bounds at 7 and 15, ✓ 16, ★ 20', () => {
    const bar = barGeometry(japa, score, 'Int')!
    expect([bar.min, bar.max]).toEqual([0, 24])
    expect(bar.ticks.map((t) => t.at)).toEqual([(7 / 24) * 100, (15 / 24) * 100])
    expect(bar.segments.map((s) => s.colour)).toEqual(['Red', 'Yellow', 'Green'])
    expect(bar.segments[2].left + bar.segments[2].width).toBeCloseTo(100)
    expect(bar.done!.at).toBeCloseTo((16 / 24) * 100)
    expect(bar.bonus!.at).toBeCloseTo((20 / 24) * 100)
  })

  it('pads a Time scale around the values', () => {
    const bar = barGeometry(null, scoreConfig('Lower', { Time: { h: 5, m: 0 } }, { Time: { h: 4, m: 30 } }), 'Time')!
    expect([bar.min, bar.max]).toEqual([270 - 30, 300 + 30])
    expect(bar.segments).toEqual([])
  })

  it('has no bar with nothing set', () => {
    expect(barGeometry(paletteZones(3, 'Higher', null), null, 'Int')).toBeNull()
  })

  it('takes one sample inside each zone', () => {
    const bar = barGeometry(japa, score, 'Int')!
    expect(zoneSamples(bar, japa, 'Int')).toEqual([
      { value: { Int: 4 }, colour: 'Red' }, { value: { Int: 11 }, colour: 'Yellow' }, { value: { Int: 20 }, colour: 'Green' },
    ])
  })
})
