import type { Direction, Goal, GoalPeriod, ReportDataEntry } from '../../../api/charts'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import type { Lookup } from './panelLogic'

export type SquareState = 'full' | 'part' | 'limit' | 'over' | 'blank'
export interface GoalSquare { from: string; to: string; value: number; running: boolean; state: SquareState; fill: number }

const MAX_SQUARES = 12
const shift = (cob: string, n: number) => toDateStr(addDays(fromDateStr(cob), n))

/** The day, the Monday-to-Sunday week, or the calendar month holding `cob`. */
export function periodOf(cob: string, period: GoalPeriod): { from: string; to: string } {
  if (period === 'Day') return { from: cob, to: cob }
  const d = fromDateStr(cob)
  if (period === 'Week') {
    const from = shift(cob, -((d.getDay() + 6) % 7))
    return { from, to: shift(from, 6) }
  }
  return { from: toDateStr(new Date(d.getFullYear(), d.getMonth(), 1)), to: toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
}

/** Dates on which any entry has a value. */
export function loggedDays(entries: ReportDataEntry[]): Set<string> {
  const days = new Set<string>()
  for (const x of entries) if (x.value !== null && x.value !== undefined) days.add(x.cob_date)
  return days
}

/**
 * The practice can be counted: Yes/no, Number or Duration, and active. A days goal on a practice that isn't Duration
 * any more was retyped, so it's gone too.
 */
export function goalAvailable(goal: Goal, l: Lookup): boolean {
  if (goal.counts === 'Days' && l.type(goal.practice) !== 'Duration') return false
  return (['Bool', 'Int', 'Duration'] as const).some((t) => l.available(goal.practice, t))
}

export function squareState(
  direction: Direction, x: number, n: number, running: boolean, blank: boolean,
): { state: SquareState; fill: number } {
  if (blank && !running) return { state: 'blank', fill: 0 }
  if (direction === 'AtLeast') {
    return x >= n ? { state: 'full', fill: 1 } : { state: 'part', fill: Math.min(x / n, 0.9) }
  }
  if (x === 0) return { state: 'full', fill: 1 }
  if (x > n) return { state: 'over', fill: 0 }
  if (x === n) return { state: 'limit', fill: 0 }
  return { state: 'part', fill: Math.min((n - x) / n, 0.9) }
}

function periodValue(goal: Goal, l: Lookup, from: string, to: string): number {
  const bool = l.type(goal.practice) === 'Bool'
  const days = goal.counts === 'Days' && l.type(goal.practice) === 'Duration'
  let sum = 0
  for (let d = from; d <= to; d = shift(d, 1)) {
    const v = l.value(goal.practice, d) ?? 0
    sum += bool ? (v === 1 ? 1 : 0) : days ? (v > 0 ? 1 : 0) : v
  }
  return sum
}

/** Oldest first; the last square is the running one. */
export function goalSquares(goal: Goal, l: Lookup, logged: Set<string>, todayCob: string): GoalSquare[] {
  const earliest = [...logged].sort().find((d) => l.value(goal.practice, d) !== null)
  const out: GoalSquare[] = []
  let p = periodOf(todayCob, goal.period)
  for (let running = true; out.length < MAX_SQUARES; running = false) {
    const value = periodValue(goal, l, p.from, running ? todayCob : p.to)
    let anyLogged = running
    for (let d = p.from; !anyLogged && d <= p.to; d = shift(d, 1)) anyLogged = logged.has(d)
    out.unshift({ ...p, value, running, ...squareState(goal.direction, value, goal.amount, running, !anyLogged) })
    if (earliest === undefined || earliest >= p.from) break
    p = periodOf(shift(p.from, -1), goal.period)
  }
  return out
}

/** Days to the period's end, today included; null for a Day goal. */
export function daysLeft(square: GoalSquare, todayCob: string): number | null {
  if (square.from === square.to) return null
  return Math.round((fromDateStr(square.to).getTime() - fromDateStr(todayCob).getTime()) / 86400000) + 1
}
