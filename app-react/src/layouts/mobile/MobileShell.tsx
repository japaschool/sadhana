import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ToastContainer } from '../../components/ui/Toast'
import { TAB_ICONS } from './tabIcons'

const TABS = [
  { to: '/', key: 'today.tabLog', icon: TAB_ICONS.edit, activeIcon: TAB_ICONS.editSolid },
  { to: '/charts', key: 'today.tabInsights', icon: TAB_ICONS.graph, activeIcon: TAB_ICONS.graphSolid },
  { to: '/yatras', key: 'today.tabYatra', icon: TAB_ICONS.userGroup, activeIcon: TAB_ICONS.userGroupSolid },
  { to: '/settings', key: 'today.tabSettings', icon: TAB_ICONS.adjust, activeIcon: TAB_ICONS.adjustSolid },
] as const

function TabIcon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 1024 1024" className="h-7 w-7 fill-current">
      <path transform="matrix(1 0 0 -1 0 960)" d={d} />
    </svg>
  )
}

function TabBar() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('today.tabs')}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ui-control bg-ui-tabbar px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] text-ui-faint2">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} aria-label={t(tab.key)} className="flex justify-center">
          {({ isActive }) => (
            <span className={`flex h-11 w-16 items-center justify-center ${isActive ? 'text-ui-accent' : ''}`}>
              <TabIcon d={isActive ? tab.activeIcon : tab.icon} />
            </span>
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
