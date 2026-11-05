import { fromDateStr } from '../../today/date'
import { shift } from './usual'

export interface Run { start: string; end: string; length: number }

const gapDays = (a: string, b: string) => Math.round((fromDateStr(b).getTime() - fromDateStr(a).getTime()) / 864e5)

/** Current run ends today or yesterday; the longest is clipped to this calendar year. */
export function runs(logged: string[], todayCob: string): { current: Run | null; longest: Run | null } {
  const set = new Set(logged)
  const end: string | null = set.has(todayCob) ? todayCob : set.has(shift(todayCob, -1)) ? shift(todayCob, -1) : null
  let current: Run | null = null
  if (end) {
    let start = end
    while (set.has(shift(start, -1))) start = shift(start, -1)
    current = { start, end, length: gapDays(start, end) + 1 }
  }
  let longest: Run | null = null
  let start = ''
  let prev = ''
  const yearStart = `${todayCob.slice(0, 4)}-01-01`
  for (const d of [...logged].filter((x) => x >= yearStart && x <= todayCob).sort()) {
    if (!prev || shift(prev, 1) !== d) start = d
    prev = d
    const length = gapDays(start, d) + 1
    if (!longest || length > longest.length) longest = { start, end: d, length }
  }
  return { current, longest }
}

/** Back after 3+ empty days: logged today or yesterday, with a gap of 3+ empty days right before. */
export function welcomeBack(logged: string[], todayCob: string): boolean {
  const days = [...logged].sort()
  const latest = days[days.length - 1]
  if (!latest || (latest !== todayCob && latest !== shift(todayCob, -1))) return false
  const previous = days[days.length - 2]
  return previous !== undefined && previous <= shift(latest, -4)
}

export function monthCount(logged: string[], month: string): number {
  return logged.filter((d) => d.startsWith(month)).length
}