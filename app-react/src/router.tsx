import { lazy } from 'react'
import { createBrowserRouter, isRouteErrorResponse, Navigate, useParams, useRouteError } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { GuestRoute } from './components/layout/GuestRoute'
import { ByLayout } from './layouts/ByLayout'

// AppShell is the authenticated layout; lazy-load it so the guest/login
// bundle doesn't pull in the whole nav subtree (TopBar/BottomNav/
// SettingsModal/HeaderMenu) and framer-motion via PageTransition.
const AppShell = lazy(() => import('./components/layout/AppShell').then((m) => ({ default: m.AppShell })))
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
const LinkPracticesMobileScreen = lazy(() => import('./features/yatras/settings/mobile/LinkPracticesMobile').then((m) => ({ default: m.LinkPracticesMobileScreen })))
const ManageYatraMobile = lazy(() => import('./features/yatras/settings/mobile/ManageYatraMobile').then((m) => ({ default: m.ManageYatraMobile })))
const AdminSectionMobile = lazy(() => import('./features/yatras/settings/mobile/AdminSectionMobile').then((m) => ({ default: m.AdminSectionMobile })))
const PracticeEditorMobile = lazy(() => import('./features/yatras/settings/mobile/PracticeEditorMobile').then((m) => ({ default: m.PracticeEditorMobile })))

/** The admin sub-pages exist on mobile only; the legacy admin page has every section. */
function ToAdminHub() {
  const { id } = useParams()
  return <Navigate to={`/yatra/${id}/admin/settings`} replace />
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
    <div className="min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <p className="text-lg font-semibold text-error mb-2">Something went wrong</p>
        <p className="text-sm text-base-content/70">{message}</p>
        <button className="btn btn-sm mt-4" onClick={() => window.location.href = '/'}>Go home</button>
      </div>
    </div>
  )
}

// Auth pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })))
const ConfirmationPage = lazy(() => import('./pages/auth/ConfirmationPage').then(m => ({ default: m.ConfirmationPage })))
const PwdResetRequestPage = lazy(() => import('./pages/auth/PwdResetRequestPage').then(m => ({ default: m.PwdResetRequestPage })))
const PwdResetPage = lazy(() => import('./pages/auth/PwdResetPage').then(m => ({ default: m.PwdResetPage })))

// Home
const HomePage = lazy(() => import('./pages/home/HomePage').then(m => ({ default: m.HomePage })))

// Charts
const ChartsPage = lazy(() => import('./pages/charts/ChartsPage').then(m => ({ default: m.ChartsPage })))
const NewChartPage = lazy(() => import('./pages/charts/NewChartPage').then(m => ({ default: m.NewChartPage })))
const SharedChartPage = lazy(() => import('./pages/charts/SharedChartPage').then(m => ({ default: m.SharedChartPage })))

// Yatras
const YatrasPage = lazy(() => import('./pages/yatras/YatrasPage').then(m => ({ default: m.YatrasPage })))
const YatraJoinPage = lazy(() => import('./pages/yatras/YatraJoinPage').then(m => ({ default: m.YatraJoinPage })))
const YatraSettingsPage = lazy(() => import('./pages/yatras/YatraSettingsPage').then(m => ({ default: m.YatraSettingsPage })))
const YatraAdminSettingsPage = lazy(() => import('./pages/yatras/YatraAdminSettingsPage').then(m => ({ default: m.YatraAdminSettingsPage })))
const YatraPracticeNewPage = lazy(() => import('./pages/yatras/YatraPracticeNewPage').then(m => ({ default: m.YatraPracticeNewPage })))
const YatraPracticeEditPage = lazy(() => import('./pages/yatras/YatraPracticeEditPage').then(m => ({ default: m.YatraPracticeEditPage })))

// Settings
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const EditUserPage = lazy(() => import('./pages/settings/EditUserPage').then(m => ({ default: m.EditUserPage })))
const EditPasswordPage = lazy(() => import('./pages/settings/EditPasswordPage').then(m => ({ default: m.EditPasswordPage })))
const LanguagePage = lazy(() => import('./pages/settings/LanguagePage').then(m => ({ default: m.LanguagePage })))
const MyPracticesPage = lazy(() => import('./pages/settings/MyPracticesPage').then(m => ({ default: m.MyPracticesPage })))
const PracticeNewPage = lazy(() => import('./pages/settings/PracticeNewPage').then(m => ({ default: m.PracticeNewPage })))
const PracticeEditPage = lazy(() => import('./pages/settings/PracticeEditPage').then(m => ({ default: m.PracticeEditPage })))
const ImportPage = lazy(() => import('./pages/settings/ImportPage').then(m => ({ default: m.ImportPage })))

