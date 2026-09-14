import { lazy } from 'react'
import { createBrowserRouter, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { GuestRoute } from './components/layout/GuestRoute'

// AppShell is the authenticated layout; lazy-load it so the guest/login
// bundle doesn't pull in the whole nav subtree (TopBar/BottomNav/
// SettingsModal/HeaderMenu) and framer-motion via PageTransition.
const AppShell = lazy(() => import('./components/layout/AppShell').then((m) => ({ default: m.AppShell })))

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
        element: <AppShell />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/charts', element: <ChartsPage /> },
          { path: '/charts/new', element: <NewChartPage /> },
          { path: '/yatras', element: <YatrasPage /> },
          { path: '/yatra/:id/join', element: <YatraJoinPage /> },
          { path: '/yatra/:id/settings', element: <YatraSettingsPage /> },
          { path: '/yatra/:id/admin/settings', element: <YatraAdminSettingsPage /> },
          { path: '/yatra/:id/practice/new', element: <YatraPracticeNewPage /> },
          { path: '/yatra/:id/practice/:practice_id/edit', element: <YatraPracticeEditPage /> },
          { path: '/settings', element: <SettingsPage /> },
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
