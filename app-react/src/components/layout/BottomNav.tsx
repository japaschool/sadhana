import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FaSlidersH, FaPlus, FaSignOutAlt } from 'react-icons/fa'
import { navItems } from './navItems'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { ACCENT, ACCENT_GRADIENT, ACCENT_SHADOW, SURFACE_GLASS, TEXT_FAINT, BORDER } from '../../theme/tokens'

const CENTER_CLASS = 'flex items-center justify-center rounded-full no-underline'
const CENTER_STYLE: React.CSSProperties = {
  width: '52px',
  height: '52px',
  marginTop: '-14px',
  background: ACCENT_GRADIENT,
  boxShadow: `0 4px 20px ${ACCENT_SHADOW}`,
}

function Tab({ to, navKey, icon: Icon, exact, onClick }: (typeof navItems)[number] & { onClick?: () => void }) {
  const { t } = useTranslation()
  return (
    <NavLink
      to={to}
      end={exact}
      onClick={onClick ? (e) => { e.preventDefault(); onClick() } : undefined}
      aria-label={t(`nav.${navKey}`)}
      className="flex-1 flex items-center justify-center min-h-[56px] no-underline"
    >
      {({ isActive }) => (
        <Icon
          className="w-6 h-6 transition-colors"
          style={{ color: isActive ? ACCENT : TEXT_FAINT }}
        />
      )}
    </NavLink>
  )
}

/**
 * Mobile-only bottom navigation. Same four destinations as the desktop TopBar,
 * moved to the bottom on small screens. Matches the app's existing glass/teal
 * aesthetic. Rendered by AppShell only on the top-level routes; `sm:hidden` so
 * desktop keeps the top nav.
 */
export function BottomNav() {
  const { t } = useTranslation()
  const [home, charts, yatras, settings] = navItems
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const requestYatraCreate = useUiStore((s) => s.requestYatraCreate)
  // Center button is context-aware per route:
  //   /charts   → new report
  //   /settings → logout
  //   /yatras   → create new yatra (asks YatrasPage to open its modal)
  //   else      → edit practices
  const onCharts = pathname === '/charts'
  const onSettings = pathname === '/settings'
  const onYatras = pathname === '/yatras'

  let center: React.ReactNode
  if (onSettings) {
    center = (
      <button
        type="button"
        aria-label={t('auth.logout')}
        onClick={() => { logout(); navigate('/login', { replace: true }) }}
        className={CENTER_CLASS}
        style={{ ...CENTER_STYLE, border: 'none', cursor: 'pointer' }}
      >
        <FaSignOutAlt className="w-5 h-5 text-[#101a30]" />
      </button>
    )
  } else if (onYatras) {
    center = (
      <button
        type="button"
        aria-label={t('yatras.createNewYatra')}
        onClick={() => requestYatraCreate()}
        className={CENTER_CLASS}
        style={{ ...CENTER_STYLE, border: 'none', cursor: 'pointer' }}
      >
        <FaPlus className="w-5 h-5 text-[#101a30]" />
      </button>
    )
  } else {
    center = (
      <Link
        to={onCharts ? '/charts/new' : '/user/practices'}
        aria-label={onCharts ? t('charts.newReport') : 'Edit practices'}
        className={CENTER_CLASS}
        style={CENTER_STYLE}
      >
        {onCharts ? <FaPlus className="w-5 h-5 text-[#101a30]" /> : <FaSlidersH className="w-5 h-5 text-[#101a30]" />}
      </Link>
    )
  }

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 sm:hidden flex items-stretch"
      style={{
        background: SURFACE_GLASS,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: `1px solid ${BORDER}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <Tab {...home} />
      <Tab {...charts} />

      {/* Center — context-aware: New report on Charts, Logout on Settings, else Edit practices */}
      <div className="flex-1 flex justify-center items-start">{center}</div>

      <Tab {...yatras} />
      <Tab {...settings} />
    </nav>
  )
}
