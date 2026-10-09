import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLayout } from '../../layouts/useLayout'
import { useShellBackground } from '../../layouts/useShellBackground'
import { AnchoredMenu, MenuItem } from '../../ui/primitives/AnchoredMenu'
import { UiToastContainer } from '../../ui/primitives/Toast'
import { LANGS } from '../settings/sections'

function Mark({ size }: { size: 'sm' | 'lg' }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className={`shrink-0 rounded-full bg-ui-accent-fill ${size === 'sm' ? 'h-[22px] w-[22px]' : 'h-[26px] w-[26px]'}`} />
      <span className={`font-extrabold tracking-[-0.01em] whitespace-nowrap ${size === 'sm' ? 'text-base' : 'text-xl'}`}>Sadhana Pro</span>
    </span>
  )
}

export function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const lang = LANGS.find((l) => l.code === i18n.resolvedLanguage?.slice(0, 2)) ?? LANGS[0]
  return (
    <>
      <button type="button" aria-haspopup="menu" aria-label={`${t('auth.language')}: ${lang.name}`} onClick={(e) => setAnchor(e.currentTarget)}
        className="flex min-h-11 items-center gap-2 px-2 text-[13px] font-semibold text-ui-ink2 sm:text-sm">
        {lang.name}
        <span aria-hidden className="-mt-[3px] h-1.5 w-1.5 rotate-45 border-r-[1.8px] border-b-[1.8px] border-ui-muted" />
      </button>
      {anchor && (
        <AnchoredMenu anchor={anchor} label={t('auth.language')} onClose={() => setAnchor(null)}>
          {LANGS.map((l) => (
            <MenuItem key={l.code} selected={l.code === lang.code} onSelect={() => { setAnchor(null); void i18n.changeLanguage(l.code) }}>
              {l.name}
            </MenuItem>
          ))}
        </AnchoredMenu>
      )}
    </>
  )
}

// A month of saffron days: done, mostly done, a few, missed; the last days are still to come.
const DAYS = '3323133233023332333133323---'.split('')
const DAY_BG: Record<string, string> = { '0': 'bg-ui-heat-0', '1': 'bg-ui-heat-1', '2': 'bg-ui-heat-2', '3': 'bg-ui-heat-3' }

function PracticePanel() {
  const { t } = useTranslation()
  return (
    <aside aria-hidden className="flex w-[600px] shrink-0 flex-col bg-ui-panel px-12 py-11 max-xl:w-[42%]">
      <Mark size="lg" />
      <div className="flex flex-1 flex-col items-center justify-center gap-12">
        <div className="grid grid-cols-[repeat(7,44px)] gap-2.5">
          {DAYS.map((d, i) => (
            <span key={i} className={`h-11 w-11 rounded-xl ${d === '-' ? 'border-[1.5px] border-dashed border-ui-control' : DAY_BG[d]}`} />
          ))}
        </div>
        <div className="flex flex-col items-center">
          <span className="h-[100px] w-[200px] rounded-t-full bg-ui-accent-fill" />
          <span className="mt-2.5 h-2 w-[260px] rounded bg-ui-ink" />
          <span className="mt-2.5 h-2 w-[170px] rounded bg-ui-ink opacity-45" />
          <span className="mt-2.5 h-2 w-[70px] rounded bg-ui-ink opacity-20" />
        </div>
      </div>
      <p className="text-[26px] leading-tight font-bold tracking-[-0.02em] text-balance text-ui-ink2">{t('auth.tagline')}</p>
    </aside>
  )
}

interface AuthFrameProps {
  children: ReactNode
  /** The switch-screen link: pinned low on mobile, under the card on tablet, under the form on desktop. */
  footer?: ReactNode
  /** Signed-out screens offer a language switch; the yatra invite (signed in) doesn't. */
  lang?: boolean
  /** Mobile only: replaces the pinned footer (the invite's Cancel / Join). */
  actions?: ReactNode
}

/** No shell, no tab bar. Mobile: full-screen form. Tablet: a centred card (14k). Desktop: a practice panel beside the form (14s). */
export function AuthFrame({ children, footer, lang = true, actions }: AuthFrameProps) {
  const layout = useLayout()
  const ref = useRef<HTMLDivElement>(null)
  useShellBackground(ref)
  const root = 'ui-root min-h-dvh bg-ui-bg text-ui-ink'

  if (layout === 'mobile') return (
    <div ref={ref} className={`${root} flex flex-col pt-[env(safe-area-inset-top)]`}>
      <header className="flex shrink-0 items-center justify-between pt-3.5 pr-3.5 pl-6">
        <span className="flex min-h-11 items-center"><Mark size="sm" /></span>
        {lang && <LanguageSwitch />}
      </header>
      <main className="flex flex-1 flex-col px-6 pt-7">{children}</main>
      {actions ?? <footer className="min-h-5 shrink-0 px-6 pt-3 pb-[calc(34px+env(safe-area-inset-bottom))]">{footer}</footer>}
      <UiToastContainer />
    </div>
  )

  if (layout === 'tablet') return (
    <div ref={ref} className={`${root} flex flex-col`}>
      <header className="flex justify-center pt-[calc(56px+env(safe-area-inset-top))]"><Mark size="lg" /></header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-12 py-8">
        <div className="w-full max-w-[480px] rounded-[28px] border border-ui-hairline bg-ui-surface p-10 shadow-[0_24px_48px_-32px_rgba(60,40,10,.35)]">
          {children}
        </div>
        {actions ?? footer}
      </main>
      {lang && <footer className="flex justify-center pb-[calc(32px+env(safe-area-inset-bottom))]"><LanguageSwitch /></footer>}
      <UiToastContainer />
    </div>
  )

  return (
    <div ref={ref} className={`${root} flex`}>
      <PracticePanel />
      <div className="flex min-w-0 flex-1 flex-col px-10 pt-7 pb-10">
        <div className="flex min-h-11 justify-end">{lang && <LanguageSwitch />}</div>
        <main className="flex flex-1 flex-col items-center justify-center">
          <div className="flex w-full max-w-[420px] flex-col gap-8">
            {children}
            {actions ?? footer}
          </div>
        </main>
      </div>
      <UiToastContainer />
    </div>
  )
}
