import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PrimaryButton } from '../../auth/kit'
import { KINDS } from '../guideLogic'
import type { GuideKind } from '../guideLogic'
import { GuideFrame } from '../GuideFrame'
import { KindHead } from '../KindHead'
import { MiniReport } from '../MiniReport'
import { PickTile } from '../PickTile'
import type { Guide } from '../useGuide'

const GAP = 12
type DotState = 'cur' | 'tracked' | 'pending'
const DOT: Record<DotState, string> = {
  cur: 'h-2 w-5 rounded bg-ui-ink',
  tracked: 'h-2 w-2 rounded-full bg-ui-accent-fill',
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
            const state: DotState = i === guide.pos ? 'cur' : guide.tracked.includes(k) ? 'tracked' : 'pending'
            return <span key={k} data-state={state} className={DOT[state]} />
          })}
        </div>
      </div>
      {guide.tracked.length > 0 && <span className="text-xs font-bold text-ui-muted">{t('guide.chosen', { n: guide.tracked.length })}</span>}
    </div>
  )
}

/** As tall as the strip leaves room for: charts that don't fit whole are left out, the first always shown. */
function Card({ kind, current, guide }: { kind: GuideKind; current: boolean; guide: Guide }) {
  const { t } = useTranslation()
  const on = guide.tracked.includes(kind)
  return (
    <div className={`w-[min(322px,calc(100vw-56px))] shrink-0 snap-start transition-opacity ${current ? '' : 'opacity-55'}`}>
      <PickTile on={on} label={t(`guide.kinds.${kind}.name`)} onToggle={() => guide.toggle(kind)}>
        <MiniReport kind={kind} compact clip on={on} head={<KindHead kind={kind} />} />
      </PickTile>
    </div>
  )
}

/** One report at a time, the next peeking. A tap picks a card; Next goes on once one is picked. */
export function ChooseMobile({ guide }: { guide: Guide }) {
  const { t } = useTranslation()
  const strip = useRef<HTMLDivElement>(null)
  const goingTo = useRef<number | null>(null) // set while a scroll to `pos` (Back from set up) is under way, so its own scroll events don't move the position back
  const { pos, setPos } = guide

  const indexAt = () => {
    const el = strip.current
    const card = el?.firstElementChild as HTMLElement | null
    return el && card ? Math.round(el.scrollLeft / (card.offsetWidth + GAP)) : pos
  }
  // Back from set up scrolls to that report's card; `goingTo` keeps that scroll's own events from moving the position back.
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
  }, [])
  function onScroll() {
    const i = indexAt()
    if (goingTo.current !== null) { if (i === goingTo.current) goingTo.current = null; return }
    if (i !== pos) setPos(Math.min(KINDS.length - 1, Math.max(0, i)))
  }

  return (
    <GuideFrame guide={guide} fill>
      <Heading />
      <Dots guide={guide} label={t('guide.position', { a: pos + 1, b: KINDS.length })} />
      <div ref={strip} onScroll={onScroll} onPointerDown={() => { goingTo.current = null }} onTouchStart={() => { goingTo.current = null }} className="flex min-h-0 flex-1 snap-x snap-mandatory items-stretch gap-3 overflow-x-auto overflow-y-hidden scroll-px-[22px] px-[22px] pt-1 pb-4 [scrollbar-width:none]">
        {KINDS.map((k, i) => <Card key={k} kind={k} current={i === pos} guide={guide} />)}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-ui-hairline bg-ui-tabbar px-4 pt-3 pb-[max(30px,env(safe-area-inset-bottom))]">
        {!guide.tracked.length && <span role="status" className="text-center text-[13px] leading-snug text-ui-muted">{t('guide.chooseOne')}</span>}
        <PrimaryButton type="button" disabled={!guide.tracked.length} onClick={guide.next}>{t('guide.next')}</PrimaryButton>
      </div>
    </GuideFrame>
  )
}
