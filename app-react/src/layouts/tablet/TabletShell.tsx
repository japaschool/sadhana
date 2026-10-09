import { useRef } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UiToastContainer } from '../../ui/primitives/Toast'
import { useAuthStore } from '../../store/authStore'
import { initials } from '../../ui/initials'
import { TabIcon } from '../TabIcon'
import { TABS, tabActive } from '../tabIcons'
import { useShellBackground } from '../useShellBackground'

function Rail() {
  const { t } = useTranslation()
  const name = useAuthStore((s) => s.user?.name ?? '')
  const { pathname } = useLocation()
  return (
    <nav aria-label={t('today.tabs')}
      className="fixed inset-y-0 left-0 z-40 flex w-[88px] flex-col items-center gap-[22px] border-r border-ui-control bg-ui-bg pt-[calc(32px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))] text-[11px] font-bold text-ui-faint2">
      {/* The Rust app's header lotus, masked so it's the same colour as the active nav icon. */}
      <span aria-hidden className="mb-2 h-10 w-10 bg-ui-accent [mask:url(/logo.png)_center/contain_no-repeat]" />
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="flex flex-col items-center gap-1.5">
          {({ isActive }) => {
            const on = tabActive(tab.to, isActive, pathname)
            return (
              <>
                <span className={`flex h-8 w-12 items-center justify-center rounded-full ${on ? 'bg-ui-accent-pill text-ui-accent' : ''}`}>
                  <TabIcon d={on ? tab.activeIcon : tab.icon} className="h-6 w-6" />
                </span>
                <span className={on ? 'text-ui-ink' : ''}>{t(tab.key)}</span>
              </>
            )
          }}
        </NavLink>
      ))}
      <Link to="/settings/edit-user" aria-label={t('settings.userDetails')}
        className="mt-auto flex h-10 w-10 items-center justify-center rounded-full bg-ui-selected text-xs font-extrabold text-ui-on-selected">
        {initials(name)}
      </Link>
    </nav>
  )
}

/** Tablet frame: a fixed 88px nav rail on the left, the screen fills the rest. */
export function TabletShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useShellBackground(ref)
  return (
    <div ref={ref} className="ui-root min-h-dvh bg-ui-bg pl-[88px]">
      <Rail />
      {children}
      <UiToastContainer />
    </div>
  )
}
