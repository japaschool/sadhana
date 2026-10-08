import type {
  BetterDirection, ColourBound, ColourZonesConfig, DailyScoreConfig, PracticeDataType, PracticeValue, ZoneColour,
} from '../../../types/api'
import { findZone, zoneNumber } from '../yatrasLogic'

export type ScoredType = 'Int' | 'Time' | 'Duration'
export const isScored = (dt: PracticeDataType): dt is ScoredType => dt === 'Int' || dt === 'Time' || dt === 'Duration'

export function fromNumber(n: number, dt: ScoredType): PracticeValue {
  if (dt === 'Int') return { Int: n }
  if (dt === 'Duration') return { Duration: n }
  return { Time: { h: Math.floor(n / 60), m: n % 60 } }
}

/** As typed in a field: 16, 1:30 (h:mm), 05:30. */
export function formatValue(v: PracticeValue | null | undefined, dt: ScoredType): string {
  const n = zoneNumber(v)
  if (n === null) return ''
  if (dt === 'Int') return String(n)
  const h = Math.floor(n / 60)
  const m = String(n % 60).padStart(2, '0')
  return dt === 'Time' ? `${String(h).padStart(2, '0')}:${m}` : `${h}:${m}`
}

/** Empty → null; anything that isn't a value of this type → 'invalid'. Durations also take plain minutes. */
export function parseValue(text: string, dt: ScoredType): PracticeValue | null | 'invalid' {
  const s = text.trim()
  if (!s) return null
  if (dt === 'Int') return /^\d+$/.test(s) ? { Int: Number(s) } : 'invalid'
  const hm = /^(\d{1,2}):([0-5]\d)$/.exec(s)
  if (dt === 'Time') return hm && Number(hm[1]) < 24 ? fromNumber(Number(hm[1]) * 60 + Number(hm[2]), 'Time') : 'invalid'
  if (/^\d+$/.test(s)) return { Duration: Number(s) }
  return hm ? { Duration: Number(hm[1]) * 60 + Number(hm[2]) } : 'invalid'
}

export type ZoneCount = 0 | 2 | 3
export const zoneCount = (z?: ColourZonesConfig | null): ZoneCount => (!z?.bounds.length ? 0 : z.bounds.length === 1 ? 2 : 3)

/** Standard palettes. Higher: Red, (Yellow,) Green above. Lower: Green, (Yellow,) Red above. Values and the empty colour carry over. */
export function paletteZones(count: 2 | 3, dir: BetterDirection, prev?: ColourZonesConfig | null): ColourZonesConfig {
  const [first, above]: ZoneColour[] = dir === 'Higher' ? ['Red', 'Green'] : ['Green', 'Red']
  const colours: ZoneColour[] = count === 3 ? [first, 'Yellow'] : [first]
  return {
    better_direction: dir,
    bounds: colours.map((colour, i) => ({ to: prev?.bounds[i]?.to ?? null, colour })),
    no_value_colour: prev?.no_value_colour ?? 'Neutral',
    best_colour: above,
  }
}

export const aboveColour = (z: ColourZonesConfig): ZoneColour => z.best_colour ?? (z.better_direction === 'Higher' ? 'Green' : 'Red')

export type FieldError =
  | { kind: 'format' }
  | { kind: 'order'; than: PracticeValue; colour: ZoneColour }
  | { kind: 'bonus'; done: PracticeValue; dir: BetterDirection }

export interface Checked { values: (PracticeValue | null)[]; errors: (FieldError | null)[]; ok: boolean }

/** Each bound must parse and be more than the last filled one before it. */
export function checkBounds(texts: string[], colours: ZoneColour[], dt: ScoredType): Checked {
  const values: (PracticeValue | null)[] = []
  const errors: (FieldError | null)[] = []
  let prev: { v: PracticeValue; colour: ZoneColour } | null = null
  texts.forEach((text, i) => {
    const v = parseValue(text, dt)
    if (v === 'invalid') { values.push(null); errors.push({ kind: 'format' }); return }
    values.push(v)
    if (v && prev && zoneNumber(v)! <= zoneNumber(prev.v)!) { errors.push({ kind: 'order', than: prev.v, colour: prev.colour }); return }
    errors.push(null)
    if (v) prev = { v, colour: colours[i] }
  })
  return { values, errors, ok: errors.every((e) => !e) }
}

