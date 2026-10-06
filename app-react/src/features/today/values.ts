import type { PracticeValue } from '../../types/api'

export interface DurationUnits { h: string; min: string }

/** Dropdown options: main stores them comma-separated, the old React form newline-separated. */
export function parseOptions(raw?: string | null): string[] {
  return (raw ?? '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
}

export function formatDuration(total: number, u: DurationUnits): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} ${u.min}`
  return m === 0 ? `${h} ${u.h}` : `${h} ${u.h} ${m} ${u.min}`
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
