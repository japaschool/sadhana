import { useRef } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UiToastContainer } from '../../ui/primitives/Toast'
import { TabIcon } from '../TabIcon'
import { TABS } from '../tabIcons'
import { useShellBackground } from '../useShellBackground'

function TabBar() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('today.tabs')}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ui-control bg-ui-tabbar px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] text-ui-faint2">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} aria-label={t(tab.key)} className="flex justify-center">
          {({ isActive }) => (
            <span className={`flex h-11 w-16 items-center justify-center ${isActive ? 'text-ui-accent' : ''}`}>
              <TabIcon d={isActive ? tab.activeIcon : tab.icon} className="h-7 w-7" />
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function MobileShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useShellBackground(ref)
  return (
    <div ref={ref} className="ui-root min-h-dvh bg-ui-bg pb-[calc(72px+env(safe-area-inset-bottom))]">
      {children}
      <TabBar />
      <UiToastContainer />
    </div>
  )
}
