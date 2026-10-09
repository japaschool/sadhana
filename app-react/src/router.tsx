import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter, isRouteErrorResponse, Navigate, useParams, useRouteError } from 'react-router-dom'
import { ProtectedRoute } from './layouts/ProtectedRoute'
import { GuestRoute } from './layouts/GuestRoute'
import { ByLayout, UiLoading } from './layouts/ByLayout'

const TodayMobileScreen = lazy(() => import('./features/today/mobile/TodayMobile').then((m) => ({ default: m.TodayMobileScreen })))
const InsightsMobileScreen = lazy(() => import('./features/insights/mobile/InsightsMobile').then((m) => ({ default: m.InsightsMobileScreen })))
const SettingsMobileScreen = lazy(() => import('./features/settings/mobile/SettingsMobile').then((m) => ({ default: m.SettingsMobileScreen })))
const TodayTabletScreen = lazy(() => import('./features/today/tablet/TodayTablet').then((m) => ({ default: m.TodayTabletScreen })))
const InsightsTabletScreen = lazy(() => import('./features/insights/tablet/InsightsTablet').then((m) => ({ default: m.InsightsTabletScreen })))
const SettingsTabletScreen = lazy(() => import('./features/settings/tablet/SettingsTablet').then((m) => ({ default: m.SettingsTabletScreen })))
const InsightsDesktopScreen = lazy(() => import('./features/insights/desktop/InsightsDesktop').then((m) => ({ default: m.InsightsDesktopScreen })))
const SettingsDesktopScreen = lazy(() => import('./features/settings/desktop/SettingsDesktop').then((m) => ({ default: m.SettingsDesktopScreen })))
const YatrasMobileScreen = lazy(() => import('./features/yatras/mobile/YatrasMobile').then((m) => ({ default: m.YatrasMobileScreen })))
const YatrasTabletScreen = lazy(() => import('./features/yatras/tablet/YatrasTablet').then((m) => ({ default: m.YatrasTabletScreen })))
const YatraSettingsHome = lazy(() => import('./features/yatras/settings/SettingsFrame').then((m) => ({ default: m.YatraSettingsHome })))
const LinkPracticesScreen = lazy(() => import('./features/yatras/settings/mobile/LinkPracticesMobile').then((m) => ({ default: m.LinkPracticesMobile })))
const AdminSectionMobile = lazy(() => import('./features/yatras/settings/mobile/AdminSectionMobile').then((m) => ({ default: m.AdminSectionMobile })))
const ChartEditorMobileScreen = lazy(() => import('./features/insights/settings/mobile/ChartEditorMobile').then((m) => ({ default: m.ChartEditorMobileScreen })))
const ChartEditorWide = lazy(() => import('./features/insights/settings/wide/ChartEditorWide').then((m) => ({ default: m.ChartEditorWide })))
const PracticesMobileScreen = lazy(() => import('./features/practices/mobile/PracticesMobile').then((m) => ({ default: m.PracticesMobileScreen })))
const PracticesWide = lazy(() => import('./features/practices/wide/PracticesWide').then((m) => ({ default: m.PracticesWide })))
const ChartsSettings = lazy(() => import('./features/settings/SettingsLists').then((m) => ({ default: m.ChartsSettings })))
const YatrasSettings = lazy(() => import('./features/settings/SettingsLists').then((m) => ({ default: m.YatrasSettings })))
const PracticeEditorMobile = lazy(() => import('./features/yatras/settings/mobile/PracticeEditorMobile').then((m) => ({ default: m.PracticeEditorMobile })))

/** One screen for every layout: just the loading state while the code arrives. */
const ui = (element: ReactNode) => <Suspense fallback={<UiLoading />}>{element}</Suspense>

/** The chart editor's old URL: it lives under Settings now. */
function ToChartSettings() {
  const { id } = useParams()
  return <Navigate to={`/settings/charts/${id}`} replace />
}

/** Practices' old URL: they live under Settings now. */
function ToPracticeSettings() {
  const { id } = useParams()
  return <Navigate to={`/settings/practices/${id}`} replace />
}

/** The old admin page's URL: its sections are listed on the yatra settings hub now. */
function ToSettingsHub() {
  const { id } = useParams()
  return <Navigate to={`/yatra/${id}/settings`} replace />
}
const YatrasDesktopScreen = lazy(() => import('./features/yatras/desktop/YatrasDesktop').then((m) => ({ default: m.YatrasDesktopScreen })))

function RootError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
    ? error.message
    : 'Something went wrong'
  return (
    <div className="ui-root flex min-h-dvh items-center justify-center bg-ui-bg p-8 text-center text-ui-ink">
      <div>
        <p className="mb-2 text-lg font-semibold text-ui-danger">Something went wrong</p>
        <p className="text-sm text-ui-ink2">{message}</p>
        <button className="mt-4 rounded-xl bg-ui-control px-4 py-2 text-sm font-semibold" onClick={() => window.location.href = '/'}>Go home</button>
      </div>
    </div>
  )
}

