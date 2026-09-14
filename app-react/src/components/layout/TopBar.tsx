import React from 'react'
import { useNavigate, NavLink, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FaChevronLeft } from 'react-icons/fa'
import { LuX } from 'react-icons/lu'
import { navItems } from './navItems'
import { HomeHeaderActions } from './HomeHeaderActions'
import { useUiStore } from '../../store/uiStore'
import { ACCENT_RING, TEXT, BORDER } from '../../theme/tokens'

interface TopBarProps {
  title?: string
  showBack?: boolean
  showClose?: boolean
  right?: React.ReactNode
}

export const TopBar = React.memo(function TopBar({ title, showBack, showClose, right }: TopBarProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const openSettings = useUiStore((s) => s.openSettings)

  const renderNavItem = ({ to, navKey, exact }: (typeof navItems)[number]) => (
    <NavLink
      key={to}
      to={to}
      end={exact}
      onClick={navKey === 'settings' ? (e) => { e.preventDefault(); openSettings() } : undefined}
      aria-label={t(`nav.${navKey}`)}
      className={`h-9 inline-flex items-center px-3 rounded-full text-[12.6px] font-medium transition-colors ${navKey === 'charts' ? 'lg:hidden' : ''}`}
    >
      {({ isActive }) => (
        <span
          className="inline-flex items-center h-9 px-3 rounded-full transition-colors"
          style={{
            color: isActive ? '#ffffff' : 'rgba(255,255,255,0.72)',
            fontWeight: isActive ? 400 : 300,
            border: isActive ? `1px solid ${ACCENT_RING}` : '1px solid transparent',
            background: isActive ? 'rgba(252,211,77,0.08)' : 'transparent',
          }}
        >
          {t(`nav.${navKey}`)}
        </span>
      )}
    </NavLink>
  )

  // Desktop nav: Yatras is reachable via the Yatras ▾ menu, so drop it here.
  const desktopNav = navItems.filter(({ navKey }) => navKey !== 'yatras')
  const homeItem = desktopNav.find(({ navKey }) => navKey === 'home')
  const restItems = desktopNav.filter(({ navKey }) => navKey !== 'home')

  return (
    <header
      className={`fixed top-0 left-0 right-0 h-14 items-center px-4 z-40 gap-3 ${showBack || showClose ? 'flex' : 'hidden sm:flex'}`}
      style={{
        background: 'linear-gradient(180deg, rgba(9,13,18,0.78) 0%, rgba(9,13,18,0.32) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      {showClose ? (
        <button onClick={() => navigate(-1)} aria-label="Close" className="btn btn-ghost btn-sm btn-circle text-base-content/70">
          <LuX className="w-5 h-5" />
        </button>
      ) : showBack ? (
        <button onClick={() => navigate(-1)} aria-label="Go back" className="btn btn-ghost btn-sm btn-circle text-base-content/80">
          <FaChevronLeft className="w-4 h-4" />
        </button>
      ) : (
        <Link to="/" className="flex items-center gap-2 no-underline">
          <img src="/logo.png" className="h-[35px] w-[35px] object-contain" style={{ filter: 'brightness(0) invert(1)' }} alt="Sadhana" />
          <span style={{ fontFamily: "'Allura', cursive", fontSize: '1.9rem', fontWeight: 400, color: TEXT, lineHeight: 1, letterSpacing: '0.03em', marginTop: '4px' }}>Sadhana</span>
        </Link>
      )}

      {(showBack || showClose) && title && (
        <h1 className="font-serif font-semibold text-base text-base-content flex-1">{title}</h1>
      )}

      {!showBack && !showClose && (
        <nav className="ml-auto hidden sm:flex items-center gap-2" aria-label="Main navigation">
          {homeItem && renderNavItem(homeItem)}
          <HomeHeaderActions />
          {restItems.map(renderNavItem)}
        </nav>
      )}

      {right && (
        <div className={(showBack || showClose) ? 'ml-auto' : 'ml-2'}>
          {right}
        </div>
      )}
    </header>
  )
})
