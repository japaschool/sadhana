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
  /** The practice names there before the first attempt, so a retry doesn't take what that attempt created for old practices. */
  const existed = useRef<Set<string> | null>(null)

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

  const exit = useCallback((outcome: 'left') => {
    run.end(outcome)
    // From Add practice, the way out is the form for one practice; from sign-up it is Today.
    navigate(firstRun ? '/' : '/settings/practices/new', { replace: true })
  }, [run, navigate, firstRun])
  const finish = () => navigate(firstRun ? '/' : backTo, { replace: true })
  const setUp = KINDS.some((k) => tracked.includes(k) && choices[k])
  const leave = () => (creating === 'done' ? finish() : setUp ? setConfirming(true) : exit('left'))

  return {
    firstRun, carousel, step, exitKey: firstRun ? 'guide.exit' : 'home.addOneMyself', pos, reader, setReader, creating, setCreating, plan, existed, setPos, tracked, skipped, choices, nothing, confirming,
    /** What the plan is built from: only the reports still tracked, so skipping one after its set up drops it (re-tracking brings its values back). */
    chosen: Object.fromEntries(KINDS.map((k) => [k, tracked.includes(k) ? choices[k] : null])) as unknown as Choices,
    /** The first card of a sign-up guide is the start: nowhere to go back to. */
    canBack: !(firstRun && step.at === 'choose' && pos === 0 && !nothing) && creating === null,
    setChoice: <K extends GuideKind>(kind: K, value: Choices[K]) => setChoices((c) => ({ ...c, [kind]: value })),
    toggle, decide,
    next: () => advance(tracked),
    back: goBack,
    /** The system Back. At the start there is no step to go back to, so it means leaving, and asks if anything would be lost. */
    popBack: () => {
      if (confirming) setConfirming(false)
      else if (step.at === 'choose' && pos === 0 && !nothing && (firstRun || setUp)) leave()
      else goBack()
    },
    /** From the nothing-chosen screen: track just this one. */
    pick: (kind: GuideKind) => { setTracked([kind]); setNothing(false); setStep(after({ at: 'choose' }, [kind])) },
    lookAgain: () => { setNothing(false); setPos(0); setSkipped([]) },
    /** "Build my own list", at any step: asks first once a report has been set up. */
    leave,
    keepGoing: () => setConfirming(false),
    confirmLeave: () => exit('left'),
    /** Recorded once, when everything is created, so closing the app on the closing screen still counts. */
    finished: (hasReader?: boolean) => run.end('finished', hasReader),
    /** Leaves the closing screen: navigation only. Sign-up ends on Today; from Add practice it goes back to where it was opened. */
    finish,
    /** Some of it may already exist, so leaving can't promise nothing is saved. */
    partlySaved: plan.current !== null,
  }
}