/** Done and bonus must parse; bonus is at least done (Higher) or at most done (Lower). */
export function checkScore(doneText: string, bonusText: string, dir: BetterDirection, dt: ScoredType): Checked {
  const done = parseValue(doneText, dt)
  const bonus = parseValue(bonusText, dt)
  const errors: (FieldError | null)[] = [done === 'invalid' ? { kind: 'format' } : null, bonus === 'invalid' ? { kind: 'format' } : null]
  if (done && done !== 'invalid' && bonus && bonus !== 'invalid') {
    const d = zoneNumber(done)!
    const b = zoneNumber(bonus)!
    if (dir === 'Higher' ? b < d : b > d) errors[1] = { kind: 'bonus', done, dir }
  }
  const ok = (v: PracticeValue | null | 'invalid') => (v === 'invalid' ? null : v)
  return { values: [ok(done), ok(bonus)], errors, ok: errors.every((e) => !e) }
}

export function scoreConfig(dir: BetterDirection, done: PracticeValue | null, bonus: PracticeValue | null): DailyScoreConfig | null {
  if (!done && !bonus) return null
  return { better_direction: dir, mandatory_threshold: done, bonus_rules: bonus ? [{ threshold: bonus, points: 1 }] : [] }
}

export const bonusOf = (s?: DailyScoreConfig | null): PracticeValue | null => s?.bonus_rules[0]?.threshold ?? null

/** Where Green starts, as a done threshold: one above the last filled bound (Higher) or the first bound (Lower). */
export function greenStart(z: ColourZonesConfig, dt: ScoredType): PracticeValue | null {
  if (z.better_direction === 'Lower') {
    const n = zoneNumber(z.bounds[0]?.to)
    return n === null ? null : fromNumber(n, dt)
  }
  const filled = z.bounds.map((b) => zoneNumber(b.to)).filter((n): n is number => n !== null)
  return filled.length ? fromNumber(filled[filled.length - 1] + 1, dt) : null
}

export interface Bar {
  min: number
  max: number
  segments: { left: number; width: number; colour: ZoneColour }[]
  ticks: { at: number; value: PracticeValue }[]
  done: { at: number; value: PracticeValue } | null
  bonus: { at: number; value: PracticeValue } | null
}

const DAY_END = 24 * 60 - 1

/** One scale for the colour bounds and the ✓/★ thresholds; positions in %. Null when nothing is set. */
export function barGeometry(z: ColourZonesConfig | null | undefined, s: DailyScoreConfig | null | undefined, dt: ScoredType): Bar | null {
  const bounds = (z?.bounds ?? []).filter((b): b is ColourBound & { to: PracticeValue } => !!b.to)
  const done = s?.mandatory_threshold ?? null
  const bonus = bonusOf(s)
  const nums = [...bounds.map((b) => b.to), done, bonus].map(zoneNumber).filter((n): n is number => n !== null)
  if (!nums.length) return null
  const lo = Math.min(...nums)
  const hi = Math.max(...nums)
  let min = 0
  let max = Math.ceil(hi * 1.2) || 1
  if (dt === 'Time') {
    const pad = Math.max(30, Math.round((hi - lo) * 0.25))
    min = Math.max(0, lo - pad)
    max = Math.min(DAY_END, hi + pad)
  }
  const at = (n: number) => ((n - min) / (max - min)) * 100
  const segments: Bar['segments'] = []
  if (z && bounds.length) {
    let left = 0
    for (const b of bounds) {
      const x = at(zoneNumber(b.to)!)
      segments.push({ left, width: x - left, colour: b.colour })
      left = x
    }
    segments.push({ left, width: 100 - left, colour: aboveColour(z) })
  }
  const mark = (v: PracticeValue | null) => (v ? { at: at(zoneNumber(v)!), value: v } : null)
  return { min, max, segments, ticks: bounds.map((b) => ({ at: at(zoneNumber(b.to)!), value: b.to })), done: mark(done), bonus: mark(bonus) }
}

/** A value from the middle of each zone, coloured the way the table paints it. */
export function zoneSamples(bar: Bar, z: ColourZonesConfig, dt: ScoredType): { value: PracticeValue; colour: ZoneColour }[] {
  const edges = [bar.min, ...bar.ticks.map((t) => zoneNumber(t.value)!), bar.max]
  return bar.segments.map((_, i) => {
    const value = fromNumber(Math.round((edges[i] + edges[i + 1]) / 2), dt)
    return { value, colour: findZone(value, z) }
  })
}
