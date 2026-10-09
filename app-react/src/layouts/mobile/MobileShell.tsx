import { useRef } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UiToastContainer } from '../../ui/primitives/Toast'
import { TabIcon } from '../TabIcon'
import { TABS, tabActive } from '../tabIcons'
import { useShellBackground } from '../useShellBackground'

function TabBar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  return (
    <nav aria-label={t('today.tabs')}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ui-control bg-ui-tabbar px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] text-ui-faint2">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} aria-label={t(tab.key)} className="flex justify-center">
          {({ isActive }) => {
            const on = tabActive(tab.to, isActive, pathname)
            return (
              <span className={`flex h-11 w-16 items-center justify-center ${on ? 'text-ui-accent' : ''}`}>
                <TabIcon d={on ? tab.activeIcon : tab.icon} className="h-7 w-7" />
              </span>
            )
          }}
        </NavLink>
      ))}
    </nav>
  )
}

/** `tabBar={false}`: a page with its own bar at the bottom (a form's Save). */
export function MobileShell({ children, tabBar = true }: { children: ReactNode; tabBar?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useShellBackground(ref)
  return (
    <div ref={ref} className={`ui-root min-h-dvh bg-ui-bg ${tabBar ? 'pb-[calc(72px+env(safe-area-inset-bottom))]' : ''}`}>
      {children}
      {tabBar && <TabBar />}
      <UiToastContainer />
    </div>
  )
}
