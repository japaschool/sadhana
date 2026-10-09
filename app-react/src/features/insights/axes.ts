import type { PracticeDataType } from '../../types/api'

/** The report's Y axes as the server stores them: Y is Left, Y2 Right, Y3 Left 2, Y4 Right 2, … (as the Yew chart drew them). */
export const AXES = ['Y', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8'] as const
export type Axis = (typeof AXES)[number]

export interface AxisSeries { dataType: PracticeDataType; yAxis: string | null }

export const isLeft = (a: Axis) => AXES.indexOf(a) % 2 === 0
/** 1 for Left/Right, 2 for Left 2/Right 2, … */
export const axisRank = (a: Axis) => Math.floor(AXES.indexOf(a) / 2) + 1
const asAxis = (s: string | null): Axis | null => (AXES as readonly string[]).includes(s ?? '') ? (s as Axis) : null

/** Each series' axis. A manual one (yAxis set) keeps its own; an automatic one (null) shares the first axis
 *  holding its type, or takes the first free one. Series on one axis share its scale, so it holds one type. */
export function assignAxes(series: AxisSeries[]): Axis[] {
  const typeOf = new Map<Axis, PracticeDataType>()
  for (const s of series) {
    const a = asAxis(s.yAxis)
    if (a && !typeOf.has(a)) typeOf.set(a, s.dataType)
  }
  return series.map((s) => {
    const manual = asAxis(s.yAxis)
    if (manual) return manual
    const shared = AXES.find((a) => typeOf.get(a) === s.dataType)
    if (shared) return shared
    // ponytail: with all 8 axes taken by other types (only possible through manual picks), it lands on Left.
    const free = AXES.find((a) => !typeOf.has(a)) ?? 'Y'
    typeOf.set(free, s.dataType)
    return free
  })
}

/** Where a new automatic series of this type would land, and the series already there. */
export function landing(series: AxisSeries[], dataType: PracticeDataType): { axis: Axis; shared: boolean } {
  const axes = assignAxes([...series, { dataType, yAxis: null }])
  const axis = axes[axes.length - 1]
  return { axis, shared: axes.slice(0, -1).includes(axis) }
}

/** For the manual picker: who holds each axis apart from series `index`. */
export function axisUse(series: AxisSeries[], index: number): Map<Axis, PracticeDataType> {
  const axes = assignAxes(series)
  const use = new Map<Axis, PracticeDataType>()
  axes.forEach((a, i) => { if (i !== index && !use.has(a)) use.set(a, series[i].dataType) })
  return use
}
