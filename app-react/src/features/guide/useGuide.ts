import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { KINDS } from './guideLogic'
import type { Choices, GuideKind, GuidePlan } from './guideLogic'
import { useGuideRun } from './useGuideRun'

export type GuideStep = { at: 'choose' } | { at: 'setup'; kind: GuideKind } | { at: 'reader' } | { at: 'finish' }
export type Guide = ReturnType<typeof useGuide>

const NONE: Choices = { sleep: null, count: null, time: null, days: null }
/** `last_step` as the server records it: choose, setup_sleep, setup_count, setup_time, setup_days, reader, creating, finish. */
const stepName = (s: GuideStep, creating: string | null) => (s.at === 'setup' ? `setup_${s.kind}` : s.at === 'finish' && creating !== 'done' ? 'creating' : s.at)

/**
 * The guide's state. `firstRun` (new account) adds the reader question; `back` is where Back from the first
 * card goes when the guide wasn't opened by sign-up. `carousel` is false on the wide grid, where `pos` means nothing.
 */
export function useGuide({ firstRun, back: backTo, carousel = true }: { firstRun: boolean; back: string; carousel?: boolean }) {
  const navigate = useNavigate()
  const run = useGuideRun(firstRun ? 'signup' : 'add_practice')
  const [step, setStep] = useState<GuideStep>({ at: 'choose' })
  const [carouselPos, setPos] = useState(0)
  const pos = carousel ? carouselPos : 0
  const [tracked, setTracked] = useState<GuideKind[]>([])
  const [skipped, setSkipped] = useState<GuideKind[]>([])
  const [choices, setChoices] = useState<Choices>(NONE)
  const [nothing, setNothing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  /** The answer to the reader question: null until given. */
  const [reader, setReader] = useState<boolean | null>(null)
  /** Creating the practices and reports: running or done. Back is gone then, because what was chosen is being saved. */
  const [creating, setCreating] = useState<'running' | 'done' | null>(null)
  /** Built at the first Finish and kept for every retry, so a retry never renames. */
  const plan = useRef<GuidePlan | null>(null)

  // newAccount lasts the whole session; the first-run flag lives on in history state.
  useEffect(() => { useAuthStore.setState({ newAccount: false }) }, [])
  const name = stepName(step, creating)
  useEffect(() => { run.mark(name) }, [run, name])

  const inOrder = (kinds: GuideKind[]) => KINDS.filter((k) => kinds.includes(k))
  /** The step after `from`, given who is tracked. */
  function after(from: GuideStep, list: GuideKind[]): GuideStep {
    const rest = from.at === 'choose' ? list : from.at === 'setup' ? list.slice(list.indexOf(from.kind) + 1) : []
    if (rest.length) return { at: 'setup', kind: rest[0] }
    return from.at !== 'reader' && firstRun ? { at: 'reader' } : { at: 'finish' }
  }

  function advance(list: GuideKind[]) {
    if (step.at === 'choose' && !list.length) { setNothing(true); return }
    setStep(after(step, list))
  }

  function toggle(kind: GuideKind) {
    setTracked((t) => (t.includes(kind) ? t.filter((k) => k !== kind) : inOrder([...t, kind])))
    setSkipped((s) => s.filter((k) => k !== kind))
  }

  /** Track or Skip on the carousel's current card: the same position a swipe moves. */
  function decide(kind: GuideKind, yes: boolean) {
    const list = inOrder(yes ? [...tracked, kind] : tracked.filter((k) => k !== kind))
    setTracked(list)
    setSkipped(inOrder(yes ? skipped.filter((k) => k !== kind) : [...skipped, kind]))
    if (pos < KINDS.length - 1) setPos(pos + 1)
    else advance(list)
  }

  function goBack() {
    const lastSetup: GuideStep = tracked.length ? { at: 'setup', kind: tracked[tracked.length - 1] } : { at: 'choose' }
    if (nothing) setNothing(false)
    else if (step.at === 'choose') { if (pos > 0) setPos(pos - 1); else navigate(backTo) }
    else if (step.at === 'setup') {
      const i = tracked.indexOf(step.kind)
      if (i > 0) setStep({ at: 'setup', kind: tracked[i - 1] })
      else { setStep({ at: 'choose' }); setPos(KINDS.indexOf(step.kind)) }
    } else setStep(step.at === 'finish' && firstRun ? { at: 'reader' } : lastSetup)
  }

  const exit = useCallback((outcome: 'finished' | 'left', hasReader?: boolean) => {
    run.end(outcome, hasReader)
    // ponytail: Task 17 refines where a guide opened from the app ends up.
    navigate(outcome === 'finished' && !firstRun ? backTo : '/', { replace: true })
  }, [run, navigate, firstRun, backTo])

  return {
    firstRun, carousel, step, pos, reader, setReader, creating, setCreating, plan, setPos, tracked, skipped, choices, nothing, confirming,
    /** What the plan is built from: only the reports still tracked, so skipping one after its set up drops it (re-tracking brings its values back). */
    chosen: Object.fromEntries(KINDS.map((k) => [k, tracked.includes(k) ? choices[k] : null])) as unknown as Choices,
    /** The first card of a sign-up guide is the start: nowhere to go back to. */
    canBack: !(firstRun && step.at === 'choose' && pos === 0 && !nothing) && creating === null,
    setChoice: <K extends GuideKind>(kind: K, value: Choices[K]) => setChoices((c) => ({ ...c, [kind]: value })),
    toggle, decide,
    next: () => advance(tracked),
    back: goBack,
    /** From the nothing-chosen screen: track just this one. */
    pick: (kind: GuideKind) => { setTracked([kind]); setNothing(false); setStep(after({ at: 'choose' }, [kind])) },
    lookAgain: () => { setNothing(false); setPos(0); setSkipped([]) },
    /** "Build my own list", at any step: asks first once a report has been set up. */
    leave: () => (creating === 'done' ? exit('finished', reader ?? undefined) : KINDS.some((k) => tracked.includes(k) && choices[k]) ? setConfirming(true) : exit('left')),
    keepGoing: () => setConfirming(false),
    confirmLeave: () => exit('left'),
    finish: (hasReader?: boolean) => exit('finished', hasReader),
  }
}
