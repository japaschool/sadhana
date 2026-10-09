import type { TFunction } from 'i18next'
import type { PracticeTrace, TraceType } from '../../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../../types/api'
import { axisRank, isLeft, type Axis } from '../../axes'

export type Style = 'Bar' | 'Line' | 'Dot'
export const styleOf = (type_: TraceType): Style => (typeof type_ === 'object' ? 'Line' : type_)
export const typeOf = (style: Style, was: TraceType): TraceType =>
  style === 'Line' ? (typeof was === 'object' ? was : { Line: { style: 'Regular' } }) : style

/** A new series: times as a line, yes/no and text as dots, amounts as bars; on its type's axis. */
export function newTrace(p: UserPractice): PracticeTrace {
  const dt = p.data_type
  const type_: TraceType = dt === 'Time' ? { Line: { style: 'Regular' } } : dt === 'Bool' || dt === 'Text' ? 'Dot' : 'Bar'
  return { label: null, type_, practice: p.id, y_axis: null, show_average: dt === 'Int' || dt === 'Duration' || dt === 'Time' }
}

export const axisName = (t: TFunction, a: Axis) => {
  const n = axisRank(a)
  if (n === 1) return t(isLeft(a) ? 'chartSettings.axisLeft' : 'chartSettings.axisRight')
  return t(isLeft(a) ? 'chartSettings.axisLeftN' : 'chartSettings.axisRightN', { n })
}
/** "Left axis" / "Ось: левая". */
export const onAxis = (t: TFunction, a: Axis, lang: string) => {
  const axis = axisName(t, a)
  return t('chartSettings.onAxis', { axis, lower: axis.toLocaleLowerCase(lang) })
}
export const kindName = (t: TFunction, dt: PracticeDataType) => t(`chartSettings.kind${dt}`)

export function StyleIcon({ style, className = 'h-4 w-4' }: { style: Style; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`shrink-0 ${className}`} fill="currentColor">
      {style === 'Bar' && <><rect x="2" y="7" width="3" height="7" rx="0.8" /><rect x="6.5" y="3" width="3" height="11" rx="0.8" /><rect x="11" y="5.5" width="3" height="8.5" rx="0.8" /></>}
      {style === 'Line' && <path d="M2 12l4-5 3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      {style === 'Dot' && <><circle cx="3" cy="10" r="1.8" /><circle cx="8" cy="6" r="1.8" /><circle cx="13" cy="8.5" r="1.8" /></>}
    </svg>
  )
}

/** The series' style in its colour, as in the list and the legend. */
export function SeriesTile({ style, color, gone }: { style: Style; color: string; gone?: boolean }) {
  return gone ? (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-ui-faint text-ui-faint"><StyleIcon style={style} /></span>
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
      style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, color }}><StyleIcon style={style} /></span>
  )
}

export function LegendMark({ style, color }: { style: Style; color: string }) {
  if (style === 'Line') return <span aria-hidden className="h-[3px] w-3.5 shrink-0 rounded-full" style={{ background: color }} />
  if (style === 'Dot') return <span aria-hidden className="flex shrink-0 gap-0.5">{[0, 1].map((i) => <span key={i} className="h-1 w-1 rounded-full" style={{ background: color }} />)}</span>
  return <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
}

/** The footer line: "Saved as you edit", or "Not saved" while a save is failing. */
export function SaveDot({ failed, text, t }: { failed: boolean; text: string; t: TFunction }) {
  return (
    <span role="status" className={`flex items-center gap-1.5 text-xs font-semibold ${failed ? 'text-ui-danger' : 'text-ui-muted'}`}>
      <span aria-hidden className={`h-[7px] w-[7px] rounded-full ${failed ? 'bg-ui-danger' : 'bg-ui-good'}`} />{failed ? t('chartSettings.notSaved') : text}
    </span>
  )
}
