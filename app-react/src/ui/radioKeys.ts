import type { KeyboardEvent } from 'react'

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

/** Arrow keys on a radiogroup: choose the next or previous option, wrapping, and move focus to it. */
export function onRadioKeys<T extends string>(e: KeyboardEvent<HTMLElement>, values: T[], value: T, onChange: (v: T) => void) {
  const step = STEP[e.key]
  if (!step) return
  e.preventDefault()
  const i = (values.indexOf(value) + step + values.length) % values.length
  onChange(values[i])
  e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[i]?.focus()
}

/** The group is one tab stop: the chosen option, or the first when none is. */
export const radioTabIndex = <T extends string>(values: T[], value: T, v: T) =>
  v === value || (!values.includes(value) && v === values[0]) ? 0 : -1
