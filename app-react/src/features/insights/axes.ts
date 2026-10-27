import type { PracticeDataType } from '../../types/api'

/** The report's Y axes as the server stores them: Y is Left, Y2 Right, Y3 Left 2, Y4 Right 2, … (as the Yew chart drew them). */
export const AXES = ['Y', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8'] as const
export type Axis = (typeof AXES)[number]

export interface AxisSeries { dataType: PracticeDataType; yAxis: string | null }

export const isLeft = (a: Axis) => AXES.indexOf(a) % 2 === 0
/** 1 for Left/Right, 2 for Left 2/Right 2, … */
export const axisRank = (a: Axis) => Math.floor(AXES.indexOf(a) / 2) + 1
const asAxis = (s: string | null): Axis | null => (AXES as readonly string[]).includes(s ?? '') ? (s as Axis) : null

/** Each series' axis. An unset one is Left (Y), as the Yew chart drew it. */
export function assignAxes(series: AxisSeries[]): Axis[] {
  return series.map((s) => asAxis(s.yAxis) ?? 'Y')
}

/** Where a new series of this type goes: the first axis already holding its type, else the first free one. */
export function landing(series: AxisSeries[], dataType: PracticeDataType): { axis: Axis; shared: boolean } {
  const axes = assignAxes(series)
  const held = AXES.find((a) => series[axes.indexOf(a)]?.dataType === dataType)
  if (held) return { axis: held, shared: true }
  // ponytail: with all 8 axes taken by other types it lands on Left.
  return { axis: AXES.find((a) => !axes.includes(a)) ?? 'Y', shared: false }
}

/** Every series given its axis outright, each landing as if added in order (for All practices, which has no report). */
export function withLandedAxes<T extends AxisSeries>(series: T[]): T[] {
  const out: T[] = []
  for (const s of series) out.push({ ...s, yAxis: landing(out, s.dataType).axis })
  return out
}

/** For the manual picker: who holds each axis apart from series `index`. */
export function axisUse(series: AxisSeries[], index: number): Map<Axis, PracticeDataType> {
  const axes = assignAxes(series)
  const use = new Map<Axis, PracticeDataType>()
  axes.forEach((a, i) => { if (i !== index && !use.has(a)) use.set(a, series[i].dataType) })
  return use
}
