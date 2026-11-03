import type { PracticeValue } from '../../types/api'
import { formatTimeInput } from './inputFormat'

export interface DurationUnits { h: string; min: string }

/** Dropdown options: main stores them comma-separated, the old React form newline-separated. */
export function parseOptions(raw?: string | null): string[] {
  return (raw ?? '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
}

/** A number and its unit: one-letter units sit flush (2h, 20m), longer ones get a space (2 год). */
export const withUnit = (n: number, unit: string) => `${n}${unit.length > 1 ? ' ' : ''}${unit}`

/** 2h 20m, 45m, 7h. */
export function formatDuration(total: number, u: DurationUnits): string {
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  if (h === 0) return withUnit(m, u.min)
  return m === 0 ? withUnit(h, u.h) : `${withUnit(h, u.h)} ${withUnit(m, u.min)}`
}

export function formatTime(t: { h: number; m: number }): string {
  return `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`
}

/** undefined and null both mean "no value". */
export function sameValue(a?: PracticeValue | null, b?: PracticeValue | null): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export function capitalize(s: string, locale: string): string {
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
}

/** A time field's next text as you type: digits only, the colon added for you, and Backspace over it removes a digit instead. */
export function typeTime(raw: string, prev: string): string {
  const next = formatTimeInput(raw)
  const deleting = raw.length < prev.length
  return deleting && next === prev ? formatTimeInput(raw.replace(/\D/g, '').slice(0, -1)) : next
}
