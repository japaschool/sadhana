import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PrimaryButton, SecondaryButton } from '../../auth/kit'
import { KINDS } from '../guideLogic'
import type { GuideKind } from '../guideLogic'
import { GuideFrame } from '../GuideFrame'
import { KindHead } from '../KindHead'
import { MiniReport } from '../MiniReport'
import type { Guide } from '../useGuide'

const GAP = 12
type DotState = 'cur' | 'tracked' | 'skipped' | 'pending'
const DOT: Record<DotState, string> = {
  cur: 'h-2 w-5 rounded bg-ui-ink',
  tracked: 'h-2 w-2 rounded-full bg-ui-accent-fill',
  skipped: 'h-2 w-2 rounded-full border-[1.5px] border-ui-faint',
  pending: 'h-2 w-2 rounded-full bg-ui-control',
}

function Heading() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 px-[22px] pb-3.5">
      <h1 className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em] text-pretty">{t('guide.title')}</h1>
      <p className="text-sm leading-normal text-ui-muted text-pretty">{t('guide.intro')}</p>
    </div>
  )
}

function Dots({ guide, label }: { guide: Guide; label: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-[22px] pb-3">
      <div className="flex items-center gap-3">
        <span className="font-ui-mono text-xs font-semibold text-ui-muted">{label}</span>
        <div className="flex items-center gap-1.5" aria-hidden>
          {KINDS.map((k, i) => {
            const state: DotState = guide.nothing ? 'skipped' : i === guide.pos ? 'cur' : guide.tracked.includes(k) ? 'tracked' : guide.skipped.includes(k) ? 'skipped' : 'pending'
            return <span key={k} data-state={state} className={DOT[state]} />
          })}
        </div>
      </div>
      {guide.tracked.length > 0 && <span className="text-xs font-bold text-ui-muted">{t('guide.chosen', { n: guide.tracked.length })}</span>}
    </div>
  )
}

/** Nothing chosen at the end: pick one, look again, or build your own list. */
function Nothing({ guide }: { guide: Guide }) {
  const { t } = useTranslation()
  return (
    <>
      <Dots guide={guide} label={t('guide.noneChosen')} />
      <div className="flex flex-col gap-3.5 px-4">
        <div className="flex flex-col gap-2 rounded-[20px] border border-ui-accent-pill bg-ui-accent-soft p-[18px]">
          <h2 className="text-lg leading-snug font-extrabold">{t('guide.nothing.title')}</h2>
          <p className="text-sm leading-normal text-ui-ink2 text-pretty">{t('guide.nothing.body')}</p>
        </div>
        <ul className="divide-y divide-ui-hairline overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-surface">
          {KINDS.map((k) => (
            <li key={k} className="flex items-center gap-3 py-3 pr-3 pl-3.5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-extrabold">{t(`guide.kinds.${k}.name`)}</span>
                <span className="text-xs leading-snug text-ui-muted">{t(`guide.kinds.${k}.desc`)}</span>
              </div>
              <button type="button" onClick={() => guide.pick(k)} aria-label={`${t('guide.trackShort')}: ${t(`guide.kinds.${k}.name`)}`}
                className="min-h-9 rounded-[10px] border border-ui-control bg-ui-surface px-3 text-[13px] font-bold">{t('guide.trackShort')}</button>
            </li>
          ))}
        </ul>
        <SecondaryButton onClick={guide.lookAgain}>{t('guide.nothing.again')}</SecondaryButton>
        <button type="button" onClick={guide.leave} className="min-h-[52px] text-base font-bold text-ui-accent">{t('guide.exit')}</button>
      </div>
    </>
  )
}

function Card({ kind, current }: { kind: GuideKind; current: boolean }) {
  return (
    <div className={`w-[min(322px,calc(100vw-56px))] shrink-0 snap-start transition-opacity ${current ? '' : 'opacity-55'}`}>
      <MiniReport kind={kind} compact head={<KindHead kind={kind} />} />
    </div>
  )
}

/** One report at a time, the next peeking. Track and Skip move the same position a swipe does. */
export function ChooseMobile({ guide }: { guide: Guide }) {
  const { t } = useTranslation()
  const strip = useRef<HTMLDivElement>(null)
  const goingTo = useRef<number | null>(null) // set while a Track/Skip scroll is under way, so its own scroll events don't move the position back
  const { pos, setPos, nothing } = guide

  const indexAt = () => {
    const el = strip.current
    const card = el?.firstElementChild as HTMLElement | null
    return el && card ? Math.round(el.scrollLeft / (card.offsetWidth + GAP)) : pos
  }
  // Track/Skip scroll to the new card; `goingTo` keeps that scroll's own events from moving the position back.
  // A touch, the scroll ending, or a moment passing releases it, so it can't stick when a swipe interrupts.
  useEffect(() => {
    const card = strip.current?.children[pos] as HTMLElement | undefined
    if (!card || indexAt() === pos) return
    goingTo.current = pos
    card.scrollIntoView?.({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    const release = setTimeout(() => { goingTo.current = null }, 700)
    return () => clearTimeout(release)
  }, [pos]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = strip.current
    const release = () => { goingTo.current = null }
    el?.addEventListener('scrollend', release)
    return () => el?.removeEventListener('scrollend', release)
  }, [nothing])
  function onScroll() {
    const i = indexAt()
    if (goingTo.current !== null) { if (i === goingTo.current) goingTo.current = null; return }
    if (i !== pos) setPos(Math.min(KINDS.length - 1, Math.max(0, i)))
  }

  if (nothing) return <GuideFrame guide={guide}><Heading /><Nothing guide={guide} /></GuideFrame>
  const kind = KINDS[pos]
  return (
    <GuideFrame guide={guide}>
      <Heading />
      <Dots guide={guide} label={t('guide.position', { a: pos + 1, b: KINDS.length })} />
      <div ref={strip} onScroll={onScroll} onPointerDown={() => { goingTo.current = null }} onTouchStart={() => { goingTo.current = null }} className="flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-[22px] px-[22px] [scrollbar-width:none]">
        {KINDS.map((k, i) => <Card key={k} kind={k} current={i === pos} />)}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2.5 px-[22px] pt-3.5">
        <SecondaryButton onClick={() => guide.decide(kind, false)}>{t('guide.skip')}</SecondaryButton>
        <PrimaryButton type="button" onClick={() => guide.decide(kind, true)}>{t('guide.track')}</PrimaryButton>
      </div>
    </GuideFrame>
  )
}
