import type { ColourZonesConfig, ZoneColour } from '../../types/api'

/** A value as a number to compare against zone bounds; null when nothing was logged. */
function zoneNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return raw
  const o = raw as Record<string, unknown>
  if (typeof o.Bool === 'boolean') return o.Bool ? 1 : 0
  if (typeof o.Int === 'number') return o.Int
  if (typeof o.Duration === 'number') return o.Duration
  const t = o.Time as { h: number; m: number } | undefined
  if (t) return t.h * 60 + t.m
  return null // ponytail: Text values get no zone; the Rust UI compares them as strings
}

/** Same rule as the Rust UI: the first bound the value is at or below, else the best colour. */
export function findZone(raw: unknown, cfg: ColourZonesConfig): ZoneColour {
  const n = zoneNumber(raw)
  if (n === null) return cfg.no_value_colour
  for (const b of cfg.bounds) {
    const to = zoneNumber(b.to)
    if (to !== null && n <= to) return b.colour
  }
  return cfg.best_colour ?? (cfg.better_direction === 'Higher' ? 'Green' : 'Red')
}

/** The stability heatmap's fixed zones (7-day average %), as in the Rust UI. */
export const HEATMAP_ZONES: ColourZonesConfig = {
  better_direction: 'Higher',
  bounds: [
    { to: { Int: 50 }, colour: 'MutedRed' },
    { to: { Int: 70 }, colour: 'Red' },
    { to: { Int: 95 }, colour: 'Yellow' },
    { to: { Int: 105 }, colour: 'Green' },
  ],
  no_value_colour: 'Neutral',
  best_colour: 'DarkGreen',
}

/** A score of 0 means no data for that day. */
export const heatmapZone = (score: number): ZoneColour => findZone(score > 0 ? score : null, HEATMAP_ZONES)

/** The server sends 15 days around the selected one: drop today's (still incomplete), else the oldest. */
export const heatmapWindow = <T,>(days: T[], isToday: boolean): T[] => (isToday ? days.slice(0, -1) : days.slice(1))

export const ZONE_BG: Record<ZoneColour, string> = {
  Neutral: '',
  MutedRed: 'bg-[var(--ui-zone-muted-red)]',
  Red: 'bg-[var(--ui-zone-red)]',
  Yellow: 'bg-[var(--ui-zone-yellow)]',
  Green: 'bg-[var(--ui-zone-green)]',
  DarkGreen: 'bg-[var(--ui-zone-dark-green)]',
}
