import type { Step } from '../panels/gapLogic'

/** Teal above usual (or earlier), amber below; the strongest steps take light text. */
export function stepStyle(step: Step) {
  if (step === 0) return { background: 'var(--ui-div-0)' }
  const key = `${step > 0 ? 'p' : 'm'}${Math.abs(step)}`
  return { background: `var(--ui-div-${key})`, ...(Math.abs(step) === 3 && { color: `var(--ui-on-div-${key})` }) }
}
