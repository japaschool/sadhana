import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ToastContainer } from '../../components/ui/Toast'

const TABS = [
  { to: '/', key: 'today.tabToday', icon: 'rounded-[3px]' },
  { to: '/charts', key: 'today.tabInsights', icon: 'rounded-[3px]' },
  { to: '/yatras', key: 'today.tabYatra', icon: 'rounded-full' },
  { to: '/settings', key: 'today.tabSettings', icon: 'rotate-45' },
] as const

function TabBar() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('today.tabs')}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ui-control bg-ui-tabbar px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] text-xs font-semibold text-ui-faint2">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'}
          className={({ isActive }) => `flex flex-col items-center gap-1.5 ${isActive ? 'text-ui-ink' : ''}`}>
          {({ isActive }) => (
            <>
              <span className={`flex h-7 w-11 items-center justify-center rounded-full ${isActive ? 'bg-ui-accent-pill' : ''}`}>
                <span aria-hidden className={`h-2.5 w-2.5 ${tab.icon} ${isActive ? 'bg-ui-accent' : 'border-[1.5px] border-ui-faint2'}`} />
              </span>
              {t(tab.key)}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/** Matches the browser chrome and overscroll area to the shell's background while mounted. */
function useShellBackground(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    const html = document.documentElement
    const prevBg = html.style.backgroundColor
    const apply = () => {
      if (!ref.current) return
      const bg = getComputedStyle(ref.current).getPropertyValue('--ui-bg').trim()
      meta!.content = bg
      html.style.backgroundColor = bg
    }
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    apply()
    scheme.addEventListener('change', apply)
    return () => {
      scheme.removeEventListener('change', apply)
      html.style.backgroundColor = prevBg
      if (created) meta!.remove()
    }
  }, [ref])
}

export function MobileShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useShellBackground(ref)
  return (
    <div ref={ref} className="ui-root min-h-dvh bg-ui-bg pb-[calc(72px+env(safe-area-inset-bottom))]">
      {children}
      <TabBar />
      <ToastContainer />
    </div>
  )
}
