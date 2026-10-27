import { useRef } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UiToastContainer } from '../../ui/primitives/Toast'
import { LogPanel } from '../../features/today/desktop/LogPanel'
import { useLogDate } from '../../features/today/useLogDate'
import { useAuthStore } from '../../store/authStore'
import { initials } from '../../ui/initials'
import { TabIcon } from '../TabIcon'
import { TABS, tabActive } from '../tabIcons'
import { useShellBackground } from '../useShellBackground'

function Sidebar() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const name = user?.name ?? ''
  const { pathname } = useLocation()
  return (
    // Below xl the main column gets tight, so the sidebar collapses to the tablet's 88px rail (icon over a small label).
    <nav aria-label={t('today.tabs')}
      className="sticky top-0 flex h-dvh w-[88px] shrink-0 flex-col items-center gap-[22px] border-r border-ui-control py-7 text-ui-faint2 xl:w-[224px] xl:items-stretch xl:gap-1 xl:px-4 xl:text-ui-ink2">
      {/* The Rust app's header lotus, masked so it's the accent colour. */}
      <span aria-hidden className="mb-2 h-10 w-10 shrink-0 self-center bg-ui-accent [mask:url(/logo.png)_center/contain_no-repeat] xl:mb-[18px] xl:h-12 xl:w-12" />
      {/* No Log tab: the log is always open in the right-hand panel. */}
      {TABS.filter((tab) => tab.to !== '/').map((tab) => (
        <NavLink key={tab.to} to={tab.to}
          className={({ isActive }) => `flex flex-col items-center gap-1.5 text-[11px] font-bold xl:flex-row xl:gap-3 xl:rounded-xl xl:px-3 xl:py-2.5 xl:text-sm ${tabActive(tab.to, isActive, pathname) ? 'text-ui-ink xl:bg-ui-accent-pill' : 'xl:font-semibold'}`}>
          {({ isActive }) => {
            const on = tabActive(tab.to, isActive, pathname)
            return (
              <>
                <span className={`flex h-8 w-12 items-center justify-center rounded-full xl:h-auto xl:w-auto ${on ? 'bg-ui-accent-pill text-ui-accent' : 'text-ui-faint2'}`}>
                  <TabIcon d={on ? tab.activeIcon : tab.icon} className="h-6 w-6 xl:h-5 xl:w-5" />
                </span>
                {t(tab.key)}
              </>
            )
          }}
        </NavLink>
      ))}
      <Link to="/settings/edit-user" aria-label={t('settings.userDetails')}
        className="mt-auto flex items-center gap-2.5 xl:rounded-[14px] xl:border xl:border-ui-hairline xl:bg-ui-surface xl:p-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ui-selected text-xs font-extrabold text-ui-on-selected xl:h-8 xl:w-8 xl:text-[11px]">
          {initials(name)}
        </span>
        <span className="hidden min-w-0 flex-col xl:flex">
          <span className="truncate text-[13px] font-bold text-ui-ink">{name}</span>
          <span className="truncate text-[11px] font-medium text-ui-muted">{user?.email}</span>
        </span>
      </Link>
    </nav>
  )
}

/** Desktop frame: sidebar nav, the screen, and the log panel on the right. The screen gets the log's date
 *  (Insights ends its window on it) and can move it (a table row opens its day in the panel).
 *  `log={false}` drops the panel, for screens that need the width (yatra settings). */
export function DesktopShell({ children, log = true }: { children: (logDate: Date, setLogDate: (d: Date) => void) => ReactNode; log?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useShellBackground(ref)
  const [date, setDate] = useLogDate()
  return (
    <div ref={ref} className="ui-root flex min-h-dvh items-start bg-ui-bg">
      <Sidebar />
      <main className="min-w-0 flex-1">{children(date, setDate)}</main>
      {log && <LogPanel date={date} onDate={setDate} />}
      <UiToastContainer />
    </div>
  )
}
