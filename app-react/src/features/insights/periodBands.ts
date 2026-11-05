import type { MarkedPeriod } from '../../api/markedPeriods'

export interface Band { x1: string; x2: string; name: string }

/** Marked periods as bands over a chart's days (yyyy-mm-dd, ascending): clipped to the first..last day, an open period running to the last day, none outside. */
export function periodBands(periods: MarkedPeriod[], days: string[]): Band[] {
  return periods.flatMap((p) => {
    const inside = days.filter((d) => d >= p.start_date && (p.end_date === null || d <= p.end_date))
    return inside.length ? [{ x1: inside[0], x2: inside[inside.length - 1], name: p.name }] : []
  })
}