// Auth pages, the 404 and the yatra invite share one form kit and frame (features/auth).
const Login = lazy(() => import('./features/auth/Login').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('./features/auth/Register').then((m) => ({ default: m.Register })))
const ConfirmRegistration = lazy(() => import('./features/auth/Register').then((m) => ({ default: m.ConfirmRegistration })))
const ResetRequest = lazy(() => import('./features/auth/Reset').then((m) => ({ default: m.ResetRequest })))
const ResetPassword = lazy(() => import('./features/auth/Reset').then((m) => ({ default: m.ResetPassword })))
const YatraJoin = lazy(() => import('./features/auth/YatraJoin').then((m) => ({ default: m.YatraJoin })))
const NotFound = lazy(() => import('./features/auth/NotFound').then((m) => ({ default: m.NotFound })))
const SharedMobile = lazy(() => import('./features/shared/SharedReports').then((m) => ({ default: m.SharedMobile })))
const SharedTablet = lazy(() => import('./features/shared/SharedReports').then((m) => ({ default: m.SharedTablet })))
const SharedDesktop = lazy(() => import('./features/shared/SharedReports').then((m) => ({ default: m.SharedDesktop })))
const UserDetails = lazy(() => import('./features/settings/UserDetails').then((m) => ({ default: m.UserDetails })))
const ChangePassword = lazy(() => import('./features/settings/ChangePassword').then((m) => ({ default: m.ChangePassword })))
const ImportCsv = lazy(() => import('./features/settings/ImportCsv').then((m) => ({ default: m.ImportCsv })))
const Help = lazy(() => import('./features/settings/Help').then((m) => ({ default: m.Help })))
const SendMessage = lazy(() => import('./features/settings/SendMessage').then((m) => ({ default: m.SendMessage })))

export const router = createBrowserRouter([
  // Guest-only routes
  {
    errorElement: <RootError />,
    element: <GuestRoute />,
    children: [
      { path: '/login', element: ui(<Login />) },
      { path: '/register', element: ui(<Register />) },
      { path: '/register/:id', element: ui(<ConfirmRegistration />) },
      { path: '/reset', element: ui(<ResetRequest />) },
      { path: '/reset/:id', element: ui(<ResetPassword />) },
    ],
  },
  // Authenticated routes
  {
    element: <ProtectedRoute />,
    children: [
      // Each layout renders its own shell. Desktop has no Log screen: the log is a panel beside every screen.
      { path: '/', element: <ByLayout mobile={<TodayMobileScreen />} tablet={<TodayTabletScreen />} desktop={<Navigate to="/charts" replace />} /> },
      { path: '/settings', element: <ByLayout mobile={<SettingsMobileScreen />} tablet={<SettingsTabletScreen />} desktop={<SettingsDesktopScreen />} /> },
      { path: '/charts', element: <ByLayout mobile={<InsightsMobileScreen />} tablet={<InsightsTabletScreen />} desktop={<InsightsDesktopScreen />} /> },
      { path: '/yatras', element: <ByLayout mobile={<YatrasMobileScreen />} tablet={<YatrasTabletScreen />} desktop={<YatrasDesktopScreen />} /> },
      // One screen per layout; Add and Edit are sheets over the list on mobile, a panel beside it on tablet and desktop.
      { path: '/settings/practices', element: <ByLayout mobile={<PracticesMobileScreen />} tablet={<PracticesWide />} desktop={<PracticesWide />} /> },
      { path: '/settings/practices/new', element: <ByLayout mobile={<PracticesMobileScreen />} tablet={<PracticesWide />} desktop={<PracticesWide />} /> },
      { path: '/settings/practices/:id', element: <ByLayout mobile={<PracticesMobileScreen />} tablet={<PracticesWide />} desktop={<PracticesWide />} /> },
      { path: '/user/practices', element: <Navigate to="/settings/practices" replace /> },
      { path: '/user/practice/new', element: <Navigate to="/settings/practices/new" replace /> },
      { path: '/user/practice/:id/edit', element: <ToPracticeSettings /> },
      { path: '/settings/charts', element: ui(<ChartsSettings />) },
      { path: '/settings/yatras', element: ui(<YatrasSettings />) },
      { path: '/charts/:id/edit', element: <ToChartSettings /> },
      { path: '/settings/charts/:id', element: <ByLayout mobile={<ChartEditorMobileScreen />} tablet={<ChartEditorWide />} desktop={<ChartEditorWide />} /> },
      { path: '/yatra/:id/settings', element: ui(<YatraSettingsHome />) },
      { path: '/yatra/:id/links', element: ui(<LinkPracticesScreen />) },
      { path: '/yatra/:id/admin/settings', element: <ToSettingsHub /> },
      { path: '/yatra/:id/admin/:section', element: ui(<AdminSectionMobile />) },
      { path: '/yatra/:id/practice/:practice_id/edit', element: ui(<PracticeEditorMobile />) },
      { path: '/settings/edit-user', element: ui(<UserDetails />) },
      { path: '/settings/edit-password', element: ui(<ChangePassword />) },
      { path: '/settings/import', element: ui(<ImportCsv />) },
      { path: '/help', element: ui(<Help />) },
      { path: '/help/support-form', element: ui(<SendMessage />) },
      { path: '/yatra/:id/join', element: ui(<YatraJoin />) },
    ],
  },
  // Public routes
  { path: '/shared/:id', element: <ByLayout mobile={<SharedMobile />} tablet={<SharedTablet />} desktop={<SharedDesktop />} /> },
  { path: '*', element: ui(<NotFound />) },
])
