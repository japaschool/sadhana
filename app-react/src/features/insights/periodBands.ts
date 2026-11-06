import type { MarkedPeriod } from '../../api/markedPeriods'

export interface Band { x1: string; x2: string; name: string; id: string }

/** Marked periods as bands over a chart's days (yyyy-mm-dd, ascending): clipped to the first..last day, an open period running to the last day, none outside. */
export function periodBands(periods: MarkedPeriod[], days: string[]): Band[] {
  return periods.flatMap((p) => {
    const inside = days.filter((d) => d >= p.start_date && (p.end_date === null || d <= p.end_date))
    return inside.length ? [{ x1: inside[0], x2: inside[inside.length - 1], name: p.name, id: p.id }] : []
  })
}

export interface LabelSpot { x: number; anchor: 'start' | 'end'; lane: number }

const PAD = 3
const GAP = 8

/**
 * Where each band's full name goes, in pixels: from the band's start, or ending at its end when it would run off the right.
 * A name that would touch an earlier one moves down a lane, so overlapping periods stack their names.
 */
export function labelSpots(items: { x1: number; x2: number; w: number }[], left: number, right: number): LabelSpot[] {
  const lanes: number[] = [] // each lane's rightmost used pixel
  const spots: LabelSpot[] = new Array(items.length)
  const order = items.map((_, i) => i).sort((a, b) => items[a].x1 - items[b].x1)
  for (const i of order) {
    const { x1, x2, w } = items[i]
    const fromStart = x1 + PAD + w <= right
    const from = fromStart ? x1 + PAD : Math.max(left, x2 - PAD - w)
    let lane = lanes.findIndex((end) => end + GAP <= from)
    if (lane < 0) lane = lanes.length
    lanes[lane] = from + w
    spots[i] = fromStart ? { x: from, anchor: 'start', lane } : { x: from + w, anchor: 'end', lane }
  }
  return spots
}
