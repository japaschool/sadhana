import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { navItems } from './navItems'
import { AppBackground } from './AppBackground'
import { ToastContainer } from '../ui/Toast'
import { PageTransition } from './PageTransition'
import { SettingsModal } from './SettingsModal'

export function AppShell() {
  const location = useLocation()
  const { t } = useTranslation()
  // Bottom nav shows only on the top-level destinations; sub-pages (which use
  // back/close) don't get it.
  const showBottomNav = navItems.some((n) => n.to === location.pathname)
  // Mobile Insights opens the legacy report editor here; give it a way back.
  const isReportEditor = location.pathname === '/charts/manage'
  return (
    <div className="relative">
      <AppBackground />
      {isReportEditor ? <TopBar showBack title={t('charts.manage')} /> : <TopBar />}
      <main
        className={
          showBottomNav
            ? 'pt-0 sm:pt-14 pb-[calc(64px+env(safe-area-inset-bottom))] sm:pb-0'
            : 'pt-14'
        }
      >
        {/* Keyed remount fades each page in. No AnimatePresence: its sync mode
            kept the previous page mounted during the switch, causing a flash. */}
        <PageTransition key={location.pathname}>
          <Outlet />
        </PageTransition>
      </main>
      {showBottomNav && <BottomNav />}
      <SettingsModal />
      <ToastContainer />
    </div>
  )
}