// Help
const HelpPage = lazy(() => import('./pages/help/HelpPage').then(m => ({ default: m.HelpPage })))
const SupportPage = lazy(() => import('./pages/help/SupportPage').then(m => ({ default: m.SupportPage })))

// Misc
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

export const router = createBrowserRouter([
  // Guest-only routes
  {
    errorElement: <RootError />,
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/register/:id', element: <ConfirmationPage /> },
      { path: '/reset', element: <PwdResetRequestPage /> },
      { path: '/reset/:id', element: <PwdResetPage /> },
    ],
  },
  // Authenticated routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        // Redesigned layouts render their own shell; the rest fall back to the legacy AppShell.
        // Desktop has no Log screen: the log is a panel beside every screen.
        path: '/',
        element: <ByLayout mobile={<TodayMobileScreen />} tablet={<TodayTabletScreen />} desktop={<Navigate to="/charts" replace />} legacy={<AppShell />} />,
        children: [{ index: true, element: <HomePage /> }],
      },
      {
        path: '/settings',
        element: <ByLayout mobile={<SettingsMobileScreen />} tablet={<SettingsTabletScreen />} desktop={<SettingsDesktopScreen />} legacy={<AppShell />} />,
        children: [{ index: true, element: <SettingsPage /> }],
      },
      {
        path: '/charts',
        element: <ByLayout mobile={<InsightsMobileScreen />} tablet={<InsightsTabletScreen />} desktop={<InsightsDesktopScreen />} legacy={<AppShell />} />,
        children: [{ index: true, element: <ChartsPage /> }],
      },
      {
        path: '/yatras',
        element: <ByLayout mobile={<YatrasMobileScreen />} tablet={<YatrasTabletScreen />} desktop={<YatrasDesktopScreen />} legacy={<AppShell />} />,
        children: [{ index: true, element: <YatrasPage /> }],
      },
      {
        path: '/yatra/:id/settings',
        element: <ByLayout mobile={<LinkPracticesMobileScreen />} legacy={<AppShell />} />,
        children: [{ index: true, element: <YatraSettingsPage /> }],
      },
      {
        path: '/yatra/:id/admin/settings',
        element: <ByLayout mobile={<ManageYatraMobile />} legacy={<AppShell />} />,
        children: [{ index: true, element: <YatraAdminSettingsPage /> }],
      },
      { path: '/yatra/:id/admin/:section', element: <ByLayout mobile={<AdminSectionMobile />} legacy={<ToAdminHub />} /> },
      {
        path: '/yatra/:id/practice/:practice_id/edit',
        element: <ByLayout mobile={<PracticeEditorMobile />} legacy={<AppShell />} />,
        children: [{ index: true, element: <YatraPracticeEditPage /> }],
      },
      {
        element: <AppShell />,
        children: [
          { path: '/charts/manage', element: <ChartsPage /> },
          { path: '/charts/new', element: <NewChartPage /> },
          { path: '/yatra/:id/join', element: <YatraJoinPage /> },
          { path: '/yatra/:id/practice/new', element: <YatraPracticeNewPage /> },
          { path: '/settings/edit-user', element: <EditUserPage /> },
          { path: '/settings/edit-password', element: <EditPasswordPage /> },
          { path: '/settings/language', element: <LanguagePage /> },
          { path: '/settings/import', element: <ImportPage /> },
          { path: '/user/practices', element: <MyPracticesPage /> },
          { path: '/user/practice/new', element: <PracticeNewPage /> },
          { path: '/user/practice/:id/edit', element: <PracticeEditPage /> },
          { path: '/help', element: <HelpPage /> },
          { path: '/help/support-form', element: <SupportPage /> },
        ],
      },
    ],
  },
  // Public routes
  { path: '/shared/:id', element: <SharedChartPage /> },
  { path: '*', element: <NotFoundPage /> },
])
